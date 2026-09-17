import { Show } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import ClerkHeader from "../integrations/clerk/header-user.tsx";
import { openSearch } from "./journal/search-palette";
import ThemeToggle from "./theme-toggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-rule border-b bg-paper/88 px-4 backdrop-blur-md">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base">
          <Link
            className="inline-flex items-center gap-2.5 font-serif text-[19px] text-ink no-underline"
            to="/"
          >
            <BrandMark />
            Life on a Shelf
          </Link>
        </h2>

        <Show when="signed-in">
          <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm sm:order-none sm:ml-6 sm:w-auto sm:flex-nowrap sm:pb-0">
            <Link
              activeOptions={{ exact: true }}
              activeProps={{ className: "nav-link is-active" }}
              className="nav-link"
              to="/"
            >
              Shelf
            </Link>
            <Link
              activeProps={{ className: "nav-link is-active" }}
              className="nav-link"
              to="/atlas"
            >
              Atlas
            </Link>
            <Link
              activeProps={{ className: "nav-link is-active" }}
              className="nav-link"
              to="/on-this-day"
            >
              On this day
            </Link>
            <button className="nav-link" onClick={openSearch} type="button">
              Search <kbd>Ctrl K</kbd>
            </button>
          </div>
        </Show>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Show when="signed-in">
            <Button asChild size="sm">
              <Link to="/write">Write today</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link
                activeProps={{ className: "text-ink" }}
                aria-label="Settings"
                title="Settings"
                to="/settings"
              >
                <SettingsGlyph />
              </Link>
            </Button>
          </Show>
          <ClerkHeader />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

/** Three little spines. */
function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[18px] items-end gap-[2px]"
    >
      <i className="block h-[13px] w-1 rounded-[1px] bg-accent opacity-75" />
      <i className="block h-[18px] w-1 rounded-[1px] bg-accent" />
      <i className="block h-[15px] w-1 rounded-[1px] bg-accent opacity-60" />
    </span>
  );
}

function SettingsGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}
