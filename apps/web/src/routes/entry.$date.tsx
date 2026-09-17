import {
  type Entry,
  type EntrySummary,
  formatLongDate,
  formatShortDate,
  isIsoDate,
  MOOD_LABELS,
  periodKeyFor,
  periodLabel,
  plural,
  readingTime,
} from "@repo/mongo/shared";
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Editor } from "#/components/journal/editor";
import { PageBody } from "#/components/journal/markdown";
import { MediaGallery } from "#/components/journal/media-gallery";
import { MoodDot } from "#/components/journal/mood-dot";
import { JournalError, Loading } from "#/components/journal/states";
import { TagLink } from "#/components/journal/tag-link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { deleteEntryFn, getEntryPageFn } from "#/server/journal";

export const Route = createFileRoute("/entry/$date")({
  loader: ({ params }) => {
    if (!isIsoDate(params.date)) {
      throw notFound();
    }
    return getEntryPageFn({ data: { date: params.date } });
  },
  component: EntryPage,
  pendingComponent: () => <Loading what="the page" />,
  errorComponent: JournalError,
  notFoundComponent: () => (
    <main className="page-wrap px-4 py-12">
      <p className="text-ink-soft">
        That is not a date a page could belong to.
      </p>
    </main>
  ),
});

function EntryPage() {
  const { date } = Route.useParams();
  const { entry, older, newer, mediaEnabled, settings, today } =
    Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState(entry === null);
  const volumeKey = periodKeyFor(date, settings.volumePeriod);

  const finish = async () => {
    await router.invalidate();
    setEditing(false);
  };

  return (
    <main className="page-wrap rise-in px-4 py-10">
      <Link
        className="mb-5 inline-flex items-center gap-1.5 font-serif text-[14px] text-ink-soft no-underline hover:text-accent"
        params={{ periodKey: volumeKey }}
        to="/volume/$periodKey"
      >
        ← {periodLabel(volumeKey)}
      </Link>

      <article className="page-sheet">
        {editing ? (
          <Editor
            actions={
              entry ? (
                <Button onClick={finish} size="sm" type="button">
                  Done
                </Button>
              ) : null
            }
            date={date}
            entry={entry}
            key={`${date}:${entry?.updatedAt ?? "new"}`}
            mediaEnabled={mediaEnabled}
            onSaved={entry ? undefined : () => router.invalidate()}
          />
        ) : null}
        {!editing && entry ? (
          <PageView
            date={date}
            entry={entry}
            onEdit={() => setEditing(true)}
            volumeKey={volumeKey}
          />
        ) : null}
      </article>

      {editing && entry ? null : (
        <nav
          aria-label="Older and newer pages"
          className="mt-5 grid gap-3.5 sm:grid-cols-2"
        >
          <PageNavLink direction="older" entry={older} />
          <PageNavLink direction="newer" entry={newer} />
        </nav>
      )}

      {!entry && date <= today ? (
        <p className="mt-6 text-[13px] text-ink-faint">
          Nothing was written on this day. Whatever you put here now becomes its
          page.
        </p>
      ) : null}
    </main>
  );
}

interface PageViewProps {
  date: string;
  entry: Entry;
  onEdit: () => void;
  volumeKey: string;
}

/** The page as a reader sees it. */
function PageView({ date, entry, onEdit, volumeKey }: PageViewProps) {
  return (
    <>
      <header className="mb-7">
        <p className="kicker m-0">{formatLongDate(date)}</p>
        <h1 className="display-title mt-2.5 mb-0 text-[clamp(28px,4.4vw,40px)] text-ink">
          {entry.title || (
            <span className="text-ink-faint italic">Untitled</span>
          )}
        </h1>
        <p className="mt-3 mb-0 flex flex-wrap items-center gap-1 text-[13px] text-ink-faint">
          <span>{readingTime(entry.words)}</span>
          {entry.mood ? (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <MoodDot mood={entry.mood} /> felt {MOOD_LABELS[entry.mood]}
              </span>
            </>
          ) : null}
          {entry.tags.length > 0 ? <span>·</span> : null}
          {entry.tags.map((tag) => (
            <TagLink key={tag} tag={tag} />
          ))}
        </p>
      </header>

      <MediaGallery media={entry.media} />
      {entry.body.trim().length > 0 ? (
        <PageBody body={entry.body} />
      ) : (
        <p className="m-0 font-serif text-[18px] text-ink-faint italic">
          No words on this page
          {entry.media.length > 0 ? ", only the pictures" : ""}.
        </p>
      )}

      <footer className="mt-10 flex flex-wrap items-center gap-3 border-rule border-t pt-5">
        <Button onClick={onEdit} type="button" variant="outline">
          Edit this page
        </Button>
        <TearOut date={date} entry={entry} volumeKey={volumeKey} />
      </footer>
    </>
  );
}

function TearOut({
  date,
  entry,
  volumeKey,
}: {
  date: string;
  entry: Entry;
  volumeKey: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteEntryFn({ data: { date } });
      await router.navigate({
        params: { periodKey: volumeKey },
        to: "/volume/$periodKey",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The page could not be removed."
      );
      setDeleting(false);
    }
  };

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={deleting} type="button" variant="ghost">
            Tear it out
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tear out this page?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatLongDate(date)} and {plural(entry.media.length, "clip")} on
              it go for good. There is no wastebasket.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Tear it out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? (
        <p className="m-0 text-[13px] text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function PageNavLink({
  direction,
  entry,
}: {
  direction: "older" | "newer";
  entry: EntrySummary | null;
}) {
  const label = direction === "older" ? "← Earlier" : "Later →";
  if (!entry) {
    return (
      <span className="page-nav-link text-ink-faint" data-direction={direction}>
        <span className="text-[11px] uppercase tracking-[0.12em]">{label}</span>
        <span className="font-serif text-[15px] italic">
          {direction === "older"
            ? "This is the first page."
            : "This is the latest page."}
        </span>
      </span>
    );
  }
  return (
    <Link
      className="page-nav-link"
      data-direction={direction}
      params={{ date: entry.date }}
      to="/entry/$date"
    >
      <span className="text-[11px] text-ink-faint uppercase tracking-[0.12em]">
        {label}
      </span>
      <span className="font-serif text-[17px] text-ink">
        {entry.title || "Untitled"}
      </span>
      <span className="text-[12px] text-ink-faint">
        {formatShortDate(entry.date)}
      </span>
    </Link>
  );
}
