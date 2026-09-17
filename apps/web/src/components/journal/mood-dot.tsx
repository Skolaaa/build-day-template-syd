import { MOOD_LABELS, type Mood } from "@repo/mongo/shared";

export function MoodDot({ mood }: { mood: Mood | null }) {
  if (mood === null) {
    return null;
  }
  return (
    <span
      aria-label={`felt ${MOOD_LABELS[mood]}`}
      className="mood-dot"
      data-mood={mood}
      role="img"
      title={`felt ${MOOD_LABELS[mood]}`}
    />
  );
}
