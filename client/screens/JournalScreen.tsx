import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getSavedVerses, removeVerse, SavedVerse, getTotalVersesFound } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [savedVerses, setSavedVerses] = useState<SavedVerse[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalVersesFound, setTotalVersesFound] = useState(0);
  const [activeEmotionFilter, setActiveEmotionFilter] = useState<string | null>(null);

  const filteredVerses = useMemo(() => {
    let results = savedVerses;
    if (activeEmotionFilter) {
      results = results.filter(
        (v) => v.emotion.toLowerCase() === activeEmotionFilter.toLowerCase()
      );
    }
    if (!searchQuery.trim()) return results;
    const q = searchQuery.toLowerCase();
    return results.filter(
      (v) =>
        v.verse.toLowerCase().includes(q) ||
        v.reference.toLowerCase().includes(q) ||
        v.emotion.toLowerCase().includes(q)
    );
  }, [savedVerses, searchQuery, activeEmotionFilter]);

  const loadVerses = useCallback(async () => {
    const [verses, total] = await Promise.all([
      getSavedVerses(),
      getTotalVersesFound(),
    ]);
    setSavedVerses(verses);
    setTotalVersesFound(total);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVerses();
    }, [loadVerses])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadVerses();
    setIsRefreshing(false);
  };

  const handleDelete = (verse: SavedVerse) => {
    Alert.alert(
      "Remove Verse",
      "Are you sure you want to remove this verse from your journal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await removeVerse(verse.id);
            await loadVerses();
          },
        },
      ]
    );
  };

  const handleVersePress = (verse: SavedVerse) => {
    navigation.navigate("VerseDetail", {
      verse: verse.verse,
      reference: verse.reference,
      emotion: verse.emotion,
      isSaved: true,
      translation: verse.translation,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderItem = ({ item, index }: { item: SavedVerse; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
      <Pressable
        style={[
          styles.verseCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
            borderWidth: isDark ? 1 : 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.05,
            shadowRadius: isDark ? 0 : 10,
            elevation: isDark ? 0 : 2,
          },
        ]}
        onPress={() => handleVersePress(item)}
        onLongPress={() => handleDelete(item)}
        testID={`card-saved-verse-${index}`}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.emotionBadge,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              style={[styles.emotionText, { color: theme.textSecondary }]}
            >
              {item.emotion}
            </ThemedText>
          </View>
          <ThemedText
            style={[styles.dateText, { color: theme.textTertiary }]}
          >
            {formatDate(item.savedAt)}
          </ThemedText>
        </View>

        <ThemedText
          style={[styles.verseSnippet, { color: theme.text }]}
          numberOfLines={3}
        >
          "{item.verse}"
        </ThemedText>

        {item.notes ? (
          <View
            style={[
              styles.notePreview,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="edit-3" size={12} color={theme.textTertiary} style={styles.noteIcon} />
            <ThemedText
              style={[styles.noteText, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {item.notes}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View>
            <ThemedText
              style={[styles.referenceText, { color: theme.link }]}
            >
              {item.reference}
            </ThemedText>
            {item.translation ? (
              <ThemedText
                style={[styles.translationText, { color: theme.textTertiary }]}
              >
                {item.translation}
              </ThemedText>
            ) : null}
          </View>
          <Feather name="chevron-right" size={18} color={theme.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="bookmark" size={64} color={theme.textTertiary} style={styles.emptyIcon} />
      <ThemedText
        style={[styles.emptyTitle, { color: theme.text }]}
      >
        Your verse journey begins here
      </ThemedText>
      <ThemedText
        style={[styles.emptySubtitle, { color: theme.textTertiary }]}
      >
        Save verses that speak to you and build your personal collection
      </ThemedText>
    </View>
  );

  const topEmotions = useMemo(() => {
    const emotionCount: Record<string, number> = {};
    for (const v of savedVerses) {
      const key = v.emotion.toLowerCase();
      if (!key.startsWith("search:") && key !== "daily verse") {
        emotionCount[key] = (emotionCount[key] || 0) + 1;
      }
    }
    return Object.entries(emotionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion, count]) => ({ emotion, count }));
  }, [savedVerses]);

  const ListHeader = () => (
    <View>
      {/* Stats bar */}
      <View
        style={[
          styles.statsBar,
          { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
        ]}
      >
        <View style={styles.statItem}>
          <ThemedText style={[styles.statNumber, { color: theme.link }]}>
            {savedVerses.length}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textTertiary }]}>
            Saved
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <ThemedText style={[styles.statNumber, { color: theme.link }]}>
            {totalVersesFound}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textTertiary }]}>
            Explored
          </ThemedText>
        </View>
        {topEmotions.length > 0 && (
          <>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.topEmotions}>
                {topEmotions.slice(0, 3).map(({ emotion }) => (
                  <View
                    key={emotion}
                    style={[styles.emotionDot, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <ThemedText style={[styles.dotText, { color: theme.textSecondary }]}>
                      {emotion}
                    </ThemedText>
                  </View>
                ))}
              </View>
              <ThemedText style={[styles.statLabel, { color: theme.textTertiary }]}>
                Top moods
              </ThemedText>
            </View>
          </>
        )}
      </View>

      {/* Mood Insights bar chart */}
      {topEmotions.length >= 2 && (
        <Animated.View entering={FadeInDown.duration(450).delay(100)}>
          <View
            style={[
              styles.insightsCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <View style={styles.insightsHeader}>
              <Feather name="activity" size={13} color={theme.link} />
              <ThemedText style={[styles.insightsTitle, { color: theme.link }]}>
                EMOTIONAL JOURNEY
              </ThemedText>
            </View>
            {topEmotions.map(({ emotion, count }, index) => {
              const maxCount = topEmotions[0].count;
              const widthPct = Math.round((count / maxCount) * 100);
              const isActive = activeEmotionFilter === emotion;
              const isTop = index === 0;
              return (
                <Pressable
                  key={emotion}
                  style={styles.insightsRow}
                  onPress={() => {
                    setActiveEmotionFilter(isActive ? null : emotion);
                    Haptics.selectionAsync();
                  }}
                >
                  <ThemedText
                    style={[
                      styles.insightsEmotion,
                      {
                        color: isTop ? theme.text : theme.textSecondary,
                        fontWeight: isTop ? "600" : "400",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {emotion}
                  </ThemedText>
                  <View style={[styles.insightsTrack, { backgroundColor: theme.backgroundTertiary }]}>
                    <Animated.View
                      style={[
                        styles.insightsFill,
                        {
                          width: `${widthPct}%` as any,
                          backgroundColor: isActive
                            ? theme.link
                            : isTop
                            ? theme.accent
                            : theme.backgroundSecondary,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.insightsCount, { color: theme.textTertiary }]}>
                    {count}
                  </ThemedText>
                </Pressable>
              );
            })}
            <ThemedText style={[styles.insightsHint, { color: theme.textTertiary }]}>
              Tap a bar to filter your verses
            </ThemedText>
          </View>
        </Animated.View>
      )}

      {/* Search bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
        ]}
      >
        <Feather name="search" size={18} color={theme.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search verses, references, or emotions…"
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Emotion filter chips */}
      {topEmotions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <Pressable
            style={[
              styles.filterChip,
              {
                backgroundColor: activeEmotionFilter === null ? theme.link : theme.backgroundDefault,
                borderColor: activeEmotionFilter === null ? theme.link : theme.border,
              },
            ]}
            onPress={() => setActiveEmotionFilter(null)}
          >
            <ThemedText
              style={[
                styles.filterChipText,
                { color: activeEmotionFilter === null ? theme.buttonText : theme.textSecondary },
              ]}
            >
              All
            </ThemedText>
          </Pressable>
          {topEmotions.map(({ emotion }) => (
            <Pressable
              key={emotion}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeEmotionFilter === emotion ? theme.link : theme.backgroundDefault,
                  borderColor: activeEmotionFilter === emotion ? theme.link : theme.border,
                },
              ]}
              onPress={() => {
                setActiveEmotionFilter(activeEmotionFilter === emotion ? null : emotion);
                Haptics.selectionAsync();
              }}
            >
              <ThemedText
                style={[
                  styles.filterChipText,
                  { color: activeEmotionFilter === emotion ? theme.buttonText : theme.textSecondary },
                ]}
              >
                {emotion}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing["3xl"],
        },
        filteredVerses.length === 0 && styles.emptyListContent,
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={filteredVerses}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={savedVerses.length > 0 ? ListHeader : null}
      ListEmptyComponent={renderEmptyState}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.link}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  filterContent: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  verseCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  emotionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  emotionText: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  dateText: {
    fontSize: 13,
  },
  verseSnippet: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    marginBottom: Spacing.md,
    fontFamily: Typography.verseBodySmall.fontFamily,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  referenceText: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  translationText: {
    fontSize: 12,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  topEmotions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "center",
    marginBottom: 2,
  },
  emotionDot: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  dotText: {
    fontSize: 10,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    height: 46,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  notePreview: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  noteIcon: {
    marginRight: Spacing.xs,
    opacity: 0.7,
  },
  noteText: {
    fontSize: 13,
    fontStyle: "italic",
    flex: 1,
  },
  // Mood Insights card
  insightsCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  insightsTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  insightsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insightsEmotion: {
    fontSize: 13,
    width: 80,
    textTransform: "capitalize",
  },
  insightsTrack: {
    flex: 1,
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  insightsFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  insightsCount: {
    fontSize: 12,
    fontWeight: "600",
    width: 20,
    textAlign: "right",
  },
  insightsHint: {
    fontSize: 11,
    marginTop: Spacing.xs,
    fontStyle: "italic",
    textAlign: "right",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIcon: {
    marginBottom: Spacing["2xl"],
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});
