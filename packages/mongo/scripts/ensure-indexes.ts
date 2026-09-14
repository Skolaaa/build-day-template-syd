#!/usr/bin/env bun
// Creates the indexes the package's queries rely on. Run once per database
// (locally after the first `bun run dev`, and against Atlas before deploying):
//
//   MONGODB_URI=mongodb://127.0.0.1:27017/boilerplate bun run ensure-indexes
import { withDb } from "../src/client.ts";
import { ensureNoteIndexes } from "../src/notes.ts";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not set.");
}

await withDb(uri, async (db) => {
  await ensureNoteIndexes(db);
  console.log(`Indexes ensured on ${db.databaseName}.`);
});
