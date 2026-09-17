# Life on a Shelf

A private journal that behaves like a bookshelf. Each **volume** is a book on
the shelf: a week, a month or a year, whichever you choose. A **page** is one
day's entry: words, and optionally video. Spines get thicker the more was
written, so the shelf shows the shape of your attention from across the room.
The **Atlas** reads the whole journal back as a picture.

Built as a [Turborepo](https://turborepo.com) monorepo with Bun workspaces:

- [`apps/web`](apps/web): the [TanStack Start](https://tanstack.com/start) app,
  deployed as a Cloudflare Worker, with [Clerk](https://clerk.com) for sign-in,
  MongoDB for pages and Cloudflare R2 for video. See its
  [README](apps/web/README.md) for the architecture.
- [`packages/mongo`](packages/mongo): `@repo/mongo`, the data layer. The
  journal collections, the shelf aggregation, and the period-key helpers the
  UI and server share. See its [README](packages/mongo/README.md).

## Develop

```bash
bun install
bun run dev
```

That starts the web app on <http://localhost:3000> and a local MongoDB (a real
`mongod`, downloaded on first run, data kept in `.mongo-data`). No Docker.
Local dev also gets a simulated R2 bucket, so video works without an account.

You need Clerk keys in `apps/web/.env.local` (copy `.env.example`). `MONGODB_URI`
can stay at its local default, or point at an Atlas cluster to work against
real data. Sign in with the "Dev login (local only)" link on `/login` once
`DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` are set and `bun run create-dev-user`
has been run in `apps/web`.

To see the shelf full, write three years of plausible pages for the dev user:

```bash
cd apps/web
bun run seed            # adds pages for days that have none
bun run seed --clear    # tears out every page first
```

Other commands, all from the root:

- `bun run check`: Ultracite lint plus typecheck across the workspace
- `bun test`: period keys, the shelf aggregation, media-key authorization
- `bun run build`: production build of the Worker
- `bun run deploy`: build and deploy (see below)

## Deploy

Local development needs none of this.

### 1. Cloudflare

```bash
cd apps/web
bunx wrangler login
```

If you belong to more than one account, set `CLOUDFLARE_ACCOUNT_ID` in
`apps/web/.env.local`.

### 2. MongoDB Atlas

The local database only exists on your machine. Create an
[Atlas](https://www.mongodb.com/atlas) cluster (the free tier is enough), a
database user with read/write on your database, and under **Network Access**
allow `0.0.0.0/0`: Workers have no fixed egress IPs. Copy the `mongodb+srv://`
connection string with the database name in its path, then create the indexes
once:

```bash
cd packages/mongo
MONGODB_URI='mongodb+srv://user:pass@cluster.mongodb.net/life-on-a-shelf' bun run ensure-indexes
```

### 3. Secrets on the Worker

`.env.local` never leaves your machine. Set each of these before the first
deploy; each command prompts for the value:

```bash
cd apps/web
wrangler secret put MONGODB_URI
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put VITE_CLERK_PUBLISHABLE_KEY
```

Never set `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` on a deployed Worker. Their
absence is what disables the dev-login route.

### 4. Ship it

```bash
bun run deploy
```

Open `/api/health` on the printed URL: it answers `{"status":"ok"}`. This
deploys the **text-only** journal, which works on any Cloudflare account.

### 5. Media (optional): R2 for video and photos

Pages can carry video and photos; the bytes go in an R2 bucket, never in
MongoDB. R2's free tier (10 GB storage, 1M Class A / 10M Class B operations a
month, free egress) covers a personal journal comfortably, but Cloudflare
requires a payment method on the account before R2 can be enabled. Enable it
in the dashboard, then:

```bash
cd apps/web
bunx wrangler r2 bucket create life-on-a-shelf-media
bun run deploy:media
```

`deploy:media` deploys the `media` environment from `wrangler.jsonc`, which is
the same Worker plus the `MEDIA` binding. Without the binding the editor says
in one line that video needs R2 and stays text-only; nothing errors. The media
routes never make the bucket public: every object key starts with the owner's
user id and `/api/media/*` refuses any key outside the signed-in user's prefix.

## License

[MIT](LICENSE)
