import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const { resolvedColorScheme } = useThemeContext();
  const isDark = resolvedColorScheme === "dark";
  const theme = Colors[resolvedColorScheme];

  return {
    theme,
    isDark,
  };
}
