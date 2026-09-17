import { plural } from "@repo/mongo/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EntryRow } from "#/components/journal/entry-row";
import { JournalError, Loading } from "#/components/journal/states";
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
      <Link
        className="mb-5 inline-flex items-center gap-1.5 font-serif text-[14px] text-ink-soft no-underline hover:text-accent"
        to="/"
      >
        ← The shelf
      </Link>
      <p className="kicker mb-2">Tagged</p>
      <h1 className="display-title mb-2 text-[clamp(30px,5vw,44px)] text-ink">
        {tag}
      </h1>
      <p className="mb-8 text-ink-soft">{plural(entries.length, "page")}.</p>
      {entries.length === 0 ? (
        <p className="text-ink-faint">No page carries this tag any more.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {entries.map((entry) => (
            <EntryRow entry={entry} fullDate key={entry.id} />
          ))}
        </ul>
      )}
    </main>
  );
}
