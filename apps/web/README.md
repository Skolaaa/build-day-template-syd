# Boilerplate

A [TanStack Start](https://tanstack.com/start) app deployed on Cloudflare Workers, with [Hono](https://hono.dev) as the top-level `fetch` handler, [Clerk](https://clerk.com) for auth and [MongoDB](https://www.mongodb.com) for data.

## Architecture

`src/server.ts` is the Worker's entry point (`main` in `wrangler.jsonc`). It's a Hono app:

- Hono handles its own routes first (e.g. `/api/health`).
- Everything else falls through to `app.all('*', ...)`, which delegates to TanStack Start's request handler (`@tanstack/react-start/server-entry`) for SSR pages, server functions, and static assets.
- `@clerk/hono`'s `clerkMiddleware()` runs globally, so `getAuth(c)` is available in any Hono route.
- On the TanStack Start side, `src/start.ts` wires the same auth in via `@clerk/tanstack-react-start`'s `clerkMiddleware()`, and `src/routes/__root.tsx` wraps the app in `<ClerkProvider>`.

## Clerk integration

Clerk handles auth in two layers, because a request goes to either Hono or TanStack Start:

| Layer | Package | Where | Gives you |
| --- | --- | --- | --- |
| Hono routes | `@clerk/hono` | `src/server.ts` | `getAuth(c)` in any `app.get(...)` handler, e.g. `/api/health` returns the current `userId` |
| TanStack Start | `@clerk/tanstack-react-start` | `src/start.ts` (request middleware, after CSRF) | auth state for SSR pages and server functions |
| React UI | `@clerk/tanstack-react-start` | `src/integrations/clerk/` | `<ClerkProvider>`, `<Show>`, `<UserButton>`, `<SignIn>`, `useUser()` |

Both middlewares read the same keys, so a session cookie set by the Clerk UI is valid on either side. `@clerk/backend` is used directly where the app calls Clerk's Backend API (`/api/dev-login` and `scripts/create-dev-user.ts`).

### Files

- `src/integrations/clerk/provider.tsx` wraps `<ClerkProvider>` with an `appearance` config. Clerk's components render in a shadow root that the app's CSS variables can't reach, so the brand colors and font from `styles.css` are restated there. Change them in both places.
- `src/integrations/clerk/header-user.tsx` shows `<UserButton>` when signed in and a "Sign in" link to `/login` when signed out. `src/components/header.tsx` renders it.
- `src/routes/login.tsx` renders Clerk's `<SignIn routing="hash" />` for signed-out visitors and a profile card for signed-in ones. Hash routing keeps Clerk's multi-step sign-in flow on `/login` without extra catch-all routes.

### Protecting things

- Hono route: `const { userId } = getAuth(c)`, then return 401 if `userId` is null.
- React: wrap content in `<Show when="signed-in">` / `<Show when="signed-out">`, or read `useUser()`.
- TanStack server functions and loaders: use the `auth()` helper from `@clerk/tanstack-react-start/server`. No route uses it yet.

### Dev login

For local testing and browser automation there's a one-click login that skips the Clerk UI:

1. Set `DEV_LOGIN_EMAIL` and `DEV_LOGIN_PASSWORD` in `.env.local`.
2. Run `bun run create-dev-user` to create the user in your Clerk instance, or reset the password of an existing one.
3. In `bun run dev`, `/login` shows a "Dev login (local only)" button.

The button hits `GET /api/dev-login`. That route looks up the user and mints a 60-second Clerk sign-in token, then redirects to `/dev-login?token=...`. The `/dev-login` page redeems the token with `signIn.ticket()` and `signIn.finalize()`, which creates a real Clerk session and sends you to `/`.

The route returns 404 unless `DEV_LOGIN_EMAIL` is set, and that is the only thing protecting it. Never set `DEV_LOGIN_*` on a deployed Worker. (The button is hidden outside dev builds, but the API route doesn't check for dev mode.)

## MongoDB

Database access goes through the workspace package [`@repo/mongo`](../../packages/mongo) (see its README for the driver setup, the local database and the Workers-specific reasoning). In this app:

- `src/server/notes.ts` holds the server functions. Each handler wraps its work in `withDb(env.MONGODB_URI, ...)`, with `env` from `cloudflare:workers`. That is the one place the connection string is read.
- `src/routes/notes.tsx` is the example page: the loader calls `listNotesFn`, the form calls `createNoteFn` and invalidates the router. Its `errorComponent` renders a "could not reach MongoDB" panel, which is what you see when the local database is not running.
- Browser code imports only `@repo/mongo/shared`. The package root imports the driver and belongs in server functions (or Hono routes: `withDb(c.env.MONGODB_URI, ...)` works there too).

`MONGODB_URI` names the database in its path. The default in `.env.example` points at the local server that `bun run dev` starts; for Atlas, paste the cluster's `mongodb+srv://` string instead.

## Develop

```bash
bun install
bun run dev
```

Requires Clerk keys in `.env.local` (see `.env.example`): `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_PUBLISHABLE_KEY` (same value) and `CLERK_SECRET_KEY`. Pull your own with `clerk env pull` after `clerk link --app <app_id>`. `MONGODB_URI` can stay at its `.env.example` default for local work.

## Build & deploy

`.env.local` only feeds local dev — it's never uploaded. Before the first `wrangler deploy`, set the Clerk keys as real Worker secrets/vars (a deploy without them will 500, the same way local dev did before Clerk keys were added):

```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put VITE_CLERK_PUBLISHABLE_KEY
wrangler secret put MONGODB_URI
```

`MONGODB_URI` must be an Atlas (or otherwise reachable) connection string; the local server only exists on your machine. Use the cluster's `mongodb+srv://...` string with the database name in its path, and allow connections from anywhere in Atlas Network Access (Workers have no fixed egress IPs). Then create the indexes once against that database:

```bash
cd ../../packages/mongo
MONGODB_URI='mongodb+srv://...' bun run ensure-indexes
```

Then:

```bash
bun run build     # vite build
bun run deploy    # build + wrangler deploy
```

`wrangler.jsonc` has no `account_id` set, so `wrangler deploy`/`wrangler whoami` will use (or prompt for) whichever Cloudflare account is active.

`bun run cf-typegen` regenerates `worker-configuration.d.ts` (the `Env` type) from `wrangler.jsonc` + local env vars — it also runs automatically via `prepare` (`bun install`), so a fresh clone typechecks without a manual step.
