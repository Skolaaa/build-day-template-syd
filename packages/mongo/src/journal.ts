// The journal: entries (one per day per user), the reader's settings, and the
// optional naming/colouring of a volume. Volumes themselves are never stored.
// An entry belongs to a date; which volume it sits in is derived from that
// date and the reader's current period length, so changing the period
// reshelves everything instantly and destroys nothing.
//
// Every function takes the Clerk `userId` and scopes each query with it. The
// server functions are responsible for never letting a client supply it.

import { differenceInCalendarDays } from "date-fns";
import type { Collection, Db, Document, ObjectId } from "mongodb";
import { ObjectId as ObjectIdCtor } from "mongodb";
import {
  type Atlas,
  type AtlasMonth,
  type AtlasWeek,
  BODY_MAX_LENGTH,
  CAPTION_MAX_LENGTH,
  countWords,
  DEFAULT_VOLUME_PERIOD,
  type Entry,
  type EntryInput,
  type EntrySummary,
  excerptOf,
  granularityOf,
  isIsoDate,
  isMood,
  isPeriodKey,
  type JournalSettings,
  type MediaContentType,
  type MediaKind,
  type MediaRef,
  type Mood,
  normalizeTag,
  type OnThisDayHit,
  parseIsoDate,
  parseMediaKey,
  periodKeyFor,
  periodLabel,
  periodRange,
  type SearchHit,
  type Shelf,
  type ShelfStats,
  SPINE_PALETTE,
  spineColorFor,
  TAG_MAX_COUNT,
  TAG_MAX_LENGTH,
  type TagCount,
  TITLE_MAX_LENGTH,
  VOLUME_SUBTITLE_MAX_LENGTH,
  VOLUME_TITLE_MAX_LENGTH,
  type Volume,
  type VolumeDetail,
  type VolumeMetaInput,
  type VolumePeriod,
} from "./shared.ts";

// ------------------------------------------------------------ documents

/** How a page is stored. Only this module sees `_id` and `Date`. */
interface EntryDocument {
  _id: ObjectId;
  body: string;
  createdAt: Date;
  date: string;
  media: MediaDocument[];
  mood: Mood | null;
  tags: string[];
  title: string;
  updatedAt: Date;
  userId: string;
  /** Word count, kept on the document so the shelf can sum it in one pass. */
  words: number;
  /** Local hour the page was started in, from the reader's clock. */
  writtenHour: number | null;
}

interface MediaDocument {
  bytes: number;
  caption?: string;
  contentType: MediaContentType;
  createdAt: Date;
  durationSec?: number;
  height?: number;
  id: string;
  key: string;
  kind: MediaKind;
  posterKey?: string;
  width?: number;
}

interface SettingsDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  volumePeriod: VolumePeriod;
}

interface VolumeMetaDocument {
  _id: ObjectId;
  color: string | null;
  granularity: VolumePeriod;
  periodKey: string;
  subtitle: string | null;
  title: string | null;
  updatedAt: Date;
  userId: string;
}

function entries(db: Db): Collection<EntryDocument> {
  return db.collection<EntryDocument>("entries");
}

function settings(db: Db): Collection<SettingsDocument> {
  return db.collection<SettingsDocument>("settings");
}

function volumeMeta(db: Db): Collection<VolumeMetaDocument> {
  return db.collection<VolumeMetaDocument>("volumeMeta");
}

// -------------------------------------------------------------- indexes

/** Creates the indexes the queries below rely on. Run once at setup, not per request. */
export async function ensureJournalIndexes(db: Db): Promise<void> {
  await entries(db).createIndex({ date: -1, userId: 1 }, { unique: true });
  await entries(db).createIndex({ tags: 1, userId: 1 });
  // A compound text index with the user id as an equality prefix keeps search
  // scoped to one reader inside the index itself.
  await entries(db).createIndex(
    { body: "text", title: "text", userId: 1 },
    { name: "entries_text", weights: { body: 1, title: 5 } }
  );
  await settings(db).createIndex({ userId: 1 }, { unique: true });
  await volumeMeta(db).createIndex(
    { periodKey: 1, userId: 1 },
    { unique: true }
  );
}

