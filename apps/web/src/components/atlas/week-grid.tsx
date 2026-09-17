import { type AtlasWeek, formatCount } from "@repo/mongo/shared";
import { Link } from "@tanstack/react-router";

const WEEKS_IN_YEAR = 53;
const BANDS = 5;

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

/** Four cut points that split the written weeks into five even bands. */
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

/**
 * A life in weeks: one cell per ISO week, one row per year, shaded by how
 * much was written. Empty weeks are the colour of the paper; the eye reads
 * the shape of the years without a single number.
 */
export function WeekGrid({ weeks }: { weeks: AtlasWeek[] }) {
  if (weeks.length === 0) {
    return (
      <p className="m-0 text-[14px] text-ink-faint">Nothing to draw yet.</p>
    );
  }
  const byWeek = new Map(weeks.map((w) => [w.week, w]));
  const cuts = quantileCuts(weeks.map((w) => w.words));
  const years = [...new Set(weeks.map((w) => Number(w.week.slice(0, 4))))];
  const first = Math.min(...years);
  const last = Math.max(...years);
  const rows = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex w-max flex-col gap-[3px]">
        {rows.map((year) => (
          <div className="flex items-center" key={year}>
            <Link
              className="w-11 flex-none text-[11px] text-ink-faint tabular-nums no-underline hover:text-accent"
              params={{ periodKey: String(year) }}
              to="/volume/$periodKey"
            >
              {year}
            </Link>
            <div className="flex gap-[3px]">
              {Array.from({ length: WEEKS_IN_YEAR }, (_, i) => {
                const key = `${year}-W${String(i + 1).padStart(2, "0")}`;
                const week = byWeek.get(key);
                const words = week?.words ?? 0;
                return (
                  <Link
                    aria-label={
                      week
                        ? `${key}: ${formatCount(words)} words`
                        : `${key}: nothing written`
                    }
                    className="week-cell"
                    data-band={bandOf(words, cuts)}
                    key={key}
                    params={{ periodKey: key }}
                    title={week ? `${key} · ${formatCount(words)} words` : key}
                    to="/volume/$periodKey"
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
        less
        {[0, 1, 2, 3, 4, 5].map((band) => (
          <span
            aria-hidden="true"
            className="week-cell"
            data-band={band}
            key={band}
          />
        ))}
        more
      </div>
    </div>
  );
}
