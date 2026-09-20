import { Link } from "@tanstack/react-router";
import { CalendarClock, Library, MapIcon, PenLine, Search } from "lucide-react";
import { openSearch } from "./journal/search-palette";

const TABS = [
  { icon: Library, label: "Shelf", to: "/" },
  { icon: MapIcon, label: "Atlas", to: "/atlas" },
  { icon: CalendarClock, label: "On this day", to: "/on-this-day" },
] as const;

/** The journal's nav on a phone: a bar at the bottom, under the thumb. */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Journal"
      className="fixed inset-x-0 bottom-0 z-40 border-rule border-t bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="m-0 flex list-none items-stretch justify-around p-0">
        {TABS.map(({ icon: Icon, label, to }) => (
          <li className="min-w-0 flex-1" key={to}>
            <Link
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "is-active" }}
              className="tab-link"
              to={to}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
        <li className="min-w-0 flex-1">
          <button className="tab-link" onClick={openSearch} type="button">
            <Search aria-hidden="true" className="size-5" />
            <span>Search</span>
          </button>
        </li>
        <li className="min-w-0 flex-1">
          <Link
            activeProps={{ className: "is-active" }}
            className="tab-link"
            to="/write"
          >
            <PenLine aria-hidden="true" className="size-5" />
            <span>Write</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
