import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { READING_PLAN_THEMES } from "@/constants/bible";
import { apiRequest } from "@/lib/query-client";
import {
  getActiveReadingPlan,
  startReadingPlan,
  markReadingPlanDayComplete,
  clearReadingPlan,
  ReadingPlanProgress,
  getSelectedTranslation,
  saveVerse,
  isVerseSaved,
} from "@/lib/storage";

interface PlanDay {
  day: number;
  title: string;
  verse: string;
  reference: string;
  translation: string;
  focus: string;
  application: string;
}

interface ReadingPlan {
  theme: string;
  title: string;
  description: string;
  days: PlanDay[];
}

export default function ReadingPlanScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [view, setView] = useState<"picker" | "plan">("picker");
  const [activePlan, setActivePlan] = useState<ReadingPlan | null>(null);
  const [progress, setProgress] = useState<ReadingPlanProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [savedStates, setSavedStates] = useState<Record<string, boolean>>({});
  const [translation, setTranslation] = useState("NIV");

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    const [saved, trans] = await Promise.all([
      getActiveReadingPlan(),
      getSelectedTranslation(),
    ]);
    setTranslation(trans);
    if (saved) {
      setProgress(saved);
      // Fetch the plan for the saved theme
      fetchPlan(saved.themeId, trans, false);
    }
  };

  const fetchPlan = async (themeId: string, trans: string, showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      // Use raw fetch (not apiRequest) so we can inspect status before throwing,
      // allowing proper 429 / 504 handling without the error being swallowed.
      const rawResponse = await fetch(
        `${getApiUrl()}/api/reading-plan?theme=${encodeURIComponent(themeId)}&translation=${trans}`,
        { credentials: "include" }
      );

      // Handle rate limiting — respect Retry-After and do NOT retry automatically
      if (rawResponse.status === 429) {
        const retryAfter = parseInt(rawResponse.headers.get("Retry-After") || "30", 10);
        console.warn(`Reading plan rate limited. Retry after ${retryAfter}s`);
        setIsLoading(false);
        return; // Stop here, do not retry automatically
      }

      // Handle timeout/server error gracefully — surface message, do not retry
      if (rawResponse.status === 504 || rawResponse.status === 500) {
        const errData = await rawResponse.json().catch(() => ({}));
        console.error("Reading plan server error:", errData);
        setIsLoading(false);
        return; // Stop here, do not retry automatically
      }

      if (!rawResponse.ok) {
        throw new Error(`${rawResponse.status}: ${rawResponse.statusText}`);
      }

      const data = await rawResponse.json();
      setActivePlan(data);
      setView("plan");
      // Check saved states for all verses
      const states: Record<string, boolean> = {};
      for (const d of data.days || []) {
        states[d.reference] = await isVerseSaved(d.verse, d.reference);
      }
      setSavedStates(states);
    } catch (err) {
      console.error("Error fetching reading plan:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTheme = async (themeId: string, themeLabel: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startReadingPlan(themeId, themeLabel);
    const newProgress: ReadingPlanProgress = {
      themeId,
      themeLabel,
      startedAt: new Date().toISOString(),
      completedDays: [],
    };
    setProgress(newProgress);
    fetchPlan(themeId, translation, true);
  };

  const handleChangePlan = async () => {
    Haptics.selectionAsync();
    await clearReadingPlan();
    setProgress(null);
    setActivePlan(null);
    setView("picker");
    setExpandedDay(null);
  };

  const handleToggleDay = (dayIndex: number) => {
    Haptics.selectionAsync();
    setExpandedDay((prev) => (prev === dayIndex ? null : dayIndex));
  };

  const handleCompleteDay = async (dayIndex: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markReadingPlanDayComplete(dayIndex);
    setProgress((prev) => {
      if (!prev) return prev;
      const newCompleted = [...prev.completedDays];
      if (!newCompleted.includes(dayIndex)) newCompleted.push(dayIndex);
      return { ...prev, completedDays: newCompleted };
    });

    // Check if this was the final day — fire a plan completion celebration
    const planLength = activePlan?.days?.length || 7;
    const isLastDay = dayIndex === planLength - 1;
    if (isLastDay && progress) {
      const alreadyCompletedAll =
        progress.completedDays.length >= planLength - 1; // -1 because this day is being added now
      if (alreadyCompletedAll || planLength === 1) {
        // Small delay so the UI updates first
        setTimeout(() => {
          const planTitle = activePlan?.title || "7-Day Reading Plan";
          Alert.alert(
            "🎉 Plan Complete!",
            `You finished "${planTitle}"!\n\nCompleting a 7-day reading plan takes real dedication. Scripture has been guiding you all week — carry that momentum forward.\n\nWant to share this win with a friend?`,
            [
              { text: "Choose Another Plan", onPress: handleChangePlan },
              {
                text: "Share",
                onPress: () => {
                  Share.share({
                    message: `I just finished a 7-day Bible reading plan on "${activePlan?.theme || "Scripture"}" using Verse for You! If you're looking for a daily dose of Scripture, check it out:\nhttps://verseforyou.app`,
                    title: "I finished a reading plan!",
                  }).catch(() => {});
                },
              },
            ]
          );
        }, 600);
      }
    }
  };

  const handleSaveVerse = async (day: PlanDay) => {
    if (savedStates[day.reference]) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveVerse({
      id: Date.now().toString(),
      verse: day.verse,
      reference: day.reference,
      emotion: `Reading Plan: ${activePlan?.theme || ""}`,
      savedAt: new Date().toISOString(),
      translation: day.translation,
    });
    setSavedStates((prev) => ({ ...prev, [day.reference]: true }));
  };

  const handleShareDay = async (day: PlanDay) => {
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: `Day ${day.day}: ${day.title}\n\n"${day.verse}"\n— ${day.reference}\n\nShared via Verse for You 📖`,
      });
    } catch {}
  };

  const completedCount = progress?.completedDays?.length || 0;
  const totalDays = activePlan?.days?.length || 7;

  // --- Picker View ---
  if (view === "picker") {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing["3xl"],
          },
        ]}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <ThemedText type="h3" style={[styles.title, { color: theme.text }]}>
            7-Day Reading Plans
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textTertiary }]}>
            Choose a theme and begin a week of focused Scripture reading
          </ThemedText>

          {READING_PLAN_THEMES.map((planTheme, index) => (
            <Animated.View
              key={planTheme.id}
              entering={FadeInDown.duration(300).delay(index * 50)}
            >
              <Pressable
                style={[
                  styles.themeCard,
                  { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                ]}
                onPress={() => handleSelectTheme(planTheme.id, planTheme.label)}
                testID={`plan-theme-${planTheme.id}`}
              >
                <View style={styles.themeInfo}>
                  <ThemedText style={[styles.themeLabel, { color: theme.text }]}>
                    {planTheme.label}
                  </ThemedText>
                  <ThemedText style={[styles.themeDays, { color: theme.textTertiary }]}>
                    7-day plan
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textTertiary} />
              </Pressable>
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>
    );
  }

  // --- Plan View ---
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing["3xl"],
        },
      ]}
    >
      {isLoading ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText style={[styles.loadingText, { color: theme.textTertiary }]}>
            Building your reading plan…
          </ThemedText>
        </Animated.View>
      ) : activePlan ? (
        <Animated.View entering={FadeIn.duration(400)}>
          {/* Plan Header */}
          <View
            style={[
              styles.planHeader,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <ThemedText type="h3" style={[styles.planTitle, { color: theme.text }]}>
              {activePlan.title}
            </ThemedText>
            <ThemedText style={[styles.planDescription, { color: theme.textSecondary }]}>
              {activePlan.description}
            </ThemedText>

            {/* Progress bar */}
            <View style={styles.progressRow}>
              <ThemedText style={[styles.progressLabel, { color: theme.textTertiary }]}>
                Day {completedCount} of {totalDays}
              </ThemedText>
              <View style={[styles.progressTrack, { backgroundColor: theme.backgroundTertiary }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.success,
                      width: `${(completedCount / totalDays) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <Pressable
              style={[styles.changePlanButton, { borderColor: theme.border }]}
              onPress={handleChangePlan}
            >
              <ThemedText style={[styles.changePlanText, { color: theme.textSecondary }]}>
                Choose a different plan
              </ThemedText>
            </Pressable>
          </View>

          {/* Days */}
          {activePlan.days.map((day, index) => {
            const isCompleted = progress?.completedDays?.includes(index) || false;
            const isExpanded = expandedDay === index;
            const isSaved = savedStates[day.reference] || false;

            return (
              <Animated.View
                key={day.day}
                entering={FadeInDown.duration(300).delay(index * 60)}
              >
                <Pressable
                  style={[
                    styles.dayCard,
                    {
                      backgroundColor: isCompleted
                        ? theme.backgroundSecondary
                        : theme.backgroundDefault,
                      borderColor: isCompleted ? theme.success : theme.border,
                    },
                  ]}
                  onPress={() => handleToggleDay(index)}
                  testID={`day-card-${index}`}
                >
                  <View style={styles.dayHeader}>
                    <View style={styles.dayHeaderLeft}>
                      <View
                        style={[
                          styles.dayBadge,
                          {
                            backgroundColor: isCompleted
                              ? theme.success
                              : theme.backgroundTertiary,
                          },
                        ]}
                      >
                        {isCompleted ? (
                          <Feather name="check" size={14} color="#fff" />
                        ) : (
                          <ThemedText
                            style={[
                              styles.dayNumber,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {day.day}
                          </ThemedText>
                        )}
                      </View>
                      <View>
                        <ThemedText style={[styles.dayTitle, { color: theme.text }]}>
                          {day.title}
                        </ThemedText>
                        <ThemedText
                          style={[styles.dayReference, { color: theme.link }]}
                        >
                          {day.reference}
                        </ThemedText>
                      </View>
                    </View>
                    <Feather
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={theme.textTertiary}
                    />
                  </View>

                  {isExpanded ? (
                    <Animated.View
                      entering={FadeInDown.duration(250)}
                      style={styles.dayContent}
                    >
                      <ThemedText
                        style={[styles.dayVerse, { color: theme.text }]}
                      >
                        "{day.verse}"
                      </ThemedText>

                      <View
                        style={[
                          styles.focusBox,
                          { backgroundColor: theme.backgroundTertiary },
                        ]}
                      >
                        <ThemedText
                          style={[styles.focusLabel, { color: theme.link }]}
                        >
                          TODAY'S FOCUS
                        </ThemedText>
                        <ThemedText
                          style={[styles.focusText, { color: theme.textSecondary }]}
                        >
                          {day.focus}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.applicationBox,
                          { backgroundColor: theme.backgroundSecondary },
                        ]}
                      >
                        <Feather name="check-circle" size={14} color={theme.success} />
                        <ThemedText
                          style={[styles.applicationText, { color: theme.text }]}
                        >
                          {day.application}
                        </ThemedText>
                      </View>

                      <View style={styles.dayActions}>
                        <Pressable
                          style={[
                            styles.dayActionButton,
                            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                          ]}
                          onPress={() => handleSaveVerse(day)}
                          testID={`button-save-day-${index}`}
                        >
                          <Feather
                            name="heart"
                            size={16}
                            color={isSaved ? theme.error : theme.textTertiary}
                          />
                          <ThemedText
                            style={[
                              styles.dayActionText,
                              { color: isSaved ? theme.error : theme.textSecondary },
                            ]}
                          >
                            {isSaved ? "Saved" : "Save"}
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dayActionButton,
                            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                          ]}
                          onPress={() => handleShareDay(day)}
                          testID={`button-share-day-${index}`}
                        >
                          <Feather name="share-2" size={16} color={theme.textTertiary} />
                          <ThemedText style={[styles.dayActionText, { color: theme.textSecondary }]}>
                            Share
                          </ThemedText>
                        </Pressable>

                        {!isCompleted ? (
                          <Pressable
                            style={[
                              styles.completeButton,
                              { backgroundColor: theme.success },
                            ]}
                            onPress={() => handleCompleteDay(index)}
                            testID={`button-complete-day-${index}`}
                          >
                            <Feather name="check" size={16} color="#fff" />
                            <ThemedText style={styles.completeText}>
                              Mark Complete
                            </ThemedText>
                          </Pressable>
                        ) : null}
                      </View>
                    </Animated.View>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 20,
  },
  themeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  themeInfo: {
    flex: 1,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  themeDays: {
    fontSize: 13,
  },
  loadingContainer: {
    alignItems: "center",
    paddingTop: Spacing["4xl"],
    gap: Spacing.lg,
  },
  loadingText: {
    fontSize: 15,
    fontStyle: "italic",
  },
  planHeader: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  planTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  planDescription: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  progressRow: {
    marginBottom: Spacing.lg,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  progressTrack: {
    height: 6,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  changePlanButton: {
    alignSelf: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  changePlanText: {
    fontSize: 13,
    fontWeight: "500",
  },
  dayCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  dayHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  dayBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "700",
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  dayReference: {
    fontSize: 13,
    fontWeight: "500",
  },
  dayContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: 0,
  },
  dayVerse: {
    ...Typography.verseBodySmall,
    fontStyle: "italic",
    marginBottom: Spacing.lg,
  },
  focusBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  focusLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },
  focusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  applicationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  applicationText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  dayActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  dayActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  dayActionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  completeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
});
