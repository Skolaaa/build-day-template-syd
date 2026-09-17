# @repo/mongo

The MongoDB layer of the monorepo: the driver, connection handling tuned for Cloudflare Workers, a local database for development, and the journal collections (`entries`, `settings`, `volumeMeta`) in `src/journal.ts`.

## Entry points

| Import | Contents | Where it may run |
| --- | --- | --- |
| `@repo/mongo` | `withDb` (connection handling) | Server only: it imports the driver |
| `@repo/mongo/journal` | `saveEntry`, `getShelf`, `getVolume`, `searchEntries`, `getAtlas`, `ensureJournalIndexes`, ... | Server only |
| `@repo/mongo/shared` | Types, `periodKeyFor` / `periodRange` / `periodLabel`, spine sizing, media-key helpers, limits | Anywhere, including React components |

One entry per module, no barrel file: a new collection gets its own `src/<name>.ts` and its own `exports` line in `package.json`. Keep the server/browser split. Importing a driver-backed entry from a route component pulls the whole driver (about 1.4 MB) into the browser bundle. Anything the UI needs goes in `src/shared.ts`.

## Using it

```ts
import { withDb } from "@repo/mongo";
import { getShelf, saveEntry } from "@repo/mongo/journal";

const shelf = await withDb(uri, (db) => getShelf(db, userId, "month", "2026-09-17"));
const page = await withDb(uri, (db) =>
  saveEntry(db, userId, { body: "...", date: "2026-09-17", mood: 4, tags: ["walks"], title: "The river path" })
);
```

`withDb` opens a connection, runs the callback against the database named in the URI path (`mongodb://host/<db>`), and closes the connection. The app passes `env.MONGODB_URI` from `cloudflare:workers`; this package never reads environment variables itself, which is what lets it run unchanged under Bun for tests and scripts.

### One connection per request, on purpose

The Workers runtime ties a socket to the request that opened it. A `MongoClient` cached at module scope serves the first request and then hangs the next one with "the Worker's code had hung and would never generate a response". So `withDb` connects and disconnects per request. The cost is one handshake per request: milliseconds against the local server, roughly 100-300 ms against Atlas. If that matters, the next step is to hold the client inside a Durable Object, which keeps a connection warm across requests.

The client options in `src/client.ts` follow from the same model: `maxPoolSize: 1`, and `serverSelectionTimeoutMS: 3000` so an unreachable database fails in three seconds instead of the driver's thirty.

### Volumes are derived, not stored

An entry belongs to a date. Which volume it sits in is a function of that date and the reader's `volumePeriod` setting, computed inside the shelf aggregation (`listVolumes`) with `$substrCP` for years and months and `$isoWeek` / `$isoWeekYear` for weeks. Changing the period reshelves everything without touching a document. `volumeMeta` only exists for volumes the reader named or recoloured. The same period arithmetic lives in `src/shared.ts` (`periodKeyFor`, `periodRange`) with tests for the ISO week edges at year end.

### Collection modules

`src/journal.ts` shows the shape every collection module follows:

- The stored shape (`NoteDocument`, with `ObjectId` and `Date`) stays private to the module.
- Functions return plain JSON (`Note`, with `id: string` and an ISO date). Server function results are serialized, and driver types do not survive that.
- Input is validated before it reaches the database.
- Indexes live in one `ensure...Indexes` function, run once at setup (see below), never per request.

## Local database

`bun run dev` in this package (or at the repo root, where turbo starts it alongside the web app) runs a real `mongod` through [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server). No Docker or system install is needed. The first run downloads the binary (MongoDB 7.0, about 100 MB) into `node_modules/.cache`; later runs start in well under a second. Data is written to `.mongo-data` at the repo root, which is gitignored, so pages survive restarts. Delete that folder to start clean.

The default `MONGODB_URI` in `apps/web/.env.example` points at it: `mongodb://127.0.0.1:27017/life-on-a-shelf`.

```bash
bun run dev              # start the local database (Ctrl+C stops it)
bun test                 # runs against a throwaway in-memory instance
MONGODB_URI=mongodb://127.0.0.1:27017/life-on-a-shelf bun run ensure-indexes
```

## Atlas

Point `MONGODB_URI` at your cluster's `mongodb+srv://` string (the driver's SRV lookup works on Workers). Locally that goes in `apps/web/.env.local`; on a deployed Worker it is a secret:

```bash
cd apps/web && wrangler secret put MONGODB_URI
```

Run `ensure-indexes` against the cluster once before the first deploy.

## Two workarounds worth knowing about

- **Driver pinned to 6.x.** `mongodb@7` depends on `bson@7`, which calls `v8.startupSnapshot.isBuildingSnapshot()` at load time. Bun has not implemented it and throws, so `bun test` and the scripts would fail ([oven-sh/bun#32501](https://github.com/oven-sh/bun/issues/32501)). Cloudflare documents 6.15 and up as supported. Bump to 7 once Bun ships the fix.
- **`punycode/` in the Worker bundle.** The driver's `tr46` dependency does `require("punycode/")` (trailing slash, meaning the npm package rather than Node's builtin). The Cloudflare Vite plugin's dependency optimizer cannot resolve that spelling and leaves a bare `require`, which the Worker runtime does not have. `apps/web/vite.config.ts` has a small resolver plugin that maps it to the package's ES module ([cloudflare/workers-sdk#11751](https://github.com/cloudflare/workers-sdk/issues/11751)).
