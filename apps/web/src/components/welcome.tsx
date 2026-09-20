import { periodLabel, spineColorFor, type Volume } from "@repo/mongo/shared";
import { Link } from "@tanstack/react-router";
import { Compass, Film, Library } from "lucide-react";
import { Bookcase } from "#/components/shelf/bookcase";
import { Button } from "#/components/ui/button";

/** Fifteen months of a plausible journal, so the door shows what is behind it. */
const SAMPLE: {
  entries: number;
  key: string;
  title?: string;
  words: number;
}[] = [
  { entries: 6, key: "2024-09", words: 1800 },
  { entries: 11, key: "2024-10", words: 4100 },
  { entries: 9, key: "2024-11", words: 3300 },
  { entries: 14, key: "2024-12", words: 5900 },
  { entries: 17, key: "2025-01", title: "The quiet year", words: 7400 },
  { entries: 8, key: "2025-02", words: 2700 },
  { entries: 12, key: "2025-03", words: 4600 },
  { entries: 19, key: "2025-04", words: 8100 },
  { entries: 10, key: "2025-05", words: 3900 },
  { entries: 7, key: "2025-06", words: 2200 },
  { entries: 15, key: "2025-07", title: "Out again", words: 6300 },
  { entries: 13, key: "2025-08", words: 5200 },
  { entries: 20, key: "2025-09", words: 8800 },
  { entries: 9, key: "2025-10", words: 3400 },
  { entries: 12, key: "2025-11", words: 4900 },
  { entries: 16, key: "2025-12", words: 6700 },
];

const SAMPLE_VOLUMES: Volume[] = SAMPLE.map((month) => ({
  color: spineColorFor(month.key),
  daysWritten: month.entries,
  entries: month.entries,
  firstEntry: null,
  granularity: "month",
  lastEntry: null,
  mediaCount: 0,
  named: month.title !== undefined,
  periodKey: month.key,
  subtitle: null,
  title: month.title ?? periodLabel(month.key),
  words: month.words,
}));

const PROMISES = [
  {
    body: "Every spine grows with the words inside it. Full months stand tall; quiet ones stay thin. You can read a year from across the room.",
    icon: Library,
    title: "See the shape of a year",
  },
  {
    body: "Drop a clip or a photo on any page. It is kept under your own key, and nobody else can ask for it.",
    icon: Film,
    title: "Words and video, a page a day",
  },
  {
    body: "The Atlas turns the whole journal into a grid of days, a line of moods and the hours you tend to write.",
    icon: Compass,
    title: "Read it back as a picture",
  },
];

/** Signed out: the door, and a look through it. */
export function Welcome() {
  return (
    <main className="page-wrap rise-in px-4 pt-14 pb-10">
      <section className="max-w-[58ch]">
        <p className="kicker mb-4">A private journal</p>
        <h1 className="display-title mb-5 text-balance text-[clamp(38px,6vw,60px)] text-ink">
          Your years, standing on a shelf.
        </h1>
        <p className="mb-4 text-pretty font-serif text-[19px] text-ink-soft leading-relaxed">
          Write a page a day. Each week, month or year becomes a book, and the
          shelf fills up: thicker spines where you had more to say, thin ones
          where you didn't. From across the room you can see the shape of a year
          before you read a word of it.
        </p>
        <p className="mb-8 text-[15px] text-ink-faint">
          Words and video, kept for you alone. Nothing here is shared, sold or
          indexed.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild size="lg">
            <Link to="/login">Sign in to your shelf</Link>
          </Button>
          <span className="text-[13px] text-ink-faint">
            Free for words. Export any time.
          </span>
        </div>
      </section>

      <div aria-hidden="true" className="mt-12 select-none" inert>
        <Bookcase currentPeriodKey="2025-12" volumes={SAMPLE_VOLUMES} />
      </div>

      <section className="mt-4 grid gap-8 border-rule border-t pt-10 sm:grid-cols-3">
        {PROMISES.map(({ body, icon: Icon, title }) => (
          <div key={title}>
            <span className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-paper-sunk text-ink-soft">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <h2 className="m-0 mb-1.5 font-serif text-[20px] text-ink">
              {title}
            </h2>
            <p className="m-0 text-[14.5px] text-ink-soft leading-relaxed">
              {body}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