// ------------------------------------------------------------ mapping

function toMediaRef(doc: MediaDocument): MediaRef {
  const ref: MediaRef = {
    bytes: doc.bytes,
    contentType: doc.contentType,
    createdAt: doc.createdAt.toISOString(),
    id: doc.id,
    key: doc.key,
    kind: doc.kind,
  };
  if (doc.caption !== undefined) {
    ref.caption = doc.caption;
  }
  if (doc.durationSec !== undefined) {
    ref.durationSec = doc.durationSec;
  }
  if (doc.width !== undefined) {
    ref.width = doc.width;
  }
  if (doc.height !== undefined) {
    ref.height = doc.height;
  }
  if (doc.posterKey !== undefined) {
    ref.posterKey = doc.posterKey;
  }
  return ref;
}

function toEntry(doc: EntryDocument): Entry {
  return {
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    date: doc.date,
    id: doc._id.toHexString(),
    media: doc.media.map(toMediaRef),
    mood: doc.mood,
    tags: doc.tags,
    title: doc.title,
    updatedAt: doc.updatedAt.toISOString(),
    words: doc.words,
  };
}

const SUMMARY_PROJECTION = {
  body: 1,
  date: 1,
  media: 1,
  mood: 1,
  tags: 1,
  title: 1,
  updatedAt: 1,
  words: 1,
} as const;

function toSummary(doc: EntryDocument): EntrySummary {
  return {
    date: doc.date,
    excerpt: excerptOf(doc.body),
    id: doc._id.toHexString(),
    mediaCount: doc.media.length,
    mood: doc.mood,
    tags: doc.tags,
    title: doc.title,
    updatedAt: doc.updatedAt.toISOString(),
    words: doc.words,
  };
}

// ---------------------------------------------------------- validation

function validateDate(date: unknown): string {
  if (!isIsoDate(date)) {
    throw new Error("Expected a date like 2026-09-17.");
  }
  return date;
}

function validateTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    throw new Error("Tags must be a list.");
  }
  const seen = new Set<string>();
  for (const raw of tags) {
    if (typeof raw !== "string") {
      throw new Error("Tags must be text.");
    }
    const tag = normalizeTag(raw);
    if (tag.length === 0) {
      continue;
    }
    if (tag.length > TAG_MAX_LENGTH) {
      throw new Error(`A tag can be at most ${TAG_MAX_LENGTH} characters.`);
    }
    seen.add(tag);
  }
  if (seen.size > TAG_MAX_COUNT) {
    throw new Error(`A page can carry at most ${TAG_MAX_COUNT} tags.`);
  }
  return [...seen];
}

