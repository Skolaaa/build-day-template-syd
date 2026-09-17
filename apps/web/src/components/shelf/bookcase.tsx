import {
  hashKey,
  PILE_SIZE,
  spineHeight,
  spineThickness,
  type Volume,
} from "@repo/mongo/shared";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useCallback } from "react";
import { Bookend } from "./props";
import { FlatSpine, LEAN_DEGREES, Spine, UnopenedSpine } from "./spine";

/** Room for books on one board, in px: the page width less the case's sides. */
const SHELF_WIDTH = 960;
/** The mini shelf draws spines at 0.6 width, so its budget is in full-size units. */
const MINI_SHELF_WIDTH = 900;
const BOOK_GAP = 3;
const MIN_BOOKS_BEFORE_SPACE = 3;
/** An unopened spine is fixed-width (see .spine-unopened). */
const UNOPENED_WIDTH = 44;
const MIN_BOOKS_TO_LEAN = 2;
/**
 * What a pile takes on the board: the tallest book lying down (291px), its
 * largest sideways nudge, the pile's own margin and the row gap.
 */
const PILE_WIDTH = 320;
const PILE_MAX_SHIFT = 14;
/** Piles go on every other shelf, and only when it still has this many upright. */
const PILE_EVERY = 2;
const MIN_UPRIGHT_BESIDE_PILE = 5;
/** Free board, in px, before a bookend goes in the gap. */
const ROOM_FOR_BOOKEND = 70;

interface Shelf {
  /** Pixels of board still free after the books on it. */
  free: number;
  /** Books lying on their side at the right end, earliest at the bottom. */
  pile: Volume[];
  volumes: Volume[];
}

/**
 * Books go on a shelf until it is full, then the next one. Thick books take
 * more room. Every other shelf ends in a small pile of the next few volumes
 * lying flat, the way a shelf that someone actually uses does.
 */
function intoShelves(
  volumes: Volume[],
  width: number,
  withPiles: boolean
): Shelf[] {
  const shelves: Shelf[] = [];
  let row: Volume[] = [];
  let used = 0;
  let index = 0;
  const wantsPile = () => withPiles && index % PILE_EVERY === 1;
  // Only hold room for a pile while enough volumes remain to make one;
  // otherwise the row fills the whole board like any other.
  const budget = (remaining: number) =>
    wantsPile() && remaining >= PILE_SIZE ? width - PILE_WIDTH : width;
  const close = (remaining: Volume[]): number => {
    const pile =
      wantsPile() &&
      row.length >= MIN_UPRIGHT_BESIDE_PILE &&
      remaining.length >= PILE_SIZE
        ? remaining.slice(0, PILE_SIZE)
        : [];
    const free = width - used - (pile.length > 0 ? PILE_WIDTH : 0);
    shelves.push({ free, pile, volumes: row });
    row = [];
    used = 0;
    index += 1;
    return pile.length;
  };

  let i = 0;
  while (i < volumes.length) {
    const volume = volumes[i] as Volume;
    const thickness = spineThickness(volume.entries) + BOOK_GAP;
    if (row.length > 0 && used + thickness > budget(volumes.length - i)) {
      i += close(volumes.slice(i));
      continue;
    }
    row.push(volume);
    used += thickness;
    i += 1;
  }
  if (row.length > 0 || shelves.length === 0) {
    close([]);
  }
  return shelves;
}

/**
 * The last book on a row with room to spare leans back onto its neighbour,
 * the way the last book on a real shelf does. The gap it needs at the foot
 * follows from the tilt and the shorter of the two books, so its top edge
 * lands on the neighbour rather than through it.
 */
