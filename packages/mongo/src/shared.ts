// Safe to import from browser code: no driver, no Node APIs. Everything the UI
// needs from this package lives here; the package root pulls in the driver.

/**
 * How a note leaves this package: plain JSON. Server functions serialize
 * their results, and `ObjectId`/`Date` would not survive the round trip.
 */
export interface Note {
  createdAt: string;
  id: string;
  text: string;
}

export const NOTE_TEXT_MAX_LENGTH = 280;
