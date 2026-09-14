#!/usr/bin/env bun
// Runs a local MongoDB for development without Docker or a system install.
// mongodb-memory-server downloads a real `mongod` binary on first run (cached
// under node_modules/.cache) and starts it as a child process. Data is kept in
// <repo>/.mongo-data (gitignored) so it survives restarts.
//
// Started by `bun run dev` (turbo runs every workspace's `dev` script) or on
// its own with `bun run dev` inside packages/mongo. Ctrl+C stops it.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 27_017;
const dbPath = resolve(import.meta.dir, "../../../.mongo-data");

await mkdir(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { dbPath, port: PORT, storageEngine: "wiredTiger" },
});

const uri = server.getUri();
console.log(`MongoDB running at ${uri} (data in ${dbPath})`);
if (!uri.includes(`:${PORT}/`)) {
  console.warn(
    `Port ${PORT} was busy, so a random port was used. Point MONGODB_URI at the address above.`
  );
}

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