function validateEntryInput(input: EntryInput): {
  body: string;
  date: string;
  mood: Mood | null;
  tags: string[];
  title: string;
  writtenHour: number | null;
} {
  const date = validateDate(input.date);
  if (typeof input.title !== "string" || typeof input.body !== "string") {
    throw new Error("Title and body must be text.");
  }
  const title = input.title.trim();
  if (title.length > TITLE_MAX_LENGTH) {
    throw new Error(`A title can be at most ${TITLE_MAX_LENGTH} characters.`);
  }
  const body = input.body.replace(/\r\n/g, "\n");
  if (body.length > BODY_MAX_LENGTH) {
    throw new Error(`A page can hold at most ${BODY_MAX_LENGTH} characters.`);
  }
  if (input.mood !== null && !isMood(input.mood)) {
    throw new Error("Mood must be 1 to 5, or empty.");
  }
  const hour = input.writtenHour;
  const writtenHour =
    typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour < 24
      ? hour
      : null;
  return {
    body,
    date,
    mood: input.mood,
    tags: validateTags(input.tags),
    title,
    writtenHour,
  };
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function validateVolumeMeta(input: VolumeMetaInput): VolumeMetaInput {
  const title =
    typeof input.title === "string" && input.title.trim().length > 0
      ? input.title.trim()
      : null;
  if (title && title.length > VOLUME_TITLE_MAX_LENGTH) {
    throw new Error(
      `A volume title can be at most ${VOLUME_TITLE_MAX_LENGTH} characters.`
    );
  }
  const subtitle =
    typeof input.subtitle === "string" && input.subtitle.trim().length > 0
      ? input.subtitle.trim()
      : null;
  if (subtitle && subtitle.length > VOLUME_SUBTITLE_MAX_LENGTH) {
    throw new Error(
      `A subtitle can be at most ${VOLUME_SUBTITLE_MAX_LENGTH} characters.`
    );
  }
  const color = typeof input.color === "string" ? input.color : null;
  if (color && !HEX_COLOR.test(color)) {
    throw new Error("Colour must be a hex value like #3f5b52.");
  }
  if (color && !(SPINE_PALETTE as readonly string[]).includes(color)) {
    throw new Error("Colour must be one of the cloth colours.");
  }
  return { color, subtitle, title };
}

// ------------------------------------------------------------ settings

export async function getSettings(
  db: Db,
  userId: string
): Promise<JournalSettings> {
  const doc = await settings(db).findOne({ userId });
  return { volumePeriod: doc?.volumePeriod ?? DEFAULT_VOLUME_PERIOD };
}

export async function updateSettings(
  db: Db,
  userId: string,
  input: JournalSettings
): Promise<JournalSettings> {
  const now = new Date();
  await settings(db).updateOne(
    { userId },
    {
      $set: { updatedAt: now, volumePeriod: input.volumePeriod },
      $setOnInsert: { createdAt: now, userId },
    },
    { upsert: true }
  );
  return { volumePeriod: input.volumePeriod };
}

// ------------------------------------------------------------- entries

export async function getEntry(
  db: Db,
  userId: string,
  date: string
): Promise<Entry | null> {
  const doc = await entries(db).findOne({ date: validateDate(date), userId });
  return doc ? toEntry(doc) : null;
}

/** Creates or updates the page for `input.date`. */
export async function saveEntry(
  db: Db,
  userId: string,
  input: EntryInput
): Promise<Entry> {
  const clean = validateEntryInput(input);
  const now = new Date();
  const doc = await entries(db).findOneAndUpdate(
    { date: clean.date, userId },
    {
      $set: {
        body: clean.body,
        mood: clean.mood,
        tags: clean.tags,
        title: clean.title,
        updatedAt: now,
        words: countWords(clean.body) + countWords(clean.title),
      },
      $setOnInsert: {
        createdAt: now,
        date: clean.date,
        media: [],
        userId,
        writtenHour: clean.writtenHour,
      },
    },
    { returnDocument: "after", upsert: true }
  );
  if (!doc) {
    throw new Error("The page was saved but could not be read back.");
  }
  return toEntry(doc);
}

/** Removes a page and returns the R2 keys its media occupied, for cleanup. */
export async function deleteEntry(
  db: Db,
  userId: string,
  date: string
): Promise<{ mediaKeys: string[] } | null> {
  const doc = await entries(db).findOneAndDelete({
    date: validateDate(date),
    userId,
  });
  if (!doc) {
    return null;
  }
  return { mediaKeys: doc.media.flatMap(mediaKeys) };
}

function mediaKeys(media: MediaDocument): string[] {
  return media.posterKey ? [media.key, media.posterKey] : [media.key];
}

export async function listEntriesBetween(
  db: Db,
  userId: string,
  start: string,
  end: string
): Promise<EntrySummary[]> {
  const docs = await entries(db)
    .find(
      { date: { $gte: validateDate(start), $lte: validateDate(end) }, userId },
      { projection: SUMMARY_PROJECTION }
    )
    .sort({ date: -1 })
    .toArray();
  return docs.map(toSummary);
}

export async function listRecentEntries(
  db: Db,
  userId: string,
  limit: number
): Promise<EntrySummary[]> {
  const docs = await entries(db)
    .find({ userId }, { projection: SUMMARY_PROJECTION })
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toSummary);
}

