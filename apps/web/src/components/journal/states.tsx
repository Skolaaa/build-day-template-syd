import {
  type ErrorComponentProps,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export function Loading({ what = "the shelf" }: { what?: string }) {
  return (
    <main className="page-wrap px-4 py-16">
      <p className="m-0 text-ink-soft" role="status">
        Fetching {what}…
      </p>
    </main>
  );
}

const DATABASE_HINTS = [
  "MongoServerSelectionError",
  "ECONNREFUSED",
  "MONGODB_URI",
];

/**
 * The one error panel every journal route uses. A database that cannot be
 * reached gets a pointer at the connection string; anything else is shown
 * as it is, in words, with a way to try again.
 */
export function JournalError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : String(error);
  const isDatabase = DATABASE_HINTS.some((hint) => message.includes(hint));

  const retry = async () => {
    reset();
    await router.invalidate();
  };

  return (
    <main className="page-wrap px-4 py-12">
      <section className="page-sheet max-w-3xl">
        <p className="kicker mb-3">Something went wrong</p>
        <h1 className="display-title mb-4 text-3xl text-ink">
          {isDatabase
            ? "The shelf could not be reached."
            : "This page would not open."}
        </h1>
        {isDatabase ? (
          <p className="m-0 text-ink-soft text-sm leading-7">
            The database did not answer. Check <code>MONGODB_URI</code> in{" "}
            <code>apps/web/.env.local</code>; for local work, the root{" "}
            <code>bun run dev</code> starts one for you.
          </p>
        ) : null}
        <pre className="mt-4 overflow-x-auto rounded-sm bg-paper-sunk p-3 text-xs">
          {message}
        </pre>
        <div className="mt-6 flex gap-3">
          <Button onClick={retry} type="button" variant="outline">
            Try again
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Back to the shelf</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export function EmptyShelf() {
  return (
    <div className="mx-auto my-[8vh] max-w-[52ch] text-center">
      <h2 className="mb-3 font-serif text-[32px] text-ink">
        Nothing on the shelf yet
      </h2>
      <p className="mb-6 text-ink-soft">
        Every bookcase starts this way. Write one page today and a volume
        appears with your name on it; keep going and the spine gets thicker the
        more you write.
      </p>
      <Button asChild>
        <Link to="/write">Write the first page</Link>
      </Button>
    </div>
  );
}
