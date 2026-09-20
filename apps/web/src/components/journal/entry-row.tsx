import {
  type EntrySummary,
  formatDayMonth,
  formatShortDate,
  plural,
} from "@repo/mongo/shared";
import { Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from "#/components/ui/item";
import { MoodDot } from "./mood-dot";
import { TagLink } from "./tag-link";

interface EntryRowProps {
  entry: EntrySummary;
  /** Show the year too, for lists that span more than one. */
  fullDate?: boolean;
}

/** One page in a list: the date in the margin, the title and a line of it. */
export function EntryRow({ entry, fullDate = false }: EntryRowProps) {
  return (
    <Item
      asChild
      className="-mx-3 items-start gap-4 rounded-lg px-3 py-3.5 transition-colors hover:bg-paper-raised/70"
      size="sm"
    >
      <li>
        <ItemMedia className="w-[74px] justify-start self-start pt-1 sm:w-[84px]">
          <time
            className="text-[12.5px] text-ink-faint tabular-nums"
            dateTime={entry.date}
          >
            {fullDate
              ? formatShortDate(entry.date)
              : formatDayMonth(entry.date)}
          </time>
        </ItemMedia>
        <ItemContent className="gap-1.5">
          <Link
            className="flex flex-col items-start gap-1 no-underline"
            params={{ date: entry.date }}
            to="/entry/$date"
          >
            <span className="flex items-center gap-2 font-serif text-[18px] text-ink leading-snug">
              {entry.title || (
                <span className="text-ink-faint italic">Untitled</span>
              )}
              <MoodDot mood={entry.mood} />
              {entry.mediaCount > 0 ? (
                <Clapperboard
                  aria-label={plural(entry.mediaCount, "clip")}
                  className="size-3.5 text-ink-faint"
                />
              ) : null}
            </span>
            {entry.excerpt ? (
              <ItemDescription className="font-sans text-[14px] text-ink-soft">
                {entry.excerpt}
              </ItemDescription>
            ) : null}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
            <span>{plural(entry.words, "word")}</span>
            {entry.tags.map((tag) => (
              <TagLink key={tag} tag={tag} />
            ))}
          </div>
        </ItemContent>
      </li>
    </Item>
  );
}

/** The list the rows sit in: hairlines between, nothing around. */
export function EntryList({ children }: { children: React.ReactNode }) {
  return <ul className="m-0 list-none divide-y divide-rule p-0">{children}</ul>;
}
