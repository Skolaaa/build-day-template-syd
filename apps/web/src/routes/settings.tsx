import {
  periodKeyFor,
  plural,
  type Shelf,
  VOLUME_PERIODS,
  type VolumePeriod,
} from "@repo/mongo/shared";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { JournalError, Loading } from "#/components/journal/states";
import { Bookcase } from "#/components/shelf/bookcase";
import { useThemeMode } from "#/components/theme-toggle";
import { Button } from "#/components/ui/button";
import { getSettingsPageFn, updateSettingsFn } from "#/server/journal";

export const Route = createFileRoute("/settings")({
  loader: () => getSettingsPageFn(),
  component: SettingsPage,
  pendingComponent: () => <Loading what="settings" />,
  errorComponent: JournalError,
});

const PERIOD_COPY: Record<VolumePeriod, { name: string; note: string }> = {
  month: {
    name: "A month",
    note: "Twelve books a year. Busy months stand out; quiet ones stay thin.",
  },
  week: {
    name: "A week",
    note: "A book for every week. The shelf fills fast and shows the rhythm of a year.",
  },
  year: {
    name: "A year",
    note: "One thick book per year, the way a diary used to be.",
  },
};

const THEMES = [
  { label: "Day", mode: "light" },
  { label: "Night", mode: "dark" },
  { label: "Follow the system", mode: "auto" },
] as const;

function SettingsPage() {
  const { settings, previews, today } = Route.useLoaderData();
  const router = useRouter();
  const [period, setPeriod] = useState<VolumePeriod>(settings.volumePeriod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useThemeMode();
  const preview: Shelf = previews[period];
  const dirty = period !== settings.volumePeriod;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSettingsFn({ data: { volumePeriod: period } });
      await router.invalidate();
      toast(`The shelf is now divided by ${period}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The setting could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page-wrap rise-in px-4 py-10">
      <Link
        className="mb-5 inline-flex items-center gap-1.5 font-serif text-[14px] text-ink-soft no-underline hover:text-accent"
        to="/"
      >
        ← The shelf
      </Link>
      <h1 className="display-title mb-2 text-[clamp(30px,5vw,44px)] text-ink">
        Settings
      </h1>
      <p className="mb-9 max-w-[60ch] text-ink-soft">
        Two things to decide: how long a volume is, and what light to read by.
      </p>

      <section className="mb-12">
        <h2 className="section-heading">What one volume covers</h2>
        <p className="mt-0 mb-5 max-w-[60ch] text-[14.5px] text-ink-soft">
          Pages belong to days, not to books, so changing this reshelves the
          whole journal instantly and loses nothing. Change it back any time.
        </p>
        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-3">
          <legend className="sr-only">Volume length</legend>
          {VOLUME_PERIODS.map((option) => (
            <label
              className={
                period === option
                  ? "panel cursor-pointer border-accent p-4 text-left ring-1 ring-accent"
                  : "panel cursor-pointer p-4 text-left hover:border-rule-strong"
              }
              key={option}
            >
              <input
                checked={period === option}
                className="sr-only"
                name="volumePeriod"
                onChange={() => setPeriod(option)}
                type="radio"
                value={option}
              />
              <span className="block font-serif text-[19px] text-ink">
                {PERIOD_COPY[option].name}
              </span>
              <span className="mt-1 block text-[13px] text-ink-soft leading-relaxed">
                {PERIOD_COPY[option].note}
              </span>
              <span className="mt-2 block text-[12px] text-ink-faint">
                {plural(previews[option].stats.volumes, "volume")} on the shelf
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-6">
          <p className="kicker mb-1">Preview</p>
          {preview.volumes.length === 0 ? (
            <p className="text-[14px] text-ink-faint">
              Write a page and the preview fills in.
            </p>
          ) : (
            <Bookcase
              currentPeriodKey={periodKeyFor(today, period)}
              mini
              volumes={preview.volumes}
            />
          )}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <Button disabled={!dirty || saving} onClick={save} type="button">
            {saving ? "Reshelving…" : "Reshelve"}
          </Button>
          {dirty ? (
            <span className="text-[13px] text-ink-faint">Not saved yet.</span>
          ) : null}
          {error ? (
            <p className="m-0 text-[13px] text-accent" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="section-heading">Light</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((option) => (
            <Button
              aria-pressed={theme === option.mode}
              key={option.mode}
              onClick={() => setTheme(option.mode)}
              type="button"
              variant={theme === option.mode ? "default" : "outline"}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-faint">
          Night is lamplight on the shelf, not white on black.
        </p>
      </section>
    </main>
  );
}
