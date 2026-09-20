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
import { ChevronLeft, ChevronRight, Palette, PenLine } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { CalendarHeatmap } from "#/components/journal/calendar-heatmap";
import { EntryList, EntryRow } from "#/components/journal/entry-row";
import { type Stat, StatTiles } from "#/components/journal/stat-tiles";
import { JournalError, Loading } from "#/components/journal/states";
import { BlurFade } from "#/components/motion/blur-fade";
import { PageBreadcrumb } from "#/components/page-header";
import { Button } from "#/components/ui/button";
import { ButtonGroup } from "#/components/ui/button-group";
import { CoverEditorDialog } from "#/components/volume/cover-editor";
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

const GROUP_STAGGER = 0.05;

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageBreadcrumb
          crumbs={[
            { label: "The shelf", to: "/" },
            { label: periodLabel(volume.periodKey) },
          ]}
        />
        <ButtonGroup aria-label="Neighbouring volumes">
          <Button asChild size="sm" variant="outline">
            <Link params={{ periodKey: previous }} to="/volume/$periodKey">
              <ChevronLeft data-icon="inline-start" />
              {periodLabel(previous)}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link params={{ periodKey: next }} to="/volume/$periodKey">
              {periodLabel(next)}
              <ChevronRight data-icon="inline-end" />
            </Link>
          </Button>
        </ButtonGroup>
      </div>

      <VolumePlate
        isCurrent={isCurrent}
        onName={() => setNaming(true)}
        shelfPeriod={settings.volumePeriod}
        volume={volume}
      />

      <CoverEditorDialog
        color={volume.color}
        entries={volume.entries}
        onOpenChange={setNaming}
        open={naming}
        periodKey={volume.periodKey}
        subtitle={volume.subtitle}
        title={volume.named ? volume.title : ""}
      />

      <BlurFade>
        <section className="panel mb-10 grid gap-8 p-5 md:grid-cols-2 md:items-start">
          <div className="min-w-0">
            <h2 className="section-heading">Days written</h2>
            <div className="overflow-x-auto pb-1">
              <CalendarHeatmap
                calendar={calendar}
                granularity={volume.granularity}
                periodKey={volume.periodKey}
                today={today}
              />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="section-heading">In figures</h2>
            <StatTiles className="sm:grid-cols-2" stats={figuresFor(volume)} />
          </div>
        </section>
      </BlurFade>

      {entries.length === 0 ? null : (
        <div className="flex flex-col gap-8">
          {groups.map((group, index) => (
            <BlurFade delay={index * GROUP_STAGGER} key={group.label ?? "all"}>
              <section>
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
                <EntryList>
                  {group.entries.map((entry) => (
                    <EntryRow entry={entry} key={entry.id} />
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

function figuresFor(volume: Volume): Stat[] {
  const span =
    volume.firstEntry && volume.lastEntry
      ? `${formatShortDate(volume.firstEntry)}${
          volume.firstEntry === volume.lastEntry
            ? ""
            : ` to ${formatShortDate(volume.lastEntry)}`
        }`
      : undefined;
  return [
    { label: "Pages", value: volume.entries },
    { label: "Words", value: volume.words },
    { label: "Clips", value: volume.mediaCount },
    { hint: span, label: "Days written", value: volume.daysWritten },
  ];
}

interface VolumePlateProps {
  isCurrent: boolean;
  onName: () => void;
  shelfPeriod: VolumePeriod;
  volume: Volume;
}

/** The title plate on the volume's cover. */
function VolumePlate({
  volume,
  isCurrent,
  onName,
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
      <p className="mt-3.5 mb-3 text-[13.5px] text-ink-faint leading-7">
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
        <Button onClick={onName} size="sm" type="button" variant="outline">
          <Palette data-icon="inline-start" />
          {volume.named ? "Rename or recolour" : "Name this volume"}
        </Button>
        {isCurrent ? (
          <Button asChild size="sm">
            <Link to="/write">
              <PenLine data-icon="inline-start" />
              Write today
            </Link>
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

function VolumeSummary({ volume }: { volume: Volume }) {
  return (
    <>
      {plural(volume.entries, "page")} · {formatCount(volume.words)} words
      {volume.mediaCount > 0 ? ` · ${plural(volume.mediaCount, "clip")}` : ""}
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
