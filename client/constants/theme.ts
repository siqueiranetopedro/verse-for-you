import { Platform } from "react-native";

// Verse for You — Warm sage palette: calm, trustworthy, spiritually grounded
const primaryColor = "#4E7C6B"; // Warm sage green — growth, life, calm
const primaryDark = "#3A5E52"; // Deeper sage for dark mode

export const Colors = {
  light: {
    text: "#1C2B26",           // Deep forest — strong readability
    textSecondary: "#5A7267",  // Muted sage — secondary info
    textTertiary: "#8FA89F",   // Soft sage — hints and labels
    buttonText: "#FFFFFF",
    tabIconDefault: "#8FA89F",
    tabIconSelected: primaryColor,
    link: primaryColor,
    backgroundRoot: "#F5F7F5",    // Barely-green white — warm and clean
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#EDF2EF", // Soft sage-white
    backgroundTertiary: "#E0EAE5",  // Light sage
    accent: "#C4935A",           // Warm amber — CTAs and highlights
    success: "#4E7C6B",
    error: "#B56B6B",
    border: "#D8E5DE",
  },
  dark: {
    text: "#E8F0EC",           // Warm off-white
    textSecondary: "#9AB5A8",  // Muted sage
    textTertiary: "#6B8A7E",   // Darker muted sage
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B8A7E",
    tabIconSelected: "#8FC4B0",
    link: "#8FC4B0",
    backgroundRoot: "#141E1B",    // Deep forest — rich dark
    backgroundDefault: "#1C2B26", // Dark sage-green
    backgroundSecondary: "#243530",
    backgroundTertiary: "#2E4540",
    accent: "#C4935A",
    success: "#6BAF8E",
    error: "#C17B7B",
    border: "#2E4540",
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
