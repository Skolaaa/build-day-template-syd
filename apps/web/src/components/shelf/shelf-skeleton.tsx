import { Skeleton } from "#/components/ui/skeleton";

interface Ghost {
  height: number;
  id: string;
  width: number;
}

// Two shelves of books drawn as ghosts, sized like real spines so the page
// keeps its shape while the shelf is fetched and nothing jumps when it lands.
const TIERS: { id: string; spines: Ghost[] }[] = [
  {
    id: "upper",
    spines: [
      { height: 246, id: "a", width: 52 },
      { height: 228, id: "b", width: 46 },
      { height: 264, id: "c", width: 58 },
      { height: 237, id: "d", width: 44 },
      { height: 255, id: "e", width: 62 },
      { height: 228, id: "f", width: 40 },
      { height: 273, id: "g", width: 54 },
      { height: 246, id: "h", width: 48 },
      { height: 237, id: "i", width: 56 },
      { height: 264, id: "j", width: 42 },
      { height: 228, id: "k", width: 50 },
      { height: 255, id: "l", width: 60 },
    ],
  },
  {
    id: "lower",
    spines: [
      { height: 237, id: "a", width: 48 },
      { height: 264, id: "b", width: 54 },
      { height: 228, id: "c", width: 44 },
      { height: 246, id: "d", width: 58 },
      { height: 273, id: "e", width: 46 },
      { height: 237, id: "f", width: 52 },
      { height: 255, id: "g", width: 40 },
    ],
  },
];

/** The bookcase before its books arrive. */
export function ShelfSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Fetching the shelf"
      className="bookcase block"
    >
      <div className="shelf-case">
        {TIERS.map((tier) => (
          <div className="shelf-tier" key={tier.id}>
            <div className="shelf-books">
              {tier.spines.map((spine) => (
                <Skeleton
                  className="shrink-0 rounded-[3px_5px_5px_3px] bg-rule"
                  key={spine.id}
                  style={{ height: spine.height, width: spine.width }}
                />
              ))}
            </div>
            <div aria-hidden="true" className="shelf-plank">
              <Skeleton className="h-3 w-12 bg-wood-bottom/40" />
            </div>
          </div>
        ))}
      </div>
    </output>
  );
}
