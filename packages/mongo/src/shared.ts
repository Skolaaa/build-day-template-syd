// Safe to import from browser code: no driver, no Node APIs. Everything the UI
// needs from this package lives here; the package root pulls in the driver.
//
// Dates are plain `YYYY-MM-DD` strings everywhere. A page belongs to a civil
// day, not an instant, so timezones never move an entry to the day before.

import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  format,
  getISOWeek,
  getISOWeekYear,
  isValid,
  startOfISOWeek,
} from "date-fns";

// ---------------------------------------------------------------- periods

export const VOLUME_PERIODS = ["week", "month", "year"] as const;
export type VolumePeriod = (typeof VOLUME_PERIODS)[number];
export const DEFAULT_VOLUME_PERIOD: VolumePeriod = "month";

export function isVolumePeriod(value: unknown): value is VolumePeriod {
  return (VOLUME_PERIODS as readonly unknown[]).includes(value);
}

/** Which year sits on the top shelf of the bookcase. */
export const SHELF_ORDERS = ["newest", "oldest"] as const;
export type ShelfOrder = (typeof SHELF_ORDERS)[number];
export const DEFAULT_SHELF_ORDER: ShelfOrder = "newest";

export function isShelfOrder(value: unknown): value is ShelfOrder {
  return (SHELF_ORDERS as readonly unknown[]).includes(value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_KEY = /^\d{4}$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const WEEK_KEY = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

/**
 * Local midnight for a civil date. Every helper here reads the result back
 * through local getters, so the civil date survives regardless of the zone
 * the code runs in (UTC on the Worker, wherever the reader is in a browser).
 */
export function parseIsoDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? Number.NaN, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** True for a well-formed date that exists (rejects 2026-02-30). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return false;
  }
  const parsed = parseIsoDate(value);
  return isValid(parsed) && toIsoDate(parsed) === value;
}

/** Today as the reader sees it, in their own clock. */
export function localToday(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * Which volume a day belongs to under a given period length:
 * `"2026"`, `"2026-09"` or `"2026-W38"` (ISO week, so the week of
 * 29 Dec 2025 is `"2026-W01"`).
 */
export function periodKeyFor(date: string, period: VolumePeriod): string {
  const day = parseIsoDate(date);
  switch (period) {
    case "year":
      return format(day, "yyyy");
    case "month":
      return format(day, "yyyy-MM");
    case "week":
      return `${getISOWeekYear(day)}-W${String(getISOWeek(day)).padStart(2, "0")}`;
    default:
      throw new Error(`Unknown volume period: ${String(period)}`);
  }
}

export function granularityOf(periodKey: string): VolumePeriod {
  if (YEAR_KEY.test(periodKey)) {
    return "year";
  }
  if (MONTH_KEY.test(periodKey)) {
    return "month";
  }
  if (WEEK_KEY.test(periodKey)) {
    return "week";
  }
  throw new Error(`Not a volume key: ${periodKey}`);
}

export function isPeriodKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (YEAR_KEY.test(value) || MONTH_KEY.test(value) || WEEK_KEY.test(value))
  );
}

/** Monday of ISO week 1 is the week containing 4 January. */
function isoWeekStart(isoYear: number, week: number): Date {
  const fourthOfJanuary = new Date(isoYear, 0, 4);
  return addDays(startOfISOWeek(fourthOfJanuary), (week - 1) * 7);
}

/** First and last day of a volume, inclusive. */
export function periodRange(periodKey: string): { start: string; end: string } {
  const granularity = granularityOf(periodKey);
  if (granularity === "year") {
    return { end: `${periodKey}-12-31`, start: `${periodKey}-01-01` };
  }
  if (granularity === "month") {
    const first = parseIsoDate(`${periodKey}-01`);
    return { end: toIsoDate(endOfMonth(first)), start: toIsoDate(first) };
  }
  const [year, week] = periodKey.split("-W").map(Number);
  const start = isoWeekStart(year ?? 0, week ?? 1);
  return { end: toIsoDate(addDays(start, 6)), start: toIsoDate(start) };
}

