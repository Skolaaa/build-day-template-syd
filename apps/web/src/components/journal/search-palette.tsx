import type { SearchHit } from "@repo/mongo/shared";
import { formatShortDate } from "@repo/mongo/shared";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/components/ui/command";
import { searchFn } from "#/server/journal";

const OPEN_EVENT = "life-on-a-shelf:search";
const DEBOUNCE_MS = 180;

/** Anything can ask for the palette; the header's Search button does. */
export function openSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export default function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");
  const navigate = useNavigate();
  const latest = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setHits([]);
      setStatus("idle");
      return;
    }
    const id = latest.current + 1;
    latest.current = id;
    setStatus("searching");
    const timer = setTimeout(async () => {
      try {
        const results = await searchFn({ data: { q } });
        // A slower earlier search must not overwrite a newer one.
        if (latest.current === id) {
          setHits(results);
          setStatus("idle");
        }
      } catch {
        if (latest.current === id) {
          setStatus("error");
        }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const openHit = (date: string) => {
    setOpen(false);
    setQuery("");
    navigate({ params: { date }, to: "/entry/$date" });
  };

  return (
    <CommandDialog
      description="Search every page you have written"
      onOpenChange={setOpen}
      open={open}
      title="Search the journal"
    >
      {/* Results come ranked from the text index; cmdk must not re-filter them. */}
      <Command shouldFilter={false}>
        <CommandInput
          onValueChange={setQuery}
          placeholder="Search your pages…"
          value={query}
        />
        <CommandList>
          {status === "error" ? (
            <p className="px-4 py-6 text-accent text-sm" role="alert">
              The search could not be run. Try again in a moment.
            </p>
          ) : null}
          {status !== "error" &&
          query.trim().length > 0 &&
          hits.length === 0 ? (
            <CommandEmpty>
              {status === "searching"
                ? "Looking…"
                : "Nothing written about that yet."}
            </CommandEmpty>
          ) : null}
          {hits.length > 0 ? (
            <CommandGroup heading="Pages">
              {hits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  onSelect={() => openHit(hit.date)}
                  value={hit.id}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-serif text-[16px] text-ink">
                      {hit.title || "Untitled"}
                    </span>
                    <span className="text-[11.5px] text-ink-faint">
                      {formatShortDate(hit.date)}
                    </span>
                    {hit.excerpt ? (
                      <span className="line-clamp-2 text-[13px] text-ink-soft">
                        {hit.excerpt}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
