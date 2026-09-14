import { type Db, MongoClient } from "mongodb";

// Tuned for Cloudflare Workers, where a connection lives for one request and a
// hanging connection attempt blocks the whole page render.
const WORKER_CLIENT_OPTIONS = {
  // One request needs one connection; more would only multiply handshakes.
  maxPoolSize: 1,
  minPoolSize: 0,
  // Fail fast when the database is unreachable (e.g. local server not running)
  // instead of the driver's 30s default.
  serverSelectionTimeoutMS: 3000,
} as const;

/**
 * Opens a connection for `uri`, runs `fn` against the database named in the
 * URI path (`mongodb://host/<db>`), then closes the connection.
 *
 * One connection per request is deliberate. The Workers runtime ties a socket
 * to the request that opened it, so a `MongoClient` cached at module scope
 * serves the first request and hangs the next one ("the Worker's code had
 * hung and would never generate a response"). Connecting per request costs a
 * handshake: milliseconds locally, roughly 100-300ms to Atlas. To keep a
 * connection warm across requests, hold the client in a Durable Object.
 */
export async function withDb<T>(
  uri: string,
  fn: (db: Db) => Promise<T>
): Promise<T> {
  const client = new MongoClient(uri, WORKER_CLIENT_OPTIONS);
  try {
    return await fn(client.db());
  } finally {
    await client.close();
  }
}
