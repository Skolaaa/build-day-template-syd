
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## shadcn components

`apps/web/src/components/ui/`, `lib/utils.ts` and `hooks/use-mobile.ts` are shadcn CLI
output. Never hand-edit them, and put nothing else in `components/ui/`. `biome.jsonc`
excludes them at the `files` level because `ultracite fix` corrupts them. See
`apps/web/src/components/ui/CLAUDE.md`.

## MongoDB

Data access lives in `packages/mongo` (`@repo/mongo`), see its README. Rules that
are easy to break:

- Server code imports `@repo/mongo` / `@repo/mongo/notes`; anything a React
  component needs comes from `@repo/mongo/shared`. The other entries pull the driver
  into the browser bundle. One entry per module in `exports`, no barrel file.
- Use `withDb(uri, fn)`; never cache a `MongoClient` at module scope. Workers tie
  sockets to the request that opened them, and a cached client hangs the next request.
- The driver stays on 6.x until Bun implements `v8.startupSnapshot` (bson 7 breaks
  `bun test`).
- Local database: `bun run dev` (root or `packages/mongo`) starts a real `mongod` via
  mongodb-memory-server, data in `.mongo-data`. No Docker.

## Deploy

Local dev needs no accounts. Deploying needs a Cloudflare account (`bunx wrangler
login`) and a MongoDB Atlas cluster with Network Access open to `0.0.0.0/0`. Before the
first `bun run deploy`, set `MONGODB_URI` (the Atlas string, database name in the path)
and the three Clerk keys with `wrangler secret put` in `apps/web`, and run
`ensure-indexes` in `packages/mongo` against Atlas once. Never set `DEV_LOGIN_*` on a
deployed Worker. Full steps: README.md "Deploy".

## Dev login (testing)

`apps/web` exposes a one-click dev login for local testing: `/login` has a
"Dev login (local only)" link (dev builds only) that hits `GET /api/dev-login`,
mints a Clerk sign-in token for a dedicated dev user, and redeems it at
`/dev-login` to establish a real session without going through Clerk's UI.
Only active when `DEV_LOGIN_EMAIL`/`DEV_LOGIN_PASSWORD` are set in
`apps/web/.env.local` (never set these in a deployed environment). Create/
refresh the dev user with `bun run create-dev-user` from `apps/web`.
