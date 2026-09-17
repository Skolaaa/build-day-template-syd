// Runs against a throwaway in-memory MongoDB (mongodb-memory-server), so no
// running database is needed. The first run downloads the mongod binary.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Db, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  addMedia,
  deleteEntry,
  ensureJournalIndexes,
  getAtlas,
  getEntry,
  getEntryNeighbours,
  getSettings,
  getShelf,
  getVolume,
  listOnThisDay,
  listTags,
  listVolumes,
  removeMediaByKey,
  saveEntry,
  searchEntries,
  setVolumeMeta,
  updateMedia,
  updateSettings,
} from "./journal.ts";
import { type EntryInput, type MediaRef, mediaKeyFor } from "./shared.ts";

let server: MongoMemoryServer;
let client: MongoClient;
let db: Db;

const ALICE = "user_alice";
const BOB = "user_bob";

function page(date: string, overrides: Partial<EntryInput> = {}): EntryInput {
  return {
    body: "A quiet, ordinary day that I want to remember.",
    date,
    mood: 4,
    tags: ["ordinary"],
    title: `Page ${date}`,
    ...overrides,
  };
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  client = new MongoClient(server.getUri());
  db = client.db("test");
  await ensureJournalIndexes(db);

  // Alice: pages straddling a year end, so weeks and months disagree.
  await Promise.all(
    [
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-15",
      "2026-09-16",
      "2026-09-17",
    ].map((date) => saveEntry(db, ALICE, page(date, { writtenHour: 21 })))
  );
  await saveEntry(
    db,
    ALICE,
    page("2026-09-17", {
      body: "Walked the river path with the hawthorn out. Eleven words here now.",
      tags: ["walks", "Hawthorn", " walks "],
      title: "The river path",
      writtenHour: 21,
    })
  );
  await saveEntry(db, BOB, page("2026-09-17", { title: "Bob's page" }));
});

afterAll(async () => {
  await client.close();
  await server.stop();
});

describe("entries", () => {
  test("saveEntry upserts by date, normalises tags and counts words", async () => {
    const entry = must(await getEntry(db, ALICE, "2026-09-17"));
    expect(entry.title).toBe("The river path");
    expect(entry.tags).toEqual(["walks", "hawthorn"]);
    expect(entry.words).toBe(15);
    expect(entry.media).toEqual([]);
    expect(typeof entry.id).toBe("string");
    expect(new Date(entry.createdAt).toISOString()).toBe(entry.createdAt);
  });

  test("one page per day per user, and users never see each other's pages", async () => {
    const alice = await getEntry(db, ALICE, "2026-09-17");
    const bob = await getEntry(db, BOB, "2026-09-17");
    expect(alice?.title).toBe("The river path");
    expect(bob?.title).toBe("Bob's page");
    expect(await getEntry(db, BOB, "2026-01-01")).toBeNull();
  });

  test("saveEntry rejects bad input before it reaches the database", async () => {
    await expect(saveEntry(db, ALICE, page("2026-02-30"))).rejects.toThrow(
      "date"
    );
    await expect(
      saveEntry(db, ALICE, page("2026-03-01", { mood: 9 as never }))
    ).rejects.toThrow("Mood");
    await expect(
      saveEntry(db, ALICE, page("2026-03-01", { tags: ["x".repeat(41)] }))
    ).rejects.toThrow("tag");
  });

  test("neighbours walk by date within one user", async () => {
    const { older, newer } = await getEntryNeighbours(db, ALICE, "2026-01-01");
    expect(older?.date).toBe("2025-12-31");
    expect(newer?.date).toBe("2026-01-02");
    const edge = await getEntryNeighbours(db, BOB, "2026-09-17");
    expect(edge).toEqual({ newer: null, older: null });
  });

  test("deleteEntry returns the media keys to clean up", async () => {
    const saved = await saveEntry(db, ALICE, page("2024-06-01"));
    const ref = fakeMedia(ALICE, saved.id);
    await addMedia(db, ALICE, saved.id, ref);
    expect(await deleteEntry(db, ALICE, "2024-06-01")).toEqual({
      mediaKeys: [ref.key],
    });
    expect(await deleteEntry(db, ALICE, "2024-06-01")).toBeNull();
  });
});

describe("settings", () => {
  test("defaults to monthly volumes and persists a change", async () => {
    expect(await getSettings(db, ALICE)).toEqual({ volumePeriod: "month" });
    await updateSettings(db, ALICE, { volumePeriod: "week" });
    expect(await getSettings(db, ALICE)).toEqual({ volumePeriod: "week" });
    await updateSettings(db, ALICE, { volumePeriod: "month" });
    expect(await getSettings(db, BOB)).toEqual({ volumePeriod: "month" });
  });
});

