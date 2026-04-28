# Verse for You — Daily Review
**Date:** Thursday, April 23, 2026
**Review window:** 10:00 AM PT daily (Mon–Fri)
**Scope:** Demand signals + code quality and UX improvements implemented today.

---

## 1. Demand Signals (April 23, 2026)

We are now 18 days post-Easter 2026. Historical data in the faith-app category shows a "post-Easter plateau" — the install spike fades but retained users are the most engaged cohort of the year. Key signals for today:

- **Viral sharing is the primary organic acquisition channel for faith apps in 2026.** YouVersion's growth has been driven primarily by verse-share cards on Instagram and iMessage. VFY's share output was utilitarian — just verse text with no call-to-action or app link. This was leaving acquisition value on the table.
- **Milestone celebrations drive word-of-mouth.** Apps with discovery milestones (Duolingo streaks, Spotify Wrapped, Goodreads "50 books read") consistently outperform in organic sharing. VFY had `getTotalVersesFound()` tracking silently in storage for weeks with zero surface area for the user.
- **AI hallucination in Bible references is a known trust-eroder.** User reviews of AI-powered scripture apps consistently flag impossible references ("Acts 29", "Proverbs 40", "John 22") as confidence-breaking moments. VFY was sending unvalidated AI output directly to the client.
- **Code maintainability compounds.** The `HomeScreen.tsx` file at 1,024 lines was the highest-friction file in the codebase for future features. Extracting the verse card into its own component was overdue.

---

## 2. Changes Made Today

### Bible Reference Validation — Hallucination Guard on Server
**Files changed:** `server/routes.ts`

Added two utility functions and a canonical Bible book/chapter map:
- `BIBLE_CANON` — a `Record<string, number>` mapping all 66 books to their max chapter count, including alternate spellings (Psalm/Psalms, Song of Solomon/Song of Songs).
- `isValidBibleReference(reference)` — validates that the book exists in the canon and the chapter is within range.
- `filterValidVerses(verses)` — filters an array of verse objects, removing hallucinated references. Falls back to the original array if filtering removes everything (better to show a questionable reference than nothing).

Applied to:
- `/api/verses` (emotion-to-verse endpoint) — `filterValidVerses` runs before caching and responding.
- `/api/search` (concordance search) — same filter applied.
- `/api/random-verse` — single-reference `isValidBibleReference` check; falls back to Proverbs 3:5-6 if hallucinated.
- `/api/verse-of-day` — same check; falls back to Psalm 118:24 if hallucinated.

**Why this matters:** `gpt-4o-mini` occasionally returns references like "Wisdom 4:12", "Acts 29:5", or "Proverbs 41:1". These display visibly broken links in the app (BibleGateway 404s) and erode trust. This guard catches the most common failure modes without requiring a full verse database.

### VerseResultCard Component Extraction
**Files changed:** `client/components/VerseResultCard.tsx` (new), `client/screens/HomeScreen.tsx`

Extracted the inline verse card (save/copy/share buttons + verse text + reference + translation) from `HomeScreen.tsx` into a new standalone `VerseResultCard` component in `client/components/`. The component accepts typed props (`verseResult`, `isSaved`, `isCopied`, callbacks) and handles its own layout and styles.

- `HomeScreen.tsx`: 1,024 → 950 lines (extracted ~115 lines of card markup + styles)
- All styles, shadow logic, and action button layout now live in `VerseResultCard.tsx`
- `VerseResult` interface is now exported from `VerseResultCard.tsx` and imported into `HomeScreen.tsx` (previously defined inline in both files)

**Why this matters:** The card markup was duplicated in HomeScreen and will be needed in other surfaces (search results, future widgets). Centralizing it prevents drift and makes the Home screen's render logic readable again.

### Share Card Formatting Upgrade
**Files changed:** `client/screens/HomeScreen.tsx`, `client/screens/VerseDetailModal.tsx`