/** The volume `delta` steps away, so a volume page can walk the shelf. */
export function shiftPeriodKey(periodKey: string, delta: number): string {
  const granularity = granularityOf(periodKey);
  const { start } = periodRange(periodKey);
  const day = parseIsoDate(start);
  if (granularity === "year") {
    return periodKeyFor(toIsoDate(addYears(day, delta)), "year");
  }
  if (granularity === "month") {
    return periodKeyFor(toIsoDate(addMonths(day, delta)), "month");
  }
  return periodKeyFor(toIsoDate(addDays(day, delta * 7)), "week");
}

/** What an unnamed volume is called: "2026", "September 2026", "Week 38, 2026". */
export function periodLabel(periodKey: string): string {
  const granularity = granularityOf(periodKey);
  if (granularity === "year") {
    return periodKey;
  }
  if (granularity === "month") {
    return format(parseIsoDate(`${periodKey}-01`), "MMMM yyyy");
  }
  const [year, week] = periodKey.split("-W");
  return `Week ${Number(week)}, ${year}`;
}

/** The period as it fits on a spine's foot: "Sep 2023", "W38 2026", "2023". */
export function periodShortLabel(periodKey: string): string {
  const granularity = granularityOf(periodKey);
  if (granularity === "year") {
    return periodKey;
  }
  if (granularity === "month") {
    return format(parseIsoDate(`${periodKey}-01`), "MMM yyyy");
  }
  const [year, week] = periodKey.split("-W");
  return `W${Number(week)} ${year}`;
}

/**
 * What is stamped on a spine: a short title through the middle and, when
 * the title does not already say it, the period in small figures at the
 * foot. A month volume reads "September" over "2023", not "September 2023"
 * squeezed against the bands.
 */
/**
 * What a plank is engraved with when a year does not fit on one shelf: the
 * stretch of it that stands there, "Jan – Jun" or "W1 – W26". Year volumes
 * give the years themselves, "2019 – 2026".
 */
export function periodSpanLabel(first: string, last: string): string {
  const from = periodEdgeLabel(first);
  const to = periodEdgeLabel(last);
  return from === to ? from : `${from} – ${to}`;
}

function periodEdgeLabel(periodKey: string): string {
  const granularity = granularityOf(periodKey);
  if (granularity === "year") {
    return periodKey;
  }
  if (granularity === "month") {
    return format(parseIsoDate(`${periodKey}-01`), "MMM");
  }
  const [, week] = periodKey.split("-W");
  return `W${Number(week)}`;
}

export function spineFaceFor(volume: {
  named: boolean;
  periodKey: string;
  title: string;
}): { foot: string | null; title: string } {
  if (volume.named) {
    return { foot: periodShortLabel(volume.periodKey), title: volume.title };
  }
  const granularity = granularityOf(volume.periodKey);
  if (granularity === "year") {
    return { foot: null, title: volume.periodKey };
  }
  if (granularity === "month") {
    return {
      foot: volume.periodKey.slice(0, 4),
      title: format(parseIsoDate(`${volume.periodKey}-01`), "MMMM"),
    };
  }
  const [year, week] = volume.periodKey.split("-W");
  return { foot: year ?? null, title: `Week ${Number(week)}` };
}

/** The dates a volume covers, as a person would say them. */
export function periodRangeLabel(periodKey: string): string {
  const granularity = granularityOf(periodKey);
  if (granularity !== "week") {
    return periodLabel(periodKey);
  }
  const { start, end } = periodRange(periodKey);
  const first = parseIsoDate(start);
  const last = parseIsoDate(end);
  if (first.getMonth() === last.getMonth()) {
    return `${format(first, "d")}–${format(last, "d MMMM yyyy")}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${format(first, "d MMMM")}–${format(last, "d MMMM yyyy")}`;
  }
  return `${format(first, "d MMMM yyyy")}–${format(last, "d MMMM yyyy")}`;
}