describe("shelf aggregation", () => {
  test("groups by year", async () => {
    const volumes = await listVolumes(db, ALICE, "year");
    expect(volumes.map((v) => [v.periodKey, v.entries])).toEqual([
      ["2025", 3],
      ["2026", 5],
    ]);
    const [v2025] = volumes;
    expect(v2025?.firstEntry).toBe("2025-12-29");
    expect(v2025?.lastEntry).toBe("2025-12-31");
    expect(v2025?.daysWritten).toBe(3);
    expect(v2025?.title).toBe("2025");
    expect(v2025?.named).toBe(false);
    expect(v2025?.words).toBe(3 * 11);
  });

  test("groups by month", async () => {
    const volumes = await listVolumes(db, ALICE, "month");
    expect(volumes.map((v) => [v.periodKey, v.entries])).toEqual([
      ["2025-12", 3],
      ["2026-01", 3],
      ["2026-09", 2],
    ]);
    expect(volumes[1]?.title).toBe("January 2026");
  });

  test("groups by ISO week, so the year-end week is one volume", async () => {
    const volumes = await listVolumes(db, ALICE, "week");
    expect(volumes.map((v) => [v.periodKey, v.entries])).toEqual([
      ["2026-W01", 5],
      ["2026-W03", 1],
      ["2026-W38", 2],
    ]);
    expect(volumes[0]?.firstEntry).toBe("2025-12-29");
    expect(volumes[0]?.lastEntry).toBe("2026-01-02");
  });

  test("is scoped to the user", async () => {
    const volumes = await listVolumes(db, BOB, "year");
    expect(volumes.map((v) => [v.periodKey, v.entries])).toEqual([["2026", 1]]);
  });

  test("joins the volume's name and colour when the reader set one", async () => {
    await setVolumeMeta(db, ALICE, "2026", {
      color: "#3f5b52",
      subtitle: "so far",
      title: "The Long Middle",
    });
    const [, v2026] = await listVolumes(db, ALICE, "year");
    expect(v2026?.title).toBe("The Long Middle");
    expect(v2026?.subtitle).toBe("so far");
    expect(v2026?.color).toBe("#3f5b52");
    expect(v2026?.named).toBe(true);
    // Bob's 2026 is untouched by Alice's naming.
    const [bob2026] = await listVolumes(db, BOB, "year");
    expect(bob2026?.named).toBe(false);
    // Clearing every field removes the record and the defaults come back.
    await setVolumeMeta(db, ALICE, "2026", {
      color: null,
      subtitle: null,
      title: null,
    });
    const [, cleared] = await listVolumes(db, ALICE, "year");
    expect(cleared?.title).toBe("2026");
  });

  test("getShelf adds totals and streaks", async () => {
    const shelf = await getShelf(db, ALICE, "year", "2026-09-17");
    expect(shelf.stats.entries).toBe(8);
    expect(shelf.stats.volumes).toBe(2);
    expect(shelf.stats.firstEntry).toBe("2025-12-29");
    expect(shelf.stats.lastEntry).toBe("2026-09-17");
    expect(shelf.stats.longestStreak).toBe(5);
    expect(shelf.stats.currentStreak).toBe(2);
    const later = await getShelf(db, ALICE, "year", "2026-09-19");
    expect(later.stats.currentStreak).toBe(0);
  });
});

describe("volume detail", () => {
  test("lists pages newest first with a calendar of words", async () => {
    const detail = await getVolume(db, ALICE, "2026-W01");
    expect(detail.entries.map((e) => e.date)).toEqual([
      "2026-01-02",
      "2026-01-01",
      "2025-12-31",
      "2025-12-30",
      "2025-12-29",
    ]);
    expect(detail.calendar["2026-01-01"]).toBe(11);
    expect(detail.volume.granularity).toBe("week");
    expect(detail.volume.entries).toBe(5);
  });

  test("an unwritten volume is still a volume", async () => {
    const detail = await getVolume(db, ALICE, "2019");
    expect(detail.entries).toEqual([]);
    expect(detail.volume.entries).toBe(0);
    expect(detail.volume.firstEntry).toBeNull();
  });
});

