import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

export interface VerseResult {
  verse: string;
  reference: string;
  translation: string;
}

interface VerseResultCardProps {
  verseResult: VerseResult;
  index: number;
  isSaved: boolean;
  isCopied: boolean;
  onPress: () => void;
  onSave: () => void;
  onCopy: () => void;
  onShare: () => void;
  testIdPrefix?: string;
}

export default function VerseResultCard({
  verseResult,
  index,
  isSaved,
  isCopied,
  onPress,
  onSave,
  onCopy,
  onShare,
  testIdPrefix = "card",
}: VerseResultCardProps) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      key={`${verseResult.reference}-${index}`}
      entering={FadeInDown.duration(400).delay(index * 100)}
    >
      <Pressable
        style={[
          styles.verseCard,
          {
            backgroundColor: theme.backgroundSecondary,
            borderLeftColor: isSaved ? theme.success : theme.accent,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.06,
            shadowRadius: isDark ? 0 : 10,
            elevation: isDark ? 0 : 2,
          },
        ]}
        onPress={onPress}
        testID={`${testIdPrefix}-verse-${index}`}
      >
        {/* Action buttons row */}
        <View style={styles.verseCardActions}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
            onPress={onSave}
            testID={`button-save-verse-${index}`}
          >
            <Feather
              name="heart"
              size={18}
              color={isSaved ? theme.error : theme.textTertiary}
              style={{ opacity: isSaved ? 1 : 0.6 }}
            />
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              {
                backgroundColor: isCopied
                  ? theme.success + "20"
                  : theme.backgroundDefault,
              },
            ]}
            onPress={onCopy}
            testID={`button-copy-verse-${index}`}
          >
            <Feather
              name={isCopied ? "check" : "copy"}
              size={18}
              color={isCopied ? theme.success : theme.textTertiary}
              style={{ opacity: isCopied ? 1 : 0.7 }}
            />
          </Pressable>

          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
            onPress={onShare}
            testID={`button-share-verse-${index}`}
          >
            <Feather
              name="share-2"
              size={18}
              color={theme.textTertiary}
              style={{ opacity: 0.7 }}
            />
          </Pressable>
        </View>

        <ThemedText style={[styles.verseText, { color: theme.text }]}>
          "{verseResult.verse}"
        </ThemedText>

        <ThemedText style={[styles.referenceText, { color: theme.link }]}>
          {verseResult.reference}
        </ThemedText>

        <ThemedText style={[styles.translationLabel, { color: theme.textTertiary }]}>
          {verseResult.translation}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  verseCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    marginBottom: Spacing.md,
  },
  verseCardActions: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    gap: Spacing.sm,
    zIndex: 10,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  verseText: {
    ...Typography.verseBody,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
    marginRight: 112, // room for 3 action buttons (3 × 36px + gaps)
    fontStyle: "italic",
  },
  referenceText: {
    fontSize: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  translationLabel: {
    fontSize: 13,
    marginTop: Spacing.sm,
    fontWeight: "500",
  },
});
