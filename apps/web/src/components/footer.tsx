import { Link } from "@tanstack/react-router";

export default function Footer() {
  return (
    <footer className="border-rule border-t px-4 pt-8 pb-12 text-[13px] text-ink-faint">
      <div className="page-wrap flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="m-0 font-serif text-[15px] text-ink-soft">
          Life on a Shelf
        </p>
        <p className="m-0">
          Your pages are yours: nothing here is shared, sold or indexed.{" "}
          <Link
            className="text-ink-faint underline-offset-3 hover:text-ink"
            to="/settings"
          >
            Settings
          </Link>
        </p>
      </div>
    </footer>
  );
}
