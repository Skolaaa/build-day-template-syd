import {
  formatCount,
  formatLongDate,
  periodKeyFor,
  plural,
  type ShelfStats,
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
          <p className="m-0 max-w-[62ch] font-serif text-[18px] text-ink-soft leading-relaxed">
            {plural(stats.entries, "page")} across{" "}
            {plural(stats.volumes, "volume")}, {formatCount(stats.words)} words
            {stats.firstEntry ? (
              <>, since {formatLongDate(stats.firstEntry)}</>
            ) : null}
            . <RunLine stats={stats} />
          </p>
        )}
      </section>

      {volumes.length === 0 ? (
        <EmptyShelf />
      ) : (
        <>
          <Bookcase currentPeriodKey={currentPeriodKey} volumes={volumes} />

          <nav
            aria-label="From the shelf"
            className="-mt-6 mb-11 flex flex-wrap items-center gap-x-6 gap-y-2"
          >
            <Button asChild variant="outline">
              <Link to="/write">Write today</Link>
            </Button>
            <Link className="nav-link" to="/atlas">
              Read it back as a picture
            </Link>
            <Link className="nav-link" to="/on-this-day">
              On this day
            </Link>
          </nav>

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

/** The streaks, said the way a person would say them. */
function RunLine({ stats }: { stats: ShelfStats }) {
  if (stats.daysWritten === 0) {
    return null;
  }
  const running =
    stats.currentStreak > 1
      ? `${plural(stats.currentStreak, "day")} in a row and counting`
      : null;
  const longest =
    stats.longestStreak > 1
      ? `the longest run was ${plural(stats.longestStreak, "day")}`
      : null;
  const parts = [running, longest].filter((part) => part !== null);
  if (parts.length === 0) {
    return null;
  }
  const line = parts.join("; ");
  return <>{line.charAt(0).toUpperCase() + line.slice(1)}.</>;
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
