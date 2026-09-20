// Server functions for the journal. Only the `.handler()` bodies run on the
// server; the client bundle gets RPC stubs, so importing the driver and
// `cloudflare:workers` here never reaches the browser.
//
// Every handler resolves the Clerk user itself. A `userId` is never accepted
// from the client, which is what keeps one reader's shelf private from another.

import { env } from "cloudflare:workers";
import { auth } from "@clerk/tanstack-react-start/server";
import { withDb } from "@repo/mongo";
import {
  deleteEntry,
  getAtlas,
  getEntry,
  getEntryNeighbours,
  getSettings,
  getShelf,
  getVolume,
  listEntriesByTag,
  listOnThisDay,
  listRecentEntries,
  listTags,
  saveEntry,
  searchEntries,
  setVolumeMeta,
  updateMedia,
  updateSettings,
} from "@repo/mongo/journal";
import {
  type EntryInput,
  isIsoDate,
  isMood,
  isPeriodKey,
  isShelfOrder,
  isVolumePeriod,
  type VolumeMetaInput,
} from "@repo/mongo/shared";
import { createServerFn } from "@tanstack/react-start";
import { mediaEnabled, readerToday, requireUserId } from "./context";

const RECENT_ON_SHELF = 6;
const TAGS_ON_SHELF = 24;
const SEARCH_LIMIT = 20;
const TAG_SUGGESTIONS = 50;

// ---------------------------------------------------------------- helpers

function asObject(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object") {
    throw new Error("Expected an object.");
  }
  return input as Record<string, unknown>;
}

function dateInput(input: unknown): { date: string } {
  const { date } = asObject(input);
  if (!isIsoDate(date)) {
    throw new Error("Expected a date like 2026-09-17.");
  }
  return { date };
}

function optionalDateInput(input: unknown): { date?: string } {
  const { date } = asObject(input ?? {});
  if (date === undefined) {
    return {};
  }
  if (!isIsoDate(date)) {
    throw new Error("Expected a date like 2026-09-17.");
  }
  return { date };
}

function periodKeyInput(input: unknown): { periodKey: string } {
  const { periodKey } = asObject(input);
  if (!isPeriodKey(periodKey)) {
    throw new Error("Not a volume.");
  }
  return { periodKey };
}

function entryInput(input: unknown): EntryInput {
  const raw = asObject(input);
  const { date } = dateInput(raw);
  if (typeof raw.title !== "string" || typeof raw.body !== "string") {
    throw new Error("Title and body must be text.");
  }
  if (!Array.isArray(raw.tags) || raw.tags.some((t) => typeof t !== "string")) {
    throw new Error("Tags must be a list of text.");
  }
  if (raw.mood !== null && !isMood(raw.mood)) {
    throw new Error("Mood must be 1 to 5, or empty.");
  }
  const writtenHour =
    typeof raw.writtenHour === "number" ? raw.writtenHour : null;
  return {
    body: raw.body,
    date,
    mood: raw.mood,
    tags: raw.tags as string[],
    title: raw.title,
    writtenHour,
  };
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }
  return value;
}

// ------------------------------------------------------------------ shelf

export const getShelfFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { userId } = await auth();
    if (!userId) {
      return { signedIn: false as const };
    }
    const today = readerToday();
    return await withDb(env.MONGODB_URI, async (db) => {
      const settings = await getSettings(db, userId);
      const [shelf, recent, tags] = await Promise.all([
        getShelf(db, userId, settings.volumePeriod, today),
        listRecentEntries(db, userId, RECENT_ON_SHELF),
        listTags(db, userId, TAGS_ON_SHELF),
      ]);
      return { recent, settings, shelf, signedIn: true as const, tags, today };
    });
  }
);

// ---------------------------------------------------------------- entries

/** The page for a day, with its neighbours, or null when nothing is written. */
export const getEntryPageFn = createServerFn({ method: "GET" })
  .validator(dateInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, async (db) => {
      const [entry, neighbours, settings, tags] = await Promise.all([
        getEntry(db, userId, data.date),
        getEntryNeighbours(db, userId, data.date),
        getSettings(db, userId),
        listTags(db, userId, TAG_SUGGESTIONS),
      ]);
      return {
        entry,
        mediaEnabled: mediaEnabled(),
        settings,
        tags: tags.map((t) => t.tag),
        today: readerToday(),
        ...neighbours,
      };
    });
  });

