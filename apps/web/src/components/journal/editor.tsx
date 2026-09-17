import {
  BODY_MAX_LENGTH,
  countWords,
  type Entry,
  formatLongDate,
  MOOD_LABELS,
  MOODS,
  type Mood,
  normalizeTag,
  plural,
  TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@repo/mongo/shared";
import { X } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "#/components/ui/button";
import { saveEntryFn } from "#/server/journal";
import { MediaManager } from "./media-manager";

const AUTOSAVE_MS = 1200;

interface Draft {
  body: string;
  mood: Mood | null;
  tags: string[];
  title: string;
}

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

interface EditorProps {
  /** Rendered in the footer, next to the save state (e.g. a Done button). */
  actions?: React.ReactNode;
  date: string;
  entry: Entry | null;
  mediaEnabled: boolean;
  /** Called after a successful save with the page as stored. */
  onSaved?: (entry: Entry) => void;
}

function draftOf(entry: Entry | null): Draft {
  return {
    body: entry?.body ?? "",
    mood: entry?.mood ?? null,
    tags: entry?.tags ?? [],
    title: entry?.title ?? "",
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.body === b.body &&
    a.title === b.title &&
    a.mood === b.mood &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, i) => tag === b.tags[i])
  );
}

function draftKey(date: string): string {
  return `draft:${date}`;
}

