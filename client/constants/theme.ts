import { Platform } from "react-native";

// Bible Verse App - Warm spiritual palette with muted indigo accent
const primaryColor = "#7C6E8A"; // Muted indigo-purple — spiritual, calm, modern
const primaryDark = "#5C5070";

export const Colors = {
  light: {
    text: "#2A2630",
    textSecondary: "#6B6478",
    textTertiary: "#A09AAC",
    buttonText: "#FFFFFF",
    tabIconDefault: "#A09AAC",
    tabIconSelected: primaryColor,
    link: primaryColor,
    backgroundRoot: "#F8F6FB",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F2EFF7",
    backgroundTertiary: "#E8E4F0",
    accent: "#C4BAD4",
    success: "#7A9B76",
    error: "#C17B7B",
    border: "#E6E2EE",
  },
  dark: {
    text: "#F0EEF5",
    textSecondary: "#B0A8BE",
    textTertiary: "#857E94",
    buttonText: "#FFFFFF",
    tabIconDefault: "#857E94",
    tabIconSelected: "#C4BAD4",
    link: "#C4BAD4",
    backgroundRoot: "#18161D",
    backgroundDefault: "#232029",
    backgroundSecondary: "#2D2A35",
    backgroundTertiary: "#383442",
    accent: "#7C6E8A",
    success: "#7A9B76",
    error: "#C17B7B",
    border: "#383442",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 52,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "400" as const,
  },
  bodyLarge: {
    fontSize: 22,
    lineHeight: 34,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  // Verse body uses a serif font for a devotional, editorial feel (2026 standard for faith apps)
  verseBody: {
    fontSize: 22,
    lineHeight: 34,
    fontWeight: "400" as const,
    fontFamily: Platform.select({ ios: "ui-serif", default: "serif" }),
  },
  verseBodySmall: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "400" as const,
    fontFamily: Platform.select({ ios: "ui-serif", default: "serif" }),
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
