# Bible Verse App - Design Guidelines

## Brand Identity

**Purpose**: A personal spiritual companion that helps users find relevant Bible verses based on their current emotional state, providing comfort and guidance when they need it most.

**Aesthetic Direction**: Soft/pastel with editorial refinement. The app should feel like a gentle friend - calming, approachable, and spiritually grounding. Think of a peaceful morning devotional with breathing room, soft colors, and thoughtful typography that invites contemplation.

**Memorable Element**: The emotion-to-verse experience - users remember how the app "understood" their feelings and surfaced the perfect verse at the perfect moment.

## Navigation Architecture

**Root Navigation**: Tab Navigation (3 tabs)
- **Home** (Verse tab) - Primary screen for emotion input and verse discovery
- **Journal** (History tab) - Saved verses and past emotional check-ins
- **Settings** - Profile and app preferences

## Screen-by-Screen Specifications

### 1. Home Screen (Verse Discovery)
**Purpose**: User enters their current emotion and receives a relevant Bible verse.

**Layout**:
- Header: Transparent, custom header with app title "Daily Verse" (centered), no buttons
- Main content: ScrollView with safe area insets (top: headerHeight + Spacing.xl, bottom: tabBarHeight + Spacing.xl)
- Floating elements: None

**Components**:
- Date display (e.g., "WEDNESDAY, JANUARY 22")
- Large text prompt: "How are you feeling today?"
- Text input field (rounded, centered, placeholder: "anxious, grateful, lost...")
- Emotion suggestion pills (scrollable horizontal row): "anxious", "grateful", "peaceful", "lost", "hopeful", "afraid", "joyful"
- Primary button: "Find Verse" (full-width, below input)
- Verse card (appears after search):
  - Soft background with left accent bar
  - Verse text (large, readable, with subtle quotation styling)
  - Reference text (book, chapter:verse)
  - Save button (heart icon, top-right of card)

**Empty State**: Show decorative illustration (praying-hands.png) with text "Share what's on your heart"

### 2. Journal Screen (History)
**Purpose**: View saved verses and past emotional check-ins.

**Layout**:
- Header: Default navigation header, title "Journal", right button (filter icon)
- Main content: FlatList with safe area insets (bottom: tabBarHeight + Spacing.xl)

**Components**:
- List of saved verse cards (chronological, newest first)
- Each card shows: date, emotion tag, verse snippet, reference
- Tap card to view full verse
- Swipe to delete

**Empty State**: Show empty-journal.png with text "Your verse journey begins here"

### 3. Settings Screen
**Purpose**: Manage profile, notifications, and app preferences.

**Layout**:
- Header: Default navigation header, title "Settings"
- Main content: ScrollView with form sections

**Components**:
- Profile section:
  - Avatar (circular, user-generated or default praying-hands-avatar.png)
  - Display name field
- Preferences:
  - Daily reminder toggle
  - Reminder time picker
  - Theme selector (Light/Dark/Auto)
- About:
  - App version
  - Privacy policy link
  - Terms of service link

### 4. Full Verse Modal (Native Modal)
**Purpose**: Display complete verse with context and actions.

**Layout**:
- Custom modal with rounded top corners
- Close button (X, top-left)
- Share button (top-right)

**Components**:
- Verse text (large, centered)
- Reference (below verse)
- Context button: "Read Chapter" (opens external Bible app)
- Save/Unsave button (heart, filled if saved)

## Color Palette

**Primary Colors**:
- Primary: #8B7E74 (warm taupe - grounding, spiritual)
- Primary Dark: #6B5D54 (pressed state)

**Background**:
- Background: #F9F7F4 (soft cream)
- Surface: #FFFFFF (white cards)
- Surface Secondary: #F3EFE9 (verse card background)

**Text**:
- Text Primary: #2D2A26 (warm black)
- Text Secondary: #736B63 (muted brown)
- Text Tertiary: #A39A8F (subtle gray)

**Accent**:
- Accent Bar: #C8B8A8 (soft gold for verse card left border)
- Link: #8B7E74 (matches primary)

**Semantic**:
- Success: #7A9B76 (saved confirmation)
- Error: #C17B7B (delete confirmation)

## Typography

**Font**: System font (SF Pro for iOS)

**Type Scale**:
- Title (Screen headers): 32px, Bold
- Headline (Verse reference): 18px, Semibold, uppercase, letter-spacing: 0.5px
- Body Large (Verse text): 22px, Regular, line-height: 34px
- Body (Input, buttons): 17px, Regular
- Caption (Date, tags): 13px, Medium, uppercase, letter-spacing: 1px

## Visual Design

**Touchable Feedback**:
- Primary buttons: Scale down to 0.96 on press, opacity 0.8
- Cards: Subtle scale (0.98) on press
- Pills: Background color change on press (#8B7E74)

**Buttons**:
- Primary: Rounded (12px), solid primary color, white text
- Secondary: Rounded (12px), transparent with 1px border (primary color)

**Cards**:
- Border radius: 16px
- Shadow: None (use subtle border instead: 1px solid #E8E3DD)
- Left accent bar: 4px solid accent color

**Input Field**:
- Border radius: 12px
- Border: 2px solid #E8E3DD
- Focus state: Border color changes to primary
- Text alignment: Center

## Assets to Generate

1. **icon.png** - App icon with open book and soft light rays
   - WHERE USED: Device home screen

2. **splash-icon.png** - Simplified book icon for launch screen
   - WHERE USED: App launch screen

3. **praying-hands.png** - Gentle illustration of praying hands with warm tones
   - WHERE USED: Home screen empty state

4. **empty-journal.png** - Soft illustration of empty journal with bookmark
   - WHERE USED: Journal screen empty state

5. **praying-hands-avatar.png** - Circular avatar with simple praying hands icon
   - WHERE USED: Settings profile section (default avatar)

6. **onboarding-welcome.png** - Welcoming illustration showing person in peaceful moment
   - WHERE USED: First-time user onboarding screen

All illustrations should use the app's color palette (warm taupes, creams, soft golds) and have a hand-drawn, gentle aesthetic.