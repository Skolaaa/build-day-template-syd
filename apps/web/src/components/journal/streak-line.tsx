import { plural, type ShelfStats } from "@repo/mongo/shared";

/** The streaks, said the way a person would say them. Shared by the shelf and the atlas. */
export function StreakLine({
  stats,
}: {
  stats: Pick<ShelfStats, "currentStreak" | "longestStreak">;
}) {
  const running =
    stats.currentStreak > 1
      ? `${plural(stats.currentStreak, "day")} in a row and counting`
      : null;
  const longest =
    stats.longestStreak > 1
      ? `the longest run was ${plural(stats.longestStreak, "day")}`
      : null;
  const parts = [running, longest].filter((part) => part !== null);
  if (parts.length === 0) {
    return null;
  }
  const line = parts.join("; ");
  return <>{line.charAt(0).toUpperCase() + line.slice(1)}.</>;
}
