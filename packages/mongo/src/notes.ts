import type { Collection, Db, ObjectId } from "mongodb";
import { NOTE_TEXT_MAX_LENGTH, type Note } from "./shared.ts";

/** How a note is stored. Only this module sees `_id` and `Date`. */
interface NoteDocument {
  _id: ObjectId;
  createdAt: Date;
  text: string;
}

const DEFAULT_LIST_LIMIT = 20;

function notesCollection(db: Db): Collection<NoteDocument> {
  return db.collection<NoteDocument>("notes");
}

function toNote(doc: NoteDocument): Note {
  return {
    createdAt: doc.createdAt.toISOString(),
    id: doc._id.toHexString(),
    text: doc.text,
  };
}

/** Creates the indexes the queries below rely on. Run once at setup, not per request. */
export async function ensureNoteIndexes(db: Db): Promise<void> {
  await notesCollection(db).createIndex({ createdAt: -1 });
}

/** Newest notes first. */
export async function listNotes(
  db: Db,
  limit = DEFAULT_LIST_LIMIT
): Promise<Note[]> {
  const docs = await notesCollection(db)
    .find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toNote);
}

/** Validates and stores a note. Throws on empty or over-long text. */
export async function createNote(
  db: Db,
  input: { text: string }
): Promise<Note> {
  const text = input.text.trim();
  if (text.length === 0) {
    throw new Error("Note text must not be empty.");
  }
  if (text.length > NOTE_TEXT_MAX_LENGTH) {
    throw new Error(
      `Note text must be at most ${NOTE_TEXT_MAX_LENGTH} characters.`
    );
  }

  const { insertedId } = await notesCollection(db).insertOne({
    createdAt: new Date(),
    text,
  } as NoteDocument);

  const doc = await notesCollection(db).findOne({ _id: insertedId });
  if (!doc) {
    throw new Error("Note was inserted but could not be read back.");
  }
  return toNote(doc);
}
