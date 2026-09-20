import {
  formatMonthYear,
  formatShortDate,
  MOOD_LABELS,
  plural,
} from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, PenLine } from "lucide-react";
import { Bars, MoodLine, VizCard } from "#/components/atlas/charts";
import {
  GRID_GRANULARITIES,
  GrainPicker,
  LifeGrid,
  useGridGranularity,
} from "#/components/atlas/life-grid";
import { StatTiles } from "#/components/journal/stat-tiles";
import { EmptyNote, JournalError, Loading } from "#/components/journal/states";
import { BlurFade } from "#/components/motion/blur-fade";
import { PageHeader } from "#/components/page-header";
import { Button } from "#/components/ui/button";
import { getAtlasFn } from "#/server/journal";

export const Route = createFileRoute("/atlas")({
  loader: () => getAtlasFn(),
  component: AtlasPage,
  pendingComponent: () => <Loading what="the atlas" />,
  errorComponent: JournalError,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TAGS_SHOWN = 12;
const CARD_STAGGER = 0.05;
const CRUMBS = [
  { label: "The shelf", to: "/" as const },
  { label: "The atlas" },
];

/** "9am", "midnight": an hour as a person says it. */
function hourLabel(hour: number): string {
  if (hour === 0) {
    return "midnight";
  }
  if (hour === 12) {
    return "noon";
  }
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function moodWord(value: number): string {
  const nearest = Math.min(5, Math.max(1, Math.round(value))) as
    | 1
    | 2
    | 3
    | 4
    | 5;
  return `${value.toFixed(1)} · ${MOOD_LABELS[nearest]}`;
}

function AtlasPage() {
  const { atlas, settings, today } = Route.useLoaderData();
  const { stats } = atlas;
  const [grain, setGrain] = useGridGranularity();

  if (stats.entries === 0) {
    return (
      <main className="page-wrap rise-in px-4 py-10">
        <PageHeader
          crumbs={CRUMBS}
          description="The whole journal read back as a picture."
          title="The atlas"
        />
        <EmptyNote
          action={
            <Button asChild>
              <Link to="/write">
                <PenLine data-icon="inline-start" />
                Write today
              </Link>
            </Button>
          }
          description="A map needs some ground first. Once there are pages on the shelf, this reads the whole journal back as a picture."
          icon={<Compass />}
          title="Nothing to draw yet"
        />
      </main>
    );
  }

  const volumes = atlas.volumes.map((v) => ({
    label: v.title,
    value: v.words,
  }));
  const months = atlas.months.map((m) => ({
    label: formatMonthYear(m.month),
    value: m.mood,
  }));
  const hours = atlas.hours.map((count, hour) => ({
    label: hourLabel(hour),
    value: count,
  }));
  const weekdays = atlas.weekdays.map((count, i) => ({
    label: WEEKDAYS[i] ?? "",
    value: count,
  }));
  const tags = atlas.tags
    .slice(0, TAGS_SHOWN)
    .map((t) => ({ label: t.tag, value: t.count }));
  const hasMoods = atlas.months.some((m) => m.mood !== null);
  const hasHours = atlas.hours.some((h) => h > 0);

  return (
    <main className="page-wrap rise-in px-4 py-10">
      <PageHeader
        crumbs={CRUMBS}
        description="The whole journal read back as a picture."
        title="The atlas"
      />

      <section className="mb-10">
        <StatTiles
          stats={[
            {
              hint: `on ${plural(stats.entries, "page")}`,
              label: "Words",
              value: stats.words,
            },
            {
              hint: `bound by ${settings.volumePeriod}`,
              label: "Volumes",
              value: stats.volumes,
            },
            {
              hint: stats.firstEntry
                ? `since ${formatShortDate(stats.firstEntry)}`
                : undefined,
              label: "Days written",
              value: stats.daysWritten,
            },
            {
              hint: "days in a row",
              label: "Longest run",
              value: stats.longestStreak,
            },
          ]}
        />
      </section>

      <div className="flex flex-col gap-6">
        <BlurFade>
          <VizCard
            subtitle="Words per volume, the way the spines show it on the shelf."
            title="Thickness of each volume"
          >
            <Bars
              data={volumes}
              describe={(v) => `${formatCountWords(v)}`}
              interval="preserveStartEnd"
            />
          </VizCard>
        </BlurFade>

        <BlurFade delay={CARD_STAGGER}>
          <VizCard
            aside={<GrainPicker onChange={setGrain} value={grain} />}
            subtitle={`One cell per ${grain}, darker where more was written.`}
            title={
              GRID_GRANULARITIES.find((g) => g.key === grain)?.title ??
              "A life in weeks"
            }
          >
            <LifeGrid
              days={atlas.days}
              granularity={grain}
              months={atlas.months}
              today={today}
              weeks={atlas.weeks}
            />
          </VizCard>
        </BlurFade>

        <div className="grid gap-6 md:grid-cols-2">
          <BlurFade>
            <VizCard
              subtitle={
                hasMoods
                  ? "The average of what you said you felt, month by month."
                  : "Mark how days felt and this fills in."
              }
              title="Mood by month"
            >
              {hasMoods ? <MoodLine data={months} describe={moodWord} /> : null}
            </VizCard>
          </BlurFade>
          <BlurFade delay={CARD_STAGGER}>
            <VizCard
              subtitle={
                hasHours
                  ? "When pages get started, by the clock you wrote on."
                  : "Recorded from now on, as pages are started."
              }
              title="Hour of the day"
            >
              {hasHours ? (
                <Bars data={hours} describe={(v) => plural(v, "page")} />
              ) : null}
            </VizCard>
          </BlurFade>
          <BlurFade>
            <VizCard
              subtitle="Which days of the week get written on."
              title="Days of the week"
            >
              <Bars data={weekdays} describe={(v) => plural(v, "page")} />
            </VizCard>
          </BlurFade>
          <BlurFade delay={CARD_STAGGER}>
            <VizCard
              subtitle="The tags that come up most."
              title="What it keeps coming back to"
            >
              {tags.length > 0 ? (
                <Bars data={tags} describe={(v) => plural(v, "page")} />
              ) : (
                <p className="m-0 text-[14px] text-ink-faint">No tags yet.</p>
              )}
            </VizCard>
          </BlurFade>
        </div>
      </div>
    </main>
  );
}

function formatCountWords(value: number): string {
  return plural(value, "word");
}
