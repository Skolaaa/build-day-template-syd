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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Field, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "#/components/ui/input-group";
import { setVolumeMetaFn } from "#/server/journal";

interface CoverEditorDialogProps {
  color: string;
  entries: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  periodKey: string;
  subtitle: string | null;
  title: string;
}

/** Title, subtitle and cloth colour for a volume, in a dialog over the page. */
export function CoverEditorDialog({
  open,
  onOpenChange,
  ...props
}: CoverEditorDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="bg-paper-raised ring-rule sm:max-w-2xl">
        {/* Keyed on open so a cancelled edit never lingers into the next. */}
        {open ? (
          <CoverForm onDone={() => onOpenChange(false)} {...props} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface CoverFormProps {
  color: string;
  entries: number;
  onDone: () => void;
  periodKey: string;
  subtitle: string | null;
  title: string;
}

const PREVIEW_HEIGHT_SCALE = 0.8;
const HEX_DIGITS = 6;
const LEADING_HASH = /^#/;

function CoverForm({
  periodKey,
  entries,
  title: initialTitle,
  subtitle: initialSubtitle,
  color: initialColor,
  onDone,
}: CoverFormProps) {
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [color, setColor] = useState(initialColor);
  // The hex field is free text while typing; the cloth only follows it once
  // it is a whole colour, so the preview never flashes through half-typed ones.
  const [hexDraft, setHexDraft] = useState(
    initialColor.replace(LEADING_HASH, "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickColor = (next: string) => {
    const lower = next.toLowerCase();
    setColor(lower);
    setHexDraft(lower.replace(LEADING_HASH, ""));
  };

  const onHexChange = (raw: string) => {
    const digits = raw.replace(LEADING_HASH, "").slice(0, HEX_DIGITS);
    setHexDraft(digits);
    const next = `#${digits}`;
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
  const named = initialTitle.length > 0;

  return (
    <form className="contents" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle className="font-normal font-serif text-[22px] text-ink">
          {named ? "Rename or recolour" : "Name this volume"}
        </DialogTitle>
        <DialogDescription className="text-ink-soft">
          A title through the spine, a line under it, and the cloth it is bound
          in. The book redraws as you go.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <SpinePreview
          color={color}
          entries={entries}
          periodKey={periodKey}
          title={title.trim()}
        />

        <div className="grid content-start gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel className="kicker" htmlFor={`${id}-title`}>
                Title
              </FieldLabel>
              <Input
                className="font-serif text-[16px]"
                id={`${id}-title`}
                maxLength={VOLUME_TITLE_MAX_LENGTH}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={periodLabel(periodKey)}
                value={title}
              />
            </Field>
            <Field>
              <FieldLabel className="kicker" htmlFor={`${id}-subtitle`}>
                Subtitle
              </FieldLabel>
              <Input
                className="font-serif text-[16px] italic"
                id={`${id}-subtitle`}
                maxLength={VOLUME_SUBTITLE_MAX_LENGTH}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="optional"
                value={subtitle}
              />
            </Field>
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
                  {
                    "--swatch": custom ? color : "transparent",
                  } as CSSProperties
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
              <InputGroup className="ml-2 w-[8.5em]">
                <InputGroupAddon>
                  <InputGroupText className="font-mono">#</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Colour as a hex value"
                  className="font-mono text-[12.5px] tabular-nums"
                  maxLength={HEX_DIGITS}
                  onChange={(event) => onHexChange(event.target.value)}
                  spellCheck={false}
                  value={hexDraft}
                />
              </InputGroup>
            </div>
          </fieldset>
        </div>
      </div>

      <DialogFooter className="items-center">
        {error ? (
          <p className="m-0 mr-auto text-[13px] text-accent" role="alert">
            {error}
          </p>
        ) : null}
        <DialogClose asChild>
          <Button size="sm" type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={saving} size="sm" type="submit">
          {saving ? "Saving…" : "Save the cover"}
        </Button>
      </DialogFooter>
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
