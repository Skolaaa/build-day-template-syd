import {
  type AtlasDay,
  type AtlasMonth,
  type AtlasWeek,
  formatCount,
  formatLongDate,
  formatMonthYear,
  parseIsoDate,
  toIsoDate,
} from "@repo/mongo/shared";
import { Link } from "@tanstack/react-router";
import {
  addDays,
  getISOWeek,
  getISOWeekYear,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
} from "date-fns";
import { type ReactNode, useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";

export type GridGranularity = "day" | "week" | "month";

export const GRID_GRANULARITIES: {
  key: GridGranularity;
  label: string;
  title: string;
}[] = [
  { key: "day", label: "days", title: "A life in days" },
  { key: "week", label: "weeks", title: "A life in weeks" },
  { key: "month", label: "months", title: "A life in months" },
];

const STORAGE_KEY = "atlas-grid";
const WEEKS_IN_YEAR = 53;
const DAYS_IN_WEEK = 7;
const WEEKDAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MONTHS_IN_YEAR = 12;
const BANDS = 5;
const MONTH_INITIALS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

/** Which of the five bands a value falls in. 0 means nothing was written. */
function bandOf(value: number, cuts: number[]): number {
  if (value <= 0) {
    return 0;
  }
  let band = 1;
  for (const cut of cuts) {
    if (value > cut) {
      band += 1;
    }
  }
  return Math.min(band, BANDS);
}

/** Four cut points that split the written cells into five even bands. */
function quantileCuts(values: number[]): number[] {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return [];
  }
  return [1, 2, 3, 4].map(
    (i) =>
      sorted[
        Math.min(sorted.length - 1, Math.floor((sorted.length * i) / BANDS))
      ] ?? 0
  );
}

function isGranularity(value: unknown): value is GridGranularity {
  return value === "day" || value === "week" || value === "month";
}

/**
 * The reader's last choice of grain, kept in the browser. It is read after
 * mount so the server and the first client render agree.
 */
export function useGridGranularity(): [
  GridGranularity,
  (next: GridGranularity) => void,
] {
  const [granularity, setGranularity] = useState<GridGranularity>("week");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isGranularity(stored)) {
        setGranularity(stored);
      }
    } catch {
      // Private windows and blocked storage fall back to the default.
    }
  }, []);
  const choose = (next: GridGranularity) => {
    setGranularity(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembering the choice is fine.
    }
  };
  return [granularity, choose];
}

interface GrainPickerProps {
  onChange: (next: GridGranularity) => void;
  value: GridGranularity;
}

