import {
  periodLabel,
  SPINE_PALETTE,
  VOLUME_SUBTITLE_MAX_LENGTH,
  VOLUME_TITLE_MAX_LENGTH,
} from "@repo/mongo/shared";
import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { setVolumeMetaFn } from "#/server/journal";

interface CoverEditorProps {
  color: string;
  onDone: () => void;
  periodKey: string;
  subtitle: string | null;
  title: string;
}

/** Title, subtitle and cloth colour for a volume, saved inline. */
export function CoverEditor({
  periodKey,
  title: initialTitle,
  subtitle: initialSubtitle,
  color: initialColor,
  onDone,
}: CoverEditorProps) {
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setVolumeMetaFn({ data: { color, periodKey, subtitle, title } });
      await router.invalidate();
      onDone();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The cover could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="panel mb-7 grid items-end gap-4 p-5 sm:grid-cols-2"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-1.5">
        <label className="kicker" htmlFor={`${id}-title`}>
          Title
        </label>
        <Input
          className="font-serif text-[16px]"
          id={`${id}-title`}
          maxLength={VOLUME_TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={periodLabel(periodKey)}
          value={title}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="kicker" htmlFor={`${id}-subtitle`}>
          Subtitle
        </label>
        <Input
          className="font-serif text-[16px] italic"
          id={`${id}-subtitle`}
          maxLength={VOLUME_SUBTITLE_MAX_LENGTH}
          onChange={(event) => setSubtitle(event.target.value)}
          placeholder="optional"
          value={subtitle}
        />
      </div>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0 sm:col-span-2">
        <legend className="kicker mb-1.5">Cloth</legend>
        <div className="flex flex-wrap gap-1.5">
          {SPINE_PALETTE.map((swatch) => (
            <label
              className="swatch"
              data-selected={color === swatch ? "true" : undefined}
              key={swatch}
              style={{ background: swatch }}
              title={swatch}
            >
              <input
                checked={color === swatch}
                className="sr-only"
                name="color"
                onChange={() => setColor(swatch)}
                type="radio"
                value={swatch}
              />
              <span className="sr-only">{swatch}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button disabled={saving} size="sm" type="submit">
          {saving ? "Saving…" : "Save the cover"}
        </Button>
        <Button onClick={onDone} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        {error ? (
          <p className="m-0 text-[13px] text-accent" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
