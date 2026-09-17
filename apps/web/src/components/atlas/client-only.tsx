import { type ReactNode, useSyncExternalStore } from "react";

const noop = () => () => undefined;

/**
 * Charts measure their container, which the server cannot do. Rendering them
 * only after hydration keeps the SSR markup and the first client render equal.
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
  return mounted ? children : fallback;
}