/** Days, weeks or months: how fine the grid is cut, as one segmented control. */
export function GrainPicker({ value, onChange }: GrainPickerProps) {
  return (
    <ToggleGroup
      aria-label="Grain of the grid"
      onValueChange={(next) => {
        if (isGranularity(next)) {
          onChange(next);
        }
      }}
      size="sm"
      spacing={0}
      type="single"
      value={value}
      variant="outline"
    >
      {GRID_GRANULARITIES.map((option) => (
        <ToggleGroupItem
          aria-label={option.title}
          className="px-3 text-[12.5px] text-ink-faint data-[state=on]:bg-paper-sunk data-[state=on]:text-ink"
          key={option.key}
          value={option.key}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

interface LifeGridProps {
  days: AtlasDay[];
  granularity: GridGranularity;
  months: AtlasMonth[];
  today: string;
  weeks: AtlasWeek[];
}

/**
 * The journal as a grid of cells, one per day, week or month, shaded by how
 * much was written. Empty cells are the colour of the paper; the eye reads
 * the shape of the years without a single number.
 */
export function LifeGrid({
  days,
  weeks,
  months,
  granularity,
  today,
}: LifeGridProps) {
  if (days.length === 0) {
    return (
      <p className="m-0 text-[14px] text-ink-faint">Nothing to draw yet.</p>
    );
  }
  if (granularity === "day") {
    return <DayGrid days={days} today={today} />;
  }
  if (granularity === "month") {
    return <MonthGrid months={months} today={today} />;
  }
  return <WeekGrid today={today} weeks={weeks} />;
}

/** The year a sorted key starts with; 0 when there is no such key. */
function yearOf(key: string | undefined): number {
  return key ? Number(key.slice(0, 4)) : 0;
}

function yearsBetween(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

function Legend() {
  return (
    <div className="mt-3.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
      less
      {[0, 1, 2, 3, 4, 5].map((band) => (
        <span
          aria-hidden="true"
          className="life-cell"
          data-band={band}
          key={band}
        />
      ))}
      more
    </div>
  );
}

interface CellProps {
  band: number;
  children?: ReactNode;
  /** Past the present: drawn as air rather than empty paper. */
  future?: boolean;
  label: string;
  /** Where the cell opens; a cell for a day with no page goes nowhere. */
  to: { params: Record<string, string>; to: string } | null;
}

function Cell({ band, label, to, future = false, children }: CellProps) {
  if (future) {
    return (
      <span aria-hidden="true" className="life-cell" data-missing="true" />
    );
  }
  if (!to) {
    return (
      <span
        aria-label={label}
        className="life-cell"
        data-band={band}
        role="img"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      aria-label={label}
      className="life-cell"
      data-band={band}
      params={to.params}
      title={label}
      to={to.to}
    >
      {children}
    </Link>
  );
}

/** One row per year, one column per ISO week. */
function WeekGrid({ weeks, today }: { today: string; weeks: AtlasWeek[] }) {
  const byWeek = new Map(weeks.map((w) => [w.week, w]));
  const cuts = quantileCuts(weeks.map((w) => w.words));
  const todayDate = parseIsoDate(today);
  const thisWeek = `${getISOWeekYear(todayDate)}-W${String(getISOWeek(todayDate)).padStart(2, "0")}`;
  const rows = yearsBetween(yearOf(weeks[0]?.week), yearOf(weeks.at(-1)?.week));

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex w-max flex-col gap-[3px]">
        {rows.map((year) => (
          <div className="flex items-center" key={year}>
            <YearLabel year={year} />
            <div className="flex gap-[3px]">
              {Array.from({ length: WEEKS_IN_YEAR }, (_, i) => {
                const key = `${year}-W${String(i + 1).padStart(2, "0")}`;
                const week = byWeek.get(key);
                const words = week?.words ?? 0;
                return (
                  <Cell
                    band={bandOf(words, cuts)}
                    future={key > thisWeek}
                    key={key}
                    label={
                      week
                        ? `${key}: ${formatCount(words)} words`
                        : `${key}: nothing written`
                    }
                    to={{
                      params: { periodKey: key },
                      to: "/volume/$periodKey",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Legend />
    </div>
  );
}

/** One row per year, one cell per month, with the month's initial inside. */
function MonthGrid({ months, today }: { months: AtlasMonth[]; today: string }) {
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const cuts = quantileCuts(months.map((m) => m.words));
  const thisMonth = today.slice(0, 7);
  const rows = yearsBetween(
    yearOf(months[0]?.month),
    yearOf(months.at(-1)?.month)
  );

  return (
    <div className="life-grid-months overflow-x-auto pb-1">
      <div className="flex w-max flex-col gap-[4px]">
        {rows.map((year) => (
          <div className="flex items-center" key={year}>
            <YearLabel year={year} />
            <div className="flex gap-[4px]">
              {Array.from({ length: MONTHS_IN_YEAR }, (_, i) => {
                const key = `${year}-${String(i + 1).padStart(2, "0")}`;
                const month = byMonth.get(key);
                const words = month?.words ?? 0;
                return (
                  <Cell
                    band={bandOf(words, cuts)}
                    future={key > thisMonth}
                    key={key}
                    label={
                      month
                        ? `${formatMonthYear(key)}: ${formatCount(words)} words`
                        : `${formatMonthYear(key)}: nothing written`
                    }
                    to={{
                      params: { periodKey: key },
                      to: "/volume/$periodKey",
                    }}
                  >
                    <span aria-hidden="true">{MONTH_INITIALS[i]}</span>
                  </Cell>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Legend />
    </div>
  );
}

/**
 * The familiar one: a block per year, a column per ISO week, a row per
 * weekday. A day belongs to the block of its ISO week-year, so the last
 * days of December can sit in the next year's first column.
 */
function DayGrid({ days, today }: { days: AtlasDay[]; today: string }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cuts = quantileCuts(days.map((d) => d.words));
  // Rows arrive sorted, so the ends give the range; the ISO week-year can
  // differ from the calendar year by one at either end of December.
  const [first] = days;
  const last = days.at(-1);
  const blocks = yearsBetween(
    first ? getISOWeekYear(parseIsoDate(first.date)) : 0,
    last ? getISOWeekYear(parseIsoDate(last.date)) : 0
  );

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex w-max flex-col gap-4">
        {blocks.map((year) => (
          <YearBlock
            byDate={byDate}
            cuts={cuts}
            key={year}
            today={today}
            year={year}
          />
        ))}
      </div>
      <Legend />
    </div>
  );
}

interface YearBlockProps {
  byDate: Map<string, AtlasDay>;
  cuts: number[];
  today: string;
  year: number;
}

function YearBlock({ year, byDate, cuts, today }: YearBlockProps) {
  // Monday of ISO week 1 of this year.
  const start = startOfISOWeek(
    setISOWeek(setISOWeekYear(parseIsoDate(`${year}-06-01`), year), 1)
  );
  const columns = Array.from({ length: WEEKS_IN_YEAR }, (_, week) =>
    addDays(start, week * DAYS_IN_WEEK)
  ).filter((monday) => getISOWeekYear(monday) === year);

  // A month initial above the first column whose Monday falls in it.
  const monthAt = new Map<number, string>();
  let seen = -1;
  for (const [i, monday] of columns.entries()) {
    const month = monday.getMonth();
    if (month !== seen) {
      monthAt.set(i, MONTH_INITIALS[month] ?? "");
      seen = month;
    }
  }

  return (
    <div className="flex">
      <div className="pt-[15px]">
        <YearLabel year={year} />
      </div>
      <div className="flex flex-col gap-[3px]">
        <div className="flex h-[12px] gap-[3px] text-[10px] text-ink-faint">
          {columns.map((monday, i) => (
            <span className="life-cell life-cell-label" key={toIsoDate(monday)}>
              {monthAt.get(i) ?? ""}
            </span>
          ))}
        </div>
        {WEEKDAY_NAMES.map((name, weekday) => (
          <div className="flex gap-[3px]" key={name}>
            {columns.map((monday) => {
              const date = toIsoDate(addDays(monday, weekday));
              const day = byDate.get(date);
              const words = day?.words ?? 0;
              return (
                <Cell
                  band={bandOf(words, cuts)}
                  future={date > today}
                  key={date}
                  label={
                    day
                      ? `${formatLongDate(date)}: ${formatCount(words)} words`
                      : `${formatLongDate(date)}: nothing written`
                  }
                  to={day ? { params: { date }, to: "/entry/$date" } : null}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function YearLabel({ year }: { year: number }) {
  return (
    <Link
      className="block w-11 flex-none text-[11px] text-ink-faint tabular-nums no-underline hover:text-accent"
      params={{ periodKey: String(year) }}
      to="/volume/$periodKey"
    >
      {year}
    </Link>
  );
}
