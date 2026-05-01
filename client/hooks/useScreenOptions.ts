import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";

// expo-glass-effect is iOS-only — guard against web/Android crashes
let isLiquidGlassAvailable: () => boolean;
try {
  if (Platform.OS === "ios") {
    isLiquidGlassAvailable = require("expo-glass-effect").isLiquidGlassAvailable;
  } else {
    isLiquidGlassAvailable = () => false;
  }
} catch {
  isLiquidGlassAvailable = () => false;
}

interface UseScreenOptionsParams {
  transparent?: boolean;
}

export function useScreenOptions({
  transparent = true,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  return {
    headerTitleAlign: "center",
    headerTransparent: transparent && Platform.OS !== "web",
    headerBlurEffect: isDark ? "dark" : "light",
    headerTintColor: theme.text,
    headerStyle: {
      backgroundColor: Platform.select({
        ios: undefined,
        android: theme.backgroundRoot,
        web: theme.backgroundRoot,
      }),
    },
    gestureEnabled: Platform.OS !== "web",
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };
}
