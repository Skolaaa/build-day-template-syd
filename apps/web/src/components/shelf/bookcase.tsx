import {
  formatCount,
  granularityOf,
  periodSpanLabel,
  plural,
  type ShelfOrder,
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
/** The uprights and the books' inset from them, both sides together. */
const CASE_PADDING = 56;
/** An unopened spine is fixed-width (see .spine-unopened). */
const UNOPENED_WIDTH = 44;
/** The settings preview draws spines at this fraction of their size. */
const MINI_SCALE = 0.6;
/** How long the books take to settle when the shelf first appears. */
const SETTLE_MS = 1400;

interface Row {
  key: string;
  /** The year this plank belongs to; one word for all of them for year volumes. */
  tier: string;
  /** The current, unwritten volume goes at the end of this row. */
  unopened: boolean;
  volumes: Volume[];
}

interface Tally {
  entries: number;
  volumes: number;
  words: number;
}

/**
 * Which shelf a volume belongs on. Weeks and months stack by year; year
 * volumes are one book each, so they share a run of planks.
 */
function tierOf(periodKey: string): string {
  return granularityOf(periodKey) === "year" ? "years" : periodKey.slice(0, 4);
}

/** A book on a plank, or the space where the current, unwritten one stands. */
type Item = Volume | "unopened";

function itemWidth(item: Item, scale: number): number {
  const width =
    item === "unopened" ? UNOPENED_WIDTH : spineThickness(item.entries);
  return width * scale + BOOK_GAP;
}

/**
 * One shelf per year, the books in order, and a new plank whenever a year
 * outgrows the width. Thick books take more room. The current volume, if
 * nothing has been written in it yet, stands at the end of its year. A
 * year that needs more than one plank fills from the end the reader is
 * looking at, so the odd plank is the far one, not the first thing seen.
 */
function packRows(
  volumes: Volume[],
  currentPeriodKey: string,
  unopened: boolean,
  budget: number,
  scale: number,
  order: ShelfOrder
): Row[] {
  const tiers = new Map<string, Item[]>();
  for (const volume of volumes) {
    const tier = tierOf(volume.periodKey);
    tiers.set(tier, [...(tiers.get(tier) ?? []), volume]);
  }
  if (unopened) {
    const tier = tierOf(currentPeriodKey);
    tiers.set(tier, [...(tiers.get(tier) ?? []), "unopened"]);
  }
  const rows: Row[] = [];
  for (const [tier, items] of tiers) {
    rows.push(...packTier(tier, items, budget, scale, order === "newest"));
  }
  return rows;
}

function packTier(
  tier: string,
  items: Item[],
  budget: number,
  scale: number,
  fromEnd: boolean
): Row[] {
  const planks: Item[][] = [];
  let plank: Item[] = [];
  let used = 0;
  for (const item of fromEnd ? items.toReversed() : items) {
    const width = itemWidth(item, scale);
    if (plank.length > 0 && used + width > budget) {
      planks.push(plank);
      plank = [];
      used = 0;
    }
    plank.push(item);
    used += width;
  }
  planks.push(plank);
  const ordered = fromEnd
    ? planks.toReversed().map((p) => p.toReversed())
    : planks;
  return ordered.map((plankItems) => {
    const volumes = plankItems.filter((item) => item !== "unopened");
    const hasUnopened = plankItems.length !== volumes.length;
    const [first] = volumes;
    return {
      key: first ? first.periodKey : `${tier}-unopened`,
      tier,
      unopened: hasUnopened,
      volumes,
    };
  });
}

function tallyTiers(volumes: Volume[]): Map<string, Tally> {
  const tiers = new Map<string, Tally>();
  for (const volume of volumes) {
    const tier = tierOf(volume.periodKey);
    const tally = tiers.get(tier) ?? { entries: 0, volumes: 0, words: 0 };
    tally.entries += volume.entries;
    tally.volumes += 1;
    tally.words += volume.words;
    tiers.set(tier, tally);
  }
  return tiers;
}

/** The first and last period standing on a plank, the unopened one included. */
function rowSpan(row: Row, currentPeriodKey: string): [string, string] {
  const first = row.volumes[0]?.periodKey ?? currentPeriodKey;
  const last = row.unopened
    ? currentPeriodKey
    : (row.volumes.at(-1)?.periodKey ?? first);
  return [first, last];
}

interface BookcaseProps {
  /** The period the reader is in now; shown as an unopened spine until written in. */
  currentPeriodKey: string;
  mini?: boolean;
  /** Which year takes the top shelf. */
  order?: ShelfOrder;
  volumes: Volume[];
}

export function Bookcase({
  volumes,
  currentPeriodKey,
  mini = false,
  order = "newest",
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
  const packed = packRows(
    volumes,
    currentPeriodKey,
    unopened,
    width - CASE_PADDING * scale,
    scale,
    order
  );
  // Books read left to right in time on every plank; the order setting only
  // decides which end of the case the present is at.
  const rows = order === "newest" ? packed.toReversed() : packed;
  const tallies = tallyTiers(volumes);
  const plankCount = new Map<string, number>();
  const lastRowOfTier = new Map<string, string>();
  for (const row of packed) {
    plankCount.set(row.tier, (plankCount.get(row.tier) ?? 0) + 1);
    lastRowOfTier.set(row.tier, row.key);
  }
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

  // Books settle in order down the case, whichever way it is turned.
  const settleFrom: number[] = [];
  let settled = 0;
  for (const row of rows) {
    settleFrom.push(settled);
    settled += row.volumes.length + (row.unopened ? 1 : 0);
  }
  return (
    <section
      aria-label="Bookcase"
      className={mini ? "bookcase shelf-mini" : "bookcase"}
      data-entering={entering ? "" : undefined}
      ref={ref}
    >
      <div className="shelf-case">
        {rows.map((row, rowIndex) => {
          const [first, last] = rowSpan(row, currentPeriodKey);
          const from = settleFrom[rowIndex] ?? 0;
          const split = (plankCount.get(row.tier) ?? 1) > 1;
          const closes = lastRowOfTier.get(row.tier) === row.key;
          return (
            <div className="shelf-tier" key={row.key}>
              <div className="shelf-books">
                {row.volumes.map((volume, bookIndex) => (
                  <Spine
                    currentYear={currentYear}
                    glimpse={!mini}
                    index={from + bookIndex}
                    key={volume.periodKey}
                    onKeyDown={onKeyDown}
                    onOpen={() => open(volume)}
                    volume={volume}
                  />
                ))}
                {row.unopened ? (
                  <UnopenedSpine
                    index={from + row.volumes.length}
                    onKeyDown={onKeyDown}
                    onStart={() => navigate({ to: "/write" })}
                    periodKey={currentPeriodKey}
                  />
                ) : null}
              </div>
              <Plank
                label={
                  row.tier === "years" ? periodSpanLabel(first, last) : row.tier
                }
                span={
                  split && row.tier !== "years"
                    ? periodSpanLabel(first, last)
                    : null
                }
                tally={closes && !mini ? tallies.get(row.tier) : undefined}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The board the books stand on, with the year cut into its front edge the
 * way a maker's mark is, and the stretch of the year if it needed more than
 * one plank. The last plank of a year carries the year's count.
 */
function Plank({
  label,
  span,
  tally,
}: {
  label: string;
  span: string | null;
  tally: Tally | undefined;
}) {
  return (
    <div className="shelf-plank">
      <span className="shelf-carve shelf-carve-year">{label}</span>
      {span ? (
        <span className="shelf-carve shelf-carve-span">{span}</span>
      ) : null}
      {tally ? (
        <span className="shelf-carve shelf-carve-tally">
          {plural(tally.volumes, "volume")} · {formatCount(tally.words)} words
        </span>
      ) : null}
    </div>
  );
}
