import { createClerkClient } from "@clerk/backend";
import { clerkMiddleware, getAuth } from "@clerk/hono";
import { withDb } from "@repo/mongo";
import {
  addMedia,
  removeMediaByKey,
  setMediaPoster,
} from "@repo/mongo/journal";
import {
  isMediaContentType,
  isOwnedMediaKey,
  MEDIA_MAX_BYTES,
  type MediaRef,
  mediaKeyFor,
  mediaKindFor,
} from "@repo/mongo/shared";
import handler from "@tanstack/react-start/server-entry";
import { type Context, Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.use("*", clerkMiddleware());

app.get("/api/health", (c) => {
  const auth = getAuth(c);
  return c.json({ status: "ok", userId: auth?.userId ?? null });
});

// One-click dev login: mints a one-time Clerk sign-in token for the dev user
// and hands it to /dev-login to redeem client-side. Only active when
// DEV_LOGIN_EMAIL is configured, which must never be set in a deployed
// environment - that absence is the safety switch for this route.
app.get("/api/dev-login", async (c) => {
  const email = c.env.DEV_LOGIN_EMAIL;
  if (!email) {
    return c.text("Dev login is not configured.", 404);
  }

  const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const { data } = await clerkClient.users.getUserList({
    emailAddress: [email],
  });
  const [user] = data;
  if (!user) {
    return c.text(
      `Dev login user ${email} does not exist yet. Run "bun run create-dev-user" in apps/web.`,
      404
    );
  }

  const { token } = await clerkClient.signInTokens.createSignInToken({
    expiresInSeconds: 60,
    userId: user.id,
  });

  return c.redirect(`/dev-login?token=${encodeURIComponent(token)}`);
});

// ------------------------------------------------------------------ media
//
// Bytes live in R2 and never touch MongoDB; the entry keeps a MediaRef. These
// are Hono routes rather than server functions because they stream bodies.
// The `MEDIA` binding is optional (see wrangler.jsonc): without it every
// route here answers 503 and the editor shows a one-line note instead.

type MediaContext = Context<{ Bindings: Env }>;

const MEDIA_PREFIX = "/api/media/";
const KEY_CACHE = "private, max-age=3600";

function authorize(
  c: MediaContext
): { bucket: R2Bucket; userId: string } | Response {
  const userId = getAuth(c)?.userId;
  if (!userId) {
    return c.json({ error: "Sign in first." }, 401);
  }
  const bucket = c.env.MEDIA;
  if (!bucket) {
    return c.json({ error: "Media is not enabled on this deployment." }, 503);
  }
  return { bucket, userId };
}

/** Cookie-authenticated writes must come from our own pages. */
function isSameOrigin(c: MediaContext): boolean {
  const site = c.req.header("sec-fetch-site");
  return site === undefined || site === "same-origin" || site === "none";
}

function keyOf(c: MediaContext): string {
  return decodeURIComponent(c.req.path.slice(MEDIA_PREFIX.length));
}

app.post("/api/media", async (c) => {
  const auth = authorize(c);
  if (auth instanceof Response) {
    return auth;
  }
  if (!isSameOrigin(c)) {
    return c.json({ error: "Uploads must come from the journal itself." }, 403);
  }
  const contentType = c.req.header("content-type")?.split(";")[0]?.trim();
  if (!isMediaContentType(contentType)) {
    return c.json(
      { error: "Only mp4, webm, mov, jpg, png and webp files are kept." },
      415
    );
  }
  const bytes = Number(c.req.header("content-length"));
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return c.json({ error: "The upload has no size." }, 411);
  }
  if (bytes > MEDIA_MAX_BYTES) {
    return c.json(
      { error: `Files are limited to ${MEDIA_MAX_BYTES / 1024 / 1024} MB.` },
      413
    );
  }
  const entryId = c.req.query("entryId") ?? "";
  const posterFor = c.req.query("posterFor");
  const { body } = c.req.raw;
  if (!(entryId && body)) {
    return c.json({ error: "Missing the page or the file." }, 400);
  }
  if (posterFor && mediaKindFor(contentType) !== "image") {
    return c.json({ error: "A poster must be an image." }, 415);
  }

  const key = mediaKeyFor(auth.userId, entryId, contentType);
  await auth.bucket.put(key, body, { httpMetadata: { contentType } });

  try {
    const entry = await withDb(c.env.MONGODB_URI, async (db) => {
      if (posterFor) {
        return await setMediaPoster(db, auth.userId, entryId, posterFor, key);
      }
      const ref: MediaRef = {
        bytes,
        contentType,
        createdAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        key,
        kind: mediaKindFor(contentType),
      };
      return await addMedia(db, auth.userId, entryId, ref);
    });
    if (!entry) {
      await auth.bucket.delete(key);
      return c.json(
        { error: "That page or clip is not yours to add to." },
        404
      );
    }
    const media = entry.media.find((m) =>
      posterFor ? m.id === posterFor : m.key === key
    );
    return c.json({ entry, media });
  } catch (error) {
    // Never leave bytes behind that no page points at.
    await auth.bucket.delete(key);
    const message =
      error instanceof Error
        ? error.message
        : "The clip could not be attached.";
    return c.json({ error: message }, 400);
  }
});

app.get(`${MEDIA_PREFIX}*`, async (c) => {
  const auth = authorize(c);
  if (auth instanceof Response) {
    return auth;
  }
  const key = keyOf(c);
  // Ownership is decided by the key alone: no lookup, no way to read another
  // reader's clip by guessing.
  if (!isOwnedMediaKey(key, auth.userId)) {
    return c.json({ error: "Not yours." }, 403);
  }
  const object = await auth.bucket.get(key, {
    onlyIf: c.req.raw.headers,
    range: c.req.raw.headers,
  });
  if (!object) {
    return c.json({ error: "No such clip." }, 404);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", KEY_CACHE);
  if (!("body" in object)) {
    // A conditional request that matched: nothing to send.
    return new Response(null, { headers, status: 304 });
  }
  if (object.range && "offset" in object.range) {
    const offset = object.range.offset ?? 0;
    const length = object.range.length ?? object.size - offset;
    headers.set(
      "content-range",
      `bytes ${offset}-${offset + length - 1}/${object.size}`
    );
    headers.set("content-length", String(length));
    return new Response(object.body, { headers, status: 206 });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers, status: 200 });
});

app.delete(`${MEDIA_PREFIX}*`, async (c) => {
  const auth = authorize(c);
  if (auth instanceof Response) {
    return auth;
  }
  if (!isSameOrigin(c)) {
    return c.json(
      { error: "Removals must come from the journal itself." },
      403
    );
  }
  const key = keyOf(c);
  if (!isOwnedMediaKey(key, auth.userId)) {
    return c.json({ error: "Not yours." }, 403);
  }
  const result = await withDb(c.env.MONGODB_URI, (db) =>
    removeMediaByKey(db, auth.userId, key)
  );
  if (!result) {
    return c.json({ error: "No such clip." }, 404);
  }
  await auth.bucket.delete(key);
  if (result.removed.posterKey) {
    await auth.bucket.delete(result.removed.posterKey);
  }
  return c.json(result.entry);
});

// Everything else is handled by TanStack Start (SSR pages, server functions, assets).
app.all("*", (c) => handler.fetch(c.req.raw));

export default app;
