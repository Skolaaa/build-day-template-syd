import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";

type ThemeMode = "light" | "dark" | "auto";

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  auto: "light",
  dark: "auto",
  light: "dark",
};

// Light and dark are "day" and "night" here: lamplight on the same shelf.
const MODE_LABEL: Record<ThemeMode, string> = {
  auto: "Auto",
  dark: "Night",
  light: "Day",
};

const MODE_ICON = {
  auto: Monitor,
  dark: Moon,
  light: Sun,
} as const;

function resolveTheme(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  if (mode === "auto") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }

  return "auto";
}

export function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(mode, prefersDark);

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);

  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }

  document.documentElement.style.colorScheme = resolved;
  window.localStorage.setItem("theme", mode);
}

/** The saved mode, kept in sync with the toggle and the OS. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    const initialMode = getInitialMode();
    setMode(initialMode);
    applyThemeMode(initialMode);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "theme") {
        setMode(getInitialMode());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (mode !== "auto") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode("auto");

    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [mode]);

  const change = (next: ThemeMode) => {
    setMode(next);
    applyThemeMode(next);
  };

  return [mode, change];
}

export default function ThemeToggle() {
  const [mode, setMode] = useThemeMode();

  const label =
    mode === "auto"
      ? "Theme: auto (follows the system). Click for day."
      : `Theme: ${MODE_LABEL[mode].toLowerCase()}. Click to change.`;

  const ModeIcon = MODE_ICON[mode];

  return (
    <Button
      aria-label={label}
      onClick={() => setMode(NEXT_MODE[mode])}
      size="sm"
      title={label}
      type="button"
      variant="outline"
    >
      <ModeIcon />
      {MODE_LABEL[mode]}
    </Button>
  );
}
