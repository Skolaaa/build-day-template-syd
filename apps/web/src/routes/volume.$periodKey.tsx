import {
  type EntrySummary,
  formatCount,
  formatMonthYear,
  formatShortDate,
  isPeriodKey,
  periodKeyFor,
  periodLabel,
  periodRangeLabel,
  plural,
  shiftPeriodKey,
  type Volume,
  type VolumePeriod,
} from "@repo/mongo/shared";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { type CSSProperties, useState } from "react";
import { CalendarHeatmap } from "#/components/journal/calendar-heatmap";
import { EntryRow } from "#/components/journal/entry-row";
import { JournalError, Loading } from "#/components/journal/states";
import { Button } from "#/components/ui/button";
import { CoverEditor } from "#/components/volume/cover-editor";
import { getVolumeFn } from "#/server/journal";

export const Route = createFileRoute("/volume/$periodKey")({
  loader: ({ params }) => {
    if (!isPeriodKey(params.periodKey)) {
      throw notFound();
    }
    return getVolumeFn({ data: { periodKey: params.periodKey } });
  },
  component: VolumePage,
  pendingComponent: () => <Loading what="the volume" />,
  errorComponent: JournalError,
  notFoundComponent: () => (
    <main className="page-wrap px-4 py-12">
      <p className="text-ink-soft">There is no volume by that name.</p>
    </main>
  ),
});

function VolumePage() {
  const { volume, entries, calendar, settings, today } = Route.useLoaderData();
  const [naming, setNaming] = useState(false);
  const isCurrent =
    periodKeyFor(today, volume.granularity) === volume.periodKey;
  const previous = shiftPeriodKey(volume.periodKey, -1);
  const next = shiftPeriodKey(volume.periodKey, 1);
  const groups =
    volume.granularity === "year"
      ? byMonth(entries)
      : [{ entries, label: null }];

  return (
    <main className="page-wrap rise-in px-4 py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="inline-flex items-center gap-1.5 font-serif text-[14px] text-ink-soft no-underline hover:text-accent"
          to="/"
        >
          ← The shelf
        </Link>
        <div className="flex gap-3 text-[13px]">
          <Link
            className="text-ink-faint no-underline hover:text-accent"
            params={{ periodKey: previous }}
            to="/volume/$periodKey"
          >
            ← {periodLabel(previous)}
          </Link>
          <Link
            className="text-ink-faint no-underline hover:text-accent"
            params={{ periodKey: next }}
            to="/volume/$periodKey"
          >
            {periodLabel(next)} →
          </Link>
        </div>
      </div>

      <VolumePlate
        isCurrent={isCurrent}
        naming={naming}
        onToggleNaming={() => setNaming((v) => !v)}
        shelfPeriod={settings.volumePeriod}
        volume={volume}
      />

      {naming ? (
        <CoverEditor
          color={volume.color}
          onDone={() => setNaming(false)}
          periodKey={volume.periodKey}
          subtitle={volume.subtitle}
          title={volume.named ? volume.title : ""}
        />
      ) : null}

      <section className="panel mb-10 overflow-x-auto p-5">
        <CalendarHeatmap
          calendar={calendar}
          granularity={volume.granularity}
          periodKey={volume.periodKey}
          today={today}
        />
      </section>

      {entries.length === 0 ? null : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.label ?? "all"}>
              {group.label ? (
                <h2 className="m-0 mb-1.5 flex items-baseline justify-between gap-3 border-rule border-b pb-2 font-serif text-[22px] text-ink">
                  {group.label}
                  <span className="font-sans text-[12px] text-ink-faint uppercase tracking-[0.06em]">
                    {plural(group.entries.length, "page")}
                  </span>
                </h2>
              ) : (
                <h2 className="section-heading">Pages, newest first</h2>
              )}
              <ul className="m-0 list-none p-0">
                {group.entries.map((entry) => (
                  <EntryRow entry={entry} key={entry.id} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

interface VolumePlateProps {
  isCurrent: boolean;
  naming: boolean;
  onToggleNaming: () => void;
  shelfPeriod: VolumePeriod;
  volume: Volume;
}

/** The title plate on the volume's cover. */
function VolumePlate({
  volume,
  isCurrent,
  naming,
  onToggleNaming,
  shelfPeriod,
}: VolumePlateProps) {
  const style = { "--volume-color": volume.color } as CSSProperties;
  const label = periodLabel(volume.periodKey);
  return (
    <header className="volume-plate mb-7" style={style}>
      <p className="m-0 text-[12px] text-ink-faint tabular-nums tracking-[0.24em]">
        {(volume.named
          ? label
          : periodRangeLabel(volume.periodKey)
        ).toUpperCase()}
      </p>
      <h1 className="display-title mt-1 mb-0 text-[clamp(30px,5vw,46px)] text-ink">
        {volume.title}
      </h1>
      {volume.subtitle ? (
        <p className="mt-1.5 mb-0 font-serif text-[18px] text-ink-soft italic">
          {volume.subtitle}
        </p>
      ) : null}
      <p className="mt-3.5 mb-2 text-[13.5px] text-ink-faint leading-7">
        {volume.entries === 0 ? (
          emptyLine(isCurrent)
        ) : (
          <VolumeSummary volume={volume} />
        )}
        {volume.granularity === shelfPeriod ? null : (
          <>
            {" "}
            · The shelf is now divided by {shelfPeriod}; this is a{" "}
            {volume.granularity}.
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onToggleNaming}
          size="sm"
          type="button"
          variant="outline"
        >
          {namingLabel(naming, volume.named)}
        </Button>
        {isCurrent ? (
          <Button asChild size="sm">
            <Link to="/write">Write today</Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function emptyLine(isCurrent: boolean): string {
  return isCurrent
    ? "Unopened. Today's page would be its first."
    : "Nothing was written in this volume.";
}

function namingLabel(naming: boolean, named: boolean): string {
  if (naming) {
    return "Close";
  }
  return named ? "Rename or recolour" : "Name this volume";
}

function VolumeSummary({ volume }: { volume: Volume }) {
  const span =
    volume.firstEntry && volume.lastEntry
      ? ` · ${formatShortDate(volume.firstEntry)}${
          volume.firstEntry === volume.lastEntry
            ? ""
            : ` to ${formatShortDate(volume.lastEntry)}`
        }`
      : "";
  return (
    <>
      {plural(volume.entries, "page")} · {formatCount(volume.words)} words
      {volume.mediaCount > 0 ? ` · ${plural(volume.mediaCount, "clip")}` : ""}
      {span}
    </>
  );
}

function byMonth(
  entries: EntrySummary[]
): { entries: EntrySummary[]; label: string | null }[] {
  const groups = new Map<string, EntrySummary[]>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const list = groups.get(month) ?? [];
    list.push(entry);
    groups.set(month, list);
  }
  return [...groups.entries()].map(([month, list]) => ({
    entries: list,
    label: formatMonthYear(month),
  }));
}
