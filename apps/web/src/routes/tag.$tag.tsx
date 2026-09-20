import { plural } from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { EntryList, EntryRow } from "#/components/journal/entry-row";
import { EmptyNote, JournalError, Loading } from "#/components/journal/states";
import { PageHeader } from "#/components/page-header";
import { Button } from "#/components/ui/button";
import { getTagPageFn } from "#/server/journal";

export const Route = createFileRoute("/tag/$tag")({
  loader: ({ params }) => getTagPageFn({ data: { tag: params.tag } }),
  component: TagPage,
  pendingComponent: () => <Loading what="the pages" />,
  errorComponent: JournalError,
});

function TagPage() {
  const { tag } = Route.useParams();
  const { entries } = Route.useLoaderData();
  return (
    <main className="page-wrap rise-in px-4 py-10">
      <PageHeader
        crumbs={[{ label: "The shelf", to: "/" }, { label: tag }]}
        description={`${plural(entries.length, "page")} carry this tag.`}
        kicker="Tagged"
        title={tag}
      />
      {entries.length === 0 ? (
        <EmptyNote
          action={
            <Button asChild variant="outline">
              <Link to="/">Back to the shelf</Link>
            </Button>
          }
          description="No page carries this tag any more."
          icon={<Tag />}
          title="Nothing here"
        />
      ) : (
        <EntryList>
          {entries.map((entry) => (
            <EntryRow entry={entry} fullDate key={entry.id} />
          ))}
        </EntryList>
      )}
    </main>
  );
}
