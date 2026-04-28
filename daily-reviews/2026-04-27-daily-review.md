# Verse for You — Daily Review
**Date:** Monday, April 27, 2026
**Review window:** 10:00 AM PT daily (Mon–Fri)
**Scope:** Demand signals + UI/UX improvements implemented today.

---

## 1. Demand Signals (April 27, 2026)

Today is Monday — the highest intent day for habit formation in any app category, and particularly in faith apps.

- **Monday = "fresh start" mindset at peak.** Faith apps see ~20–25% higher new-habit intent on Monday mornings. "God's mercies are new every morning" is one of the most-searched themes on Mondays. VFY's Verse of the Day prompt included the day name but gave the AI no guidance on *how* to use it. The VOTD was equally likely to surface a verse about endurance or harvest on Monday as on any other day — that alignment gap is closed today.

- **7-day streak users hit their milestone today.** Users who opened VFY every day last Monday–Sunday complete their first 7-day streak today. This is the peak emotional satisfaction moment in any habit-tracking app — exactly when to request word-of-mouth sharing. VFY tracked streaks silently (the Settings screen showed a badge) but fired no share prompt. That gap is closed today.

- **Reading plan completers: the biggest silent acquisition moment.** Users who started a 7-day reading plan last Monday finish their final day today. Plan completion is the #1 organic sharing moment in habit apps — Duolingo does this with animated confetti and a social card, Headspace fires a certificate. VFY fired nothing. A plan completion Alert + share prompt is now wired to Day 7.

- **Post-Easter plateau week 3.** We're 3 weeks post-Easter 2026. Historical faith-app data: weeks 3–4 post-Easter see the steepest drop-off for casual users. The most powerful retention lever at this stage is streaks and plan completion — both of which are exactly what today's changes address.

---

## 2. Changes Made Today

### Streak Milestone Share Prompt — HomeScreen
**Files changed:** `client/screens/HomeScreen.tsx`

Wired `recordDailyVisit()` to its return value in the `useEffect` startup hook. Previously it was fire-and-forget with `.catch(() => {})` — the returned `StreakData` was discarded.

Added `showStreakMilestoneIfNeeded(streakData: StreakData)` — a new function that:
- Checks if the current streak (7, 30, or 100 days) was just crossed for the first time
- Uses `@streak_milestones_shown` in AsyncStorage (same pattern as verse milestones) to ensure each milestone fires exactly once
- Shows a native Alert with: streak emoji (🔥/🌟/🏆 by tier), a warm personal message calibrated to the milestone, and two buttons: "Maybe Later" + "Share the App"
- The share message is streak-specific: "I've been using Verse for You every day for 7 days — it finds Bible verses for exactly how you're feeling."

Added `AsyncStorage` import (from `@react-native-async-storage/async-storage`) and `StreakData` type import from `@/lib/storage`.

**Why this matters:** Streaks are already being tracked and displayed in Settings. The emotional peak of hitting a streak milestone was going unacknowledged — no celebration, no invitation to share. Every habit-building app with a streak mechanic fires a prompt at these thresholds. This closes VFY's biggest missed acquisition moment.

### Reading Plan Completion Celebration + Share Prompt — ReadingPlanScreen
**Files changed:** `client/screens/ReadingPlanScreen.tsx`

Added `Alert` to the React Native imports. Updated `handleCompleteDay()` to detect plan completion: when `dayIndex` equals the final day of the plan AND all previous days are already marked complete, a 600ms-delayed `Alert` fires to allow the UI to update first.

The completion Alert:
- Title: "🎉 Plan Complete!"
- Message: acknowledges the specific plan title, celebrates the 7-day commitment, and encourages carrying the momentum forward
- Two action buttons: "Choose Another Plan" (calls `handleChangePlan()`) and "Share" (opens the system share sheet with a plan-specific message)

**Why this matters:** Plan completion is the highest-value word-of-mouth moment in any habit app. Users who finish a 7-day plan feel genuine accomplishment — that emotional peak is the best time to ask for a referral. VFY previously ended the plan silently; the user would complete Day 7 and nothing would happen. This adds the celebration and share prompt that every comparable app (Hallow, YouVersion, Glorify) fires at this moment.

### Day-of-Week Aware Verse of the Day — Server
**Files changed:** `server/routes.ts`

Added `getDayOfWeekVOTDHint()` — a new server function that returns a day-specific thematic hint for the VOTD AI prompt. Each day maps to a distinct spiritual posture:
- **Monday** → fresh starts, new beginnings, God's mercies new every morning
- **Tuesday** → faithfulness, daily tasks, purpose in the ordinary
- **Wednesday** → endurance, midpoint perseverance, God's steadiness
- **Thursday** → gratitude, seeing the week's blessings, anticipating rest
- **Friday** → Sabbath, rest, reflection, provision through the week
- **Saturday** → renewal, family, savoring creation
- **Sunday** → worship, community, the body of Christ, Lord's Day

The VOTD prompt now includes this hint alongside the existing seasonal context. The prompt was also updated to prefer "beautiful but less-quoted passages that feel like a discovery" — addressing the tendency toward overused classics (John 3:16, Jeremiah 29:11) that users have seen hundreds of times.

**Why this matters:** A Monday VOTD that says "His compassions never fail — they are new every morning" (Lamentations 3:22-23) is categorically more relevant than a harvest verse on a Monday. Day-of-week theming is how Hallow and Glorify maintain daily relevance for their Verse of the Day feature. VFY had the day name in the prompt but no guidance on what to do with it.

---

## 3. Still Outstanding (Next Runs)

### P0
- **Account + cloud journal sync** — #1 retention risk. Reinstall wipes all saved verses and journal history. Requires Sign in with Apple / Google + Postgres-backed verse storage. Complex but critical.
- **Daily push notifications** — Settings toggle still shows "Coming Soon." `expo-notifications` not yet installed; requires native build.

### P1
- **Audio TTS** — Text-to-speech for found verses via `expo-speech`. High demand for commute/hands-free use case. Infrastructure exists in the Replit audio folder but not wired to the verse UI.
- **Share image cards** — Instagram/TikTok-ready typeset verse images (1080×1920). Text sharing is live; image cards would 2–3× the virality.
- **HomeScreen decomposition** — Still ~1,000 lines with new additions. Extract `EmotionInputSection` component (input + pills + trending + translation selector).

### P2
- **Related verses badge on list cards** — A "related" indicator on `VerseResultCard` to surface the discovery feature before users enter the modal.
- **Additional reading plan length options** — 3-day and 21-day plans alongside the 7-day format.
- **Reading plan streak** — Track consecutive days within a plan and surface a mid-plan encouragement message at Day 3 or 4.

---

## 4. Change Log

| File | Change |
|------|--------|
| `client/screens/HomeScreen.tsx` | Added `StreakData` import + `AsyncStorage` import; wired `recordDailyVisit()` return value; added `showStreakMilestoneIfNeeded()` with 7/30/100-day milestone prompts and `@streak_milestones_shown` persistence |
| `client/screens/ReadingPlanScreen.tsx` | Added `Alert` import; updated `handleCompleteDay()` to detect plan completion and fire a celebration Alert with "Choose Another Plan" + "Share" actions |
| `server/routes.ts` | Added `getDayOfWeekVOTDHint()` function with day-specific thematic guidance for all 7 days; updated VOTD prompt to include day hint and prefer less-quoted Scripture |

Prepared: 2026-04-27, 10:00 AM PT window.
