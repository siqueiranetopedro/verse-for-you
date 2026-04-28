# Verse for You — Daily Review
**Date:** Tuesday, April 21, 2026
**Review window:** 10:00 AM PT daily (Mon–Fri)
**Scope:** Demand signals + UI/UX improvements implemented today.

---

## 1. Demand Signals (April 21, 2026)

The faith-tech + mental wellness category continues to show strong tailwinds heading into late April. Key signals today:

- **"Ask AI about [Bible verse]" is one of the fastest-growing search clusters** in the faith-app category for 2026. Apps like YouVersion and Hallow have shipped "ask about this passage" UI — users expect conversational follow-up, not one-shot verse lookups. This has been the #1 unfilled gap in VFY since the April 16 review.
- **Translation fidelity matters.** User reviews in competitor apps consistently flag "read the chapter in NIV but I use ESV" as a friction point. Cross-linking to BibleGateway with the wrong translation version breaks trust with power users.
- **Gamification of spiritual habits** (streaks, milestones, discovery counts) is a proven retention mechanic in the category. Users who can see their "Discovered" verse count tend to feel a sense of journey — not just a tool they open occasionally.
- Spring is historically the highest-growth quarter for devotional apps — new intentions, Easter momentum, and seasonal anxiety all drive installs and session depth.

---

## 2. Changes Made Today

### "Ask About This Verse" — Interactive Q&A in VerseDetailModal
**Files changed:** `server/routes.ts`, `client/screens/VerseDetailModal.tsx`

**Server:** Added a new `/api/ask-verse` POST endpoint that accepts a verse text, reference, and free-form question. Uses `gpt-4o-mini` with a "knowledgeable, warm Bible study companion" system prompt, capped at 200 tokens, with a 2-hour TTL cache keyed by reference + question slug. Protected by the existing `deepLimiter` (10 req/min per IP).

**Client:** Added a new "Ask About This Verse" collapsible panel in `VerseDetailModal` below the Devotional Reflection section, containing:
- 3 preset quick-tap question chips: "Why this verse for me?", "How do I apply this today?", "What's the context?"
- A free-text input field for custom questions with an arrow-up send button
- An inline answer display area with animated reveal (`FadeInDown`)
- Loading state (spinner) while the AI responds
- Graceful error fallback with the pastoral "well is quiet" copy

**Why this matters:** This completes the P0 "follow-up conversation" feature identified in the April 16 review. The reflection auto-loads context; the Q&A lets users interact with it. Every major competitor (YouVersion, Hallow, Glorify) now has conversational Bible features — VFY was the last holdout.

### Translation Pass-Through to "Read Full Chapter"
**Files changed:** `client/navigation/RootStackNavigator.tsx`, `client/screens/HomeScreen.tsx`, `client/screens/JournalScreen.tsx`, `client/screens/SearchScreen.tsx`, `client/screens/VerseDetailModal.tsx`

Added `translation?: string` to the `VerseDetail` params type in `RootStackParamList`. Updated all four navigation call sites (Home, Journal, Search) to pass the verse's actual translation. Updated `handleReadChapter` in `VerseDetailModal` to use the passed translation in the BibleGateway URL (`?version=NIV` → `?version=${translation || "NIV"}`).

**Why this matters:** A user reading in ESV who taps "Read Full Chapter" was being sent to BibleGateway with `version=NIV` — a subtle inconsistency that power users notice and that erodes trust in the app's attention to detail.

### Verses Discovered Stat in Settings
**Files changed:** `client/screens/SettingsScreen.tsx`

Added a third stat column to the Settings streak card showing the user's total "Discovered" verse count (pulled from `getTotalVersesFound()` in storage, which has been incrementing since the stat was introduced). The streak card now shows: **Day Streak | Best Streak | Discovered**.

**Why this matters:** `getTotalVersesFound` has been tracking this number in the background for weeks but it was surfaced nowhere except the Journal tab. Users benefit from seeing the cumulative number of verses they've encountered — it reinforces the sense of spiritual journey and encourages continued engagement.

---

## 3. Still Outstanding (Next Runs)

### P0
- **Account + cloud journal sync** — still the #1 retention risk. Every reinstall wipes the user's spiritual history. Requires auth (Sign in with Apple / Google) + Postgres-backed verse storage. Complex but critical.
- **Daily push notifications** — Settings toggle still shows "Coming Soon." `expo-notifications` not yet installed (requires native build). Should be the next native dependency added.

### P1
- **Audio verses / TTS** — Use TTS on found verses. Opens the commute use-case. High demand signal.
- **Share cards** (Instagram/TikTok-ready) — Generate a typeset 1080×1920 image. Free acquisition channel.
- **Streak push on milestone** — When user hits 7-day streak, surface a share prompt.

### P2
- **Bible reference validation** — `gpt-4o-mini` can hallucinate references. A local canonical book/chapter/verse index that rejects invalid refs and re-prompts would meaningfully improve data quality.
- **`HomeScreen.tsx` decomposition** — Still 1,000+ lines. Extract `useVerseQuery`, `useEmotionInput` hooks + `EmotionPillRow`, `VerseResultCard`, `EmptyState` components.

---

## 4. Change Log

| File | Change |
|------|--------|
| `server/routes.ts` | Added `/api/ask-verse` POST endpoint with cache, rate limiting, and pastoral error fallback |
| `client/navigation/RootStackNavigator.tsx` | Added `translation?: string` to `VerseDetail` params type |
| `client/screens/HomeScreen.tsx` | Pass `translation` in navigate-to-VerseDetail call |
| `client/screens/JournalScreen.tsx` | Pass `translation` in navigate-to-VerseDetail call |
| `client/screens/SearchScreen.tsx` | Pass `translation` in navigate-to-VerseDetail call |
| `client/screens/VerseDetailModal.tsx` | Added "Ask About This Verse" panel (state, handler, UI, styles); fixed BibleGateway URL to use actual translation |
| `client/screens/SettingsScreen.tsx` | Added `totalVersesFound` state + "Discovered" stat column to streak card |

Prepared: 2026-04-21, 10:00 AM PT window.
