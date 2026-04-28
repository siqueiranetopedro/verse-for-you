import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Share,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useThemeContext } from "@/contexts/ThemeContext";
import { ThemePreference, getStreakData, StreakData, getTotalVersesFound } from "@/lib/storage";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { themePreference, setTheme } = useThemeContext();

  const [dailyReminder, setDailyReminder] = useState(false);
  const [streakData, setStreakData] = useState<StreakData>({ current: 0, longest: 0, lastVisit: null });
  const [totalVersesFound, setTotalVersesFound] = useState(0);

  useEffect(() => {
    getStreakData().then(setStreakData);
    getTotalVersesFound().then(setTotalVersesFound);
  }, []);

  const handleThemeSelect = async (preference: ThemePreference) => {
    Haptics.selectionAsync();
    await setTheme(preference);
  };

  const handleToggleReminder = (value: boolean) => {
    Haptics.selectionAsync();
    setDailyReminder(value);
    if (value) {
      Alert.alert(
        "Coming Soon",
        "Daily reminders will be available in a future update."
      );
      setDailyReminder(false);
    }
  };

  const handleRateApp = () => {
    Haptics.selectionAsync();
    // Opens the App Store / Play Store listing when a real app ID is set.
    // For now, show a thank-you message.
    Alert.alert(
      "Rate Verse for You",
      "Your rating helps others discover this app and keeps the mission going. Thank you!",
      [{ text: "Close", style: "cancel" }]
    );
  };

  const handleShareApp = async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({
        message:
          "I've been using Verse for You to find Bible verses for every mood and moment. Check it out! 📖✨",
        title: "Verse for You",
      });
    } catch (error) {
      console.error("Error sharing app:", error);
    }
  };

  const handlePrivacyPolicy = () => {
    Haptics.selectionAsync();
    Linking.openURL("https://verseforyou.app/privacy").catch(() => {
      Alert.alert("Unable to Open", "Could not open the privacy policy.");
    });
  };

  const handleFeedback = () => {
    Haptics.selectionAsync();
    Linking.openURL("mailto:hello@verseforyou.app?subject=Feedback%20-%20Verse%20for%20You").catch(() => {
      Alert.alert(
        "Send Feedback",
        "Email us at hello@verseforyou.app with your thoughts, requests, or prayer needs. We read every message.",
        [{ text: "Close", style: "cancel" }]
      );
    });
  };

  const renderSettingRow = (
    icon: keyof typeof Feather.glyphMap,
    title: string,
    onPress?: () => void,
    rightElement?: React.ReactNode
  ) => (
    <Pressable
      style={[
        styles.settingRow,
        { borderBottomColor: theme.border },
      ]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name={icon} size={18} color={theme.link} />
        </View>
        <ThemedText style={styles.settingTitle}>{title}</ThemedText>
      </View>
      {rightElement ? (
        rightElement
      ) : onPress ? (
        <Feather name="chevron-right" size={20} color={theme.textTertiary} />
      ) : null}
    </Pressable>
  );

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing["3xl"],
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      {/* Streak Card */}
      <View
        style={[
          styles.streakCard,
          { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
        ]}
      >
        <View style={styles.streakItem}>
          <ThemedText style={[styles.streakNumber, { color: theme.link }]}>
            {streakData.current}
            {streakData.current >= 100 ? " 🏆" : streakData.current >= 30 ? " 🌟" : streakData.current >= 7 ? " 🔥" : ""}
          </ThemedText>
          <ThemedText style={[styles.streakLabel, { color: theme.textTertiary }]}>
            {streakData.current >= 100 ? "Legendary Streak" : streakData.current >= 30 ? "Day Streak" : streakData.current >= 7 ? "Day Streak" : "Day Streak"}
          </ThemedText>
        </View>
        <View style={[styles.streakDivider, { backgroundColor: theme.border }]} />
        <View style={styles.streakItem}>
          <ThemedText style={[styles.streakNumber, { color: theme.link }]}>
            {streakData.longest}
          </ThemedText>
          <ThemedText style={[styles.streakLabel, { color: theme.textTertiary }]}>
            Best Streak
          </ThemedText>
        </View>
        <View style={[styles.streakDivider, { backgroundColor: theme.border }]} />
        <View style={styles.streakItem}>
          <ThemedText style={[styles.streakNumber, { color: theme.link }]}>
            {totalVersesFound}
          </ThemedText>
          <ThemedText style={[styles.streakLabel, { color: theme.textTertiary }]}>
            Discovered
          </ThemedText>
        </View>
      </View>
      {streakData.current >= 7 && (
        <View style={[styles.milestoneBar, { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent }]}>
          <ThemedText style={[styles.milestoneText, { color: theme.textSecondary }]}>
            {streakData.current >= 100
              ? "🏆 100 days — you're an inspiration!"
              : streakData.current >= 30
              ? "🌟 30-day milestone! Amazing consistency."
              : "🔥 7-day streak! Keep up the great work."}
          </ThemedText>
        </View>
      )}

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          Preferences
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          {renderSettingRow(
            "bell",
            "Daily Reminder",
            undefined,
            <Switch
              value={dailyReminder}
              onValueChange={handleToggleReminder}
              trackColor={{ false: theme.backgroundTertiary, true: theme.link }}
              thumbColor="#FFFFFF"
            />
          )}

          {/* Theme selector row */}
          <View
            style={[
              styles.settingRow,
              { borderBottomColor: theme.border },
            ]}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="moon" size={18} color={theme.link} />
              </View>
              <ThemedText style={styles.settingTitle}>Appearance</ThemedText>
            </View>
            <View style={styles.themeOptions}>
              {(["light", "system", "dark"] as ThemePreference[]).map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.themeChip,
                    {
                      backgroundColor:
                        themePreference === option
                          ? theme.link
                          : theme.backgroundSecondary,
                      borderColor:
                        themePreference === option
                          ? theme.link
                          : theme.border,
                    },
                  ]}
                  onPress={() => handleThemeSelect(option)}
                >
                  <ThemedText
                    style={[
                      styles.themeChipText,
                      {
                        color:
                          themePreference === option
                            ? theme.buttonText
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          Support
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          {renderSettingRow("heart", "Support the Mission", () => {
            Haptics.selectionAsync();
            navigation.navigate("Donate");
          })}
          {renderSettingRow("star", "Rate App", handleRateApp)}
          {renderSettingRow("share-2", "Share with Friends", handleShareApp)}
          {renderSettingRow("mail", "Send Feedback", handleFeedback)}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          About
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          {renderSettingRow(
            "info",
            "Version",
            undefined,
            <ThemedText
              style={[styles.versionText, { color: theme.textTertiary }]}
            >
              1.5.0
            </ThemedText>
          )}
          {renderSettingRow("lock", "Privacy Policy", handlePrivacyPolicy)}
        </View>
      </View>

      <View style={styles.footerContainer}>
        <ThemedText
          style={[styles.footerText, { color: theme.textTertiary }]}
        >
          Verse for You
        </ThemedText>
        <ThemedText
          style={[styles.footerSubtext, { color: theme.textTertiary }]}
        >
          Find comfort in scripture
        </ThemedText>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  milestoneBar: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing["2xl"],
    alignItems: "center",
  },
  milestoneText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  streakItem: {
    alignItems: "center",
    flex: 1,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 2,
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  streakDivider: {
    width: 1,
    height: 40,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  sectionContent: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingTitle: {
    fontSize: 16,
  },
  versionText: {
    fontSize: 16,
  },
  footerContainer: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
    paddingTop: Spacing["2xl"],
  },
  footerText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  footerSubtext: {
    fontSize: 14,
    fontStyle: "italic",
  },
  themeOptions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  themeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
