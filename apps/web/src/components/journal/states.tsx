import {
  type ErrorComponentProps,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { Library, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { ShelfSkeleton } from "#/components/shelf/shelf-skeleton";
import { Button } from "#/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";

/** The page's shape, drawn in ghosts, while its data is fetched. */
export function Loading({ what = "the shelf" }: { what?: string }) {
  if (what === "the shelf") {
    return (
      <main aria-busy="true" className="page-wrap px-4 pt-10 pb-8">
        <output className="sr-only">Fetching the shelf…</output>
        <Skeleton className="mb-3 h-10 w-48" />
        <Skeleton className="mb-8 h-5 w-96 max-w-full" />
        <ShelfSkeleton />
      </main>
    );
  }
  return (
    <main aria-busy="true" className="page-wrap px-4 py-10">
      <output className="sr-only">Fetching {what}…</output>
      <Skeleton className="mb-5 h-4 w-40" />
      <Skeleton className="mb-3 h-10 w-72 max-w-full" />
      <Skeleton className="mb-10 h-5 w-96 max-w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
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

interface EmptyNoteProps {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  icon: ReactNode;
  title: string;
}

/** Nothing here yet, said kindly, with something to do about it. */
export function EmptyNote({
  action,
  className,
  description,
  icon,
  title,
}: EmptyNoteProps) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia className="text-ink-soft" variant="icon">
          {icon}
        </EmptyMedia>
        <EmptyTitle className="font-normal font-serif text-[26px] text-ink tracking-normal">
          {title}
        </EmptyTitle>
        <EmptyDescription className="text-ink-soft">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function EmptyShelf() {
  return (
    <EmptyNote
      action={
        <Button asChild>
          <Link to="/write">
            <PenLine data-icon="inline-start" />
            Write the first page
          </Link>
        </Button>
      }
      className="my-[6vh]"
      description="Every bookcase starts this way. Write one page today and a volume appears with your name on it; keep going and the spine gets thicker the more you write."
      icon={<Library />}
      title="Nothing on the shelf yet"
    />
  );
}
