import {
  periodLabel,
  plural,
  SPINE_INK_DARK,
  spineFaceFor,
  spineFoilFor,
  spineHeight,
  spineInkFor,
  spineThickness,
  type Volume,
} from "@repo/mongo/shared";
import type { CSSProperties, KeyboardEvent } from "react";

export type SpineKeyHandler = (event: KeyboardEvent<HTMLButtonElement>) => void;

/** How far a leaning book tilts, in degrees. Enough to read, not enough to fall. */
export const LEAN_DEGREES = 7;

/** A volume this many years old is as faded as it is going to get. */
const YEARS_TO_FADE = 6;
/** Books thicker than this get a rounded back, the way heavy bindings do. */
const ROUND_BACK_FROM = 56;
const ROUND_BACK_TO = 96;

/**
 * The custom properties and data attributes that dress one binding. Age
 * comes from the year the reader is in, not the clock, so the server and
 * the browser agree on it.
 */
export function bindingFor(volume: Volume, currentYear: number) {
  const ink = spineInkFor(volume.color);
  const year = Number(volume.periodKey.slice(0, 4));
  const age = Math.min(1, Math.max(0, (currentYear - year) / YEARS_TO_FADE));
  const width = spineThickness(volume.entries);
  const round = Math.min(
    1,
    Math.max(0, (width - ROUND_BACK_FROM) / (ROUND_BACK_TO - ROUND_BACK_FROM))
  );
  return {
    foil: spineFoilFor(volume.color),
    ink: ink === SPINE_INK_DARK ? "dark" : "light",
    style: {
      "--spine-age": age.toFixed(2),
      "--spine-color": volume.color,
      "--spine-height": `${spineHeight(volume.periodKey)}px`,
      "--spine-ink": ink,
      "--spine-round": round.toFixed(2),
      "--spine-width": `${width}px`,
    } as CSSProperties,
  };
}

interface SpineProps {
  /** The year the reader is in; older volumes fade a little. */
  currentYear: number;
  /**
   * Pixels of shelf this book is leaning across. Set on the last book of a
   * row that has room to spare, so it rests on the one before it.
   */
  lean?: number;
  onKeyDown?: SpineKeyHandler;
  onOpen: () => void;
  volume: Volume;
}

export function Spine({
  volume,
  onOpen,
  onKeyDown,
  currentYear,
  lean = 0,
}: SpineProps) {
  const label = periodLabel(volume.periodKey);
  const binding = bindingFor(volume, currentYear);
  const style = {
    ...binding.style,
    // Negative is anticlockwise: the book tips left, onto the one before it.
    "--spine-lean": lean > 0 ? `-${LEAN_DEGREES}deg` : "0deg",
    marginLeft: lean > 0 ? `${lean}px` : undefined,
  } as CSSProperties;
  const count = plural(volume.entries, "page");

  return (
    <button
      aria-label={`Open ${volume.title}${volume.named ? `, ${label}` : ""}, ${count}`}
      className="spine"
      data-foil={binding.foil}
      data-ink={binding.ink}
      data-leaning={lean > 0 ? "true" : undefined}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      style={style}
      title={`${volume.title} — ${count}`}
      type="button"
    >
      <SpineFace volume={volume} />
    </button>
  );
}

interface FlatSpineProps {
  currentYear: number;
  onKeyDown?: SpineKeyHandler;
  onOpen: () => void;
  /** Sideways nudge in px, so a pile is not squared off like a parcel. */
  shift: number;
  volume: Volume;
}

/** The same book lying on its side, as one layer of a pile. */
export function FlatSpine({
  volume,
  onOpen,
  onKeyDown,
  currentYear,
  shift,
}: FlatSpineProps) {
  const label = periodLabel(volume.periodKey);
  const binding = bindingFor(volume, currentYear);
  const style = {
    ...binding.style,
    marginLeft: `${shift}px`,
  } as CSSProperties;
  const count = plural(volume.entries, "page");

  return (
    <button
      aria-label={`Open ${volume.title}${volume.named ? `, ${label}` : ""}, ${count}`}
      className="spine spine-flat"
      data-foil={binding.foil}
      data-ink={binding.ink}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      style={style}
      title={`${volume.title} — ${count}`}
      type="button"
    >
      <SpineFace volume={volume} />
    </button>
  );
}

/** Titles past this many characters are set a size smaller so they fit. */
const LONG_TITLE = 14;

/** What is stamped on the cloth: bands, the title, and the period at the foot. */
export function SpineFace({ volume }: { volume: Volume }) {
  const face = spineFaceFor(volume);
  return (
    <>
      <span aria-hidden="true" className="spine-pages" />
      <span aria-hidden="true" className="spine-band" />
      <span
        className="spine-title"
        data-long={face.title.length > LONG_TITLE ? "" : undefined}
        data-plain={volume.named ? undefined : ""}
      >
        {face.title}
      </span>
      <span aria-hidden="true" className="spine-band" />
      {face.foot ? <span className="spine-year">{face.foot}</span> : null}
    </>
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
