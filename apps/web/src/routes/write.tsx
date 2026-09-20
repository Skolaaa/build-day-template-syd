import { formatLongDate, isIsoDate } from "@repo/mongo/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { Editor } from "#/components/journal/editor";
import { JournalError, Loading } from "#/components/journal/states";
import { PageHeader } from "#/components/page-header";
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
  const { date, entry, mediaEnabled, tags, today } = Route.useLoaderData();
  const navigate = useNavigate();
  const isToday = date === today;
  const heading = isToday ? "Today's page" : formatLongDate(date);

  return (
    <main className="page-wrap rise-in px-4 py-10">
      <PageHeader
        crumbs={[{ label: "The shelf", to: "/" }, { label: heading }]}
        description={
          entry
            ? "You have written here already; this edits it."
            : "A blank page. It saves itself as you write."
        }
        title={heading}
        titleClassName="text-[clamp(26px,4vw,34px)]"
      />
      <section className="page-sheet">
        <Editor
          actions={
            <Button
              onClick={() => navigate({ params: { date }, to: "/entry/$date" })}
              size="sm"
              type="button"
            >
              <BookOpen data-icon="inline-start" />
              Read it
            </Button>
          }
          date={date}
          entry={entry}
          key={date}
          mediaEnabled={mediaEnabled}
          suggestions={tags}
        />
      </section>
    </main>
  );
}
