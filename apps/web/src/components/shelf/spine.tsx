import {
  periodLabel,
  plural,
  spineHeight,
  spineThickness,
  type Volume,
} from "@repo/mongo/shared";
import type { CSSProperties, KeyboardEvent } from "react";

export type SpineKeyHandler = (event: KeyboardEvent<HTMLButtonElement>) => void;

interface SpineProps {
  onKeyDown?: SpineKeyHandler;
  onOpen: () => void;
  volume: Volume;
}

export function Spine({ volume, onOpen, onKeyDown }: SpineProps) {
  const label = periodLabel(volume.periodKey);
  const style = {
    "--spine-color": volume.color,
    "--spine-height": `${spineHeight(volume.periodKey)}px`,
    "--spine-width": `${spineThickness(volume.entries)}px`,
  } as CSSProperties;
  const count = plural(volume.entries, "page");

  return (
    <button
      aria-label={`Open ${volume.title}${volume.named ? `, ${label}` : ""}, ${count}`}
      className="spine"
      onClick={onOpen}
      onKeyDown={onKeyDown}
      style={style}
      title={`${volume.title} — ${count}`}
      type="button"
    >
      <span aria-hidden="true" className="spine-band" />
      <span className="spine-title" data-plain={volume.named ? undefined : ""}>
        {volume.title}
      </span>
      <span aria-hidden="true" className="spine-band" />
      {/* An unnamed volume is titled with its period already; don't print it twice. */}
      {volume.named ? <span className="spine-year">{label}</span> : null}
    </button>
  );
}

interface UnopenedSpineProps {
  onKeyDown?: SpineKeyHandler;
  onStart: () => void;
  periodKey: string;
}

/** The volume you are living in, before you have written a word of it. */
export function UnopenedSpine({
  periodKey,
  onStart,
  onKeyDown,
}: UnopenedSpineProps) {
  const style = {
    "--spine-height": `${spineHeight(periodKey)}px`,
  } as CSSProperties;
  return (
    <button
      aria-label={`Start the volume for ${periodLabel(periodKey)}`}
      className="spine spine-unopened"
      onClick={onStart}
      onKeyDown={onKeyDown}
      style={style}
      type="button"
    >
      <span className="spine-title">unopened</span>
      <span className="spine-year">{periodLabel(periodKey)}</span>
    </button>
  );
}
