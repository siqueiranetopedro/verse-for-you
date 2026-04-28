import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator, Share } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { saveVerse, isVerseSaved, getSelectedTranslation } from "@/lib/storage";

interface DailyVerse {
  verse: string;
  reference: string;
  translation: string;
  theme: string;
  date: string;
}

export default function VerseOfTheDay() {
  const { theme, isDark } = useTheme();
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadDailyVerse();
  }, []);

  const loadDailyVerse = async () => {
    try {
      setIsLoading(true);
      const translation = await getSelectedTranslation();
      const response = await apiRequest(
        "GET",
        `/api/verse-of-day?translation=${translation}`
      );
      const data = await response.json();
      setDailyVerse(data);
      const saved = await isVerseSaved(data.verse, data.reference);
      setIsSaved(saved);
    } catch (err) {
      console.error("Failed to load verse of the day:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dailyVerse || isSaved) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveVerse({
      id: Date.now().toString(),
      verse: dailyVerse.verse,
      reference: dailyVerse.reference,
      emotion: "Daily Verse",
      savedAt: new Date().toISOString(),
      translation: dailyVerse.translation,
    });
    setIsSaved(true);
  };

  const handleShare = async () => {
    if (!dailyVerse) return;
    Haptics.selectionAsync();
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    try {
      await Share.share({
        message: `📖 Verse of the Day — ${today}\n\n"${dailyVerse.verse}"\n\n— ${dailyVerse.reference} (${dailyVerse.translation})\n\n✨ Found with Verse for You · verseforyou.app`,
        title: `Verse of the Day — ${dailyVerse.reference}`,
      });
    } catch (err) {
      console.error("Error sharing VOTD:", err);
    }
  };

  const toggleExpand = () => {
    Haptics.selectionAsync();
    setIsExpanded((v) => !v);
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <ActivityIndicator size="small" color={theme.link} />
        <ThemedText style={[styles.loadingText, { color: theme.textTertiary }]}>
          Loading today's verse…
        </ThemedText>
      </View>
    );
  }

  if (!dailyVerse) return null;

  return (
    <Animated.View entering={FadeInDown.duration(500)}>
      <Pressable
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: isDark ? theme.accent : undefined,
            borderWidth: isDark ? 1 : 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0 : 0.07,
            shadowRadius: isDark ? 0 : 12,
            elevation: isDark ? 0 : 3,
          },
        ]}
        onPress={toggleExpand}
        testID="verse-of-the-day-card"
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.labelRow}>
            <Feather name="sun" size={14} color={theme.link} />
            <ThemedText style={[styles.label, { color: theme.link }]}>
              VERSE OF THE DAY
            </ThemedText>
          </View>
          <View style={styles.headerRight}>
            {dailyVerse.theme ? (
              <View
                style={[
                  styles.themeBadge,
                  { backgroundColor: theme.backgroundTertiary },
                ]}
              >
                <ThemedText style={[styles.themeText, { color: theme.textSecondary }]}>
                  {dailyVerse.theme}
                </ThemedText>
              </View>
            ) : null}
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.textTertiary}
            />
          </View>
        </View>

        {/* Reference always visible */}
        <ThemedText style={[styles.reference, { color: theme.link }]}>
          {dailyVerse.reference}
        </ThemedText>

        {/* Verse text — shown when expanded */}
        {isExpanded ? (
          <View>
            <ThemedText style={[styles.verseText, { color: theme.text }]}>
              "{dailyVerse.verse}"
            </ThemedText>

            <View style={styles.footerRow}>
              <ThemedText style={[styles.translationLabel, { color: theme.textTertiary }]}>
                {dailyVerse.translation}
              </ThemedText>
              <View style={styles.footerActions}>
                <Pressable
                  style={[
                    styles.saveButton,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                  onPress={handleSave}
                  testID="votd-save-button"
                >
                  <Feather
                    name="heart"
                    size={16}
                    color={isSaved ? theme.error : theme.textTertiary}
                    style={{ opacity: isSaved ? 1 : 0.7 }}
                  />
                  <ThemedText
                    style={[
                      styles.saveText,
                      { color: isSaved ? theme.error : theme.textSecondary },
                    ]}
                  >
                    {isSaved ? "Saved" : "Save"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.saveButton,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                  onPress={handleShare}
                  testID="votd-share-button"
                >
                  <Feather
                    name="share-2"
                    size={16}
                    color={theme.textTertiary}
                    style={{ opacity: 0.7 }}
                  />
                  <ThemedText style={[styles.saveText, { color: theme.textSecondary }]}>
                    Share
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <ThemedText
            style={[styles.versePreview, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            "{dailyVerse.verse}"
          </ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing["2xl"],
  },
  loadingText: {
    fontSize: 14,
  },
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing["2xl"],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  themeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  themeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  reference: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  versePreview: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontFamily: Typography.verseBodySmall.fontFamily,
  },
  verseText: {
    ...Typography.verseBodySmall,
    fontStyle: "italic",
    marginBottom: Spacing.lg,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  saveText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