function readLocalDraft(date: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(date));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(date: string, draft: Draft | null) {
  try {
    if (draft) {
      window.localStorage.setItem(draftKey(date), JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(draftKey(date));
    }
  } catch {
    // Storage full or blocked: the server copy is still the source of truth.
  }
}

/**
 * One day's page. Autosaves a beat after typing stops, keeps a copy in
 * localStorage until the server has confirmed it, and never throws away
 * what was typed when a save fails.
 */
export function Editor({
  date,
  entry: initial,
  mediaEnabled,
  onSaved,
  actions,
}: EditorProps) {
  const [entry, setEntry] = useState<Entry | null>(initial);
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const lastSaved = useRef<Draft>(draftOf(initial));
  const inFlight = useRef<Promise<Entry> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // A draft left behind by a failed save or a closed tab comes back first.
  useEffect(() => {
    const local = readLocalDraft(date);
    if (local && !sameDraft(local, lastSaved.current)) {
      setDraft(local);
      setStatus("dirty");
      setRestored(true);
    }
  }, [date]);

  const save = useCallback(async (): Promise<Entry> => {
    if (inFlight.current) {
      return await inFlight.current;
    }
    const snapshot = draftRef.current;
    setStatus("saving");
    setError(null);
    const run = (async () => {
      try {
        const saved = await saveEntryFn({
          data: {
            ...snapshot,
            date,
            // Only read on first save; later edits don't move the page.
            writtenHour: new Date().getHours(),
          },
        });
        lastSaved.current = snapshot;
        setEntry((current) =>
          current ? { ...saved, media: current.media } : saved
        );
        if (sameDraft(snapshot, draftRef.current)) {
          writeLocalDraft(date, null);
          setStatus("saved");
        } else {
          setStatus("dirty");
        }
        setRestored(false);
        onSaved?.(saved);
        return saved;
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "The page could not be saved."
        );
        throw err;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return await run;
  }, [date, onSaved]);

  // Autosave a beat after the last keystroke.
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = useCallback(
    (patch: Partial<Draft>) => {
      setDraft((current) => {
        const next = { ...current, ...patch };
        writeLocalDraft(date, next);
        return next;
      });
      setStatus("dirty");
      if (autosave.current) {
        clearTimeout(autosave.current);
      }
      autosave.current = setTimeout(() => {
        save().catch(() => undefined);
      }, AUTOSAVE_MS);
    },
    [date, save]
  );

  useEffect(
    () => () => {
      if (autosave.current) {
        clearTimeout(autosave.current);
      }
    },
    []
  );

  // Cmd/Ctrl-S saves now.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Uploads need a page id; save first if there is no page yet.
  const ensureEntry = useCallback(
    async () => entry ?? (await save()),
    [entry, save]
  );

  const addTag = useCallback(() => {
    const tag = normalizeTag(tagInput);
    if (tag.length === 0 || tag.length > TAG_MAX_LENGTH) {
      return;
    }
    setTagInput("");
    if (!draft.tags.includes(tag)) {
      change({ tags: [...draft.tags, tag] });
    }
  }, [change, draft.tags, tagInput]);

  const onTagKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    } else if (
      event.key === "Backspace" &&
      tagInput.length === 0 &&
      draft.tags.length > 0
    ) {
      change({ tags: draft.tags.slice(0, -1) });
    }
  };

  const words = useMemo(
    () => countWords(draft.body) + countWords(draft.title),
    [draft]
  );

  return (
    <div className="flex flex-col">
      <p className="kicker mb-5">{formatLongDate(date)}</p>
      <input
        aria-label="Title"
        className="editor-title"
        maxLength={TITLE_MAX_LENGTH}
        onChange={(event) => change({ title: event.target.value })}
        placeholder="A title for the day"
        type="text"
        value={draft.title}
      />
      <textarea
        aria-label="Page"
        className="editor-textarea mt-5"
        maxLength={BODY_MAX_LENGTH}
        onChange={(event) => change({ body: event.target.value })}
        placeholder="What happened. What you noticed. Markdown is fine."
        value={draft.body}
      />

      <div className="mt-7 grid gap-5 border-rule border-t pt-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="kicker">Tags</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
                <button
                  aria-label={`Remove tag ${tag}`}
                  className="inline-flex text-ink-faint hover:text-accent"
                  onClick={() =>
                    change({ tags: draft.tags.filter((t) => t !== tag) })
                  }
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              aria-label="Add a tag"
              className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-[13px] text-ink outline-none placeholder:text-ink-faint"
              maxLength={TAG_MAX_LENGTH}
              onBlur={addTag}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={onTagKey}
              placeholder={
                draft.tags.length === 0 ? "walks, family, work…" : "add another"
              }
              type="text"
              value={tagInput}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="kicker">How it felt</span>
          <fieldset className="m-0 flex items-center gap-2 border-0 p-0">
            <legend className="sr-only">How it felt</legend>
            {MOODS.map((mood) => (
              <label
                className="mood-choice"
                data-mood={mood}
                data-selected={draft.mood === mood ? "true" : undefined}
                key={mood}
                title={MOOD_LABELS[mood]}
              >
                <input
                  checked={draft.mood === mood}
                  className="sr-only"
                  name="mood"
                  onChange={() => change({ mood })}
                  onClick={() => {
                    // A second click on the chosen mood clears it.
                    if (draft.mood === mood) {
                      change({ mood: null });
                    }
                  }}
                  type="radio"
                  value={mood}
                />
                <span className="sr-only">{MOOD_LABELS[mood]}</span>
              </label>
            ))}
            <span className="ml-1 text-[13px] text-ink-faint">
              {draft.mood ? MOOD_LABELS[draft.mood] : "not said"}
            </span>
          </fieldset>
        </div>
      </div>

      <div className="mt-7 border-rule border-t pt-5">
        <span className="kicker mb-3 block">Video and photos</span>
        <MediaManager
          enabled={mediaEnabled}
          ensureEntry={ensureEntry}
          entry={entry}
          onChange={setEntry}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3.5">
        <p className="m-0 text-[13px] text-ink-faint" role="status">
          {plural(words, "word")} ·{" "}
          <SaveState error={error} restored={restored} status={status} />
        </p>
        <div className="flex flex-wrap gap-2">
          {status === "error" || status === "dirty" ? (
            <Button
              onClick={() => save().catch(() => undefined)}
              size="sm"
              type="button"
              variant="outline"
            >
              Save now
            </Button>
          ) : null}
          {actions}
        </div>
      </div>
    </div>
  );
}

function SaveState({
  status,
  error,
  restored,
}: {
  error: string | null;
  restored: boolean;
  status: Status;
}) {
  if (status === "error") {
    return (
      <span className="text-accent">
        not saved: {error ?? "something went wrong"}. Your words are kept here
        until it works.
      </span>
    );
  }
  if (status === "saving") {
    return <span>saving…</span>;
  }
  if (status === "dirty") {
    return <span>{restored ? "restored an unsaved draft" : "unsaved"}</span>;
  }
  if (status === "saved") {
    return <span>saved</span>;
  }
  return <span>autosaves as you write</span>;
}
