import {
  isVolumePeriod,
  periodKeyFor,
  plural,
  type Shelf,
  VOLUME_PERIODS,
  type VolumePeriod,
} from "@repo/mongo/shared";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { JournalError, Loading } from "#/components/journal/states";
import { PageHeader } from "#/components/page-header";
import { Bookcase } from "#/components/shelf/bookcase";
import { ThemeSwitcher } from "#/components/theme-switcher";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
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

function SettingsPage() {
  const { settings, previews, today } = Route.useLoaderData();
  const router = useRouter();
  const [period, setPeriod] = useState<VolumePeriod>(settings.volumePeriod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview: Shelf = previews[period];
  const dirty = period !== settings.volumePeriod;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSettingsFn({ data: { volumePeriod: period } });
      await router.invalidate();
      toast.success(`The shelf is now divided by ${period}.`);
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
      <PageHeader
        crumbs={[{ label: "The shelf", to: "/" }, { label: "Settings" }]}
        description="Two things to decide: how long a volume is, and what light to read by."
        title="Settings"
      />

      <section className="mb-12">
        <h2 className="section-heading">What one volume covers</h2>
        <p className="mt-0 mb-5 max-w-[60ch] text-[14.5px] text-ink-soft">
          Pages belong to days, not to books, so changing this reshelves the
          whole journal instantly and loses nothing. Change it back any time.
        </p>
        <RadioGroup
          aria-label="Volume length"
          className="grid gap-3 sm:grid-cols-3"
          onValueChange={(value) => {
            if (isVolumePeriod(value)) {
              setPeriod(value);
            }
          }}
          value={period}
        >
          {VOLUME_PERIODS.map((option) => (
            <FieldLabel
              className="bg-paper-raised"
              htmlFor={`period-${option}`}
              key={option}
            >
              <Field orientation="horizontal">
                <RadioGroupItem id={`period-${option}`} value={option} />
                <FieldContent>
                  <FieldTitle className="font-serif text-[19px] text-ink">
                    {PERIOD_COPY[option].name}
                  </FieldTitle>
                  <FieldDescription className="text-[13px] text-ink-soft">
                    {PERIOD_COPY[option].note}
                  </FieldDescription>
                  <span className="mt-1 text-[12px] text-ink-faint">
                    {plural(previews[option].stats.volumes, "volume")} on the
                    shelf
                  </span>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>

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

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button disabled={!dirty || saving} onClick={save} type="button">
            {saving ? "Reshelving…" : "Reshelve"}
          </Button>
          {dirty ? <Badge variant="outline">Not saved yet</Badge> : null}
          {error ? (
            <p className="m-0 text-[13px] text-accent" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="section-heading">Light</h2>
        <ThemeSwitcher labels />
        <p className="mt-3 text-[13px] text-ink-faint">
          Night is lamplight on the shelf, not white on black.
        </p>
      </section>
    </main>
  );
}
