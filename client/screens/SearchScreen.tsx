import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Share,
  TextInput as RNTextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import TranslationPickerModal from "@/components/TranslationPickerModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { SEARCH_SUGGESTIONS } from "@/constants/bible";
import { apiRequest } from "@/lib/query-client";
import { saveVerse, isVerseSaved, getSelectedTranslation, setSelectedTranslation, getRecentSearches, addRecentSearch, clearRecentSearches } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";


interface VerseResult {
  verse: string;
  reference: string;
  translation: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const inputRef = useRef<RNTextInput>(null);

  const [keyword, setKeyword] = useState("");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [verses, setVerses] = useState<VerseResult[]>([]);
  const [savedStates, setSavedStates] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTranslation, setSelectedTranslationState] = useState("NIV");
  const [showTranslationPicker, setShowTranslationPicker] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const buttonScale = useSharedValue(1);

  useEffect(() => {
    getSelectedTranslation().then(setSelectedTranslationState);
    getRecentSearches().then(setRecentSearches);
  }, []);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setKeyword(suggestion);
    Haptics.selectionAsync();
  };

  const handleTranslationSelect = async (translation: string) => {
    setSelectedTranslationState(translation);
    await setSelectedTranslation(translation);
    setShowTranslationPicker(false);
    Haptics.selectionAsync();
  };

  const checkSavedStates = async (verseList: VerseResult[]) => {
    const states: { [key: string]: boolean } = {};
    for (const v of verseList) {
      const key = `${v.verse}-${v.reference}`;
      states[key] = await isVerseSaved(v.verse, v.reference);
    }
    setSavedStates(states);
  };

  const handleSearch = async () => {
    if (!keyword.trim()) return;

    setIsLoading(true);
    setError(null);
    setVerses([]);
    setSavedStates({});
    const trimmedKeyword = keyword.trim();
    setSearchedKeyword(trimmedKeyword);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Save to recent searches
    await addRecentSearch(trimmedKeyword);
    const updated = await getRecentSearches();
    setRecentSearches(updated);

    try {
      const response = await apiRequest("POST", "/api/search", {
        keyword: keyword.trim(),
        translation: selectedTranslation,
        count: 10,
      });
      const data = await response.json();
      setVerses(data.verses || []);
      await checkSavedStates(data.verses || []);
    } catch (err) {
      setError("Scripture seems quiet right now — take a breath and try again.");
      console.error("Error searching:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveVerse = async (verseResult: VerseResult) => {
    const key = `${verseResult.verse}-${verseResult.reference}`;
    if (savedStates[key]) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await saveVerse({
      id: Date.now().toString(),
      verse: verseResult.verse,
      reference: verseResult.reference,
      emotion: `Search: ${searchedKeyword}`,
      savedAt: new Date().toISOString(),
      translation: verseResult.translation,
    });

    setSavedStates(prev => ({ ...prev, [key]: true }));
  };

  const handleCopyVerse = async (verseResult: VerseResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `"${verseResult.verse}" — ${verseResult.reference} (${verseResult.translation})`,
      });
    } catch (err) {
      console.error("Error copying verse:", err);
    }
  };

  const handleVersePress = (verseResult: VerseResult) => {
    const key = `${verseResult.verse}-${verseResult.reference}`;
    navigation.navigate("VerseDetail", {
      verse: verseResult.verse,
      reference: verseResult.reference,
      emotion: `Search: ${searchedKeyword}`,
      isSaved: savedStates[key] || false,
      translation: verseResult.translation,
    });
  };

  const renderVerse = ({ item, index }: { item: VerseResult; index: number }) => {
    const key = `${item.verse}-${item.reference}`;
    const isSaved = savedStates[key] || false;

    return (
      <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
        <Pressable
          style={[
            styles.verseCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: isSaved ? theme.success : theme.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0 : 0.05,
              shadowRadius: isDark ? 0 : 10,
              elevation: isDark ? 0 : 2,
            },
          ]}
          onPress={() => handleVersePress(item)}
          testID={`card-search-verse-${index}`}
        >
          <View style={styles.cardActionRow}>
            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => handleSaveVerse(item)}
              testID={`button-save-search-verse-${index}`}
            >
              <Feather
                name="heart"
                size={18}
                color={isSaved ? theme.error : theme.textTertiary}
                style={{ opacity: isSaved ? 1 : 0.6 }}
              />
            </Pressable>
            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => handleCopyVerse(item)}
              testID={`button-copy-search-verse-${index}`}
            >
              <Feather
                name="copy"
                size={18}
                color={theme.textTertiary}
                style={{ opacity: 0.7 }}
              />
            </Pressable>
          </View>

          <ThemedText
            style={[styles.verseText, { color: theme.text }]}
            numberOfLines={4}
          >
            "{item.verse}"
          </ThemedText>

          <View style={styles.cardFooter}>
            <View>
              <ThemedText style={[styles.referenceText, { color: theme.link }]}>
                {item.reference}
              </ThemedText>
              <ThemedText style={[styles.translationText, { color: theme.textTertiary }]}>
                {item.translation}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textTertiary} />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const handleClearRecent = async () => {
    Haptics.selectionAsync();
    await clearRecentSearches();
    setRecentSearches([]);
  };

  const renderEmptyState = () => {
    if (isLoading || error) return null;

    return (
      <View style={styles.emptyContainer}>
        {recentSearches.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <ThemedText style={[styles.recentTitle, { color: theme.textSecondary }]}>
                Recent Searches
              </ThemedText>
              <Pressable onPress={handleClearRecent}>
                <ThemedText style={[styles.clearText, { color: theme.link }]}>
                  Clear
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.recentPills}>
              {recentSearches.map((item) => (
                <Pressable
                  key={item}
                  style={[
                    styles.recentPill,
                    { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                  ]}
                  onPress={() => {
                    setKeyword(item);
                    Haptics.selectionAsync();
                  }}
                >
                  <Feather name="clock" size={12} color={theme.textTertiary} />
                  <ThemedText style={[styles.recentPillText, { color: theme.textSecondary }]}>
                    {item}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            <Feather name="book" size={64} color={theme.textTertiary} style={styles.emptyIcon} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              Bible Concordance
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              Enter any word to find every verse where it appears
            </ThemedText>
          </>
        )}
      </View>
    );
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight + Spacing.xl,
          },
        ]}
      >
        <View style={styles.headerSection}>
          <ThemedText type="h3" style={[styles.title, { color: theme.text }]}>
            Bible Concordance
          </ThemedText>

          <ThemedText style={[styles.explanationText, { color: theme.textTertiary }]}>
            Find every verse containing a word or topic
          </ThemedText>

          <View
            style={[
              styles.inputContainer,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="search" size={20} color={theme.textTertiary} style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.text }]}
              placeholder="Search any word..."
              placeholderTextColor={theme.textTertiary}
              value={keyword}
              onChangeText={setKeyword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              testID="input-search"
            />
          </View>

          <View style={styles.suggestionsRow}>
            {SEARCH_SUGGESTIONS.map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.suggestionPill,
                  {
                    backgroundColor:
                      keyword.toLowerCase() === item
                        ? theme.link
                        : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => handleSuggestionSelect(item)}
                testID={`pill-search-${item}`}
              >
                <ThemedText
                  style={[
                    styles.suggestionText,
                    {
                      color:
                        keyword.toLowerCase() === item
                          ? theme.buttonText
                          : theme.textSecondary,
                    },
                  ]}
                >
                  {item}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[
              styles.translationSelector,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
            ]}
            onPress={() => setShowTranslationPicker(true)}
            testID="button-search-translation"
          >
            <View style={styles.translationContent}>
              <Feather name="book-open" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.translationSelectorText, { color: theme.textSecondary }]}>
                {selectedTranslation}
              </ThemedText>
            </View>
            <Feather name="chevron-down" size={16} color={theme.textTertiary} />
          </Pressable>

          <AnimatedPressable
            style={[
              styles.searchButton,
              { backgroundColor: theme.link, opacity: keyword.trim() ? 1 : 0.5 },
              animatedButtonStyle,
            ]}
            onPress={handleSearch}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!keyword.trim() || isLoading}
            testID="button-search"
          >
            {isLoading ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.buttonText }]}>
                Search
              </ThemedText>
            )}
          </AnimatedPressable>

          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
              <ThemedText style={[styles.errorText, { color: theme.error }]}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          {verses.length > 0 ? (
            <ThemedText style={[styles.resultsLabel, { color: theme.textSecondary }]}>
              {verses.length} verses found for "{searchedKeyword}"
            </ThemedText>
          ) : null}
        </View>

        <FlatList
          style={styles.resultsList}
          contentContainerStyle={[
            styles.resultsContent,
            { paddingBottom: tabBarHeight + Spacing["3xl"] },
            verses.length === 0 && styles.emptyListContent,
          ]}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          data={verses}
          keyExtractor={(item, index) => `${item.reference}-${index}`}
          renderItem={renderVerse}
          ListEmptyComponent={renderEmptyState}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>

      <TranslationPickerModal
        visible={showTranslationPicker}
        selectedTranslation={selectedTranslation}
        onSelect={handleTranslationSelect}
        onClose={() => setShowTranslationPicker(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  explanationText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: Spacing.inputHeight,
    fontSize: 17,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  suggestionPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  translationSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  translationContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  translationSelectorText: {
    fontSize: 15,
    fontWeight: "500",
  },
  searchButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  errorContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    textAlign: "center",
    fontSize: 15,
  },
  resultsLabel: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  verseCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cardActionRow: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    gap: Spacing.xs,
    zIndex: 10,
  },
  saveButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  verseText: {
    ...Typography.verseBodySmall,
    fontStyle: "italic",
    marginBottom: Spacing.md,
    marginRight: 88, // room for 2 action buttons
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
  emptyContainer: {
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  emptyIcon: {
    marginBottom: Spacing["2xl"],
    opacity: 0.4,
    alignSelf: "center",
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
  recentSection: {
    width: "100%",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearText: {
    fontSize: 14,
    fontWeight: "500",
  },
  recentPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  recentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  recentPillText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