describe("media", () => {
  test("attach, caption, reorder and detach", async () => {
    const saved = await saveEntry(db, ALICE, page("2024-07-01"));
    const clip = fakeMedia(ALICE, saved.id, "video/mp4");
    const still = fakeMedia(ALICE, saved.id, "image/png");
    await addMedia(db, ALICE, saved.id, clip);
    let entry = await addMedia(db, ALICE, saved.id, still);
    expect(entry.media.map((m) => m.id)).toEqual([clip.id, still.id]);

    entry = await updateMedia(db, ALICE, "2024-07-01", [
      { caption: "the hawthorn", id: still.id },
      { id: clip.id },
    ]);
    expect(entry.media.map((m) => m.id)).toEqual([still.id, clip.id]);
    expect(entry.media[0]?.caption).toBe("the hawthorn");

    await expect(
      updateMedia(db, ALICE, "2024-07-01", [{ id: still.id }])
    ).rejects.toThrow("does not match");

    // Bob cannot detach Alice's clip, even knowing the key.
    expect(await removeMediaByKey(db, BOB, clip.key)).toBeNull();
    const removed = must(await removeMediaByKey(db, ALICE, clip.key));
    expect(removed.removed.id).toBe(clip.id);
    expect(removed.entry.media.map((m) => m.id)).toEqual([still.id]);
  });

  test("addMedia refuses another user's page", async () => {
    const saved = must(await getEntry(db, ALICE, "2026-09-17"));
    await expect(
      addMedia(db, BOB, saved.id, fakeMedia(BOB, saved.id))
    ).rejects.toThrow("Unknown page");
  });
});

describe("search, tags, on this day, atlas", () => {
  test("search is full text and scoped to the user", async () => {
    const hits = await searchEntries(db, ALICE, "hawthorn");
    expect(hits.map((h) => h.date)).toEqual(["2026-09-17"]);
    expect(hits[0]?.score).toBeGreaterThan(0);
    expect(await searchEntries(db, BOB, "hawthorn")).toEqual([]);
    expect(await searchEntries(db, ALICE, "   ")).toEqual([]);
  });

  test("tags are counted per user", async () => {
    const tags = await listTags(db, ALICE);
    expect(tags.find((t) => t.tag === "walks")?.count).toBe(1);
    expect(tags.find((t) => t.tag === "ordinary")?.count).toBe(8);
  });

  test("on this day follows the shelf's period", async () => {
    await saveEntry(db, ALICE, page("2025-09-17"));
    const byYear = await listOnThisDay(db, ALICE, "2026-09-17", "year");
    expect(byYear.map((h) => [h.date, h.periodsAgo])).toEqual([
      ["2025-09-17", 1],
    ]);
    const byMonth = await listOnThisDay(db, ALICE, "2026-09-17", "month");
    expect(byMonth.map((h) => h.date)).toEqual(["2025-09-17"]);
    // 17 Sep 2026 is a Thursday, as were 15 Jan and 1 Jan; 17 Sep 2025 was not.
    const byWeek = await listOnThisDay(db, ALICE, "2026-09-17", "week");
    expect(byWeek.map((h) => [h.date, h.periodsAgo])).toEqual([
      ["2026-01-15", 35],
      ["2026-01-01", 37],
    ]);
    await deleteEntry(db, ALICE, "2025-09-17");
  });

  test("atlas rolls the journal up by week, month, hour and weekday", async () => {
    const atlas = await getAtlas(db, ALICE, "year", "2026-09-17");
    expect(atlas.weeks.find((w) => w.week === "2026-W01")?.entries).toBe(5);
    expect(atlas.days.map((d) => d.date)).toEqual(
      [...atlas.days.map((d) => d.date)].sort()
    );
    expect(atlas.days.length).toBe(atlas.stats.entries);
    expect(atlas.months.find((m) => m.month === "2025-12")?.mood).toBe(4);
    // The hour is captured when a page is first started, never on later edits.
    expect(atlas.hours[21]).toBe(8);
    // Mondays: 29 Dec 2025, plus 1 Jul 2024 left behind by the media test.
    expect(atlas.weekdays[0]).toBe(2);
    expect(atlas.tags[0]?.tag).toBe("ordinary");
    // 2024 (the media test), 2025 and 2026.
    expect(atlas.volumes.length).toBe(3);
  });
});

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected a value.");
  }
  return value;
}

let mediaCounter = 0;

function fakeMedia(
  userId: string,
  entryId: string,
  contentType: "video/mp4" | "image/png" = "video/mp4"
): MediaRef {
  mediaCounter += 1;
  return {
    bytes: 1024,
    contentType,
    createdAt: new Date().toISOString(),
    id: `media_${mediaCounter}`,
    key: mediaKeyFor(userId, entryId, contentType, `uuid_${mediaCounter}`),
    kind: contentType === "video/mp4" ? "video" : "image",
  };
}
