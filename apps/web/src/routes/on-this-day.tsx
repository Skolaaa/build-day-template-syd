import {
  formatLongDate,
  type OnThisDayHit,
  type VolumePeriod,
} from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EntryRow } from "#/components/journal/entry-row";
import { JournalError, Loading } from "#/components/journal/states";
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
      <Link
        className="mb-5 inline-flex items-center gap-1.5 font-serif text-[14px] text-ink-soft no-underline hover:text-accent"
        to="/"
      >
        ← The shelf
      </Link>
      <p className="kicker mb-2">{formatLongDate(today)}</p>
      <h1 className="display-title mb-2 text-[clamp(30px,5vw,44px)] text-ink">
        On this day
      </h1>
      <p className="mb-9 max-w-[60ch] text-ink-soft">
        {LOOKS_BACK[settings.volumePeriod]} Change how the shelf is divided in
        settings and this looks back differently.
      </p>

      {hits.length === 0 ? (
        <p className="max-w-[52ch] font-serif text-[18px] text-ink-faint">
          Nothing yet. This page fills in on its own once the journal has some
          history behind it; write today and next {UNIT[settings.volumePeriod]}{" "}
          it will be here.
        </p>
      ) : (
        <div className="flex flex-col gap-9">
          {[...groups.entries()].map(([periodsAgo, list]) => (
            <section key={periodsAgo}>
              <h2 className="section-heading">
                {ago(periodsAgo, settings.volumePeriod)}
              </h2>
              <ul className="m-0 list-none p-0">
                {list.map((hit) => (
                  <EntryRow entry={hit} fullDate key={hit.id} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
