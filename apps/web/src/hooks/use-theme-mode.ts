import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "auto";

const THEME_EVENT = "life-on-a-shelf:theme";

// Light and dark are "day" and "night" here: lamplight on the same shelf.
export const MODE_LABEL: Record<ThemeMode, string> = {
  auto: "Follow the system",
  dark: "Night",
  light: "Day",
};

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
}

/** The saved mode, kept in sync with every switcher on the page and the OS. */
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
    // Two switchers on one page (header and settings) hear each other this way.
    const onLocalChange = () => setMode(getInitialMode());
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onLocalChange);
    };
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

  // Only a deliberate choice is saved; applying the saved mode on mount must
  // never write it back, or a stale read would overwrite the preference.
  const change = (next: ThemeMode) => {
    setMode(next);
    applyThemeMode(next);
    window.localStorage.setItem("theme", next);
    window.dispatchEvent(new CustomEvent(THEME_EVENT));
  };

  return [mode, change];
}
