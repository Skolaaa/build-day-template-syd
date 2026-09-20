import { ClerkProvider } from "@clerk/tanstack-react-start";
import { useResolvedTheme } from "#/hooks/use-resolved-theme";

// Brand tokens from styles.css, restated here because Clerk renders its UI
// in a shadow root that the app stylesheet's CSS variables never reach.
// Change them in both places.
const FONT = '"DM Sans", ui-sans-serif, system-ui, sans-serif';

const DAY = {
  borderRadius: "0.5rem",
  colorBackground: "#fdfaf3",
  colorDanger: "#a13a2a",
  colorInputBackground: "#fdfaf3",
  colorInputText: "#2b2520",
  colorNeutral: "#2b2520",
  colorPrimary: "#8a4433",
  colorText: "#2b2520",
  colorTextOnPrimaryBackground: "#fdfaf3",
  colorTextSecondary: "#6d6155",
  fontFamily: FONT,
};

const NIGHT = {
  ...DAY,
  colorBackground: "#1e1a16",
  colorDanger: "#e07a68",
  colorInputBackground: "#15120f",
  colorInputText: "#ece3d5",
  colorNeutral: "#ece3d5",
  colorPrimary: "#d08a6c",
  colorText: "#ece3d5",
  colorTextOnPrimaryBackground: "#15120f",
  colorTextSecondary: "#a29584",
};

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useResolvedTheme();
  const variables = theme === "dark" ? NIGHT : DAY;

  return <ClerkProvider appearance={{ variables }}>{children}</ClerkProvider>;
}
