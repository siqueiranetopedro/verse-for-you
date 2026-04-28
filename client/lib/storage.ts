import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SavedVerse {
  id: string;
  verse: string;
  reference: string;
  emotion: string;
  savedAt: string;
  translation?: string;
  /** Optional personal reflection note the user adds when saving */
  notes?: string;
}

const SAVED_VERSES_KEY = "@daily_verse_saved";
const TRANSLATION_KEY = "@selected_translation";
const THEME_KEY = "@theme_preference";
const STREAK_KEY = "@reading_streak";
const LAST_VISIT_KEY = "@last_visit_date";
const RECENT_SEARCHES_KEY = "@recent_searches";
const TOTAL_VERSES_FOUND_KEY = "@total_verses_found";
const ACTIVE_READING_PLAN_KEY = "@active_reading_plan";

export type ThemePreference = "light" | "dark" | "system";

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const value = await AsyncStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
    return "system";
  } catch {
    return "system";
  }
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, preference);
  } catch (error) {
    console.error("Error setting theme preference:", error);
  }
}

export async function getSelectedTranslation(): Promise<string> {
  try {
    const translation = await AsyncStorage.getItem(TRANSLATION_KEY);
    return translation || "NIV";
  } catch (error) {
    console.error("Error getting translation:", error);
    return "NIV";
  }
}

export async function setSelectedTranslation(translation: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TRANSLATION_KEY, translation);
  } catch (error) {
    console.error("Error setting translation:", error);
  }
}

export async function getSavedVerses(): Promise<SavedVerse[]> {
  try {
    const data = await AsyncStorage.getItem(SAVED_VERSES_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error("Error loading saved verses:", error);
    return [];
  }
}

export async function saveVerse(verse: SavedVerse): Promise<void> {
  try {
    const existing = await getSavedVerses();
    const alreadyExists = existing.some(
      (v) => v.verse === verse.verse && v.reference === verse.reference
    );
    if (!alreadyExists) {
      const updated = [verse, ...existing];
      await AsyncStorage.setItem(SAVED_VERSES_KEY, JSON.stringify(updated));
    }
  } catch (error) {
    console.error("Error saving verse:", error);
  }
}

export async function removeVerse(id: string): Promise<void> {
  try {
    const existing = await getSavedVerses();
    const updated = existing.filter((v) => v.id !== id);
    await AsyncStorage.setItem(SAVED_VERSES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error removing verse:", error);
  }
}

export async function isVerseSaved(
  verse: string,
  reference: string
): Promise<boolean> {
  try {
    const existing = await getSavedVerses();
    return existing.some(
      (v) => v.verse === verse && v.reference === reference
    );
  } catch (error) {
    console.error("Error checking if verse is saved:", error);
    return false;
  }
}

// --- Streak Tracking ---

export interface StreakData {
  current: number;
  longest: number;
  lastVisit: string | null;
}

export async function getStreakData(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
    return { current: 0, longest: 0, lastVisit: null };
  } catch {
    return { current: 0, longest: 0, lastVisit: null };
  }
}

export async function recordDailyVisit(): Promise<StreakData> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const streak = await getStreakData();

    if (streak.lastVisit === today) {
      // Already recorded today — return as-is
      return streak;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newCurrent: number;
    if (streak.lastVisit === yesterdayStr) {
      // Consecutive day
      newCurrent = streak.current + 1;
    } else {
      // Streak broken or first visit
      newCurrent = 1;
    }

    const newLongest = Math.max(newCurrent, streak.longest);
    const updated: StreakData = {
      current: newCurrent,
      longest: newLongest,
      lastVisit: today,
    };

    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error("Error recording daily visit:", error);
    return { current: 0, longest: 0, lastVisit: null };
  }
}

// --- Recent Searches ---

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(keyword: string): Promise<void> {
  try {
    const existing = await getRecentSearches();
    const filtered = existing.filter(
      (k) => k.toLowerCase() !== keyword.toLowerCase()
    );
    const updated = [keyword, ...filtered].slice(0, 8);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error saving recent search:", error);
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (error) {
    console.error("Error clearing recent searches:", error);
  }
}

// --- Total Verses Found Counter ---

export async function incrementVersesFound(count: number = 1): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TOTAL_VERSES_FOUND_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    await AsyncStorage.setItem(
      TOTAL_VERSES_FOUND_KEY,
      String(current + count)
    );
  } catch {
    // Non-critical, ignore
  }
}

export async function getTotalVersesFound(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TOTAL_VERSES_FOUND_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

const MILESTONE_KEY = "@milestones_shown";
const VERSE_MILESTONES = [10, 25, 50, 100, 250, 500];

/**
 * After incrementing verses found, call this to check whether the new total
 * just crossed a milestone for the first time.
 * Returns the milestone number if hit (and not yet shown), otherwise null.
 */
export async function checkNewMilestone(newTotal: number): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(MILESTONE_KEY);
    const shown: number[] = raw ? JSON.parse(raw) : [];
    for (const milestone of VERSE_MILESTONES) {
      if (newTotal >= milestone && !shown.includes(milestone)) {
        shown.push(milestone);
        await AsyncStorage.setItem(MILESTONE_KEY, JSON.stringify(shown));
        return milestone;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// --- Personal Notes on Saved Verses ---

export async function updateVerseNotes(id: string, notes: string): Promise<void> {
  try {
    const existing = await getSavedVerses();
    const updated = existing.map((v) =>
      v.id === id ? { ...v, notes: notes.trim() } : v
    );
    await AsyncStorage.setItem(SAVED_VERSES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error updating verse notes:", error);
  }
}

// --- Reading Plan Progress ---

export interface ReadingPlanProgress {
  themeId: string;
  themeLabel: string;
  startedAt: string;
  completedDays: number[];
}

export async function getActiveReadingPlan(): Promise<ReadingPlanProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_READING_PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function startReadingPlan(themeId: string, themeLabel: string): Promise<void> {
  try {
    const plan: ReadingPlanProgress = {
      themeId,
      themeLabel,
      startedAt: new Date().toISOString(),
      completedDays: [],
    };
    await AsyncStorage.setItem(ACTIVE_READING_PLAN_KEY, JSON.stringify(plan));
  } catch (error) {
    console.error("Error starting reading plan:", error);
  }
}

export async function markReadingPlanDayComplete(dayIndex: number): Promise<void> {
  try {
    const plan = await getActiveReadingPlan();
    if (!plan) return;
    if (!plan.completedDays.includes(dayIndex)) {
      plan.completedDays.push(dayIndex);
      await AsyncStorage.setItem(ACTIVE_READING_PLAN_KEY, JSON.stringify(plan));
    }
  } catch (error) {
    console.error("Error marking reading plan day complete:", error);
  }
}

export async function clearReadingPlan(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_READING_PLAN_KEY);
  } catch (error) {
    console.error("Error clearing reading plan:", error);
  }
}
