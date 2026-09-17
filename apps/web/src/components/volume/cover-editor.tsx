import {
  granularityOf,
  HEX_COLOR,
  periodLabel,
  SPINE_INK_DARK,
  SPINE_PALETTE,
  spineFoilFor,
  spineHeight,
  spineInkFor,
  spineThickness,
  VOLUME_SUBTITLE_MAX_LENGTH,
  VOLUME_TITLE_MAX_LENGTH,
} from "@repo/mongo/shared";
import { useRouter } from "@tanstack/react-router";
import { type CSSProperties, type FormEvent, useId, useState } from "react";
import { SpineFace } from "#/components/shelf/spine";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { setVolumeMetaFn } from "#/server/journal";

interface CoverEditorProps {
  color: string;
  entries: number;
  onDone: () => void;
  periodKey: string;
  subtitle: string | null;
  title: string;
}

const PREVIEW_HEIGHT_SCALE = 0.8;

/** Title, subtitle and cloth colour for a volume, saved inline. */
export function CoverEditor({
  periodKey,
  entries,
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
  // The hex field is free text while typing; the cloth only follows it once
  // it is a whole colour, so the preview never flashes through half-typed ones.
  const [hexDraft, setHexDraft] = useState(initialColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickColor = (next: string) => {
    const lower = next.toLowerCase();
    setColor(lower);
    setHexDraft(lower);
  };

  const onHexChange = (raw: string) => {
    const next = raw.startsWith("#") ? raw : `#${raw}`;
    setHexDraft(next);
    if (HEX_COLOR.test(next)) {
      setColor(next.toLowerCase());
    }
  };

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

  const custom = !(SPINE_PALETTE as readonly string[]).includes(color);

  return (
    <form
      className="panel mb-7 grid gap-x-6 gap-y-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)]"
      onSubmit={submit}
    >
      <SpinePreview
        color={color}
        entries={entries}
        periodKey={periodKey}
        title={title.trim()}
      />

      <div className="grid content-start gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="kicker mb-1.5">Cloth</legend>
          <div className="flex flex-wrap items-end gap-1.5">
            {SPINE_PALETTE.map((swatch) => (
              <label
                className="swatch"
                data-selected={color === swatch ? "true" : undefined}
                key={swatch}
                style={{ "--swatch": swatch } as CSSProperties}
                title={swatch}
              >
                <input
                  checked={color === swatch}
                  className="sr-only"
                  name="color"
                  onChange={() => pickColor(swatch)}
                  type="radio"
                  value={swatch}
                />
                <span className="sr-only">{swatch}</span>
              </label>
            ))}
            <label
              className="swatch swatch-custom"
              data-selected={custom ? "true" : undefined}
              style={
                { "--swatch": custom ? color : "transparent" } as CSSProperties
              }
              title="Any other colour"
            >
              <input
                aria-label="Pick any other colour"
                onChange={(event) => pickColor(event.target.value)}
                type="color"
                value={color}
              />
            </label>
            <label
              className="ml-2 flex items-center gap-1.5 text-[12px] text-ink-faint"
              htmlFor={`${id}-hex`}
            >
              <span>or</span>
              <Input
                aria-label="Colour as a hex value"
                className="h-8 w-[7.5em] font-mono text-[12.5px] tabular-nums"
                id={`${id}-hex`}
                maxLength={7}
                onChange={(event) => onHexChange(event.target.value)}
                spellCheck={false}
                value={hexDraft}
              />
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
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
      </div>
    </form>
  );
}

interface SpinePreviewProps {
  color: string;
  entries: number;
  periodKey: string;
  /** Empty when the volume is unnamed; the period is stamped instead. */
  title: string;
}

/** The book as it will stand on the shelf, redrawn as the cover changes. */
function SpinePreview({ color, entries, periodKey, title }: SpinePreviewProps) {
  const ink = spineInkFor(color);
  const style = {
    "--spine-color": color,
    "--spine-height": `${Math.round(spineHeight(periodKey) * PREVIEW_HEIGHT_SCALE)}px`,
    "--spine-ink": ink,
    "--spine-width": `${spineThickness(entries)}px`,
  } as CSSProperties;
  const volume = {
    color,
    daysWritten: 0,
    entries,
    firstEntry: null,
    granularity: granularityOf(periodKey),
    lastEntry: null,
    mediaCount: 0,
    named: title.length > 0,
    periodKey,
    subtitle: null,
    title: title || periodLabel(periodKey),
    words: 0,
  };
  return (
    <div aria-hidden="true" className="spine-preview">
      <div className="spine-preview-books">
        <div
          className="spine"
          data-foil={spineFoilFor(color)}
          data-ink={ink === SPINE_INK_DARK ? "dark" : "light"}
          style={style}
        >
          <SpineFace volume={volume} />
        </div>
      </div>
      <div className="shelf-board" />
    </div>
  );
}
