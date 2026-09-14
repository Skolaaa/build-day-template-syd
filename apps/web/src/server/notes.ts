// Server functions for the notes example. Only the `.handler()` bodies run on
// the server; the client bundle gets RPC stubs, so importing the driver and
// `cloudflare:workers` here never reaches the browser.

import { env } from "cloudflare:workers";
import { withDb } from "@repo/mongo";
import { createNote, listNotes } from "@repo/mongo/notes";
import { createServerFn } from "@tanstack/react-start";

export const listNotesFn = createServerFn({ method: "GET" }).handler(() =>
  withDb(env.MONGODB_URI, (db) => listNotes(db))
);

export const createNoteFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const text = (input as { text?: unknown } | null)?.text;
    if (typeof text !== "string") {
      throw new Error("Expected { text: string }.");
    }
    return { text };
  })
  .handler(({ data }) => withDb(env.MONGODB_URI, (db) => createNote(db, data)));
