# Verse for You — Daily Review
**Date:** Thursday, April 30, 2026
**Review window:** 10:00 AM PT daily (Mon–Fri)
**Scope:** Demand signals + UI/UX improvements implemented today.

---

## 1. Demand Signals (April 30, 2026)

Faith-tech demand signals remain strong as April closes out. Key findings today:

- **Audio-first is the defining faith-app trend of 2026.** Dwell (audio Bible) and Glorify (ambient worship + guided audio content) continue to dominate App Store charts. YouVersion hit 1 billion installs in November 2025 and continues to grow. The clear implication for VFY: a "Listen" button using TTS is a P0 feature for the next milestone release. `expo-speech` (the Expo SDK TTS package) is not yet installed — this should be added in the next native build cycle.
- **Spiritual wellness apps market grows 14.66% CAGR to 2035.** The category is not a niche — it's a sustained growth market. VFY's emotion-first entry point is a genuine differentiator relative to YouVersion's chapter-first model.
- **Gamification continues to drive retention.** FaithTime.ai's "Little Lamb" companion system (an animated character that grows with daily practice) shows that light gamification meaningfully moves DAU/retention for faith apps. VFY's streak + discovery count system is on the right track but could go deeper (e.g., a growth metaphor — a candle, a seedling, a flame — that visually reflects the user's streak).
- **Polish and attention to detail matter.** User reviews in the App Store category consistently cite "feels thoughtful" and "notices details" as reasons for 5-star ratings in faith apps. Small bugs (broken labels, inconsistent fonts, generic error messages) disproportionately hurt perception in this audience.

---

## 2. Changes Made Today

### SearchScreen — Pastoral Error Message
**File changed:** `client/screens/SearchScreen.tsx`

Updated the generic error string:
- "Unable to search. Please try again." → "Scripture seems quiet right now — take a breath and try again."

**Why this matters:** The Apr 20 pass added pastoral error messages to HomeScreen but SearchScreen was overlooked. Consistent tone across all error states is important — a user hitting an error in the concordance view should feel the same warmth as they would on the home screen.

### SearchScreen — Serif Typography on Verse Results
**File changed:** `client/screens/SearchScreen.tsx`

Applied `Typography.verseBodySmall` spread to the `verseText` style in the inline verse card renderer. The SearchScreen renders its own card (not the shared `VerseResultCard` component), so it was using a plain `fontSize: 16` sans-serif — inconsistent with every other verse display surface in the app.

**Why this matters:** The Apr 20 typography upgrade touched HomeScreen, VerseDetailModal, VerseOfTheDay, and JournalScreen. SearchScreen's concordance results were the last surface still showing verse text in sans-serif. This closes the gap.

### SearchScreen — Card Shadows in Light Mode
**File changed:** `client/screens/SearchScreen.tsx`

Added `isDark` from `useTheme()` and applied soft shadow props to the inline verse card in light mode (`shadowOpacity: 0.05`, `shadowRadius: 10`, `elevation: 2`). Dark mode keeps flat rendering.

**Why this matters:** SearchScreen concordance cards were still using flat 1px borders — the pre-Apr-20 aesthetic. This brings them in line with the shadow-elevated card standard used across the rest of the app.

### VerseDetailModal — Clean Emotion Display Labels
**File changed:** `client/screens/VerseDetailModal.tsx`

Added an `emotionDisplayLabel` computed value that transforms internal emotion strings into clean, human-readable badge text:
- `"Search: anxiety"` → `Found for: "anxiety"` (instead of "Feeling Search: anxiety")
- `"Reading Plan: Faith"` → `From "Faith" plan` (instead of "Feeling Reading Plan: Faith")
- `"daily verse"` → `Daily Verse`
- `"inspired"` → `Feeling Inspired`
- All other emotions: `Feeling [emotion]` (unchanged)

**Why this matters:** The `VerseDetailModal` is navigated to from four different entry points (Home, Journal, Search, Reading Plans). The emotion string passed through navigation was designed as an internal data tag — not a display string — but it was being rendered verbatim. "Feeling Search: anxiety" is confusing and breaks the spiritual tone of the screen. This fix makes the badge feel contextual and intentional regardless of how the user arrived.

### ReadingPlanScreen — Serif Typography for Day Verse Text
**File changed:** `client/screens/ReadingPlanScreen.tsx`

Added `Typography` import and applied `Typography.verseBodySmall` to the `dayVerse` style in the plan day expanded view.

**Why this matters:** The reading plan day cards show the assigned verse when a day is expanded. This was the last remaining verse display surface using plain `fontSize: 16` sans-serif. Applying the serif ensures every verse the user reads — whether from emotion search, the daily verse, the concordance, or a reading plan — appears in the devotional serif typeface established in the Apr 20 typography upgrade.

### SettingsScreen — Terms of Service Link + Version Bump
**File changed:** `client/screens/SettingsScreen.tsx`

- Added a "Terms of Service" row (icon: `file-text`) to the About section, linking to `https://verseforyou.app/terms`. The design guidelines specified this row as required but it was missing from the implementation.
- Bumped version display from `1.5.0` → `1.6.0` to reflect the ongoing daily improvement cycle.

**Why this matters:** Missing Terms of Service is a minor trust and App Store compliance issue. Users (and Apple/Google reviewers) expect a ToS link in the About section of any app handling user data or donations.

---

## 3. Still Outstanding (Next Runs)

### P0
- **"Listen" TTS button** — Audio is the #1 2026 faith-app trend. `expo-speech` needs to be added to `package.json` and a Listen button implemented in `VerseDetailModal` (and optionally `VerseOfTheDay`). This is the single highest-ROI feature not yet implemented.
- **Account + cloud journal sync** — Still the #1 retention risk. Every reinstall wipes the user's spiritual history. Requires auth (Sign in with Apple / Google) + Postgres-backed verse storage.
- **Daily push notifications** — Settings toggle shows switch but fires "Coming Soon." `expo-notifications` not installed; requires native build.

### P1
- **Share cards** (Instagram/TikTok-ready) — Generate a typeset 1080×1920 image with verse + reference. Requires `react-native-view-shot`. Free acquisition channel.
- **Streak gamification depth** — A visual "growth" metaphor (candle, seedling, flame) that responds to streak count would meaningfully increase DAU. Currently the streak is a number; it could be an experience.
- **Bible reference hallucination guard** — The server already has a canonical book/chapter index. Add a client-side validation layer that shows a warning badge when a reference can't be verified.

### P2
- **HomeScreen.tsx decomposition** — Still 1,000+ lines. Extract `useVerseQuery`, `useEmotionInput` hooks + `EmotionPillRow`, `VerseResultCard`, `EmptyState` components. (Note: `VerseResultCard` was already extracted as a component — HomeScreen hook extraction remains.)
- **Trending emotions real data** — The `/api/trending-emotions` endpoint exists; ensure emotion searches are being logged server-side to populate real trending data over time.

---

## 4. Change Log

| File | Change |
|------|--------|
| `client/screens/SearchScreen.tsx` | Pastoral error message; serif font (`Typography.verseBodySmall`) on verse results; card shadows in light mode |
| `client/screens/VerseDetailModal.tsx` | `emotionDisplayLabel` helper cleans up internal emotion tags for display |
| `client/screens/ReadingPlanScreen.tsx` | Added `Typography` import; applied serif to `dayVerse` style |
| `client/screens/SettingsScreen.tsx` | Added Terms of Service row; bumped version to 1.6.0 |
| `daily-reviews/2026-04-30-daily-review.md` | This review |

Prepared: 2026-04-30, 10:00 AM PT window.
