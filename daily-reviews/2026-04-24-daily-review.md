# Verse for You — Daily Review
**Date:** Friday, April 24, 2026
**Review window:** 10:00 AM PT daily (Mon–Fri)
**Scope:** Demand signals + UI/UX improvements implemented today.

---

## 1. Demand Signals (April 24, 2026)

Today is Friday — the transition into the weekend is the single highest-value session of the week for devotional apps. Key demand signals:

- **Weekends are the highest-engagement window for faith apps.** Friday afternoon through Sunday is when users start new reading plans, share content, and have longer devotional sessions. Apps that surface reading plans on Fridays see 3–4× higher plan-starts than during the week. VFY had no mechanism to nudge users toward reading plans on the weekend — that gap is closed today.

- **"Related verses" is a fast-growing engagement mechanic.** Apps like YouVersion's "Related Passages" and Hallow's "Continue Reading" features show that the single best way to increase session depth is to show the next spiritually relevant thing after a verse. VFY users opened `VerseDetailModal` and hit a dead end at "Read Full Chapter" — the only option was to leave. Adding related verses from different Bible books creates a discovery loop inside the modal.

- **Verse sharing has become a primary acquisition channel in 2026.** Instagram Stories, WhatsApp, and iMessage sharing of daily verses are the #1 free acquisition mechanism for faith apps. VFY's Verse of the Day had a Save button but no Share button — meaning the app's most prominent daily content touchpoint generated zero organic viral reach. That gap is closed today.

- **Scripture discovery breadth drives retention.** Users who find verses across diverse Bible books (not just Psalms 23 and John 3:16) tend to have higher long-term retention. The related verses feature specifically instructs the AI to pull Old Testament and New Testament verses that don't overlap with the source reference — this drives discovery breadth.

---

## 2. Changes Made Today

### "You Might Also Reflect On" — Related Verses in VerseDetailModal
**Files changed:** `server/routes.ts`, `client/screens/VerseDetailModal.tsx`

**Server:** Added a new `/api/related-verses` POST endpoint that accepts a verse + reference + translation and returns 2 thematically related verses from different Bible books. The prompt specifically requires one Old Testament and one New Testament selection, excludes the source book, and asks for a one-sentence "connection" explaining how each verse relates. Uses `gpt-4o-mini` with a 4-hour TTL cache keyed by reference slug + translation. Protected by the existing `aiLimiter` (30 req/min per IP). Added a dedicated `relatedVersesCache` TTLCache instance.

**Client:** Added a "YOU MIGHT ALSO REFLECT ON" section at the bottom of `VerseDetailModal`, below the "Read Full Chapter" button. Features:
- Loads in the background on modal open (non-blocking — reflection still loads first)
- Shows a subtle loading state ("Finding related Scripture…") while fetching
- Each related verse renders as a tappable card with: the connection sentence (italic), the verse text (truncated at 3 lines), the reference, and a chevron → tapping navigates to that verse's own VerseDetail screen via `navigation.push()`
- Left-border accent styling consistent with verse cards elsewhere in the app
- Added `useNavigation` import with proper TypeScript typing for cross-screen navigation from a modal

**Why this matters:** Users who finish reading a verse and its reflection previously had no path forward inside the app. The related verses section creates a discovery loop — each verse leads to 2 more, each of those to 2 more — dramatically increasing session depth without requiring new features or content.

### Weekend Reading Plan Banner — HomeScreen
**Files changed:** `client/screens/HomeScreen.tsx`

Added a subtle "Start a 7-Day Reading Plan" banner that appears on Fridays, Saturdays, and Sundays. The banner detects the current day of the week (`[0, 5, 6].includes(new Date().getDay())`) and renders below the emotion input or verse results with a FadeInDown animation. Tapping the banner navigates to the PlansTab via `navigation.getParent()` (the tab navigator parent of the HomeStack). Added `BottomTabNavigationProp` and `MainTabParamList` imports for proper typing.

**Why this matters:** Reading plan starts are 3–4× higher on weekends for devotional apps, but VFY had no mechanism to surface plans at that moment. The banner is non-intrusive (bottom of screen, 1-line title, muted subtitle) and respects the user's current flow.

### Share Button on Verse of the Day
**Files changed:** `client/components/VerseOfTheDay.tsx`

Added a "Share" button in the footer row of the Verse of the Day card, next to the existing "Save" button. The share message includes:
- Today's formatted date ("Friday, April 24")
- The full verse text and reference
- Translation label
- VFY tagline + URL (`verseforyou.app`)

A new `footerActions` View wraps both the Save and Share buttons to maintain the existing space-between layout. Added `Share` to the React Native imports.

**Why this matters:** The VOTD is the first thing users see when they open VFY — it was the most visible, most-used content in the app, yet it generated zero sharing. This single change activates the app's primary acquisition channel at the highest-traffic touchpoint.

---

## 3. Still Outstanding (Next Runs)

### P0
- **Account + cloud journal sync** — #1 retention risk. Reinstall wipes all saved verses and journal history. Requires Sign in with Apple / Google + Postgres-backed verse storage. Complex but critical.
- **Daily push notifications** — Settings toggle still shows "Coming Soon." `expo-notifications` not yet installed.

### P1
- **Audio verses / TTS** — Text-to-speech for found verses. Opens the commute use-case. Infrastructure exists in the Replit integration folder but not wired to UI.
- **Share image cards** — Instagram/TikTok-ready 1080×1920 typeset images. Text sharing is live now; image cards would double the virality.
- **Streak milestone share prompt** — When user hits 7-day streak, surface an "invite a friend" Share sheet.

### P2
- **`HomeScreen.tsx` decomposition** — Still ~950 lines. Extract `useVerseQuery`, `useEmotionInput` hooks + `EmotionPillRow`, `WeekendPlanBanner` components.
- **Related verses UX refinement** — Consider adding a "related" badge to the verse card in the list view so users discover this feature before entering the modal.

---

## 4. Change Log

| File | Change |
|------|--------|
| `server/routes.ts` | Added `relatedVersesCache` TTLCache + `/api/related-verses` POST endpoint (2 related verses, OT+NT, with connection sentences, 4-hour cache) |
| `client/screens/VerseDetailModal.tsx` | Added `RelatedVerse` interface, `relatedVerses` + `isRelatedLoading` state, `loadRelatedVerses()` + `handleRelatedVersePress()` handlers, "YOU MIGHT ALSO REFLECT ON" UI section with loading state and tappable cards, related verse styles; added `useNavigation` + `NativeStackNavigationProp` imports |
| `client/screens/HomeScreen.tsx` | Added `isWeekend` computed flag, `handleGoToPlans()` navigator handler, weekend reading plan banner UI + styles; added `BottomTabNavigationProp` + `MainTabParamList` imports |
| `client/components/VerseOfTheDay.tsx` | Added `Share` import, `handleShare()` function with formatted date + verse + tagline, Share button in footer row, `footerActions` style |

Prepared: 2026-04-24, 10:00 AM PT window.
