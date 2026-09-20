import {
  isShelfOrder,
  type JournalSettings,
  type ShelfOrder,
} from "@repo/mongo/shared";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { updateSettingsFn } from "#/server/journal";

const OPTIONS: { key: ShelfOrder; label: string; title: string }[] = [
  { key: "newest", label: "This year up", title: "The newest year on top" },
  { key: "oldest", label: "First year up", title: "The oldest year on top" },
];

/** Which end of the bookcase the present is at. */
export function ShelfOrderToggle({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (next: ShelfOrder) => void;
  value: ShelfOrder;
}) {
  return (
    <ToggleGroup
      aria-label="Which year is on the top shelf"
      disabled={disabled}
      onValueChange={(next) => {
        if (isShelfOrder(next) && next !== value) {
          onChange(next);
        }
      }}
      size="sm"
      spacing={0}
      type="single"
      value={value}
      variant="outline"
    >
      {OPTIONS.map((option) => (
        <ToggleGroupItem
          aria-label={option.title}
          className="px-3 text-[12.5px] text-ink-faint data-[state=on]:bg-paper-sunk data-[state=on]:text-ink"
          key={option.key}
          title={option.title}
          value={option.key}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * The same toggle, on the shelf itself: turning the case over saves the
 * choice, so it stays that way next visit and on the settings page.
 */
export function SavedShelfOrderToggle({
  settings,
}: {
  settings: JournalSettings;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const turn = async (shelfOrder: ShelfOrder) => {
    setSaving(true);
    try {
      await updateSettingsFn({ data: { ...settings, shelfOrder } });
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The shelf could not be turned."
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <ShelfOrderToggle
      disabled={saving}
      onChange={turn}
      value={settings.shelfOrder}
    />
  );
}
