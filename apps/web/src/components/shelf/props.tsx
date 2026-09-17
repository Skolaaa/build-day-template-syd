/**
 * The one thing on the shelf that is not a book: a bookend where the last
 * row stops short. Drawn inline; decoration, hidden from assistive tech.
 */

/** A cast bookend: a heavy base and an upright, holding the last row up. */
export function Bookend() {
  return (
    <svg
      aria-hidden="true"
      className="bookend"
      fill="none"
      viewBox="0 0 46 120"
    >
      <title>Bookend</title>
      <path d="M2 118 L44 118 L44 108 L14 108 L14 10 L2 10 Z" fill="#3a3229" />
      <path d="M14 10 L2 10 L2 118 L6 118 L6 14 Z" fill="#57493a" />
      <path d="M14 108 L44 108 L44 112 L14 112 Z" fill="#57493a" />
      <rect fill="#8d7248" height="1.5" width="12" x="2" y="10" />
    </svg>
  );
}
