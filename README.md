# Boilerplate

A [Turborepo](https://turborepo.com) monorepo, managed with Bun workspaces.

## Apps

- [`apps/web`](apps/web) — the [TanStack Start](https://tanstack.com/start) front end, deployed on Cloudflare Workers, with [Clerk](https://clerk.com) for auth and [MongoDB](https://www.mongodb.com) for data. See its [README](apps/web/README.md) for architecture, the Clerk integration, and setup.

## Packages

- [`packages/mongo`](packages/mongo) — `@repo/mongo`: the MongoDB driver, connection handling for Workers, a Docker-free local database, and the example `notes` collection. See its [README](packages/mongo/README.md).

## Develop

```bash
bun install
bun run dev
```

`bun run dev` starts the web app and a local MongoDB (a real `mongod`, downloaded on first run, data kept in `.mongo-data`). No Docker needed. Open the Notes page to see the round trip.

Commands at the root run across all apps via [Turborepo](https://turborepo.com):

- `bun run dev` — start all apps in dev mode
- `bun run build` — build all apps
- `bun run deploy` — build and deploy all apps
- `bun run preview` — preview production builds
- `bun run check` / `bun run fix` — lint/format the whole repo with [Ultracite](https://ultracite.ai)
- `bun run test` — run every workspace's tests

To run a command for a single app, use turbo's filter flag, e.g. `bunx turbo run dev --filter=web`, or `cd apps/web && bun run dev`.

## Deploy

Local development needs none of this. You only need the accounts below when you want the app running on the internet.

### 1. A Cloudflare account

The web app deploys to [Cloudflare Workers](https://workers.cloudflare.com). The free plan is enough. Sign in once from the terminal:

```bash
cd apps/web
bunx wrangler login
```

If you belong to more than one Cloudflare account, `wrangler deploy` will ask which one to use; set `CLOUDFLARE_ACCOUNT_ID` in `apps/web/.env.local` to skip the prompt. The Worker's name comes from `apps/web/wrangler.jsonc` (the `rename-project` skill sets it).

### 2. A MongoDB Atlas database

The local `mongod` that `bun run dev` starts only exists on your machine, so a deployed Worker needs a database it can reach. [MongoDB Atlas](https://www.mongodb.com/atlas) has a free tier:

1. Create a cluster, then a database user with read/write access.
2. Under **Network Access**, allow connections from anywhere (`0.0.0.0/0`). Workers have no fixed egress IPs, so an IP allowlist cannot be made to work.
3. Copy the cluster's connection string (**Connect** > **Drivers**) and put the database name in its path, for example `mongodb+srv://user:pass@cluster0.abcde.mongodb.net/boilerplate`.

Create the indexes once against that database:

```bash
cd packages/mongo
MONGODB_URI='mongodb+srv://...' bun run ensure-indexes
```

### 3. Secrets on the Worker

`.env.local` never leaves your machine. Everything the Worker reads from `env` has to be set as a secret before the first deploy:

```bash
cd apps/web
wrangler secret put MONGODB_URI              # the Atlas string from step 2
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put VITE_CLERK_PUBLISHABLE_KEY
```

Each command prompts for the value. Never set `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` on a deployed Worker; their absence is what disables the dev login route.

### 4. Ship it

```bash
bun run deploy
```

That builds and runs `wrangler deploy`. The URL is printed at the end; open `/notes` on it to confirm the database connection. Repeat step 3 only when a secret changes.

## License

[MIT](LICENSE)
