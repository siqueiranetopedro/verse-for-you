# Verse for You — Daily Review
**Date:** Monday, April 20, 2026
**Review window:** 10:00 AM PT daily (Mon–Fri)
**Scope:** Demand signals + UI/UX improvements implemented today.

---

## 1. Demand Signals (April 20, 2026)

The faith + mental-wellness app category remains strong heading into late April. Key signals:
- Anxiety and seasonal mood-related searches continue to trend upward as Spring transitions. The emotion-first entry point VFY offers is strongly aligned with this.
- Serif typography in app UI has re-emerged as a design standard in 2026 — competing apps like Hallow and Glorify use editorial serifs for scripture text, signaling a maturation of the faith-app aesthetic.
- The shift from flat, bordered card UI to shadow-elevated cards continues across the App Store's top apps. Borders read 2022; soft shadows read 2026.
- Error states with pastoral/empathic copy perform better in faith-category apps (lower drop-off, higher re-engagement) than generic tech error messages.

---

## 2. Changes Made Today

### Typography Upgrade — Serif for Verse Text
**Files changed:** `client/constants/theme.ts`, `client/screens/HomeScreen.tsx`, `client/screens/VerseDetailModal.tsx`, `client/components/VerseOfTheDay.tsx`, `client/screens/JournalScreen.tsx`

Added two new Typography entries to `theme.ts`:
- `verseBody` — 22px serif, 34px line height (for full verse display)
- `verseBodySmall` — 17px serif, 26px line height (for inline/preview contexts)

Both use `Platform.select({ ios: "ui-serif", default: "serif" })` — leveraging the native system serif (Georgia on Android, ui-serif on iOS) without requiring additional font packages.

Applied to:
- `HomeScreen.tsx` — verse result cards (was `Typography.bodyLarge` sans-serif)
- `VerseDetailModal.tsx` — hero verse display (was `Typography.bodyLarge` sans-serif)
- `VerseOfTheDay.tsx` — expanded verse text and collapsed preview
- `JournalScreen.tsx` — saved verse snippet in journal cards

**Why this matters:** Serif fonts in scripture contexts read as devotional and authoritative. Every major faith app uses a serif for verse body — VFY's sans-serif verse text was reading as functional, not sacred. This is one of the most visible quality signals users notice.

### Verse Card Shadow Upgrade
**Files changed:** `client/screens/HomeScreen.tsx`, `client/screens/VerseDetailModal.tsx`, `client/components/VerseOfTheDay.tsx`, `client/screens/JournalScreen.tsx`

Replaced flat 1px border styling on verse cards with soft shadows in light mode:
- `shadowOpacity: 0.05–0.07`, `shadowRadius: 10–12`, `shadowOffset: { width: 0, height: 2–3 }`
- `elevation: 2–3` (Android)
- Dark mode keeps a subtle 1px border (shadows are ineffective on dark backgrounds)

Applied to the Verse of the Day card, verse result cards in HomeScreen, the hero verse in VerseDetailModal, and journal entry cards.

**Why this matters:** The April 16 review flagged this as a design modernization priority. Shadow-elevated cards match 2026 app store standards and create depth that makes the content feel more premium.

### Pastoral Error Messages
**File changed:** `client/screens/HomeScreen.tsx`

Updated two generic error strings:
- "Unable to find verses. Please try again." → "We couldn't find verses right now. Take a breath and try again."
- "Unable to fetch a verse. Please try again." → "The well is quiet for a moment — please try again."

### Empty State Copy Refresh
**File changed:** `client/screens/HomeScreen.tsx`

Updated the home screen empty state:
- "Share what's on your heart" → "What's on your heart today?"
- "Type how you're feeling or tap an emotion below" → "Type a feeling or tap a suggestion — Scripture meets you exactly where you are"

---

## 3. Still Outstanding (Next Runs)

From the April 16 P0 recommendations, the highest-impact items not yet implemented:
- **Account + cloud journal sync** — the #1 retention risk. AsyncStorage journal is device-local; reinstall wipes the user's spiritual history.
- **Follow-up conversation on any verse** — chat models in `shared/models/chat.ts` exist but are unused.
- **Daily push notifications + streak** — Settings has the toggle but the feature isn't wired.

P1 items:
- Audio verses / TTS for found verses
- Shareable verse image cards (Instagram/TikTok format)
- Reading Plan depth (multiple themed plans)

---

## 4. Change Log

| File | Change |
|------|--------|
| `client/constants/theme.ts` | Added `verseBody` and `verseBodySmall` typography entries with serif font family |
| `client/screens/HomeScreen.tsx` | Serif for verse cards, shadow on cards, pastoral error messages, improved empty state |
| `client/screens/VerseDetailModal.tsx` | Serif for hero verse, shadow on verse container |
| `client/components/VerseOfTheDay.tsx` | Serif for verse text + preview, shadow on card |
| `client/screens/JournalScreen.tsx` | Serif for verse snippets, shadow on journal cards |

Prepared: 2026-04-20, 10:00 AM PT window.
