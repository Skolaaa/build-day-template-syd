import {
  formatCount,
  formatLongDate,
  periodKeyFor,
  plural,
} from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, MapIcon, Settings2 } from "lucide-react";
import { EntryList, EntryRow } from "#/components/journal/entry-row";
import { EmptyShelf, JournalError, Loading } from "#/components/journal/states";
import { StreakLine } from "#/components/journal/streak-line";
import { TagLink } from "#/components/journal/tag-link";
import { BlurFade } from "#/components/motion/blur-fade";
import { PageHeader } from "#/components/page-header";
import { Bookcase } from "#/components/shelf/bookcase";
import { SavedShelfOrderToggle } from "#/components/shelf/order-toggle";
import { Button } from "#/components/ui/button";
import { Welcome } from "#/components/welcome";
import { getShelfFn } from "#/server/journal";

export const Route = createFileRoute("/")({
  loader: () => getShelfFn(),
  component: ShelfPage,
  pendingComponent: () => <Loading what="the shelf" />,
  errorComponent: JournalError,
});

const TAGS_DELAY = 0.08;

function ShelfPage() {
  const data = Route.useLoaderData();
  if (!data.signedIn) {
    return <Welcome />;
  }

  const { shelf, settings, today, recent, tags } = data;
  const { stats, volumes } = shelf;
  const currentPeriodKey = periodKeyFor(today, settings.volumePeriod);

  return (
    <main className="page-wrap rise-in px-4 pt-10 pb-8">
      <PageHeader
        actions={
          volumes.length > 0 ? (
            <SavedShelfOrderToggle settings={settings} />
          ) : undefined
        }
        className="mb-6"
        description={
          stats.entries === 0 ? undefined : (
            <>
              {plural(stats.entries, "page")} across{" "}
              {plural(stats.volumes, "volume")}, {formatCount(stats.words)}{" "}
              words
              {stats.firstEntry ? (
                <>, since {formatLongDate(stats.firstEntry)}</>
              ) : null}
              . <StreakLine stats={stats} />
            </>
          )
        }
        descriptionClassName="font-serif text-[18px]"
        title="The shelf"
      />

      {volumes.length === 0 ? (
        <EmptyShelf />
      ) : (
        <>
          <Bookcase
            currentPeriodKey={currentPeriodKey}
            order={settings.shelfOrder}
            volumes={volumes}
          />

          <nav
            aria-label="From the shelf"
            className="-mt-5 mb-11 flex flex-wrap items-center gap-2"
          >
            <Button asChild size="sm" variant="outline">
              <Link to="/atlas">
                <MapIcon data-icon="inline-start" />
                Read it back as a picture
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/on-this-day">
                <CalendarClock data-icon="inline-start" />
                On this day
              </Link>
            </Button>
            <Button
              asChild
              className="text-ink-faint"
              size="sm"
              variant="ghost"
            >
              <Link to="/settings">
                <Settings2 data-icon="inline-start" />
                Bind by week, month or year
              </Link>
            </Button>
          </nav>

          <div className="grid items-start gap-11 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <BlurFade>
              <section>
                <h2 className="section-heading">Last written</h2>
                {recent.length > 0 ? (
                  <EntryList>
                    {recent.map((entry) => (
                      <EntryRow entry={entry} fullDate key={entry.id} />
                    ))}
                  </EntryList>
                ) : (
                  <p className="text-[14.5px] text-ink-faint">Nothing yet.</p>
                )}
              </section>
            </BlurFade>

            {tags.length > 0 ? (
              <BlurFade delay={TAGS_DELAY}>
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
              </BlurFade>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
