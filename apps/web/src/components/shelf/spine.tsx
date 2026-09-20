import {
  formatCount,
  formatShortDate,
  periodLabel,
  periodShortLabel,
  plural,
  SPINE_INK_DARK,
  spineFaceFor,
  spineFoilFor,
  spineHeight,
  spineInkFor,
  spineThickness,
  type Volume,
} from "@repo/mongo/shared";
import { Plus } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "#/components/ui/hover-card";

export type SpineKeyHandler = (event: KeyboardEvent<HTMLButtonElement>) => void;

/** A volume this many years old is as faded as it is going to get. */
const YEARS_TO_FADE = 6;
/** Books thicker than this get a rounded back, the way heavy bindings do. */
const ROUND_BACK_FROM = 56;
const ROUND_BACK_TO = 96;
const GLIMPSE_OPEN_MS = 240;
const GLIMPSE_CLOSE_MS = 80;

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
  /** Show a card about the volume on hover. Off for previews. */
  glimpse?: boolean;
  /** Position along the whole shelf, for the settle-in stagger. */
  index: number;
  onKeyDown?: SpineKeyHandler;
  onOpen: () => void;
  volume: Volume;
}

export function Spine({
  volume,
  onOpen,
  onKeyDown,
  currentYear,
  glimpse = true,
  index,
}: SpineProps) {
  const label = periodLabel(volume.periodKey);
  const binding = bindingFor(volume, currentYear);
  const style = { ...binding.style, "--i": index } as CSSProperties;
  const count = plural(volume.entries, "page");

  const button = (
    <button
      aria-label={`Open ${volume.title}${volume.named ? `, ${label}` : ""}, ${count}`}
      className="spine"
      data-foil={binding.foil}
      data-ink={binding.ink}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      style={style}
      type="button"
    >
      <SpineFace volume={volume} />
    </button>
  );

  if (!glimpse) {
    return button;
  }
  return <VolumeGlimpse volume={volume}>{button}</VolumeGlimpse>;
}

/** Titles past this many characters are set a size smaller so they fit. */
const LONG_TITLE = 14;

/** What is stamped on the cloth: a line at each end, the title, the period at the foot. */
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

/**
 * A card about the book under the pointer: what it is called, how much is
 * in it, and when. After Kibo UI's Glimpse, on shadcn's HoverCard.
 */
function VolumeGlimpse({
  volume,
  children,
}: {
  children: ReactNode;
  volume: Volume;
}) {
  const span =
    volume.firstEntry && volume.lastEntry
      ? `${formatShortDate(volume.firstEntry)}${
          volume.firstEntry === volume.lastEntry
            ? ""
            : ` to ${formatShortDate(volume.lastEntry)}`
        }`
      : null;
  return (
    <HoverCard closeDelay={GLIMPSE_CLOSE_MS} openDelay={GLIMPSE_OPEN_MS}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        className="w-60 bg-paper-raised ring-rule"
        side="top"
        sideOffset={12}
      >
        <p className="m-0 truncate font-serif text-[16px] text-ink">
          {volume.title}
        </p>
        {volume.named ? (
          <p className="m-0 text-[12px] text-ink-faint">
            {periodLabel(volume.periodKey)}
          </p>
        ) : null}
        {volume.subtitle ? (
          <p className="m-0 font-serif text-[13px] text-ink-soft italic">
            {volume.subtitle}
          </p>
        ) : null}
        <p className="m-0 mt-1.5 text-[12.5px] text-ink-soft">
          {plural(volume.entries, "page")} · {formatCount(volume.words)} words
          {volume.mediaCount > 0
            ? ` · ${plural(volume.mediaCount, "clip")}`
            : ""}
        </p>
        {span ? <p className="m-0 text-[12px] text-ink-faint">{span}</p> : null}
      </HoverCardContent>
    </HoverCard>
  );
}

interface UnopenedSpineProps {
  index: number;
  onKeyDown?: SpineKeyHandler;
  onStart: () => void;
  periodKey: string;
}

/** The volume you are living in, before you have written a word of it. */
export function UnopenedSpine({
  periodKey,
  onStart,
  onKeyDown,
  index,
}: UnopenedSpineProps) {
  const style = {
    "--i": index,
    "--spine-height": `${spineHeight(periodKey)}px`,
  } as CSSProperties;
  return (
    <button
      aria-label={`Start the volume for ${periodLabel(periodKey)}`}
      className="spine spine-unopened"
      onClick={onStart}
      onKeyDown={onKeyDown}
      style={style}
      title="Write today's page"
      type="button"
    >
      <Plus aria-hidden="true" className="size-3.5" />
      <span className="spine-title">unopened</span>
      <span className="spine-year">{periodShortLabel(periodKey)}</span>
    </button>
  );
}
