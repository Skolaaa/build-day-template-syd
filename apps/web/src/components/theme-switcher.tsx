import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import {
  MODE_LABEL,
  type ThemeMode,
  useThemeMode,
} from "#/hooks/use-theme-mode";
import { cn } from "#/lib/utils";

const OPTIONS: { icon: typeof Sun; key: ThemeMode }[] = [
  { icon: Sun, key: "light" },
  { icon: Moon, key: "dark" },
  { icon: Monitor, key: "auto" },
];

const PILL_SPRING = { damping: 38, stiffness: 520, type: "spring" } as const;

interface ThemeSwitcherProps {
  className?: string;
  /** Say "Day", "Night" and "Follow the system" beside the icons. */
  labels?: boolean;
}

/**
 * Day, night, or whatever the system says, as one segmented control with a
 * pill that slides to the choice. After Kibo UI's ThemeSwitcher, wired to
 * the journal's own theme hook so the header and settings stay in step.
 */
export function ThemeSwitcher({
  className,
  labels = false,
}: ThemeSwitcherProps) {
  const [mode, setMode] = useThemeMode();
  const layoutId = useId();

  return (
    <fieldset
      className={cn(
        "relative isolate m-0 inline-flex h-8 items-center gap-0.5 rounded-full border-0 bg-paper-sunk p-0.5 ring-1 ring-rule",
        className
      )}
    >
      <legend className="sr-only">Light</legend>
      {OPTIONS.map(({ icon: Icon, key }) => {
        const active = mode === key;
        const label = MODE_LABEL[key];
        return (
          <button
            aria-label={labels ? undefined : label}
            aria-pressed={active}
            className={cn(
              "relative inline-flex h-7 items-center justify-center gap-1.5 rounded-full text-[12.5px] transition-colors",
              labels ? "px-2.5" : "w-7",
              active ? "text-ink" : "text-ink-faint hover:text-ink-soft"
            )}
            key={key}
            onClick={() => setMode(key)}
            title={labels ? undefined : label}
            type="button"
          >
            {active ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-paper-raised shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-rule-strong"
                layoutId={layoutId}
                transition={PILL_SPRING}
              />
            ) : null}
            <Icon aria-hidden="true" className="relative z-10 size-3.5" />
            {labels ? <span className="relative z-10">{label}</span> : null}
          </button>
        );
      })}
    </fieldset>
  );
}