Updated all `Share.share()` calls to produce richer, more socially shareable output:

**Verse share (from HomeScreen):**
```
✨ Feeling anxious? This verse found me today.

"Cast all your anxiety on him because he cares for you."

— 1 Peter 5:7 (NIV)

📖 Verse for You · Find Scripture for how you feel
https://verseforyou.app
```

**Prayer share:**
```
🙏 A prayer for when you feel anxious:

[prayer text]

📖 Verse for You · Find Scripture for how you feel
https://verseforyou.app
```

**VerseDetailModal share:** Now includes the translation code and the app link.

**Why this matters:** Shared text is the primary organic acquisition channel. The old format was just the verse — no context, no attribution, no app link. The new format gives the recipient a reason to download the app and surfaces the emotion-first value proposition in the first line.

### Milestone Share Prompt
**Files changed:** `client/lib/storage.ts`, `client/screens/HomeScreen.tsx`

Added `checkNewMilestone(newTotal)` to `storage.ts`. It checks the updated verse count against milestone thresholds (10, 25, 50, 100, 250, 500) and returns the milestone if it was crossed for the first time (using a `@milestones_shown` AsyncStorage key to ensure each milestone is shown exactly once).

In `HomeScreen.tsx`, added `showMilestonePromptIfNeeded()` — called after `incrementVersesFound()` in both `handleFindVerses` and `handleInspireMe`. If a milestone was just hit, it fires haptic feedback and shows a native Alert:

```
✨ 10 Verses Discovered!

You've found 10 verses through Verse for You. Scripture has been meeting
you in your moments — that's something worth celebrating.

Want to share the app with someone who might need it today?

[Maybe Later]  [Share the App]
```

"Share the App" opens the system share sheet with a warm referral message.

**Why this matters:** `getTotalVersesFound()` has been tracking this number silently for weeks. Surfacing it at meaningful thresholds turns a passive counter into a growth mechanic. Each milestone is a natural moment to ask for word-of-mouth sharing without feeling pushy.

---

## 3. Still Outstanding (Next Runs)

### P0
- **Account + cloud journal sync** — still the #1 retention risk. Every reinstall wipes the user's spiritual history. Requires Sign in with Apple / Google + Postgres-backed verse storage.
- **Daily push notifications** — Settings toggle shows "Coming Soon." `expo-notifications` not installed; requires native build.

### P1
- **Audio verses / TTS** — Read found verses aloud via `expo-speech`. High demand for the commute/hands-free use case.
- **Share cards with visual design** — The current share improvements are text-only. A typeset image card (1080×1920, verse in serif on a gradient background) would drive dramatically more Instagram/TikTok sharing.
- **HomeScreen decomposition continued** — File is now 950 lines. Further extraction: `useVerseQuery` hook (verses, loading, error, fetch), `EmotionInputSection` component (input + pills + translation selector), `PrayerSection` component.

### P2
- **Streak push on milestone** — 7-day streak should surface a share prompt (similar to today's verse milestone).
- **Reading Plan depth** — Only one reading plan exists. Add 3-4 themed plans (Anxiety, Grief, Gratitude, Courage).

---

## 4. Change Log

| File | Change |
|------|--------|
| `server/routes.ts` | Added `BIBLE_CANON`, `isValidBibleReference()`, `filterValidVerses()`; applied to `/api/verses`, `/api/search`, `/api/random-verse`, `/api/verse-of-day` |
| `client/components/VerseResultCard.tsx` | New component — extracted verse card markup, styles, and action buttons from HomeScreen |
| `client/screens/HomeScreen.tsx` | Import + use `VerseResultCard`; removed duplicate card styles; upgraded share formatting; added milestone prompt logic |
| `client/screens/VerseDetailModal.tsx` | Upgraded share formatting to include translation and app link |
| `client/lib/storage.ts` | Added `checkNewMilestone()` with `@milestones_shown` persistence |

Prepared: 2026-04-23, 10:00 AM PT window.
