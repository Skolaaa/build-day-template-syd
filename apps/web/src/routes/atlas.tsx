import {
  formatCount,
  formatLongDate,
  formatMonthYear,
  MOOD_LABELS,
  plural,
} from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bars, MoodLine, VizCard } from "#/components/atlas/charts";
import {
  GRID_GRANULARITIES,
  GrainPicker,
  LifeGrid,
  useGridGranularity,
} from "#/components/atlas/life-grid";
import { JournalError, Loading } from "#/components/journal/states";
import { StreakLine } from "#/components/journal/streak-line";
import { getAtlasFn } from "#/server/journal";

export const Route = createFileRoute("/atlas")({
  loader: () => getAtlasFn(),
  component: AtlasPage,
  pendingComponent: () => <Loading what="the atlas" />,
  errorComponent: JournalError,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TAGS_SHOWN = 12;
const HOURS_IN_DAY = 24;

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
        <h1 className="display-title mb-3 text-[clamp(30px,5vw,44px)] text-ink">
          The atlas
        </h1>
        <p className="max-w-[52ch] font-serif text-[18px] text-ink-faint">
          A map needs some ground first. Once there are pages on the shelf, this
          reads the whole journal back as a picture.
        </p>
        <Link className="text-accent" to="/write">
          Write today
        </Link>
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
      <Link
        className="mb-5 inline-flex items-center gap-1.5 font-serif text-[14px] text-ink-soft no-underline hover:text-accent"
        to="/"
      >
        ← The shelf
      </Link>
      <h1 className="display-title mb-2 text-[clamp(30px,5vw,44px)] text-ink">
        The atlas
      </h1>
      <p className="mb-8 max-w-[60ch] text-ink-soft">
        The whole journal read back as a picture.
      </p>

      <p className="mb-10 max-w-[58ch] font-serif text-[clamp(20px,2.6vw,26px)] text-ink leading-[1.45]">
        {formatCount(stats.words)} words on {plural(stats.entries, "page")},
        bound into {plural(stats.volumes, "volume")} by {settings.volumePeriod}
        {stats.firstEntry ? (
          <>, starting {formatLongDate(stats.firstEntry)}</>
        ) : null}
        .{" "}
        <span className="text-ink-soft">
          <StreakLine stats={stats} />
        </span>
      </p>

      <div className="flex flex-col gap-6">
        <VizCard
          subtitle="Words per volume, the way the spines show it on the shelf."
          title="Thickness of each volume"
        >
          <Bars
            data={volumes}
            describe={(v) => `${formatCount(v)} words`}
            interval="preserveStartEnd"
          />
        </VizCard>

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

        <div className="grid gap-6 md:grid-cols-2">
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
          <VizCard
            subtitle={
              hasHours
                ? "When pages get started, by the clock you wrote on."
                : "Recorded from now on, as pages are started."
            }
            title="Hour of the day"
          >
            {hasHours ? (
              <Bars
                data={hours}
                describe={(v) => plural(v, "page")}
                interval={Math.floor(HOURS_IN_DAY / 8) - 1}
              />
            ) : null}
          </VizCard>
          <VizCard
            subtitle="Which days of the week get written on."
            title="Days of the week"
          >
            <Bars data={weekdays} describe={(v) => plural(v, "page")} />
          </VizCard>
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
        </div>
      </div>
    </main>
  );
}
