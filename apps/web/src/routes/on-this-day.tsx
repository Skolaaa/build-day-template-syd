import {
  formatLongDate,
  type OnThisDayHit,
  type VolumePeriod,
} from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, PenLine } from "lucide-react";
import { EntryList, EntryRow } from "#/components/journal/entry-row";
import { EmptyNote, JournalError, Loading } from "#/components/journal/states";
import { BlurFade } from "#/components/motion/blur-fade";
import { PageHeader } from "#/components/page-header";
import { Button } from "#/components/ui/button";
import { getOnThisDayFn } from "#/server/journal";

export const Route = createFileRoute("/on-this-day")({
  loader: () => getOnThisDayFn(),
  component: OnThisDayPage,
  pendingComponent: () => <Loading what="earlier pages" />,
  errorComponent: JournalError,
});

const UNIT: Record<VolumePeriod, string> = {
  month: "month",
  week: "week",
  year: "year",
};

const LOOKS_BACK: Record<VolumePeriod, string> = {
  month: "The same day of the month, in earlier months.",
  week: "The same weekday, in earlier weeks.",
  year: "The same date, in earlier years.",
};

const STAGGER = 0.06;

function ago(periodsAgo: number, period: VolumePeriod): string {
  const unit = UNIT[period];
  if (periodsAgo === 1) {
    return `A ${unit} ago`;
  }
  return `${periodsAgo} ${unit}s ago`;
}

function OnThisDayPage() {
  const { hits, settings, today } = Route.useLoaderData();
  const groups = new Map<number, OnThisDayHit[]>();
  for (const hit of hits) {
    const list = groups.get(hit.periodsAgo) ?? [];
    list.push(hit);
    groups.set(hit.periodsAgo, list);
  }

  return (
    <main className="page-wrap rise-in px-4 py-10">
      <PageHeader
        crumbs={[{ label: "The shelf", to: "/" }, { label: "On this day" }]}
        description={
          <>
            {LOOKS_BACK[settings.volumePeriod]} Change how the shelf is divided
            in{" "}
            <Link
              className="text-ink underline underline-offset-3"
              to="/settings"
            >
              settings
            </Link>{" "}
            and this looks back differently.
          </>
        }
        kicker={formatLongDate(today)}
        title="On this day"
      />

      {hits.length === 0 ? (
        <EmptyNote
          action={
            <Button asChild>
              <Link to="/write">
                <PenLine data-icon="inline-start" />
                Write today
              </Link>
            </Button>
          }
          description={`This page fills in on its own once the journal has some history behind it. Write today and next ${UNIT[settings.volumePeriod]} it will be here.`}
          icon={<CalendarClock />}
          title="Nothing yet"
        />
      ) : (
        <div className="flex flex-col gap-9">
          {[...groups.entries()].map(([periodsAgo, list], index) => (
            <BlurFade delay={index * STAGGER} key={periodsAgo}>
              <section>
                <h2 className="section-heading">
                  {ago(periodsAgo, settings.volumePeriod)}
                </h2>
                <EntryList>
                  {list.map((hit) => (
                    <EntryRow entry={hit} fullDate key={hit.id} />
                  ))}
                </EntryList>
              </section>
            </BlurFade>
          ))}
        </div>
      )}
    </main>
  );
}
