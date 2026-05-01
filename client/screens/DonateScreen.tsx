import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const DONATION_AMOUNTS = [5, 10, 25, 50];

export default function DonateScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectAmount = (amount: number) => {
    Haptics.selectionAsync();
    setSelectedAmount(amount);
    setError(null);
  };

  const handleDonate = async () => {
    if (!selectedAmount) {
      setError("Please select an amount");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(new URL("/api/donate", apiUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: selectedAmount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process donation");
      }

      if (data.url) {
        await Linking.openURL(data.url);
      }
    } catch (err) {
      console.error("Donation error:", err);
      setError("Unable to process donation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="heart" size={32} color={theme.link} />
          </View>
          <ThemedText style={styles.title}>Keep the Mission Going</ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Your gift helps keep this app free and supports spreading the gospel through missions worldwide
          </ThemedText>
        </View>

        <View style={styles.amountsSection}>
          <ThemedText
            style={[styles.sectionLabel, { color: theme.textSecondary }]}
          >
            Select Amount
          </ThemedText>
          <View style={styles.amountsGrid}>
            {DONATION_AMOUNTS.map((amount) => (
              <Pressable
                key={amount}
                style={[
                  styles.amountButton,
                  {
                    backgroundColor:
                      selectedAmount === amount
                        ? theme.link
                        : theme.backgroundDefault,
                    borderColor:
                      selectedAmount === amount ? theme.link : theme.border,
                  },
                ]}
                onPress={() => handleSelectAmount(amount)}
              >
                <ThemedText
                  style={[
                    styles.amountText,
                    {
                      color:
                        selectedAmount === amount
                          ? theme.buttonText
                          : theme.text,
                    },
                  ]}
                >
                  ${amount}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {error ? (
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          style={[
            styles.donateButton,
            {
              backgroundColor: selectedAmount ? theme.link : theme.backgroundTertiary,
              opacity: isLoading ? 0.7 : 1,
            },
          ]}
          onPress={handleDonate}
          disabled={isLoading || !selectedAmount}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <>
              <Feather
                name="heart"
                size={20}
                color={selectedAmount ? theme.buttonText : theme.textTertiary}
                style={styles.buttonIcon}
              />
              <ThemedText
                style={[
                  styles.donateButtonText,
                  {
                    color: selectedAmount ? theme.buttonText : theme.textTertiary,
                  },
                ]}
              >
                Donate {selectedAmount ? `$${selectedAmount}` : ""}
              </ThemedText>
            </>
          )}
        </Pressable>

        <ThemedText
          style={[styles.secureText, { color: theme.textTertiary }]}
        >
          Secure payment powered by Stripe
        </ThemedText>

        <View style={styles.impactSection}>
          <ThemedText
            style={[styles.impactTitle, { color: theme.textSecondary }]}
          >
            Your Impact
          </ThemedText>
          <View style={styles.impactItems}>
            <View style={styles.impactItem}>
              <Feather name="globe" size={18} color={theme.link} />
              <ThemedText
                style={[styles.impactText, { color: theme.textSecondary }]}
              >
                Helps keep the app free for everyone
              </ThemedText>
            </View>
            <View style={styles.impactItem}>
              <Feather name="book-open" size={18} color={theme.link} />
              <ThemedText
                style={[styles.impactText, { color: theme.textSecondary }]}
              >
                Supports spreading the gospel worldwide
              </ThemedText>
            </View>
            <View style={styles.impactItem}>
              <Feather name="users" size={18} color={theme.link} />
              <ThemedText
                style={[styles.impactText, { color: theme.textSecondary }]}
              >
                Enables more people to find comfort in scripture
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  amountsSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  amountsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  amountButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  amountText: {
    fontSize: 18,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  donateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
  donateButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  secureText: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  impactSection: {
    marginTop: "auto",
  },
  impactTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  impactItems: {
    gap: Spacing.md,
  },
  impactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  impactText: {
    fontSize: 14,
    flex: 1,
  },
});
