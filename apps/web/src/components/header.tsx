import { Show } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Library,
  MapIcon,
  PenLine,
  Search,
  Settings2,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Kbd, KbdGroup } from "#/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "#/components/ui/tooltip";
import ClerkHeader from "../integrations/clerk/header-user.tsx";
import { openSearch, useSearchShortcutLabel } from "./journal/search-palette";
import { ThemeSwitcher } from "./theme-switcher";

const NAV = [
  { icon: Library, label: "Shelf", to: "/" },
  { icon: MapIcon, label: "Atlas", to: "/atlas" },
  { icon: CalendarClock, label: "On this day", to: "/on-this-day" },
] as const;

export default function Header() {
  const shortcut = useSearchShortcutLabel();

  return (
    <header className="sticky top-0 z-40 border-rule border-b bg-paper/85 backdrop-blur-md">
      <div className="page-wrap flex h-14 items-center gap-3">
        <Link
          className="inline-flex shrink-0 items-center gap-2.5 font-serif text-[19px] text-ink no-underline"
          to="/"
        >
          <BrandMark />
          Life on a Shelf
        </Link>

        <Show when="signed-in">
          <nav aria-label="Journal" className="ml-3 hidden md:block">
            <ul className="m-0 flex list-none items-center gap-0.5 rounded-full bg-paper-sunk p-0.5 ring-1 ring-rule">
              {NAV.map(({ icon: Icon, label, to }) => (
                <li key={to}>
                  <Link
                    activeOptions={{ exact: to === "/" }}
                    activeProps={{ className: "is-active" }}
                    className="nav-pill"
                    to={to}
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Show>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Show when="signed-in">
            <button
              className="hidden h-8 items-center gap-2 rounded-lg border border-rule bg-paper-raised/60 pr-1.5 pl-2.5 text-[13px] text-ink-faint transition-colors hover:border-rule-strong hover:text-ink-soft md:inline-flex"
              onClick={openSearch}
              type="button"
            >
              <Search aria-hidden="true" className="size-3.5" />
              Search
              <KbdGroup>
                <Kbd>{shortcut}</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </button>
            <Button asChild size="sm">
              <Link to="/write">
                <PenLine data-icon="inline-start" />
                Write today
              </Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  className="hidden md:inline-flex"
                  size="icon-sm"
                  variant="ghost"
                >
                  <Link
                    activeProps={{ className: "bg-paper-sunk text-ink" }}
                    aria-label="Settings"
                    to="/settings"
                  >
                    <Settings2 />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </Show>
          <ThemeSwitcher className="hidden sm:inline-flex" />
          <ClerkHeader />
        </div>
      </div>
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
