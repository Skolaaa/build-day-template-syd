import {
  parseIsoDate,
  periodRange,
  toIsoDate,
  type VolumePeriod,
} from "@repo/mongo/shared";
import { useNavigate } from "@tanstack/react-router";
import { addDays, format, getDay } from "date-fns";
import type { CSSProperties } from "react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAYS_IN_WEEK = 7;

interface CalendarHeatmapProps {
  /** Words written per day. */
  calendar: Record<string, number>;
  granularity: VolumePeriod;
  periodKey: string;
  today: string;
}

/**
 * The period as a calendar: one cell per day, darker where more was written.
 * A week is a single row, a month a normal calendar, a year twelve small ones.
 */
export function CalendarHeatmap({
  calendar,
  granularity,
  periodKey,
  today,
}: CalendarHeatmapProps) {
  const max = Math.max(1, ...Object.values(calendar));
  if (granularity === "year") {
    const months = Array.from(
      { length: 12 },
      (_, i) => `${periodKey}-${String(i + 1).padStart(2, "0")}`
    );
    return (
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-3 md:grid-cols-4">
        {months.map((month) => (
          <div key={month}>
            <p className="m-0 mb-1.5 text-[11px] text-ink-faint uppercase tracking-[0.1em]">
              {format(parseIsoDate(`${month}-01`), "MMM")}
            </p>
            <MonthGrid
              calendar={calendar}
              max={max}
              periodKey={month}
              showNumbers={false}
              today={today}
            />
          </div>
        ))}
      </div>
    );
  }
  return (
    <MonthGrid
      calendar={calendar}
      max={max}
      periodKey={periodKey}
      showNumbers
      today={today}
    />
  );
}

interface MonthGridProps {
  calendar: Record<string, number>;
  max: number;
  periodKey: string;
  showNumbers: boolean;
  today: string;
}

function MonthGrid({
  calendar,
  max,
  periodKey,
  showNumbers,
  today,
}: MonthGridProps) {
  const navigate = useNavigate();
  const { start, end } = periodRange(periodKey);
  const first = parseIsoDate(start);
  // Monday-first: JS Sunday is 0, so shift it to the end of the week.
  const lead = (getDay(first) + 6) % DAYS_IN_WEEK;
  const days: string[] = [];
  for (let day = first; toIsoDate(day) <= end; day = addDays(day, 1)) {
    days.push(toIsoDate(day));
  }
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days,
  ];

  return (
    <div
      className={
        showNumbers
          ? "grid max-w-[420px] grid-cols-7 gap-1"
          : "grid grid-cols-7 gap-1"
      }
    >
      {WEEKDAYS.map((label, i) => (
        <span
          aria-hidden="true"
          className="text-center text-[10px] text-ink-faint"
          key={`${label}-${String(i)}`}
        >
          {label}
        </span>
      ))}
      {cells.map((date, index) => {
        if (!date) {
          return (
            <span
              className="heat-day"
              data-blank="true"
              key={`blank-${String(index)}`}
            />
          );
        }
        const words = calendar[date] ?? 0;
        const written = words > 0;
        const style = {
          "--fill": written ? 0.25 + 0.75 * (words / max) : 0,
        } as CSSProperties;
        return (
          <button
            aria-label={
              written ? `${date}, ${words} words` : `${date}, nothing written`
            }
            className="heat-day"
            data-today={date === today ? "true" : undefined}
            data-written={written ? "true" : undefined}
            key={date}
            onClick={() => navigate({ params: { date }, to: "/entry/$date" })}
            style={style}
            title={dayTitle(words, date, today)}
            type="button"
          >
            {showNumbers ? Number(date.slice(8)) : ""}
          </button>
        );
      })}
    </div>
  );
}

function dayTitle(words: number, date: string, today: string): string {
  if (words > 0) {
    return `${words} words`;
  }
  return date > today ? "Not yet" : "Nothing written";
}
