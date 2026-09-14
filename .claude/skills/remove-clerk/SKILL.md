---
name: remove-clerk
description: Strip Clerk auth out of apps/web entirely - middleware, provider, header user button, /login, dev login, env vars, dependencies and docs.
disable-model-invocation: true
allowed-tools: Bash(git:*), Bash(bun:*), Read, Edit, Write
---

# Remove Clerk

Turns the app into one with no auth. Every step below is a removal; the only
new code is whatever keeps a caller compiling once its Clerk import is gone.

Start from a clean `git status`, so the whole removal reviews as one diff. If
the tree is dirty, stop and ask the user to commit or stash first.

Code may have grown new Clerk usage since this skill was written, so treat the
file list as a starting map, not the full set. The finish line is the sweep in
step 7.

## 1. Delete Clerk-only files

- `apps/web/src/integrations/clerk/` (the whole folder)
- `apps/web/src/routes/login.tsx`
- `apps/web/src/routes/dev-login.tsx`
- `apps/web/scripts/create-dev-user.ts`

## 2. Unwire the server

- `apps/web/src/server.ts`: drop the `@clerk/hono` and `@clerk/backend` imports,
  `app.use("*", clerkMiddleware())`, and the whole `/api/dev-login` route with
  its comment. `/api/health` stays and returns `{ status: "ok" }`.
- `apps/web/src/start.ts`: drop `clerkMiddleware` from the import and from
  `requestMiddleware`. The CSRF middleware stays.

## 3. Unwire the UI

- `apps/web/src/routes/__root.tsx`: remove the `ClerkProvider` import and
  unwrap `<ClerkProvider>`, keeping its children in place.
- `apps/web/src/components/header.tsx`: remove the `ClerkHeader` import and
  `<ClerkHeader />`.
- Any other link to `/login` or `/dev-login`: remove it.

## 4. Dependencies and scaffold metadata

- From `apps/web`: `bun remove @clerk/backend @clerk/hono @clerk/tanstack-react-start`.
  This rewrites `package.json` and `bun.lock` together.
- `apps/web/package.json`: delete the `create-dev-user` script.
- `apps/web/.cta.json`: remove `"clerk"` from `chosenAddOns`.

## 5. Env vars

The vars are `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, `DEV_LOGIN_EMAIL`, `DEV_LOGIN_PASSWORD`.

- `apps/web/.env.example`: delete the Clerk block and the dev login block.
- `apps/web/.env.local` (gitignored, holds real keys): delete those five lines
  and leave every other line untouched. Tell the user you did.
- From `apps/web`: `bun run cf-typegen`, so the `Env` type drops them.

## 6. Docs

Remove the prose that describes the removed behaviour:

- `README.md`: the Clerk mention in the `apps/web` line.
- `apps/web/README.md`: Clerk in the intro sentence, the Clerk bullets under
  Architecture, the whole `## Clerk integration` section, the Clerk keys
  paragraph under Develop, and the `wrangler secret put` block (with the
  sentence introducing it) under Build & deploy.
- `CLAUDE.md` and `.claude/CLAUDE.md`: the `## Dev login (testing)` sections.

## 7. Verify

Done means all three hold:

- `git grep -il --untracked -E 'clerk|dev-login|dev_login|create-dev-user' -- ':!.claude/skills/remove-clerk'`
  returns nothing (it skips gitignored paths, so build output and
  `.env.local` are out of scope here). Each hit is a leftover: remove it, or
  rewrite the sentence if it only mentions Clerk in passing.
- `bun run typecheck` in `apps/web` passes. `src/routeTree.gen.ts` regenerates
  on build; if it still lists `/login` or `/dev-login`, run `bun run generate-routes`.
- `bun run build` passes and `bun x ultracite check` is clean.

## 8. Hand back

Delete this skill (`.claude/skills/remove-clerk/`): with Clerk gone it has
nothing left to act on. Then report the diff summary, and leave these
outward-facing steps to the user:

- If the Worker was ever deployed with Clerk secrets:
  `wrangler secret delete CLERK_SECRET_KEY` (and `CLERK_PUBLISHABLE_KEY`,
  `VITE_CLERK_PUBLISHABLE_KEY`).
- The Clerk application itself still exists in the Clerk dashboard.

Commit only if the user asks.
