import {
  formatCount,
  plural,
  spineThickness,
  type Volume,
} from "@repo/mongo/shared";
import { useNavigate } from "@tanstack/react-router";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useElementWidth } from "#/hooks/use-element-width";
import { Spine, UnopenedSpine } from "./spine";

/** What the shelf is laid out for before it has been measured: the page width. */
const DEFAULT_WIDTH = 1040;
const BOOK_GAP = 4;
/** Horizontal padding of a row of books, both sides together. */
const ROW_PADDING = 28;
/** An unopened spine is fixed-width (see .spine-unopened). */
const UNOPENED_WIDTH = 44;
/** The settings preview draws spines at this fraction of their size. */
const MINI_SCALE = 0.6;
/** How long the books take to settle when the shelf first appears. */
const SETTLE_MS = 1400;

interface Row {
  key: string;
  /** True on the first row of a year, which carries the year's label. */
  opensYear: boolean;
  /** The current, unwritten volume goes at the end of this row. */
  unopened: boolean;
  volumes: Volume[];
  year: string;
}

interface YearTally {
  entries: number;
  volumes: number;
  words: number;
}

/**
 * One shelf per year, the books in order, and a new plank whenever a year
 * outgrows the width. Thick books take more room. The current volume, if
 * nothing has been written in it yet, stands at the end of its year.
 */
function packRows(
  volumes: Volume[],
  currentPeriodKey: string,
  unopened: boolean,
  budget: number,
  scale: number
): Row[] {
  const rows: Row[] = [];
  let row: Volume[] = [];
  let used = 0;
  let year = "";
  let opensYear = true;
  const flush = () => {
    const [first] = row;
    if (first) {
      rows.push({
        key: first.periodKey,
        opensYear,
        unopened: false,
        volumes: row,
        year,
      });
      row = [];
      used = 0;
      opensYear = false;
    }
  };
  for (const volume of volumes) {
    const volumeYear = volume.periodKey.slice(0, 4);
    if (volumeYear !== year) {
      flush();
      year = volumeYear;
      opensYear = true;
    }
    const width = spineThickness(volume.entries) * scale + BOOK_GAP;
    if (row.length > 0 && used + width > budget) {
      flush();
    }
    row.push(volume);
    used += width;
  }
  if (unopened) {
    const currentYear = currentPeriodKey.slice(0, 4);
    if (currentYear !== year) {
      flush();
      year = currentYear;
      opensYear = true;
    } else if (used + UNOPENED_WIDTH * scale + BOOK_GAP > budget) {
      flush();
    }
    rows.push({
      key: `${year}-unopened`,
      opensYear,
      unopened: true,
      volumes: row,
      year,
    });
    row = [];
  }
  flush();
  return rows;
}

function tallyYears(volumes: Volume[]): Map<string, YearTally> {
  const years = new Map<string, YearTally>();
  for (const volume of volumes) {
    const year = volume.periodKey.slice(0, 4);
    const tally = years.get(year) ?? { entries: 0, volumes: 0, words: 0 };
    tally.entries += volume.entries;
    tally.volumes += 1;
    tally.words += volume.words;
    years.set(year, tally);
  }
  return years;
}

interface BookcaseProps {
  /** The period the reader is in now; shown as an unopened spine until written in. */
  currentPeriodKey: string;
  mini?: boolean;
  volumes: Volume[];
}

export function Bookcase({
  volumes,
  currentPeriodKey,
  mini = false,
}: BookcaseProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const width = useElementWidth(ref, DEFAULT_WIDTH);
  // Books settle in once, on arrival; a later re-layout just moves them.
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);
  const scale = mini ? MINI_SCALE : 1;
  const currentYear = Number(currentPeriodKey.slice(0, 4));
  const unopened = !volumes.some((v) => v.periodKey === currentPeriodKey);
  const rows = packRows(
    volumes,
    currentPeriodKey,
    unopened,
    width - ROW_PADDING * scale,
    scale
  );
  const years = tallyYears(volumes);
  const order = new Map(volumes.map((v, i) => [v.periodKey, i]));
  const open = (volume: Volume) =>
    navigate({
      params: { periodKey: volume.periodKey },
      to: "/volume/$periodKey",
    });

  // Left and right walk along the shelf, wrapping at the ends, so the whole
  // bookcase reads as one row of books rather than a list of buttons.
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    const bookcase = event.currentTarget.closest(".bookcase");
    if (!bookcase) {
      return;
    }
    const books = [...bookcase.querySelectorAll<HTMLButtonElement>(".spine")];
    const index = books.indexOf(event.currentTarget);
    if (index === -1) {
      return;
    }
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    books[(index + step + books.length) % books.length]?.focus();
  }, []);

  return (
    <section
      aria-label="Bookcase"
      className={mini ? "bookcase shelf-mini" : "bookcase"}
      data-entering={entering ? "" : undefined}
      ref={ref}
    >
      {rows.map((row) => (
        <div className="shelf-row" key={row.key}>
          {row.opensYear ? (
            <ShelfLabel
              mini={mini}
              tally={years.get(row.year)}
              year={row.year}
            />
          ) : null}
          <div className="shelf-books">
            {row.volumes.map((volume) => (
              <Spine
                currentYear={currentYear}
                glimpse={!mini}
                index={order.get(volume.periodKey) ?? 0}
                key={volume.periodKey}
                onKeyDown={onKeyDown}
                onOpen={() => open(volume)}
                volume={volume}
              />
            ))}
            {row.unopened ? (
              <UnopenedSpine
                index={volumes.length}
                onKeyDown={onKeyDown}
                onStart={() => navigate({ to: "/write" })}
                periodKey={currentPeriodKey}
              />
            ) : null}
          </div>
          <div aria-hidden="true" className="shelf-plank" />
        </div>
      ))}
    </section>
  );
}

/** The year, set small at the head of its shelf, with what it holds. */
function ShelfLabel({
  mini,
  tally,
  year,
}: {
  mini: boolean;
  tally: YearTally | undefined;
  year: string;
}) {
  return (
    <div className="shelf-label">
      <span className="shelf-year">{year}</span>
      {tally && !mini ? (
        <span>
          {plural(tally.volumes, "volume")} · {formatCount(tally.words)} words
        </span>
      ) : null}
    </div>
  );
}
