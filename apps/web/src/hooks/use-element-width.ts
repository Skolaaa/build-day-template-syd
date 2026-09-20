import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * The rendered width of an element, kept current as it resizes. The server
 * and the first client render use `fallback`, so the two agree; the real
 * measurement lands right after hydration.
 */
export function useElementWidth<T extends HTMLElement>(
  ref: RefObject<T | null>,
  fallback: number
): number {
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const measure = () => {
      setWidth(node.getBoundingClientRect().width || fallback);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, fallback]);

  return width;
}
