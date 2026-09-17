// Server-only helpers for the journal's server functions. Kept out of
// journal.ts on purpose: anything exported from that file other than a
// createServerFn survives into the client bundle, and these touch
// `cloudflare:workers`, which the browser cannot resolve.

import { env } from "cloudflare:workers";
import { auth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { getRequestHeader } from "@tanstack/react-start/server";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw redirect({ to: "/login" });
  }
  return userId;
}

const TZ_COOKIE = /(?:^|;\s*)tz=([^;]+)/;

/**
 * Today as the reader sees it. The root shell writes the browser's timezone
 * into a `tz` cookie on first load; until then (or if it is nonsense) the
 * Worker's UTC clock stands in, which is at worst a few hours out.
 */
export function readerToday(): string {
  const cookie = getRequestHeader("cookie") ?? "";
  const timeZone = decodeURIComponent(TZ_COOKIE.exec(cookie)?.[1] ?? "UTC");
  try {
    // en-CA is the one common locale whose numeric date is already ISO shaped.
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** True when the R2 bucket is bound. Without it the journal is text-only. */
export function mediaEnabled(): boolean {
  return typeof env.MEDIA !== "undefined";
}
