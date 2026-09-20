import { formatCount } from "@repo/mongo/shared";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "#/lib/utils";

const SPRING = { damping: 60, stiffness: 100 } as const;
const MS_PER_SECOND = 1000;

interface NumberTickerProps {
  className?: string;
  /** Seconds to wait once in view before counting. */
  delay?: number;
  value: number;
}

/**
 * Counts up to `value` once it scrolls into view. After Magic UI's
 * NumberTicker, with the journal's own thousands separator so the server
 * and the browser print the same figure.
 */
export function NumberTicker({
  className,
  delay = 0,
  value,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, SPRING);
  const seen = useInView(ref, { once: true });

  useEffect(() => {
    if (!seen) {
      return;
    }
    if (reduced) {
      motionValue.jump(value);
      return;
    }
    const timer = setTimeout(
      () => motionValue.set(value),
      delay * MS_PER_SECOND
    );
    return () => clearTimeout(timer);
  }, [seen, reduced, delay, motionValue, value]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = formatCount(latest);
        }
      }),
    [spring]
  );

  return (
    <span className={cn("inline-block tabular-nums", className)} ref={ref}>
      0
    </span>
  );
}
