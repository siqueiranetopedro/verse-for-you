import React from "react";
import { View, Modal, Pressable, StyleSheet, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { TRANSLATIONS } from "@/constants/bible";

interface TranslationPickerModalProps {
  visible: boolean;
  selectedTranslation: string;
  onSelect: (translation: string) => void;
  onClose: () => void;
}

export default function TranslationPickerModal({
  visible,
  selectedTranslation,
  onSelect,
  onClose,
}: TranslationPickerModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
            Select Translation
          </ThemedText>
          <ScrollView
            style={styles.scrollList}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {Object.entries(TRANSLATIONS).map(([code, name]) => (
              <Pressable
                key={code}
                style={[
                  styles.translationOption,
                  {
                    backgroundColor:
                      selectedTranslation === code
                        ? theme.backgroundSecondary
                        : "transparent",
                  },
                ]}
                onPress={() => onSelect(code)}
                testID={`translation-option-${code}`}
              >
                <View>
                  <ThemedText
                    style={[
                      styles.translationCode,
                      {
                        color:
                          selectedTranslation === code ? theme.link : theme.text,
                      },
                    ]}
                  >
                    {code}
                  </ThemedText>
                  <ThemedText
                    style={[styles.translationName, { color: theme.textSecondary }]}
                  >
                    {name}
                  </ThemedText>
                </View>
                {selectedTranslation === code ? (
                  <Feather name="check" size={20} color={theme.link} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "80%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  scrollList: {
    flexGrow: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  translationOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  translationCode: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  translationName: {
    fontSize: 13,
  },
});
