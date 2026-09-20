import {
  motion,
  type TargetAndTransition,
  useInView,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

const DEFAULT_DURATION = 0.45;
const DEFAULT_OFFSET = 10;
const DEFAULT_BLUR = "6px";
const IN_VIEW_MARGIN = "-40px";

type Direction = "up" | "down" | "left" | "right";

interface BlurFadeProps {
  blur?: string;
  children: ReactNode;
  className?: string;
  /** Seconds to hold before the reveal, for staggering neighbours. */
  delay?: number;
  direction?: Direction;
  duration?: number;
  offset?: number;
}

function axisOf(direction: Direction): "x" | "y" {
  return direction === "left" || direction === "right" ? "x" : "y";
}

function startOf(direction: Direction, offset: number): number {
  return direction === "right" || direction === "down" ? -offset : offset;
}

/**
 * Reveals its children as they scroll into view: a fade, a short slide and
 * an un-blur. After Magic UI's BlurFade, made safe for a server-rendered
 * page: the markup arrives visible, anything already on screen stays put,
 * and only what sits below the fold waits for the scroll. Readers who asked
 * for less motion get the children as they are.
 */
export function BlurFade({
  blur = DEFAULT_BLUR,
  children,
  className,
  delay = 0,
  direction = "up",
  duration = DEFAULT_DURATION,
  offset = DEFAULT_OFFSET,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [waiting, setWaiting] = useState(false);
  const seen = useInView(ref, { margin: IN_VIEW_MARGIN, once: true });

  // Once hydrated, anything below the fold hides until it arrives.
  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) {
      return;
    }
    if (node.getBoundingClientRect().top > window.innerHeight) {
      setWaiting(true);
    }
  }, [reduced]);

  const hidden = waiting && !seen;
  const axis = axisOf(direction);
  const away: TargetAndTransition = {
    filter: `blur(${blur})`,
    opacity: 0,
    transition: { duration: 0 },
  };
  away[axis] = startOf(direction, offset);
  const home: TargetAndTransition = {
    filter: "blur(0px)",
    opacity: 1,
    transition: { delay, duration, ease: "easeOut" },
  };
  home[axis] = 0;
  const variants = { hidden: away, visible: home };

  return (
    <motion.div
      animate={hidden ? "hidden" : "visible"}
      className={className}
      initial={false}
      ref={ref}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
