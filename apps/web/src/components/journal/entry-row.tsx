import {
  type EntrySummary,
  formatDayMonth,
  formatShortDate,
  plural,
} from "@repo/mongo/shared";
import { Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { MoodDot } from "./mood-dot";
import { TagLink } from "./tag-link";

interface EntryRowProps {
  entry: EntrySummary;
  /** Show the year too, for lists that span more than one. */
  fullDate?: boolean;
}

export function EntryRow({ entry, fullDate = false }: EntryRowProps) {
  return (
    <li className="entry-row flex gap-4 py-3.5">
      <time
        className="w-[74px] flex-none pt-1 text-[12.5px] text-ink-faint tabular-nums"
        dateTime={entry.date}
      >
        {fullDate ? formatShortDate(entry.date) : formatDayMonth(entry.date)}
      </time>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          className="-m-1 flex flex-col items-start gap-1 rounded-sm p-1 text-left no-underline hover:bg-paper-raised"
          params={{ date: entry.date }}
          to="/entry/$date"
        >
          <span className="flex items-center gap-2 font-serif text-[18px] text-ink">
            {entry.title || (
              <span className="text-ink-faint italic">Untitled</span>
            )}
            <MoodDot mood={entry.mood} />
            {entry.mediaCount > 0 ? (
              <Clapperboard
                aria-label={plural(entry.mediaCount, "clip")}
                className="h-3.5 w-3.5 text-ink-faint"
              />
            ) : null}
          </span>
          {entry.excerpt ? (
            <span className="line-clamp-2 text-[14px] text-ink-soft leading-relaxed">
              {entry.excerpt}
            </span>
          ) : null}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
          <span>{plural(entry.words, "word")}</span>
          {entry.tags.map((tag) => (
            <TagLink key={tag} tag={tag} />
          ))}
        </div>
      </div>
    </li>
  );
}
