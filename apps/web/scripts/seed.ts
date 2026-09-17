#!/usr/bin/env bun
// Fills the dev user's shelf with a few years of plausible pages so the
// bookcase can be seen full. Dev-only: it needs DEV_LOGIN_EMAIL to know whose
// shelf to fill, and that variable is never set on a deployed Worker.
//
//   bun run seed            # add pages for days that have none
//   bun run seed --clear    # tear out every page of the dev user first
//
// Reads CLERK_SECRET_KEY, DEV_LOGIN_EMAIL and MONGODB_URI from apps/web/.env.local.
import { createClerkClient } from "@clerk/backend";
import { withDb } from "@repo/mongo";
import { saveEntry } from "@repo/mongo/journal";
import { type Mood, toIsoDate } from "@repo/mongo/shared";
import { addDays, differenceInCalendarDays } from "date-fns";

const secretKey = process.env.CLERK_SECRET_KEY;
const email = process.env.DEV_LOGIN_EMAIL;
const uri = process.env.MONGODB_URI;
if (!(secretKey && email && uri)) {
  throw new Error(
    "CLERK_SECRET_KEY, DEV_LOGIN_EMAIL and MONGODB_URI must be set in apps/web/.env.local"
  );
}

const clear = process.argv.includes("--clear");
const YEARS_BACK = 3;
const WRITE_PROBABILITY = 0.42;

const clerk = createClerkClient({ secretKey });
const { data } = await clerk.users.getUserList({ emailAddress: [email] });
const [user] = data;
if (!user) {
  throw new Error(
    `No Clerk user for ${email}. Run "bun run create-dev-user" first.`
  );
}
const userId = user.id;

// A small deterministic generator so re-runs produce the same shelf.
let seed = 20_260_917;
function random(): number {
  seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
  return seed / 4_294_967_296;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

const TITLES = [
  "The river path",
  "A slow morning",
  "Rain on the skylight",
  "The long middle",
  "Out again",
  "Nothing much, and that was fine",
  "Hawthorn",
  "The quiet year",
  "Late light",
  "Bread, twice",
  "A phone call I put off",
  "The garden after the storm",
  "Sunday, unhurried",
  "Trains",
  "The book I keep not finishing",
  "What the dog knows",
  "Coffee with M.",
  "First frost",
  "Small repairs",
  "The last of the plums",
] as const;

const OPENERS = [
  "A quiet, ordinary day that I want to remember for exactly that reason.",
  "Woke before the alarm and lay there listening to the house.",
  "Walked the river path with the hawthorn out and the water high.",
  "Rain most of the day, the kind that makes the kitchen feel like a boat.",
  "Spent the morning on small repairs and the afternoon pretending I hadn't.",
  "Thinking about how the years stack up without asking permission.",
  "Made bread. It was fine. The second loaf was better.",
  "A long call with my sister, mostly about nothing, which is the point.",
  "Trains were late so I read on the platform and was almost glad of it.",
  "Everything smelled of cut grass and diesel.",
] as const;

const MIDDLES = [
  "The dog found something dead and was delighted; I was not.",
  "Wrote three paragraphs of the thing and deleted two. Progress, of a sort.",
  "M. says I should stop apologising for being tired. She is right.",
  "Noticed the light is already going by five. Every year this surprises me.",
  "Made a list. Lost the list. Found it in the bread bin.",
  "Somebody had left a chair out by the canal, facing the water, and I sat in it.",
  "The neighbours' kid is learning the trumpet. We are all learning the trumpet.",
  "Planted the garlic late, as usual. It forgives me every year.",
  "The market was loud and I bought too many tomatoes and no regrets.",
  "Read in the bath until the water went cold.",
  "A heron on the weir, still as a hook.",
  "Fixed the gate. It will need fixing again by spring.",
] as const;

const CLOSERS = [
  "Tomorrow: earlier start, hopefully.",
  "Bed early. Good.",
  "Nothing to report, which is its own report.",
  "Grateful, mostly. Tired, entirely.",
  "Will try the walk again if the rain holds off.",
  "That was the day. It will do.",
] as const;

const TAGS = [
  "walks",
  "family",
  "work",
  "garden",
  "books",
  "cooking",
  "weather",
  "the dog",
  "music",
  "friends",
] as const;

function bodyFor(): string {
  const parts = [pick(OPENERS), "", pick(MIDDLES)];
  if (random() > 0.5) {
    parts.push("", pick(MIDDLES));
  }
  if (random() > 0.6) {
    parts.push("", `> ${pick(MIDDLES)}`);
  }
  parts.push("", pick(CLOSERS));
  return parts.join("\n");
}

function moodFor(): Mood | null {
  if (random() < 0.2) {
    return null;
  }
  // Skewed towards "even" and "good", like most weeks.
  return pick([2, 3, 3, 3, 4, 4, 4, 5, 1] as const);
}

function tagsFor(): string[] {
  const count = random() < 0.15 ? 0 : 1 + Math.floor(random() * 2);
  return [...new Set(Array.from({ length: count }, () => pick(TAGS)))];
}

await withDb(uri, async (db) => {
  if (clear) {
    const { deletedCount } = await db
      .collection("entries")
      .deleteMany({ userId });
    await db.collection("volumeMeta").deleteMany({ userId });
    console.log(`Tore out ${deletedCount} pages.`);
  }
  const existing = new Set(
    await db
      .collection<{ date: string }>("entries")
      .find({ userId }, { projection: { _id: 0, date: 1 } })
      .map((doc) => doc.date)
      .toArray()
  );

  const today = new Date();
  const start = addDays(today, -365 * YEARS_BACK);
  const days = differenceInCalendarDays(today, start);
  let written = 0;
  const jobs: Promise<unknown>[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = toIsoDate(addDays(start, i));
    if (existing.has(date) || random() > WRITE_PROBABILITY) {
      continue;
    }
    written += 1;
    jobs.push(
      saveEntry(db, userId, {
        body: bodyFor(),
        date,
        mood: moodFor(),
        tags: tagsFor(),
        title: random() < 0.85 ? pick(TITLES) : "",
        writtenHour: pick([7, 8, 9, 12, 13, 18, 20, 21, 21, 22, 22, 23]),
      })
    );
    if (jobs.length >= 25) {
      // biome-ignore lint/performance/noAwaitInLoops: batches of 25 keep the connection count sane against Atlas
      await Promise.all(jobs.splice(0));
    }
  }
  await Promise.all(jobs);

  // A couple of named volumes, so the shelf shows both kinds of spine.
  const year = today.getFullYear();
  await db.collection("volumeMeta").updateOne(
    { periodKey: String(year - 1), userId },
    {
      $set: {
        color: "#3f5b52",
        subtitle: "so far",
        title: "The Long Middle",
        updatedAt: new Date(),
      },
      $setOnInsert: {
        granularity: "year",
        periodKey: String(year - 1),
        userId,
      },
    },
    { upsert: true }
  );
  await db.collection("volumeMeta").updateOne(
    { periodKey: String(year - 2), userId },
    {
      $set: {
        color: "#7d4a3b",
        subtitle: null,
        title: "The Quiet Year",
        updatedAt: new Date(),
      },
      $setOnInsert: {
        granularity: "year",
        periodKey: String(year - 2),
        userId,
      },
    },
    { upsert: true }
  );
  console.log(
    `Wrote ${written} pages for ${email} (${userId}) on ${db.databaseName}.`
  );
});
