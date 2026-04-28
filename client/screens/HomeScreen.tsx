import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import TranslationPickerModal from "@/components/TranslationPickerModal";
import VerseOfTheDay from "@/components/VerseOfTheDay";
import VerseResultCard, { VerseResult } from "@/components/VerseResultCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { EMOTION_SUGGESTIONS } from "@/constants/bible";
import { apiRequest } from "@/lib/query-client";
import { saveVerse, isVerseSaved, getSelectedTranslation, setSelectedTranslation, recordDailyVisit, incrementVersesFound, getRecentSearches, addRecentSearch, checkNewMilestone, StreakData } from "@/lib/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [emotion, setEmotion] = useState("");
  const [verses, setVerses] = useState<VerseResult[]>([]);
  const [savedStates, setSavedStates] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTranslation, setSelectedTranslationState] = useState("NIV");
  const [showTranslationPicker, setShowTranslationPicker] = useState(false);
  const [prayer, setPrayer] = useState<string | null>(null);
  const [isPrayerLoading, setIsPrayerLoading] = useState(false);
  const [showPrayer, setShowPrayer] = useState(false);
  const [isInspireLoading, setIsInspireLoading] = useState(false);
  const [recentEmotions, setRecentEmotions] = useState<string[]>([]);
  const [trendingEmotions, setTrendingEmotions] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Weekend reading plan nudge (Fri=5, Sat=6, Sun=0)
  const isWeekend = [0, 5, 6].includes(new Date().getDay());

  const buttonScale = useSharedValue(1);
  const prayerScale = useSharedValue(1);
  const inspireScale = useSharedValue(1);

  useEffect(() => {
    getSelectedTranslation().then(setSelectedTranslationState);
    // Record daily visit for streak tracking — fire the share prompt on streak milestones
    recordDailyVisit()
      .then((streakData) => showStreakMilestoneIfNeeded(streakData))
      .catch(() => {});
    // Load recent emotions
    getRecentSearches().then(setRecentEmotions).catch(() => {});
    // Load trending emotions from server (non-blocking)
    apiRequest("GET", "/api/trending-emotions")
      .then((r) => r.json())
      .then((data) => {
        const top = (data.trending || []).slice(0, 6).map((t: { emotion: string }) => t.emotion);
        if (top.length >= 3) setTrendingEmotions(top);
      })
      .catch(() => {});
  }, []);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animatedPrayerButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: prayerScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handlePrayerPressIn = () => {
    prayerScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  };

  const handlePrayerPressOut = () => {
    prayerScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handleInspirePressIn = () => {
    inspireScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  };

  const handleInspirePressOut = () => {
    inspireScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const animatedInspireButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inspireScale.value }],
  }));

  const handleInspireMe = async () => {
    setIsInspireLoading(true);
    setError(null);
    setVerses([]);
    setSavedStates({});
    setPrayer(null);
    setShowPrayer(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await apiRequest(
        "GET",
        `/api/random-verse?translation=${selectedTranslation}`
      );
      const data = await response.json();
      if (data.verse && data.reference) {
        const verseResult: VerseResult = {
          verse: data.verse,
          reference: data.reference,
          translation: data.translation || selectedTranslation,
        };
        setVerses([verseResult]);
        setEmotion(data.theme || "inspired");
        await checkSavedStates([verseResult]);
        await incrementVersesFound(1);
        showMilestonePromptIfNeeded(1);
      }
    } catch (err) {
      setError("The well is quiet for a moment — please try again.");
      console.error("Error fetching random verse:", err);
    } finally {
      setIsInspireLoading(false);
    }
  };

  const formatDate = () => {
    const date = new Date();
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleEmotionSelect = (selectedEmotion: string) => {
    setEmotion(selectedEmotion);
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

  // Show a one-time streak milestone share prompt when the user hits 7, 30, or 100 days.
  // Fires once per milestone (persisted in AsyncStorage) to avoid repeat prompts.
  const STREAK_MILESTONES = [7, 30, 100];
  const STREAK_MILESTONES_KEY = "@streak_milestones_shown";

  const showStreakMilestoneIfNeeded = async (streakData: StreakData) => {
    const current = streakData.current;
    try {
      const raw = await AsyncStorage.getItem(STREAK_MILESTONES_KEY);
      const shown: number[] = raw ? JSON.parse(raw) : [];
      for (const milestone of STREAK_MILESTONES) {
        if (current >= milestone && !shown.includes(milestone)) {
          shown.push(milestone);
          await AsyncStorage.setItem(STREAK_MILESTONES_KEY, JSON.stringify(shown));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const emoji = milestone >= 100 ? "🏆" : milestone >= 30 ? "🌟" : "🔥";
          const message =
            milestone >= 100
              ? `You've opened Verse for You every day for 100 days. That's extraordinary dedication — your faith journey has been consistent and beautiful.`
              : milestone >= 30
              ? `You've built a month-long daily habit with Scripture. That's the kind of consistency that changes a life.`
              : `You've visited Verse for You 7 days in a row. A full week of meeting Scripture daily — that's worth celebrating.`;
          Alert.alert(
            `${emoji} ${milestone}-Day Streak!`,
            `${message}\n\nWant to share this app with someone who might need a daily dose of Scripture too?`,
            [
              { text: "Maybe Later", style: "cancel" },
              {
                text: "Share the App",
                onPress: () => {
                  Share.share({
                    message: `I've been using Verse for You every day for ${milestone} days — it finds Bible verses for exactly how you're feeling. Check it out:\nhttps://verseforyou.app`,
                    title: "Verse for You",
                  }).catch(() => {});
                },
              },
            ]
          );
          break; // Show only one milestone at a time
        }
      }
    } catch {
      // Non-critical — silently ignore
    }
  };

  // Show a one-time milestone celebration + share prompt when the user
  // crosses a discovery threshold (10, 25, 50, 100, 250, 500 verses).
  const showMilestonePromptIfNeeded = async (justAdded: number) => {
    try {
      const total = await (async () => {
        // We need the updated total — storage was already incremented above.
        const { getTotalVersesFound: getTotal } = await import("@/lib/storage");
        return getTotal();
      })();
      const milestone = await checkNewMilestone(total);
      if (!milestone) return;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        `✨ ${milestone} Verses Discovered!`,
        `You've found ${milestone} verses through Verse for You. Scripture has been meeting you in your moments — that's something worth celebrating.\n\nWant to share the app with someone who might need it today?`,
        [
          { text: "Maybe Later", style: "cancel" },
          {
            text: "Share the App",
            onPress: () => {
              Share.share({
                message: `I've been using Verse for You to find Bible verses for how I'm feeling — it's been really meaningful. Check it out:\nhttps://verseforyou.app`,
                title: "Verse for You",
              }).catch(() => {});
            },
          },
        ]
      );
    } catch {
      // Non-critical — silently ignore
    }
  };

  const handleFindVerses = async () => {
    if (!emotion.trim()) return;

    setIsLoading(true);
    setError(null);
    setVerses([]);
    setSavedStates({});
    setPrayer(null);
    setShowPrayer(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest("POST", "/api/verses", {
        emotion: emotion.trim(),
        translation: selectedTranslation,
        count: 5,
      });
      const data = await response.json();
      setVerses(data.verses || []);
      await checkSavedStates(data.verses || []);
      const newCount = (data.verses?.length || 0);
      await incrementVersesFound(newCount);
      showMilestonePromptIfNeeded(newCount);
      // Track this emotion in recent searches
      await addRecentSearch(emotion.trim());
      const updated = await getRecentSearches();
      setRecentEmotions(updated);
    } catch (err) {
      setError("We couldn't find verses right now. Take a breath and try again.");
      console.error("Error finding verses:", err);
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
      emotion: emotion.trim(),
      savedAt: new Date().toISOString(),
      translation: verseResult.translation,
    });

    setSavedStates(prev => ({ ...prev, [key]: true }));
  };

  const handleShareVerse = async (verseResult: VerseResult) => {
    Haptics.selectionAsync();
    try {
      const emotionLine = emotion.trim()
        ? `✨ Feeling ${emotion.trim()}? This verse found me today.\n\n`
        : "";
      await Share.share({
        message: `${emotionLine}"${verseResult.verse}"\n\n— ${verseResult.reference} (${verseResult.translation})\n\n📖 Verse for You · Find Scripture for how you feel\nhttps://verseforyou.app`,
        title: verseResult.reference,
      });
    } catch (shareError) {
      console.error("Error sharing verse:", shareError);
    }
  };

  const handleCopyVerse = async (verseResult: VerseResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const key = `${verseResult.verse}-${verseResult.reference}`;
    try {
      // Open share sheet with a clean copy-ready format
      await Share.share({
        message: `"${verseResult.verse}" — ${verseResult.reference} (${verseResult.translation})`,
      });
      // Show brief "copied" feedback on the button
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Error copying verse:", err);
    }
  };

  const handleVersePress = (verseResult: VerseResult) => {
    const key = `${verseResult.verse}-${verseResult.reference}`;
    navigation.navigate("VerseDetail", {
      verse: verseResult.verse,
      reference: verseResult.reference,
      emotion: emotion.trim(),
      isSaved: savedStates[key] || false,
      translation: verseResult.translation,
    });
  };

  const handlePrayerToggle = async () => {
    if (showPrayer) {
      setShowPrayer(false);
      return;
    }

    if (prayer) {
      setShowPrayer(true);
      return;
    }

    setIsPrayerLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await apiRequest("POST", "/api/prayer", {
        emotion: emotion.trim(),
      });
      const data = await response.json();
      setPrayer(data.prayer || null);
      setShowPrayer(true);
    } catch (prayerErr) {
      console.error("Error fetching prayer:", prayerErr);
    } finally {
      setIsPrayerLoading(false);
    }
  };

  const handleGoToPlans = () => {
    Haptics.selectionAsync();
    // Navigate to the Plans tab via the parent tab navigator
    const tabNav = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
    if (tabNav) {
      tabNav.navigate("PlansTab");
    }
  };

  const handleSharePrayer = async () => {
    if (!prayer) return;
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: `🙏 A prayer for when you feel ${emotion}:\n\n${prayer}\n\n📖 Verse for You · Find Scripture for how you feel\nhttps://verseforyou.app`,
        title: "A Prayer for You",
      });
    } catch (shareError) {
      console.error("Error sharing prayer:", shareError);
    }
  };

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
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.dateContainer}>
        <ThemedText
          style={[
            styles.dateText,
            { color: theme.textTertiary },
          ]}
        >
          {formatDate()}
        </ThemedText>
      </View>

      <VerseOfTheDay />

      <ThemedText type="h2" style={styles.promptText}>
        How are you feeling?
      </ThemedText>

      <ThemedText style={[styles.explanationText, { color: theme.textTertiary }]}>
        Let Scripture meet you exactly where you are
      </ThemedText>

      <View
        style={[
          styles.inputContainer,
          { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { color: theme.text },
          ]}
          placeholder="anxious, grateful, lost..."
          placeholderTextColor={theme.textTertiary}
          value={emotion}
          onChangeText={setEmotion}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleFindVerses}
          testID="input-emotion"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.suggestionsContainer}
        contentContainerStyle={styles.suggestionsContent}
      >
        {EMOTION_SUGGESTIONS.map((item) => (
          <Pressable
            key={item}
            style={[
              styles.suggestionPill,
              {
                backgroundColor:
                  emotion.toLowerCase() === item
                    ? theme.link
                    : theme.backgroundSecondary,
              },
            ]}
            onPress={() => handleEmotionSelect(item)}
            testID={`pill-${item}`}
          >
            <ThemedText
              style={[
                styles.suggestionText,
                {
                  color:
                    emotion.toLowerCase() === item
                      ? theme.buttonText
                      : theme.textSecondary,
                },
              ]}
            >
              {item}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {recentEmotions.length > 0 && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.recentContainer}>
          <ThemedText style={[styles.recentLabel, { color: theme.textTertiary }]}>
            Recent
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentContent}
          >
            {recentEmotions.slice(0, 5).map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.recentPill,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => handleEmotionSelect(item)}
              >
                <Feather name="clock" size={11} color={theme.textTertiary} />
                <ThemedText style={[styles.recentPillText, { color: theme.textSecondary }]}>
                  {item}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {trendingEmotions.length >= 3 && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.trendingContainer}>
          <View style={styles.trendingHeader}>
            <Feather name="trending-up" size={12} color={theme.textTertiary} />
            <ThemedText style={[styles.trendingLabel, { color: theme.textTertiary }]}>
              Others are searching
            </ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingContent}
          >
            {trendingEmotions.map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.trendingPill,
                  {
                    backgroundColor: emotion.toLowerCase() === item ? theme.link : theme.backgroundTertiary,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => handleEmotionSelect(item)}
              >
                <ThemedText
                  style={[
                    styles.trendingPillText,
                    {
                      color: emotion.toLowerCase() === item ? theme.buttonText : theme.textSecondary,
                    },
                  ]}
                >
                  {item}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      <Pressable
        style={[
          styles.translationSelector,
          { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
        ]}
        onPress={() => setShowTranslationPicker(true)}
        testID="button-translation"
      >
        <View style={styles.translationContent}>
          <Feather name="book-open" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.translationText, { color: theme.textSecondary }]}>
            {selectedTranslation}
          </ThemedText>
        </View>
        <Feather name="chevron-down" size={16} color={theme.textTertiary} />
      </Pressable>

      <View style={styles.buttonRow}>
        <AnimatedPressable
          style={[
            styles.findButton,
            { backgroundColor: theme.link, opacity: emotion.trim() ? 1 : 0.5 },
            animatedButtonStyle,
          ]}
          onPress={handleFindVerses}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!emotion.trim() || isLoading}
          testID="button-find-verse"
        >
          {isLoading ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: theme.buttonText }]}>
              Find My Verses
            </ThemedText>
          )}
        </AnimatedPressable>

        <AnimatedPressable
          style={[
            styles.inspireButton,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent },
            animatedInspireButtonStyle,
          ]}
          onPress={handleInspireMe}
          onPressIn={handleInspirePressIn}
          onPressOut={handleInspirePressOut}
          disabled={isInspireLoading || isLoading}
          testID="button-inspire-me"
        >
          {isInspireLoading ? (
            <ActivityIndicator size="small" color={theme.link} />
          ) : (
            <ThemedText style={[styles.inspireButtonText, { color: theme.link }]}>
              ✦ Inspire Me
            </ThemedText>
          )}
        </AnimatedPressable>
      </View>

      {error ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}
        >
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {error}
          </ThemedText>
        </Animated.View>
      ) : null}

      {verses.length > 0 ? (
        <View style={styles.versesContainer}>
          <ThemedText style={[styles.resultsLabel, { color: theme.textSecondary }]}>
            {verses.length} verses for you — tap to read in full, ♡ to save
          </ThemedText>
          {verses.map((verseResult, index) => {
            const key = `${verseResult.verse}-${verseResult.reference}`;
            return (
              <VerseResultCard
                key={`${verseResult.reference}-${index}`}
                verseResult={verseResult}
                index={index}
                isSaved={savedStates[key] || false}
                isCopied={copiedKey === key}
                onPress={() => handleVersePress(verseResult)}
                onSave={() => handleSaveVerse(verseResult)}
                onCopy={() => handleCopyVerse(verseResult)}
                onShare={() => handleShareVerse(verseResult)}
              />
            );
          })}

          {/* Prayer prompt section */}
          <Animated.View entering={FadeInDown.duration(400).delay(600)}>
            <AnimatedPressable
              style={[
                styles.prayerButton,
                {
                  backgroundColor: showPrayer ? theme.backgroundTertiary : theme.backgroundSecondary,
                  borderColor: theme.accent,
                },
                animatedPrayerButtonStyle,
              ]}
              onPress={handlePrayerToggle}
              onPressIn={handlePrayerPressIn}
              onPressOut={handlePrayerPressOut}
              testID="button-prayer"
            >
              {isPrayerLoading ? (
                <ActivityIndicator size="small" color={theme.link} />
              ) : (
                <View style={styles.prayerButtonContent}>
                  <Feather name="feather" size={16} color={theme.link} />
                  <ThemedText style={[styles.prayerButtonText, { color: theme.link }]}>
                    {showPrayer ? "Hide Prayer" : "Pray About This"}
                  </ThemedText>
                  <Feather
                    name={showPrayer ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={theme.textTertiary}
                  />
                </View>
              )}
            </AnimatedPressable>

            {showPrayer && prayer ? (
              <Animated.View
                entering={FadeInDown.duration(350)}
                style={[
                  styles.prayerCard,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent },
                ]}
              >
                <View style={styles.prayerCardHeader}>
                  <ThemedText style={[styles.prayerLabel, { color: theme.link }]}>
                    A PRAYER FOR YOU
                  </ThemedText>
                  <Pressable
                    style={[styles.sharePrayerButton, { backgroundColor: theme.backgroundDefault }]}
                    onPress={handleSharePrayer}
                    testID="button-share-prayer"
                  >
                    <Feather name="share-2" size={14} color={theme.textTertiary} />
                  </Pressable>
                </View>
                <ThemedText style={[styles.prayerText, { color: theme.text }]}>
                  {prayer}
                </ThemedText>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      ) : null}

      {verses.length === 0 && !isLoading && !error ? (
        <View style={styles.emptyStateContainer}>
          <Feather name="book" size={64} color={theme.textTertiary} style={styles.emptyIcon} />
          <ThemedText
            style={[styles.emptyText, { color: theme.textTertiary }]}
          >
            What's on your heart today?
          </ThemedText>
          <ThemedText
            style={[styles.emptySubtext, { color: theme.textTertiary }]}
          >
            Type a feeling or tap a suggestion — Scripture meets you exactly where you are
          </ThemedText>
        </View>
      ) : null}

      {/* Weekend reading plan nudge */}
      {isWeekend ? (
        <Animated.View entering={FadeInDown.duration(500).delay(verses.length > 0 ? 800 : 400)}>
          <Pressable
            style={[
              styles.weekendBanner,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent },
            ]}
            onPress={handleGoToPlans}
            testID="banner-weekend-plan"
          >
            <View style={styles.weekendBannerContent}>
              <View style={styles.weekendBannerText}>
                <ThemedText style={[styles.weekendBannerTitle, { color: theme.text }]}>
                  Start a 7-Day Reading Plan
                </ThemedText>
                <ThemedText style={[styles.weekendBannerSubtitle, { color: theme.textTertiary }]}>
                  The weekend is a great time to begin — choose a theme and let Scripture guide your week.
                </ThemedText>
              </View>
              <Feather name="calendar" size={20} color={theme.link} />
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <TranslationPickerModal
        visible={showTranslationPicker}
        selectedTranslation={selectedTranslation}
        onSelect={handleTranslationSelect}
        onClose={() => setShowTranslationPicker(false)}
      />
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
  dateContainer: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  dateText: {
    ...Typography.caption,
  },
  promptText: {
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
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.lg,
  },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.xl,
    fontSize: 17,
    textAlign: "center",
  },
  suggestionsContainer: {
    maxHeight: 44,
    marginBottom: Spacing.lg,
  },
  suggestionsContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  suggestionPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  recentContainer: {
    marginBottom: Spacing.md,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  recentContent: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  recentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  recentPillText: {
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
    marginBottom: Spacing["2xl"],
  },
  translationContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  translationText: {
    fontSize: 15,
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  findButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  inspireButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
  },
  inspireButtonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
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
  versesContainer: {
    marginBottom: Spacing.lg,
  },
  resultsLabel: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  prayerButton: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  prayerButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  prayerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  prayerCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  prayerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  prayerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  sharePrayerButton: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  prayerText: {
    fontSize: 16,
    lineHeight: 26,
    fontStyle: "italic",
  },
  emptyStateContainer: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
  },
  emptyIcon: {
    marginBottom: Spacing.xl,
    opacity: 0.4,
  },
  emptyText: {
    fontSize: 16,
    fontStyle: "italic",
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.7,
  },
  trendingContainer: {
    marginBottom: Spacing.md,
  },
  trendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  trendingLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  trendingContent: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  trendingPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  trendingPillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  weekendBanner: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginTop: Spacing["2xl"],
  },
  weekendBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  weekendBannerText: {
    flex: 1,
  },
  weekendBannerTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  weekendBannerSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
});
