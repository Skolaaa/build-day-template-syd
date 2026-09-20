import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import { cn } from "#/lib/utils";

type StaticRoute = "/" | "/atlas" | "/on-this-day" | "/settings" | "/write";

/** One step of the trail above a page title. The last one is where you are. */
export interface Crumb {
  label: string;
  to?: StaticRoute;
  /** A volume's period key: the crumb opens that volume. */
  volume?: string;
}

function CrumbLink({ crumb }: { crumb: Crumb }) {
  if (crumb.volume) {
    return (
      <BreadcrumbLink asChild>
        <Link params={{ periodKey: crumb.volume }} to="/volume/$periodKey">
          {crumb.label}
        </Link>
      </BreadcrumbLink>
    );
  }
  if (crumb.to) {
    return (
      <BreadcrumbLink asChild>
        <Link to={crumb.to}>{crumb.label}</Link>
      </BreadcrumbLink>
    );
  }
  return <BreadcrumbPage>{crumb.label}</BreadcrumbPage>;
}

export function PageBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="font-serif text-[14px] text-ink-faint">
        {crumbs.map((crumb, index) => (
          <Fragment
            key={`${crumb.label}-${crumb.to ?? crumb.volume ?? "here"}`}
          >
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              <CrumbLink crumb={crumb} />
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

interface PageHeaderProps {
  /** Buttons set against the title. */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  crumbs?: Crumb[];
  description?: ReactNode;
  descriptionClassName?: string;
  kicker?: ReactNode;
  title: ReactNode;
  titleClassName?: string;
}

/** The top of every page: where you are, what it is called, what you can do. */
export function PageHeader({
  actions,
  children,
  className,
  crumbs,
  description,
  descriptionClassName,
  kicker,
  title,
  titleClassName,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-8 flex flex-col gap-4", className)}>
      {crumbs ? <PageBreadcrumb crumbs={crumbs} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {kicker ? <p className="kicker mb-2">{kicker}</p> : null}
          <h1
            className={cn(
              "display-title m-0 text-[clamp(30px,5vw,44px)] text-ink",
              titleClassName
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-2.5 mb-0 max-w-[62ch] text-[15px] text-ink-soft leading-relaxed",
                descriptionClassName
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