// Same output on the Worker and in the browser: date-fns formats with its
// bundled English locale, never the runtime's. `toLocaleDateString` would
// differ between the two and break hydration.
export function formatLongDate(date: string): string {
  return format(parseIsoDate(date), "EEEE, d MMMM yyyy");
}

export function formatShortDate(date: string): string {
  return format(parseIsoDate(date), "d MMM yyyy");
}

export function formatDayMonth(date: string): string {
  return format(parseIsoDate(date), "EEE d MMM");
}

export function formatMonthYear(month: string): string {
  return format(parseIsoDate(`${month}-01`), "MMM yyyy");
}

// ------------------------------------------------------------------ shelf

/**
 * Cloth colours for spines: library bindings, deep enough that gold foil
 * reads on every one of them, plus a cream that takes old gold instead.
 * Each clears 4.5:1 under its foil (checked in shared.test.ts).
 */
export const SPINE_PALETTE = [
  "#7d4a3b", // oxblood
  "#3f5b52", // bottle green
  "#4a4a6a", // slate blue
  "#6f5631", // tan
  "#5c3b4a", // plum
  "#3d5a6c", // teal
  "#67583b", // olive
  "#4a5d3b", // moss
  "#6a3f4f", // wine
  "#3b4f5c", // navy
  "#8c4635", // brick
  "#725521", // ochre
  "#4d5e40", // sage
  "#31635f", // sea green
  "#784e50", // dusty rose
  "#e8d5a8", // cream
  "#475d6e", // slate
  "#5f566f", // heather
  "#8e452e", // terracotta
  "#2f5d4a", // forest
] as const;

/** FNV-1a: cheap, stable, and spreads similar keys ("2026-09", "2026-10") apart. */
export function hashKey(key: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < key.length; i += 1) {
    // biome-ignore lint/suspicious/noBitwiseOperators: FNV-1a is defined in terms of xor
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: coerce to an unsigned 32-bit integer
  return hash >>> 0;
}

