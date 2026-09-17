import { formatLongDate, isIsoDate } from "@repo/mongo/shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Editor } from "#/components/journal/editor";
import { JournalError, Loading } from "#/components/journal/states";
import { Button } from "#/components/ui/button";
import { getWritePageFn } from "#/server/journal";

export const Route = createFileRoute("/write")({
  validateSearch: (search: Record<string, unknown>): { date?: string } =>
    isIsoDate(search.date) ? { date: search.date } : {},
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: ({ deps }) => getWritePageFn({ data: { date: deps.date } }),
  component: WritePage,
  pendingComponent: () => <Loading what="today's page" />,
  errorComponent: JournalError,
});

function WritePage() {
  const { date, entry, mediaEnabled, today } = Route.useLoaderData();
  const navigate = useNavigate();
  const isToday = date === today;

  return (
    <main className="page-wrap rise-in px-4 py-10">
      <Link
        className="mb-5 inline-flex items-center gap-1.5 font-serif text-[14px] text-ink-soft no-underline hover:text-accent"
        to="/"
      >
        ← The shelf
      </Link>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display-title m-0 text-[clamp(26px,4vw,34px)] text-ink">
          {isToday ? "Today's page" : formatLongDate(date)}
        </h1>
        <p className="m-0 text-[13px] text-ink-faint">
          {entry
            ? "You have written here already; this edits it."
            : "A blank page."}
        </p>
      </div>
      <section className="page-sheet">
        <Editor
          actions={
            <Button
              onClick={() => navigate({ params: { date }, to: "/entry/$date" })}
              size="sm"
              type="button"
            >
              Read it
            </Button>
          }
          date={date}
          entry={entry}
          key={date}
          mediaEnabled={mediaEnabled}
        />
      </section>
    </main>
  );
}
