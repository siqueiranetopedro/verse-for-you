import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { saveVerse, isVerseSaved, updateVerseNotes, getSavedVerses } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type VerseDetailRouteProp = RouteProp<RootStackParamList, "VerseDetail">;

interface RelatedVerse {
  verse: string;
  reference: string;
  translation: string;
  connection: string;
}

export default function VerseDetailModal() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const route = useRoute<VerseDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { verse, reference, emotion, isSaved: initialSaved, translation } = route.params;
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [reflection, setReflection] = useState<string | null>(null);
  const [isReflectionLoading, setIsReflectionLoading] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [personalNote, setPersonalNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [savedVerseId, setSavedVerseId] = useState<string | null>(null);
  // Ask About This Verse state
  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [isAskLoading, setIsAskLoading] = useState(false);
  const [showAskPanel, setShowAskPanel] = useState(false);
  // Related Verses state
  const [relatedVerses, setRelatedVerses] = useState<RelatedVerse[]>([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);

  useEffect(() => {
    checkIfSaved();
    // Auto-load reflection on open for an enriched experience
    loadReflection();
    // Load related verses in background (non-blocking)
    loadRelatedVerses();
  }, []);

  const loadReflection = async () => {
    setIsReflectionLoading(true);
    try {
      const response = await apiRequest("POST", "/api/reflection", {
        verse,
        reference,
        emotion,
      });
      const data = await response.json();
      setReflection(data.reflection || null);
      setShowReflection(true);
    } catch (err) {
      // Non-critical — reflection is optional enhancement
      console.error("Error auto-loading reflection:", err);
    } finally {
      setIsReflectionLoading(false);
    }
  };

  const loadRelatedVerses = async () => {
    setIsRelatedLoading(true);
    try {
      const response = await apiRequest("POST", "/api/related-verses", {
        verse,
        reference,
        translation: translation || "NIV",
      });
      const data = await response.json();
      if (Array.isArray(data.verses) && data.verses.length > 0) {
        setRelatedVerses(data.verses);
      }
    } catch (err) {
      // Non-critical — silently ignore
      console.error("Error loading related verses:", err);
    } finally {
      setIsRelatedLoading(false);
    }
  };

  const handleRelatedVersePress = (related: RelatedVerse) => {
    Haptics.selectionAsync();
    navigation.push("VerseDetail", {
      verse: related.verse,
      reference: related.reference,
      emotion: emotion,
      isSaved: false,
      translation: related.translation,
    });
  };

  const checkIfSaved = async () => {
    const saved = await isVerseSaved(verse, reference);
    setIsSaved(saved);
    if (saved) {
      // Load existing note if any
      const allVerses = await getSavedVerses();
      const match = allVerses.find((v) => v.verse === verse && v.reference === reference);
      if (match) {
        setSavedVerseId(match.id);
        if (match.notes) setPersonalNote(match.notes);
      }
    }
  };

  const handleShare = async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: `"${verse}"\n\n— ${reference}${translation ? ` (${translation})` : ""}\n\n📖 Verse for You · Find Scripture for how you feel\nhttps://verseforyou.app`,
        title: reference,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (!isSaved) {
      const id = Date.now().toString();
      await saveVerse({
        id,
        verse,
        reference,
        emotion,
        savedAt: new Date().toISOString(),
        notes: personalNote.trim() || undefined,
      });
      setSavedVerseId(id);
      setIsSaved(true);
      setShowNoteInput(true);
    }
  };

  const handleSaveNote = async () => {
    if (!savedVerseId) return;
    Haptics.selectionAsync();
    await updateVerseNotes(savedVerseId, personalNote);
    setShowNoteInput(false);
  };

  const handleToggleNote = () => {
    Haptics.selectionAsync();
    setShowNoteInput((v) => !v);
  };

  const handleReadChapter = async () => {
    Haptics.selectionAsync();
    const searchQuery = encodeURIComponent(reference);
    // Use the verse's actual translation, fall back to NIV
    const version = translation || "NIV";
    const url = `https://www.biblegateway.com/passage/?search=${searchQuery}&version=${version}`;
    await WebBrowser.openBrowserAsync(url);
  };

  const handleAskVerse = async (question: string) => {
    const q = question.trim();
    if (!q) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAskQuestion(q);
    setAskAnswer(null);
    setIsAskLoading(true);
    setShowAskPanel(true);
    try {
      const response = await apiRequest("POST", "/api/ask-verse", {
        verse,
        reference,
        question: q,
      });
      const data = await response.json();
      setAskAnswer(data.answer || null);
    } catch (err) {
      console.error("Error asking about verse:", err);
      setAskAnswer("The well is quiet for a moment — please try again.");
    } finally {
      setIsAskLoading(false);
    }
  };

  const handleAskPanelToggle = () => {
    Haptics.selectionAsync();
    setShowAskPanel((v) => !v);
  };

  const handleReflectionToggle = () => {
    Haptics.selectionAsync();
    setShowReflection((v) => !v);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing["2xl"],
          paddingBottom: insets.bottom + Spacing["3xl"],
        },
      ]}
    >
      <Animated.View entering={FadeIn.duration(400)}>
        <View style={styles.emotionContainer}>
          <View
            style={[
              styles.emotionBadge,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              style={[styles.emotionText, { color: theme.textSecondary }]}
            >
              Feeling {emotion}
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.verseContainer,
            {
              backgroundColor: theme.backgroundSecondary,
              borderLeftColor: theme.accent,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0 : 0.06,
              shadowRadius: isDark ? 0 : 10,
              elevation: isDark ? 0 : 2,
            },
          ]}
        >
          <ThemedText style={[styles.verseText, { color: theme.text }]}>
            "{verse}"
          </ThemedText>
        </View>

        <ThemedText
          style={[styles.referenceText, { color: theme.link }]}
        >
          {reference}
        </ThemedText>

        <View style={styles.actionsContainer}>
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
            onPress={handleSave}
            testID="button-save"
          >
            <Feather
              name="heart"
              size={20}
              color={isSaved ? theme.error : theme.link}
              style={{ marginRight: Spacing.sm }}
            />
            <ThemedText style={[styles.actionText, { color: theme.text }]}>
              {isSaved ? "Saved" : "Save"}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
            onPress={handleShare}
            testID="button-share"
          >
            <Feather
              name="share-2"
              size={20}
              color={theme.link}
              style={{ marginRight: Spacing.sm }}
            />
            <ThemedText style={[styles.actionText, { color: theme.text }]}>
              Share
            </ThemedText>
          </Pressable>
        </View>

        {/* Personal Notes */}
        {isSaved ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable
              style={[
                styles.noteToggleButton,
                {
                  backgroundColor: showNoteInput
                    ? theme.backgroundTertiary
                    : theme.backgroundSecondary,
                  borderColor: theme.accent,
                },
              ]}
              onPress={handleToggleNote}
              testID="button-toggle-note"
            >
              <View style={styles.noteButtonContent}>
                <Feather name="edit-3" size={16} color={theme.link} />
                <ThemedText style={[styles.noteButtonText, { color: theme.link }]}>
                  {personalNote ? "Edit My Note" : "Add Personal Note"}
                </ThemedText>
                <Feather
                  name={showNoteInput ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.textTertiary}
                />
              </View>
            </Pressable>

            {showNoteInput ? (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={[
                  styles.noteCard,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent },
                ]}
              >
                <ThemedText style={[styles.noteLabel, { color: theme.link }]}>
                  MY REFLECTION
                </ThemedText>
                <TextInput
                  style={[
                    styles.noteInput,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Write your thoughts about this verse…"
                  placeholderTextColor={theme.textTertiary}
                  value={personalNote}
                  onChangeText={setPersonalNote}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  testID="input-personal-note"
                />
                <Pressable
                  style={[styles.saveNoteButton, { backgroundColor: theme.link }]}
                  onPress={handleSaveNote}
                  testID="button-save-note"
                >
                  <ThemedText style={[styles.saveNoteText, { color: theme.buttonText }]}>
                    Save Note
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ) : personalNote ? (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={[
                  styles.noteDisplay,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent },
                ]}
              >
                <ThemedText style={[styles.noteLabel, { color: theme.link }]}>
                  MY REFLECTION
                </ThemedText>
                <ThemedText style={[styles.noteDisplayText, { color: theme.text }]}>
                  {personalNote}
                </ThemedText>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Reflection toggle */}
        <Pressable
          style={[
            styles.reflectionButton,
            {
              backgroundColor: showReflection
                ? theme.backgroundTertiary
                : theme.backgroundSecondary,
              borderColor: theme.accent,
            },
          ]}
          onPress={handleReflectionToggle}
          testID="button-reflection"
        >
          {isReflectionLoading ? (
            <ActivityIndicator size="small" color={theme.link} />
          ) : (
            <View style={styles.reflectionButtonContent}>
              <Feather name="compass" size={16} color={theme.link} />
              <ThemedText style={[styles.reflectionButtonText, { color: theme.link }]}>
                {showReflection ? "Hide Reflection" : "Devotional Reflection"}
              </ThemedText>
              <Feather
                name={showReflection ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.textTertiary}
              />
            </View>
          )}
        </Pressable>

        {showReflection && reflection ? (
          <Animated.View
            entering={FadeInDown.duration(350)}
            style={[
              styles.reflectionCard,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent },
            ]}
          >
            <ThemedText style={[styles.reflectionLabel, { color: theme.link }]}>
              REFLECTION
            </ThemedText>
            <ThemedText style={[styles.reflectionText, { color: theme.text }]}>
              {reflection}
            </ThemedText>
          </Animated.View>
        ) : null}

        {/* Ask About This Verse */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Pressable
            style={[
              styles.askToggleButton,
              {
                backgroundColor: showAskPanel
                  ? theme.backgroundTertiary
                  : theme.backgroundSecondary,
                borderColor: theme.accent,
              },
            ]}
            onPress={handleAskPanelToggle}
            testID="button-ask-toggle"
          >
            <View style={styles.askButtonContent}>
              <Feather name="message-circle" size={16} color={theme.link} />
              <ThemedText style={[styles.askButtonText, { color: theme.link }]}>
                Ask About This Verse
              </ThemedText>
              <Feather
                name={showAskPanel ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.textTertiary}
              />
            </View>
          </Pressable>

          {showAskPanel ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[
                styles.askPanel,
                { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent },
              ]}
            >
              <ThemedText style={[styles.askPanelLabel, { color: theme.link }]}>
                QUICK QUESTIONS
              </ThemedText>
              <View style={styles.presetQuestionsRow}>
                {[
                  "Why this verse for me?",
                  "How do I apply this today?",
                  "What's the context?",
                ].map((q) => (
                  <Pressable
                    key={q}
                    style={[
                      styles.presetQuestion,
                      {
                        backgroundColor:
                          askQuestion === q && askAnswer
                            ? theme.link
                            : theme.backgroundDefault,
                        borderColor: askQuestion === q && askAnswer ? theme.link : theme.border,
                      },
                    ]}
                    onPress={() => handleAskVerse(q)}
                  >
                    <ThemedText
                      style={[
                        styles.presetQuestionText,
                        {
                          color:
                            askQuestion === q && askAnswer
                              ? theme.buttonText
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      {q}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View
                style={[
                  styles.askInputRow,
                  { borderColor: theme.border, backgroundColor: theme.backgroundDefault },
                ]}
              >
                <TextInput
                  style={[styles.askInput, { color: theme.text }]}
                  placeholder="Ask your own question…"
                  placeholderTextColor={theme.textTertiary}
                  value={askQuestion}
                  onChangeText={setAskQuestion}
                  returnKeyType="send"
                  onSubmitEditing={() => handleAskVerse(askQuestion)}
                  autoCapitalize="none"
                />
                <Pressable
                  style={[
                    styles.askSendButton,
                    { backgroundColor: theme.link, opacity: askQuestion.trim() ? 1 : 0.4 },
                  ]}
                  onPress={() => handleAskVerse(askQuestion)}
                  disabled={!askQuestion.trim() || isAskLoading}
                >
                  {isAskLoading ? (
                    <ActivityIndicator size="small" color={theme.buttonText} />
                  ) : (
                    <Feather name="arrow-up" size={16} color={theme.buttonText} />
                  )}
                </Pressable>
              </View>

              {askAnswer ? (
                <Animated.View
                  entering={FadeInDown.duration(300)}
                  style={[styles.askAnswerCard, { borderTopColor: theme.border }]}
                >
                  <ThemedText style={[styles.askAnswerQuestion, { color: theme.textTertiary }]}>
                    {askQuestion}
                  </ThemedText>
                  <ThemedText style={[styles.askAnswerText, { color: theme.text }]}>
                    {askAnswer}
                  </ThemedText>
                </Animated.View>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>

        <Pressable
          style={[
            styles.readChapterButton,
            { backgroundColor: theme.link },
          ]}
          onPress={handleReadChapter}
          testID="button-read-chapter"
        >
          <Feather
            name="book-open"
            size={20}
            color={theme.buttonText}
            style={{ marginRight: Spacing.sm }}
          />
          <ThemedText
            style={[styles.readChapterText, { color: theme.buttonText }]}
          >
            Read Full Chapter
          </ThemedText>
        </Pressable>

        {/* Related Verses */}
        {(isRelatedLoading || relatedVerses.length > 0) ? (
          <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.relatedSection}>
            <View style={styles.relatedHeader}>
              <Feather name="git-branch" size={14} color={theme.textTertiary} />
              <ThemedText style={[styles.relatedLabel, { color: theme.textTertiary }]}>
                YOU MIGHT ALSO REFLECT ON
              </ThemedText>
            </View>

            {isRelatedLoading ? (
              <View style={[styles.relatedLoading, { backgroundColor: theme.backgroundSecondary }]}>
                <ActivityIndicator size="small" color={theme.link} />
                <ThemedText style={[styles.relatedLoadingText, { color: theme.textTertiary }]}>
                  Finding related Scripture…
                </ThemedText>
              </View>
            ) : (
              relatedVerses.map((related, idx) => (
                <Animated.View
                  key={`${related.reference}-${idx}`}
                  entering={FadeInDown.duration(350).delay(idx * 100)}
                >
                  <Pressable
                    style={[
                      styles.relatedCard,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        borderLeftColor: theme.accent,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isDark ? 0 : 0.04,
                        shadowRadius: isDark ? 0 : 8,
                        elevation: isDark ? 0 : 1,
                      },
                    ]}
                    onPress={() => handleRelatedVersePress(related)}
                    testID={`button-related-verse-${idx}`}
                  >
                    {related.connection ? (
                      <ThemedText style={[styles.relatedConnection, { color: theme.textTertiary }]}>
                        {related.connection}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={[styles.relatedVerseText, { color: theme.text }]} numberOfLines={3}>
                      "{related.verse}"
                    </ThemedText>
                    <View style={styles.relatedCardFooter}>
                      <ThemedText style={[styles.relatedReference, { color: theme.link }]}>
                        {related.reference}
                      </ThemedText>
                      <Feather name="chevron-right" size={14} color={theme.textTertiary} />
                    </View>
                  </Pressable>
                </Animated.View>
              ))
            )}
          </Animated.View>
        ) : null}
      </Animated.View>
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
  emotionContainer: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  emotionBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  emotionText: {
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  verseContainer: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    marginBottom: Spacing["2xl"],
  },
  verseText: {
    ...Typography.verseBody,
    fontStyle: "italic",
    textAlign: "center",
  },
  referenceText: {
    fontSize: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  actionsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  readChapterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  readChapterText: {
    fontSize: 16,
    fontWeight: "600",
  },
  reflectionButton: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  reflectionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  reflectionButtonText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  reflectionCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  reflectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  reflectionText: {
    fontSize: 16,
    lineHeight: 26,
  },
  noteToggleButton: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  noteButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  noteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  noteCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  noteInput: {
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    minHeight: 100,
    marginBottom: Spacing.lg,
  },
  saveNoteButton: {
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveNoteText: {
    fontSize: 15,
    fontWeight: "600",
  },
  noteDisplay: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  noteDisplayText: {
    fontSize: 16,
    lineHeight: 26,
    fontStyle: "italic",
  },
  // Ask About This Verse styles
  askToggleButton: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  askButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  askButtonText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  askPanel: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  askPanelLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  presetQuestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  presetQuestion: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  presetQuestionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  askInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    overflow: "hidden",
  },
  askInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
  },
  askSendButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  askAnswerCard: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  askAnswerQuestion: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: Spacing.sm,
    fontStyle: "italic",
  },
  askAnswerText: {
    fontSize: 16,
    lineHeight: 26,
  },
  // Related Verses styles
  relatedSection: {
    marginTop: Spacing["2xl"],
  },
  relatedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  relatedLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  relatedLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  relatedLoadingText: {
    fontSize: 14,
  },
  relatedCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    marginBottom: Spacing.md,
  },
  relatedConnection: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  relatedVerseText: {
    fontSize: 15,
    lineHeight: 23,
    fontStyle: "italic",
    marginBottom: Spacing.sm,
  },
  relatedCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  relatedReference: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
