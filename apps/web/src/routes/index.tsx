import {
  formatCount,
  formatLongDate,
  periodKeyFor,
  plural,
} from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EntryRow } from "#/components/journal/entry-row";
import { EmptyShelf, JournalError, Loading } from "#/components/journal/states";
import { TagLink } from "#/components/journal/tag-link";
import { Bookcase } from "#/components/shelf/bookcase";
import { Button } from "#/components/ui/button";
import { getShelfFn } from "#/server/journal";

export const Route = createFileRoute("/")({
  loader: () => getShelfFn(),
  component: ShelfPage,
  pendingComponent: () => <Loading what="the shelf" />,
  errorComponent: JournalError,
});

function ShelfPage() {
  const data = Route.useLoaderData();
  if (!data.signedIn) {
    return <Invitation />;
  }

  const { shelf, settings, today, recent, tags } = data;
  const { stats, volumes } = shelf;
  const currentPeriodKey = periodKeyFor(today, settings.volumePeriod);

  return (
    <main className="page-wrap rise-in px-4 pt-12 pb-8">
      <section className="mb-8">
        <h1 className="display-title mb-2 text-[clamp(30px,5vw,44px)] text-ink">
          The shelf
        </h1>
        {stats.entries === 0 ? null : (
          <>
            <p className="m-0 max-w-[60ch] text-ink-soft">
              {plural(stats.entries, "entry", "entries")} across{" "}
              {plural(stats.volumes, "volume")}, {formatCount(stats.words)}{" "}
              words.
              {stats.firstEntry ? (
                <> The first was {formatLongDate(stats.firstEntry)}.</>
              ) : null}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {stats.currentStreak > 0 ? (
                <Chip warm>{plural(stats.currentStreak, "day")} running</Chip>
              ) : null}
              <Chip>longest run: {plural(stats.longestStreak, "day")}</Chip>
              <Chip>{plural(stats.daysWritten, "day")} written on</Chip>
            </div>
          </>
        )}
      </section>

      {volumes.length === 0 ? (
        <EmptyShelf />
      ) : (
        <>
          <Bookcase currentPeriodKey={currentPeriodKey} volumes={volumes} />

          <div className="-mt-6 mb-11 flex flex-wrap gap-2.5">
            <Button asChild variant="outline">
              <Link to="/write">Write today</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/atlas">A life in numbers</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/on-this-day">On this day</Link>
            </Button>
          </div>

          <div className="grid items-start gap-11 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section>
              <h2 className="section-heading">Last written</h2>
              {recent.length > 0 ? (
                <ul className="m-0 list-none p-0">
                  {recent.map((entry) => (
                    <EntryRow entry={entry} fullDate key={entry.id} />
                  ))}
                </ul>
              ) : (
                <p className="text-[14.5px] text-ink-faint">Nothing yet.</p>
              )}
            </section>

            {tags.length > 0 ? (
              <section>
                <h2 className="section-heading">
                  What it keeps coming back to
                </h2>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {tags.map(({ tag, count }) => (
                    <li key={tag}>
                      <TagLink count={count} large tag={tag} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}

function Chip({
  children,
  warm = false,
}: {
  children: React.ReactNode;
  warm?: boolean;
}) {
  return (
    <span
      className={
        warm
          ? "rounded-full border border-accent bg-paper-raised px-3 py-0.5 text-[12.5px] text-accent"
          : "rounded-full border border-rule bg-paper-raised px-3 py-0.5 text-[12.5px] text-ink-soft"
      }
    >
      {children}
    </span>
  );
}

/** Signed out. No marketing, just the door. */
function Invitation() {
  return (
    <main className="page-wrap rise-in flex min-h-[calc(100vh-13rem)] items-center px-4 py-12">
      <section className="max-w-[54ch]">
        <p className="kicker mb-4">A journal</p>
        <h1 className="display-title mb-5 text-[clamp(34px,6vw,54px)] text-ink">
          Life on a Shelf
        </h1>
        <p className="mb-3 font-serif text-[19px] text-ink-soft leading-relaxed">
          Write a page a day. Each week, month or year becomes a book, and the
          shelf fills up: thicker spines where you had more to say, thin ones
          where you didn't. From across the room you can see the shape of a year
          before you read a word of it.
        </p>
        <p className="mb-8 text-[15px] text-ink-faint">
          Private by design. Words and video, kept for you alone.
        </p>
        <Button asChild size="lg">
          <Link to="/login">Sign in to your shelf</Link>
        </Button>
      </section>
    </main>
  );
}
