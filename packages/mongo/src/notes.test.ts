// Runs against a throwaway in-memory MongoDB (mongodb-memory-server), so no
// running database is needed. The first run downloads the mongod binary.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createNote, ensureNoteIndexes, listNotes } from "./notes.ts";
import { NOTE_TEXT_MAX_LENGTH } from "./shared.ts";

let server: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  client = new MongoClient(server.getUri());
  await ensureNoteIndexes(client.db("test"));
});

afterAll(async () => {
  await client.close();
  await server.stop();
});

describe("notes", () => {
  test("createNote trims text and returns plain JSON", async () => {
    const note = await createNote(client.db("test"), { text: "  hello  " });

    expect(note.text).toBe("hello");
    expect(typeof note.id).toBe("string");
    expect(new Date(note.createdAt).toISOString()).toBe(note.createdAt);
  });

  test("createNote rejects empty and over-long text", async () => {
    const db = client.db("test");

    await expect(createNote(db, { text: "   " })).rejects.toThrow(
      "must not be empty"
    );
    await expect(
      createNote(db, { text: "x".repeat(NOTE_TEXT_MAX_LENGTH + 1) })
    ).rejects.toThrow("at most");
  });

  test("listNotes returns newest first and honours the limit", async () => {
    const db = client.db("test");
    await createNote(db, { text: "first" });
    await createNote(db, { text: "second" });

    const notes = await listNotes(db, 2);

    expect(notes.map((n) => n.text)).toEqual(["second", "first"]);
  });
});