export function spineColorFor(periodKey: string): string {
  return SPINE_PALETTE[hashKey(periodKey) % SPINE_PALETTE.length] as string;
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** WCAG relative luminance of a `#rrggbb` colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#rrggbb` colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Foil colours a title can be stamped in: cream on dark cloth, ink on pale. */
export const SPINE_INK_LIGHT = "#fbf7ee";
export const SPINE_INK_DARK = "#2b2520";

/**
 * The cloth can now be any colour, so the stamped title picks whichever ink
 * reads better on it. Anything the palette offers takes the cream.
 */
export function spineInkFor(color: string): string {
  return contrast(color, SPINE_INK_LIGHT) >= contrast(color, SPINE_INK_DARK)
    ? SPINE_INK_LIGHT
    : SPINE_INK_DARK;
}

/** The middle of each foil's gradient: what the contrast check sees. */
const FOIL_LIGHT_MID = "#ecd292";
const FOIL_DARK_MID = "#6b4f1c";
const TEXT_MIN_CONTRAST = 4.5;

export type SpineFoil = "black" | "dark" | "light" | "silver";

/**
 * Titles are stamped in foil. Pale gold on dark cloth, old gold on pale
 * cloth, each chosen only where it clears 4.5:1. A mid-tone cloth that
 * takes neither is stamped in black or pewter instead, whichever side the
 * title ink falls on, so every book keeps the same glint. Those two are
 * as legible as plain ink would be on that cloth, which for a colour the
 * reader picked themselves may be less than 4.5:1; the palette never is.
 */
export function spineFoilFor(color: string): SpineFoil {
  if (contrast(color, FOIL_LIGHT_MID) >= TEXT_MIN_CONTRAST) {
    return "light";
  }
  if (contrast(color, FOIL_DARK_MID) >= TEXT_MIN_CONTRAST) {
    return "dark";
  }
  return spineInkFor(color) === SPINE_INK_DARK ? "black" : "silver";
}

/** Every so often a book lies flat; this many stacked make a pile. */
export const PILE_SIZE = 3;

const SPINE_MIN_WIDTH = 36;
const SPINE_MAX_WIDTH = 96;
const SPINE_WIDTH_PER_ROOT_ENTRY = 7;

/** A volume that has been written in a lot is a thicker book. */
export function spineThickness(entries: number): number {
  return Math.round(
    Math.min(
      SPINE_MAX_WIDTH,
      SPINE_MIN_WIDTH +
        Math.sqrt(Math.max(0, entries)) * SPINE_WIDTH_PER_ROOT_ENTRY
    )
  );
}

const SPINE_BASE_HEIGHT = 228;
const SPINE_HEIGHT_STEPS = 7;
const SPINE_HEIGHT_STEP = 9;

/**
 * Real shelves are not flush at the top. Vary the height, but the same way
 * every time, so a volume keeps its silhouette between visits.
 */
export function spineHeight(periodKey: string): number {
  return (
    SPINE_BASE_HEIGHT +
    (hashKey(periodKey) % SPINE_HEIGHT_STEPS) * SPINE_HEIGHT_STEP
  );
}

// ------------------------------------------------------------------- text

export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 100_000;
export const TAG_MAX_COUNT = 20;
export const TAG_MAX_LENGTH = 40;
export const CAPTION_MAX_LENGTH = 200;
export const VOLUME_TITLE_MAX_LENGTH = 80;
export const VOLUME_SUBTITLE_MAX_LENGTH = 120;

export const MOODS = [1, 2, 3, 4, 5] as const;
export type Mood = (typeof MOODS)[number];
export const MOOD_LABELS: Record<Mood, string> = {
  1: "rough",
  2: "low",
  3: "even",
  4: "good",
  5: "bright",
};

export function isMood(value: unknown): value is Mood {
  return (MOODS as readonly unknown[]).includes(value);
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const MARKDOWN_NOISE = /[#*_>`~[\]()!-]+/g;
const WHITESPACE = /\s+/g;

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** The first line or so of a page, with the Markdown taken off. */
export function excerptOf(body: string, maxLength = 160): string {
  const plain = body
    .replace(MARKDOWN_NOISE, " ")
    .replace(WHITESPACE, " ")
    .trim();
  if (plain.length <= maxLength) {
    return plain;
  }
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

const WORDS_PER_MINUTE = 220;

/** "3 min", the way a book jacket would put it. */
export function readingTime(words: number): string {
  return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min`;
}

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

/** 9,271 — with separators but without the locale, so SSR and client agree. */
export function formatCount(value: number): string {
  return String(Math.round(value)).replace(THOUSANDS, ",");
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`
): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(WHITESPACE, " ");
}

// ------------------------------------------------------------------ media

export const MEDIA_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;
export type MediaContentType = keyof typeof MEDIA_CONTENT_TYPES;
export type MediaKind = "video" | "image";

const MEGABYTE = 1024 * 1024;
/** The Worker request body limit on the free plan. */
export const MEDIA_MAX_BYTES = 100 * MEGABYTE;

export function isMediaContentType(value: unknown): value is MediaContentType {
  return typeof value === "string" && value in MEDIA_CONTENT_TYPES;
}

export function mediaKindFor(contentType: MediaContentType): MediaKind {
  return contentType.startsWith("video/") ? "video" : "image";
}

const MEDIA_KEY_PREFIX = "users/";

/**
 * `users/<userId>/<entryId>/<uuid>.<ext>`. The user id prefix is what makes
 * ownership checkable from the key alone, without a database round trip.
 */
export function mediaKeyFor(
  userId: string,
  entryId: string,
  contentType: MediaContentType,
  uuid: string = crypto.randomUUID()
): string {
  return `${MEDIA_KEY_PREFIX}${userId}/${entryId}/${uuid}.${MEDIA_CONTENT_TYPES[contentType]}`;
}

/** Splits a key back into its parts, or null if it is not one of ours. */
export function parseMediaKey(
  key: string
): { userId: string; entryId: string; file: string } | null {
  if (!key.startsWith(MEDIA_KEY_PREFIX)) {
    return null;
  }
  const parts = key.slice(MEDIA_KEY_PREFIX.length).split("/");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return null;
  }
  const [userId, entryId, file] = parts as [string, string, string];
  return { entryId, file, userId };
}

/** The one authorization rule for media: you can only touch keys under your own prefix. */
export function isOwnedMediaKey(key: string, userId: string | null): boolean {
  if (!userId) {
    return false;
  }
  return parseMediaKey(key)?.userId === userId;
}

export function mediaUrl(key: string): string {
  return `/api/media/${key}`;
}

// ------------------------------------------------------------------ types

/** A clip or still attached to a page. The bytes live in R2 under `key`. */
export interface MediaRef {
  bytes: number;
  caption?: string;
  contentType: MediaContentType;
  createdAt: string;
  durationSec?: number;
  height?: number;
  id: string;
  key: string;
  kind: MediaKind;
  posterKey?: string;
  width?: number;
}

/** One day's page, as it leaves the package: plain JSON. */
export interface Entry {
  body: string;
  createdAt: string;
  date: string;
  id: string;
  media: MediaRef[];
  mood: Mood | null;
  tags: string[];
  title: string;
  updatedAt: string;
  words: number;
}

/** Enough of a page to list it without shipping the body. */
export interface EntrySummary {
  date: string;
  excerpt: string;
  id: string;
  mediaCount: number;
  mood: Mood | null;
  tags: string[];
  title: string;
  updatedAt: string;
  words: number;
}

export interface EntryInput {
  body: string;
  date: string;
  mood: Mood | null;
  tags: string[];
  title: string;
  /** The reader's local hour when the page was started, for the Atlas. */
  writtenHour?: number | null;
}

export interface Volume {
  color: string;
  daysWritten: number;
  entries: number;
  firstEntry: string | null;
  granularity: VolumePeriod;
  lastEntry: string | null;
  mediaCount: number;
  /** True when the reader gave it a title, as opposed to the period label. */
  named: boolean;
  periodKey: string;
  subtitle: string | null;
  title: string;
  words: number;
}

export interface VolumeMetaInput {
  color: string | null;
  subtitle: string | null;
  title: string | null;
}

export interface JournalSettings {
  shelfOrder: ShelfOrder;
  volumePeriod: VolumePeriod;
}

export interface ShelfStats {
  currentStreak: number;
  daysWritten: number;
  entries: number;
  firstEntry: string | null;
  lastEntry: string | null;
  longestStreak: number;
  volumes: number;
  words: number;
}

export interface Shelf {
  stats: ShelfStats;
  volumes: Volume[];
}

export interface VolumeDetail {
  /** Words written on each day of the period; days without a page are absent. */
  calendar: Record<string, number>;
  entries: EntrySummary[];
  volume: Volume;
}

export interface TagCount {
  count: number;
  tag: string;
}

export interface SearchHit extends EntrySummary {
  score: number;
}

export interface OnThisDayHit extends EntrySummary {
  /** How many periods back this page is from today. */
  periodsAgo: number;
}

export interface AtlasDay {
  /** `2026-09-17`. */
  date: string;
  words: number;
}

export interface AtlasWeek {
  entries: number;
  /** ISO week key, `2026-W38`. */
  week: string;
  words: number;
}

export interface AtlasMonth {
  entries: number;
  /** `2026-09`. */
  month: string;
  mood: number | null;
  words: number;
}

export interface Atlas {
  /** Every page, oldest first, for the life-in-days grid. */
  days: AtlasDay[];
  /** Writing starts per hour of the reader's day, index 0 = midnight. */
  hours: number[];
  months: AtlasMonth[];
  stats: ShelfStats;
  tags: TagCount[];
  volumes: Volume[];
  /** Entries per ISO weekday, index 0 = Monday. */
  weekdays: number[];
  weeks: AtlasWeek[];
}
