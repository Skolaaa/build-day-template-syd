import { spineThickness, type Volume } from "@repo/mongo/shared";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useCallback } from "react";
import { Spine, UnopenedSpine } from "./spine";

/** Room for books on one board, in px: the page width less the board's padding. */
const SHELF_WIDTH = 1000;
const MINI_SHELF_WIDTH = 560;
const BOOK_GAP = 3;
const MIN_BOOKS_BEFORE_SPACE = 3;

/** Books go on a shelf until it is full, then the next one. Thick books take more room. */
function intoShelves(volumes: Volume[], width: number): Volume[][] {
  const shelves: Volume[][] = [];
  let row: Volume[] = [];
  let used = 0;
  for (const volume of volumes) {
    const thickness = spineThickness(volume.entries) + BOOK_GAP;
    if (row.length > 0 && used + thickness > width) {
      shelves.push(row);
      row = [];
      used = 0;
    }
    row.push(volume);
    used += thickness;
  }
  shelves.push(row);
  return shelves;
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
  const unopened = !volumes.some((v) => v.periodKey === currentPeriodKey);
  const shelves = intoShelves(volumes, mini ? MINI_SHELF_WIDTH : SHELF_WIDTH);

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
      {shelves.map((shelf, index) => {
        const isLast = index === shelves.length - 1;
        const books = shelf.length + (isLast && unopened ? 1 : 0);
        return (
          <div className="shelf" key={shelf[0]?.periodKey ?? "empty"}>
            <div className="shelf-books">
              {shelf.map((volume) => (
                <Spine
                  key={volume.periodKey}
                  onKeyDown={onKeyDown}
                  onOpen={() =>
                    navigate({
                      params: { periodKey: volume.periodKey },
                      to: "/volume/$periodKey",
                    })
                  }
                  volume={volume}
                />
              ))}
              {isLast && unopened ? (
                <UnopenedSpine
                  onKeyDown={onKeyDown}
                  onStart={() => navigate({ to: "/write" })}
                  periodKey={currentPeriodKey}
                />
              ) : null}
              {isLast && books < MIN_BOOKS_BEFORE_SPACE ? (
                <div aria-hidden="true" className="shelf-space" />
              ) : null}
            </div>
            <div aria-hidden="true" className="shelf-board" />
          </div>
        );
      })}
    </section>
  );
}