/** What the editor needs: the page for `date` (today by default), if any. */
export const getWritePageFn = createServerFn({ method: "GET" })
  .validator(optionalDateInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const date = data.date ?? readerToday();
    return await withDb(env.MONGODB_URI, async (db) => {
      const [entry, tags] = await Promise.all([
        getEntry(db, userId, date),
        listTags(db, userId, TAG_SUGGESTIONS),
      ]);
      return {
        date,
        entry,
        mediaEnabled: mediaEnabled(),
        tags: tags.map((t) => t.tag),
        today: readerToday(),
      };
    });
  });

export const saveEntryFn = createServerFn({ method: "POST" })
  .validator(entryInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, (db) => saveEntry(db, userId, data));
  });

export const deleteEntryFn = createServerFn({ method: "POST" })
  .validator(dateInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const result = await withDb(env.MONGODB_URI, (db) =>
      deleteEntry(db, userId, data.date)
    );
    const bucket = env.MEDIA;
    if (result && bucket) {
      await Promise.all(result.mediaKeys.map((key) => bucket.delete(key)));
    }
    return { deleted: result !== null };
  });

export const updateMediaFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = asObject(input);
    const { date } = dateInput(raw);
    if (!Array.isArray(raw.media)) {
      throw new Error("Expected a list of clips.");
    }
    const media = raw.media.map((item) => {
      const clip = asObject(item);
      if (typeof clip.id !== "string") {
        throw new Error("Each clip needs an id.");
      }
      return {
        caption: nullableString(clip.caption, "Caption") ?? undefined,
        id: clip.id,
      };
    });
    return { date, media };
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, (db) =>
      updateMedia(db, userId, data.date, data.media)
    );
  });

// ---------------------------------------------------------------- volumes

export const getVolumeFn = createServerFn({ method: "GET" })
  .validator(periodKeyInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, async (db) => {
      const [detail, settings] = await Promise.all([
        getVolume(db, userId, data.periodKey),
        getSettings(db, userId),
      ]);
      return { ...detail, settings, today: readerToday() };
    });
  });

export const setVolumeMetaFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = asObject(input);
    const { periodKey } = periodKeyInput(raw);
    const meta: VolumeMetaInput = {
      color: nullableString(raw.color, "Colour"),
      subtitle: nullableString(raw.subtitle, "Subtitle"),
      title: nullableString(raw.title, "Title"),
    };
    return { meta, periodKey };
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, (db) =>
      setVolumeMeta(db, userId, data.periodKey, data.meta)
    );
  });

// --------------------------------------------------------------- settings

export const getSettingsPageFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await requireUserId();
    const today = readerToday();
    return await withDb(env.MONGODB_URI, async (db) => {
      const settings = await getSettings(db, userId);
      // Every grouping at once, so the settings page can preview the reshelve
      // without a round trip per click.
      const [week, month, year] = await Promise.all([
        getShelf(db, userId, "week", today),
        getShelf(db, userId, "month", today),
        getShelf(db, userId, "year", today),
      ]);
      return { previews: { month, week, year }, settings, today };
    });
  }
);

export const updateSettingsFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const { shelfOrder, volumePeriod } = asObject(input);
    if (!isVolumePeriod(volumePeriod)) {
      throw new Error("Volume length must be week, month or year.");
    }
    if (!isShelfOrder(shelfOrder)) {
      throw new Error("The shelf can run newest or oldest year first.");
    }
    return { shelfOrder, volumePeriod };
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, (db) =>
      updateSettings(db, userId, data)
    );
  });

// ----------------------------------------------------- search and the rest

export const searchFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const { q } = asObject(input);
    if (typeof q !== "string") {
      throw new Error("Expected { q: string }.");
    }
    return { q };
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, (db) =>
      searchEntries(db, userId, data.q, SEARCH_LIMIT)
    );
  });

export const getOnThisDayFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await requireUserId();
    const today = readerToday();
    return await withDb(env.MONGODB_URI, async (db) => {
      const settings = await getSettings(db, userId);
      const hits = await listOnThisDay(
        db,
        userId,
        today,
        settings.volumePeriod
      );
      return { hits, settings, today };
    });
  }
);

export const getAtlasFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await requireUserId();
    const today = readerToday();
    return await withDb(env.MONGODB_URI, async (db) => {
      const settings = await getSettings(db, userId);
      const atlas = await getAtlas(db, userId, settings.volumePeriod, today);
      return { atlas, settings, today };
    });
  }
);

export const getTagPageFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const { tag } = asObject(input);
    if (typeof tag !== "string" || tag.trim().length === 0) {
      throw new Error("Expected a tag.");
    }
    return { tag };
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return await withDb(env.MONGODB_URI, async (db) => ({
      entries: await listEntriesByTag(db, userId, data.tag),
    }));
  });
