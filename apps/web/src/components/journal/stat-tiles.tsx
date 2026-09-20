import { NumberTicker } from "#/components/motion/number-ticker";
import { cn } from "#/lib/utils";

export interface Stat {
  hint?: string;
  label: string;
  /** A number counts up as it comes into view; a string is printed as is. */
  value: number | string;
}

/** A quiet row of figures: label above, figure in serif, a note beneath. */
export function StatTiles({
  className,
  stats,
}: {
  className?: string;
  stats: Stat[];
}) {
  return (
    <dl
      className={cn(
        "m-0 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4",
        className
      )}
    >
      {stats.map((stat) => (
        <div className="min-w-0 border-rule border-l pl-4" key={stat.label}>
          <dt className="kicker">{stat.label}</dt>
          <dd className="m-0 mt-1.5 font-serif text-[clamp(26px,3.4vw,34px)] text-ink tabular-nums leading-none">
            {typeof stat.value === "number" ? (
              <NumberTicker value={stat.value} />
            ) : (
              stat.value
            )}
          </dd>
          {stat.hint ? (
            <dd className="m-0 mt-1.5 text-[12.5px] text-ink-faint">
              {stat.hint}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
