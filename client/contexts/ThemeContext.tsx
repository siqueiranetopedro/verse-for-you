import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { getThemePreference, setThemePreference, ThemePreference } from "@/lib/storage";

type ColorScheme = "light" | "dark";

interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedColorScheme: ColorScheme;
  setTheme: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  themePreference: "system",
  resolvedColorScheme: "light",
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    getThemePreference().then(setThemePreferenceState);
  }, []);

  const resolvedColorScheme: ColorScheme =
    themePreference === "system"
      ? (systemColorScheme ?? "light")
      : themePreference;

  const setTheme = async (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    await setThemePreference(preference);
  };

  return (
    <ThemeContext.Provider value={{ themePreference, resolvedColorScheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