function leanFor(shelf: Shelf, unopened: boolean): number {
  const { volumes, free } = shelf;
  if (volumes.length < MIN_BOOKS_TO_LEAN || shelf.pile.length > 0) {
    return 0;
  }
  const last = volumes.at(-1);
  const neighbour = volumes.at(-2);
  if (!(last && neighbour)) {
    return 0;
  }
  const height = Math.min(
    spineHeight(last.periodKey),
    spineHeight(neighbour.periodKey)
  );
  const gap = Math.round(height * Math.sin((LEAN_DEGREES * Math.PI) / 180));
  const needed = gap + (unopened ? UNOPENED_WIDTH + BOOK_GAP : 0);
  return free >= needed ? gap : 0;
}

interface ShelfLayout {
  bookend: boolean;
  lean: number;
  showSpace: boolean;
  showUnopened: boolean;
}

/** What else goes on a shelf besides its books, decided once per row. */
function layoutFor(
  shelf: Shelf,
  isLast: boolean,
  mini: boolean,
  unopened: boolean
): ShelfLayout {
  const showUnopened = isLast && unopened;
  const books =
    shelf.volumes.length + shelf.pile.length + (showUnopened ? 1 : 0);
  const showSpace = isLast && books < MIN_BOOKS_BEFORE_SPACE;
  if (!isLast || mini) {
    return { bookend: false, lean: 0, showSpace, showUnopened };
  }
  const spare = shelf.free - (showUnopened ? UNOPENED_WIDTH + BOOK_GAP : 0);
  // A bookend holds the row up, so nothing needs to lean when there is one.
  const bookend = spare >= ROOM_FOR_BOOKEND;
  return {
    bookend,
    lean: bookend ? 0 : leanFor(shelf, showUnopened),
    showSpace,
    showUnopened,
  };
}

/** How far a flat book sits from the pile's left edge: fixed per volume. */
function pileShift(volume: Volume): number {
  return hashKey(`${volume.periodKey}/pile`) % PILE_MAX_SHIFT;
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
  const currentYear = Number(currentPeriodKey.slice(0, 4));
  const unopened = !volumes.some((v) => v.periodKey === currentPeriodKey);
  const shelves = intoShelves(
    volumes,
    mini ? MINI_SHELF_WIDTH : SHELF_WIDTH,
    !mini
  );
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
    >
      <div className="bookcase-case">
        <div aria-hidden="true" className="bookcase-upright is-left" />
        <div aria-hidden="true" className="bookcase-upright is-right" />
        <div aria-hidden="true" className="shelf-board is-top" />
        {shelves.map((shelf, index) => {
          const layout = layoutFor(
            shelf,
            index === shelves.length - 1,
            mini,
            unopened
          );
          const lastIndex = shelf.volumes.length - 1;
          return (
            <div className="shelf" key={shelf.volumes[0]?.periodKey ?? "empty"}>
              <div className="shelf-books">
                {shelf.volumes.map((volume, i) => (
                  <Spine
                    currentYear={currentYear}
                    key={volume.periodKey}
                    lean={i === lastIndex ? layout.lean : 0}
                    onKeyDown={onKeyDown}
                    onOpen={() => open(volume)}
                    volume={volume}
                  />
                ))}
                {shelf.pile.length > 0 ? (
                  <div className="book-pile">
                    {/* Column-reverse in CSS puts the earliest at the bottom. */}
                    {shelf.pile.map((volume) => (
                      <FlatSpine
                        currentYear={currentYear}
                        key={volume.periodKey}
                        onKeyDown={onKeyDown}
                        onOpen={() => open(volume)}
                        shift={pileShift(volume)}
                        volume={volume}
                      />
                    ))}
                  </div>
                ) : null}
                {layout.showUnopened ? (
                  <UnopenedSpine
                    onKeyDown={onKeyDown}
                    onStart={() => navigate({ to: "/write" })}
                    periodKey={currentPeriodKey}
                  />
                ) : null}
                {layout.bookend ? <Bookend /> : null}
                {layout.showSpace ? (
                  <div aria-hidden="true" className="shelf-space" />
                ) : null}
              </div>
              <div aria-hidden="true" className="shelf-glow" />
              <div aria-hidden="true" className="shelf-board" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