/** The pages either side of `date`, for older/newer navigation. */
export async function getEntryNeighbours(
  db: Db,
  userId: string,
  date: string
): Promise<{ newer: EntrySummary | null; older: EntrySummary | null }> {
  const day = validateDate(date);
  const [older, newer] = await Promise.all([
    entries(db)
      .find({ date: { $lt: day }, userId }, { projection: SUMMARY_PROJECTION })
      .sort({ date: -1 })
      .limit(1)
      .next(),
    entries(db)
      .find({ date: { $gt: day }, userId }, { projection: SUMMARY_PROJECTION })
      .sort({ date: 1 })
      .limit(1)
      .next(),
  ]);
  return {
    newer: newer ? toSummary(newer) : null,
    older: older ? toSummary(older) : null,
  };
}

export async function listEntriesByTag(
  db: Db,
  userId: string,
  tag: string
): Promise<EntrySummary[]> {
  const docs = await entries(db)
    .find(
      { tags: normalizeTag(tag), userId },
      { projection: SUMMARY_PROJECTION }
    )
    .sort({ date: -1 })
    .toArray();
  return docs.map(toSummary);
}

// --------------------------------------------------------------- media

/** Attaches an uploaded object to the page it was uploaded for. */
export async function addMedia(
  db: Db,
  userId: string,
  entryId: string,
  ref: MediaRef
): Promise<Entry> {
  if (!ObjectIdCtor.isValid(entryId)) {
    throw new Error("Unknown page.");
  }
  const doc = await entries(db).findOneAndUpdate(
    { _id: new ObjectIdCtor(entryId), userId },
    {
      $push: { media: { ...ref, createdAt: new Date(ref.createdAt) } },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );
  if (!doc) {
    throw new Error("Unknown page.");
  }
  return toEntry(doc);
}

/**
 * Detaches media by its R2 key. The key names the entry, so this is one
 * update; the caller is expected to have checked ownership of the key
 * already, and the `userId` in the filter makes sure of it anyway.
 */
export async function removeMediaByKey(
  db: Db,
  userId: string,
  key: string
): Promise<{ entry: Entry; removed: MediaRef } | null> {
  const parsed = parseMediaKey(key);
  if (
    !parsed ||
    parsed.userId !== userId ||
    !ObjectIdCtor.isValid(parsed.entryId)
  ) {
    return null;
  }
  const filter = { _id: new ObjectIdCtor(parsed.entryId), userId };
  const before = await entries(db).findOne(filter);
  const removed = before?.media.find((m) => m.key === key);
  if (!(before && removed)) {
    return null;
  }
  const doc = await entries(db).findOneAndUpdate(
    filter,
    { $pull: { media: { key } }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!doc) {
    return null;
  }
  return { entry: toEntry(doc), removed: toMediaRef(removed) };
}

/** Reorders clips and updates captions. Every existing clip must be listed once. */
export async function updateMedia(
  db: Db,
  userId: string,
  date: string,
  media: { caption?: string; id: string }[]
): Promise<Entry> {
  const filter = { date: validateDate(date), userId };
  const before = await entries(db).findOne(filter);
  if (!before) {
    throw new Error("Unknown page.");
  }
  const byId = new Map(before.media.map((m) => [m.id, m]));
  if (
    media.length !== byId.size ||
    new Set(media.map((m) => m.id)).size !== media.length
  ) {
    throw new Error("The clip list does not match the page.");
  }
  const reordered = media.map((item) => {
    const existing = byId.get(item.id);
    if (!existing) {
      throw new Error("The clip list does not match the page.");
    }
    const caption = item.caption?.trim() ?? "";
    if (caption.length > CAPTION_MAX_LENGTH) {
      throw new Error(
        `A caption can be at most ${CAPTION_MAX_LENGTH} characters.`
      );
    }
    const { caption: _dropped, ...rest } = existing;
    return caption.length > 0 ? { ...rest, caption } : rest;
  });
  const doc = await entries(db).findOneAndUpdate(
    filter,
    { $set: { media: reordered, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!doc) {
    throw new Error("Unknown page.");
  }
  return toEntry(doc);
}

/** Records a poster still for a clip once the client has uploaded one. */
export async function setMediaPoster(
  db: Db,
  userId: string,
  entryId: string,
  mediaId: string,
  posterKey: string
): Promise<Entry | null> {
  if (!ObjectIdCtor.isValid(entryId)) {
    return null;
  }
  const doc = await entries(db).findOneAndUpdate(
    { _id: new ObjectIdCtor(entryId), "media.id": mediaId, userId },
    { $set: { "media.$.posterKey": posterKey, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return doc ? toEntry(doc) : null;
}

// --------------------------------------------------------------- shelf

/**
 * The volume key as an aggregation expression over the stored `date` string.
 * Weeks go through a real date so `$isoWeek` handles year boundaries.
 */
function periodKeyExpression(period: VolumePeriod): Document {
  if (period === "year") {
    return { $substrCP: ["$date", 0, 4] };
  }
  if (period === "month") {
    return { $substrCP: ["$date", 0, 7] };
  }
  const isoWeek = { $isoWeek: "$$day" };
  return {
    $let: {
      in: {
        $concat: [
          { $toString: { $isoWeekYear: "$$day" } },
          "-W",
          {
            $cond: [
              { $lt: [isoWeek, 10] },
              { $concat: ["0", { $toString: isoWeek }] },
              { $toString: isoWeek },
            ],
          },
        ],
      },
      vars: { day: { $dateFromString: { dateString: "$date" } } },
    },
  };
}

interface VolumeRow {
  daysWritten: number;
  entries: number;
  firstEntry: string;
  lastEntry: string;
  mediaCount: number;
  meta?: Pick<VolumeMetaDocument, "color" | "subtitle" | "title">;
  periodKey: string;
  words: number;
}

function toVolume(row: VolumeRow, granularity: VolumePeriod): Volume {
  const title = row.meta?.title ?? null;
  return {
    color: row.meta?.color ?? spineColorFor(row.periodKey),
    daysWritten: row.daysWritten,
    entries: row.entries,
    firstEntry: row.firstEntry,
    granularity,
    lastEntry: row.lastEntry,
    mediaCount: row.mediaCount,
    named: title !== null,
    periodKey: row.periodKey,
    subtitle: row.meta?.subtitle ?? null,
    title: title ?? periodLabel(row.periodKey),
    words: row.words,
  };
}

/**
 * Every volume on the shelf, oldest first, in one aggregation: group the
 * entries by derived period key, then pick up any name or colour the reader
 * gave that volume. Never fetch all entries and group in JS.
 */
export async function listVolumes(
  db: Db,
  userId: string,
  period: VolumePeriod
): Promise<Volume[]> {
  const rows = await entries(db)
    .aggregate<VolumeRow>([
      { $match: { userId } },
      {
        $project: {
          date: 1,
          mediaCount: { $size: "$media" },
          periodKey: periodKeyExpression(period),
          words: 1,
        },
      },
      {
        $group: {
          _id: "$periodKey",
          days: { $addToSet: "$date" },
          entries: { $sum: 1 },
          firstEntry: { $min: "$date" },
          lastEntry: { $max: "$date" },
          mediaCount: { $sum: "$mediaCount" },
          words: { $sum: "$words" },
        },
      },
      {
        $lookup: {
          as: "meta",
          from: "volumeMeta",
          let: { key: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", userId] },
                    { $eq: ["$periodKey", "$$key"] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { _id: 0, color: 1, subtitle: 1, title: 1 } },
          ],
        },
      },
      {
        $project: {
          _id: 0,
          daysWritten: { $size: "$days" },
          entries: 1,
          firstEntry: 1,
          lastEntry: 1,
          mediaCount: 1,
          meta: { $arrayElemAt: ["$meta", 0] },
          periodKey: "$_id",
          words: 1,
        },
      },
      { $sort: { periodKey: 1 } },
    ])
    .toArray();
  return rows.map((row) => toVolume(row, period));
}

const ONE_DAY_MS = 86_400_000;

function daysApart(newer: string, older: string): number {
  return differenceInCalendarDays(parseIsoDate(newer), parseIsoDate(older));
}

/**
 * Longest run of consecutive days, and the run that reaches today (or
 * yesterday: a streak is not broken until a whole day has gone by).
 */
function streaks(
  datesDescending: string[],
  today: string
): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of datesDescending) {
    run = previous && daysApart(previous, date) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  const [newest] = datesDescending;
  if (!newest || daysApart(today, newest) > 1) {
    return { current: 0, longest };
  }
  let current = 0;
  let last: string | null = null;
  for (const date of datesDescending) {
    if (last && daysApart(last, date) !== 1) {
      break;
    }
    current += 1;
    last = date;
  }
  return { current, longest };
}

async function shelfStats(
  db: Db,
  userId: string,
  volumes: Volume[],
  today: string
): Promise<ShelfStats> {
  const dates = await entries(db)
    .find({ userId }, { projection: { _id: 0, date: 1 } })
    .sort({ date: -1 })
    .map((doc) => doc.date)
    .toArray();
  const { current, longest } = streaks(dates, today);
  return {
    currentStreak: current,
    daysWritten: dates.length,
    entries: volumes.reduce((sum, v) => sum + v.entries, 0),
    firstEntry: dates.at(-1) ?? null,
    lastEntry: dates[0] ?? null,
    longestStreak: longest,
    volumes: volumes.length,
    words: volumes.reduce((sum, v) => sum + v.words, 0),
  };
}

export async function getShelf(
  db: Db,
  userId: string,
  period: VolumePeriod,
  today: string
): Promise<Shelf> {
  const volumes = await listVolumes(db, userId, period);
  const stats = await shelfStats(db, userId, volumes, validateDate(today));
  return { stats, volumes };
}

// ------------------------------------------------------------- volumes

export async function getVolume(
  db: Db,
  userId: string,
  periodKey: string
): Promise<VolumeDetail> {
  if (!isPeriodKey(periodKey)) {
    throw new Error("Not a volume.");
  }
  const granularity = granularityOf(periodKey);
  const { start, end } = periodRange(periodKey);
  const [pages, meta] = await Promise.all([
    listEntriesBetween(db, userId, start, end),
    volumeMeta(db).findOne({ periodKey, userId }),
  ]);
  const calendar: Record<string, number> = {};
  for (const page of pages) {
    calendar[page.date] = page.words;
  }
  const oldest = pages.at(-1);
  const [newest] = pages;
  const volume = toVolume(
    {
      daysWritten: pages.length,
      entries: pages.length,
      firstEntry: oldest?.date ?? "",
      lastEntry: newest?.date ?? "",
      mediaCount: pages.reduce((sum, p) => sum + p.mediaCount, 0),
      meta: meta ?? undefined,
      periodKey,
      words: pages.reduce((sum, p) => sum + p.words, 0),
    },
    granularity
  );
  if (pages.length === 0) {
    volume.firstEntry = null;
    volume.lastEntry = null;
  }
  return { calendar, entries: pages, volume };
}

/** Names or recolours a volume. Clearing every field removes the record. */
export async function setVolumeMeta(
  db: Db,
  userId: string,
  periodKey: string,
  input: VolumeMetaInput
): Promise<VolumeMetaInput> {
  if (!isPeriodKey(periodKey)) {
    throw new Error("Not a volume.");
  }
  const clean = validateVolumeMeta(input);
  if (clean.title === null && clean.subtitle === null && clean.color === null) {
    await volumeMeta(db).deleteOne({ periodKey, userId });
    return clean;
  }
  await volumeMeta(db).updateOne(
    { periodKey, userId },
    {
      $set: { ...clean, updatedAt: new Date() },
      $setOnInsert: {
        granularity: granularityOf(periodKey),
        periodKey,
        userId,
      },
    },
    { upsert: true }
  );
  return clean;
}

// ---------------------------------------------------------------- tags

export async function listTags(
  db: Db,
  userId: string,
  limit = 50
): Promise<TagCount[]> {
  return await entries(db)
    .aggregate<TagCount>([
      { $match: { userId } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { _id: 1, count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, count: 1, tag: "$_id" } },
    ])
    .toArray();
}

// -------------------------------------------------------------- search

export async function searchEntries(
  db: Db,
  userId: string,
  query: string,
  limit = 20
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length === 0) {
    return [];
  }
  const docs = await entries(db)
    .find(
      { $text: { $search: q }, userId },
      { projection: { ...SUMMARY_PROJECTION, score: { $meta: "textScore" } } }
    )
    .sort({ date: -1, score: { $meta: "textScore" } })
    .limit(limit)
    .toArray();
  return docs.map((doc) => ({
    ...toSummary(doc),
    score: (doc as EntryDocument & { score: number }).score,
  }));
}

// --------------------------------------------------------- on this day

/**
 * Pages from this same point in earlier periods: the same day of the year,
 * the same day of the month, or the same weekday, depending on how the
 * reader has the shelf divided.
 */
export async function listOnThisDay(
  db: Db,
  userId: string,
  today: string,
  period: VolumePeriod,
  limit = 60
): Promise<OnThisDayHit[]> {
  const day = validateDate(today);
  const thisKey = periodKeyFor(day, period);
  let match: Document;
  if (period === "year") {
    match = { date: { $lt: day, $regex: `-${day.slice(5)}$` } };
  } else if (period === "month") {
    match = { date: { $lt: day, $regex: `-${day.slice(8)}$` } };
  } else {
    const weekday = {
      $isoDayOfWeek: { $dateFromString: { dateString: "$date" } },
    };
    const todayWeekday = {
      $isoDayOfWeek: { $dateFromString: { dateString: day } },
    };
    match = { $expr: { $eq: [weekday, todayWeekday] }, date: { $lt: day } };
  }
  const docs = await entries(db)
    .find({ ...match, userId }, { projection: SUMMARY_PROJECTION })
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
  return docs.map((doc) => ({
    ...toSummary(doc),
    periodsAgo: periodsBetween(periodKeyFor(doc.date, period), thisKey, period),
  }));
}

function periodsBetween(
  from: string,
  to: string,
  period: VolumePeriod
): number {
  if (period === "year") {
    return Number(to) - Number(from);
  }
  if (period === "month") {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    return ((ty ?? 0) - (fy ?? 0)) * 12 + ((tm ?? 0) - (fm ?? 0));
  }
  const a = parseIsoDate(periodRange(from).start).getTime();
  const b = parseIsoDate(periodRange(to).start).getTime();
  return Math.round((b - a) / (7 * ONE_DAY_MS));
}

// --------------------------------------------------------------- atlas

const HOURS_IN_DAY = 24;
const DAYS_IN_WEEK = 7;

export async function getAtlas(
  db: Db,
  userId: string,
  period: VolumePeriod,
  today: string
): Promise<Atlas> {
  const shelf = await getShelf(db, userId, period, today);
  const col = entries(db);
  const [weeks, months, hourRows, weekdayRows, tags] = await Promise.all([
    col
      .aggregate<AtlasWeek>([
        { $match: { userId } },
        {
          $project: {
            entries: { $literal: 1 },
            week: periodKeyExpression("week"),
            words: 1,
          },
        },
        {
          $group: {
            _id: "$week",
            entries: { $sum: 1 },
            words: { $sum: "$words" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, entries: 1, week: "$_id", words: 1 } },
      ])
      .toArray(),
    col
      .aggregate<AtlasMonth>([
        { $match: { userId } },
        {
          $group: {
            _id: { $substrCP: ["$date", 0, 7] },
            entries: { $sum: 1 },
            mood: { $avg: "$mood" },
            words: { $sum: "$words" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, entries: 1, month: "$_id", mood: 1, words: 1 } },
      ])
      .toArray(),
    col
      .aggregate<{ _id: number; count: number }>([
        { $match: { userId, writtenHour: { $ne: null } } },
        { $group: { _id: "$writtenHour", count: { $sum: 1 } } },
      ])
      .toArray(),
    col
      .aggregate<{ _id: number; count: number }>([
        { $match: { userId } },
        {
          $group: {
            _id: {
              $isoDayOfWeek: { $dateFromString: { dateString: "$date" } },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    listTags(db, userId, 30),
  ]);
  const hours = new Array<number>(HOURS_IN_DAY).fill(0);
  for (const row of hourRows) {
    hours[row._id] = row.count;
  }
  const weekdays = new Array<number>(DAYS_IN_WEEK).fill(0);
  for (const row of weekdayRows) {
    weekdays[row._id - 1] = row.count;
  }
  return {
    hours,
    months,
    stats: shelf.stats,
    tags: [...tags].sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
    ),
    volumes: shelf.volumes,
    weekdays,
    weeks,
  };
}
