# Verse for You

## Overview

Verse for You is a spiritual companion mobile app that helps users find relevant Bible verses based on their current emotional state. Users can input how they're feeling (e.g., anxious, grateful, peaceful) and receive AI-curated Bible verses that provide comfort and guidance. The app includes a journal feature to save meaningful verses and a settings screen for app preferences.

The app is built as an Expo React Native application with a Node.js/Express backend, designed to run on iOS, Android, and web platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81
- **Navigation**: React Navigation v7 with a three-tier structure:
  - Root Stack Navigator (handles modals like VerseDetail)
  - Main Tab Navigator (three tabs: Home, Journal, Settings)
  - Stack navigators within each tab for screen-level navigation
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: StyleSheet-based with a comprehensive theme system in `client/constants/theme.ts`
- **Animations**: React Native Reanimated for smooth UI transitions
- **Local Storage**: AsyncStorage for persisting saved verses on device

### Backend Architecture
- **Framework**: Express.js running on Node.js
- **API Pattern**: RESTful endpoints under `/api/*`
- **AI Integration**: OpenAI API (via Replit AI Integrations) for emotion-to-verse matching
- **CORS**: Dynamic origin handling for Replit dev/production domains

### Key Design Patterns
- **Path Aliases**: `@/` maps to `client/`, `@shared/` maps to `shared/`
- **Theming**: Light/dark mode support with automatic system detection
- **Component Library**: Reusable themed components (ThemedText, ThemedView, Button, Card)
- **Screen Options Hook**: Centralized navigation header styling via `useScreenOptions`

### Data Flow
1. User enters emotion on Home screen
2. Frontend sends POST to `/api/verse` with emotion string
3. Backend queries OpenAI with a Bible scholar prompt
4. Backend returns JSON with verse text and reference
5. User can save verses to AsyncStorage via Journal

### Donation Flow
1. User taps "Keep the Mission Going" in Settings
2. DonateScreen shows donation amounts ($5, $10, $25, $50)
3. User selects amount and taps Donate button
4. Backend creates Stripe checkout session via `/api/donate`
5. User is redirected to Stripe's secure payment page

## External Dependencies

### Third-Party Services
- **OpenAI API**: Used for AI-powered verse selection based on emotions
  - Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Model: gpt-4o-mini

- **Stripe**: Payment processing for donations
  - Configured via Replit Stripe integration
  - Files: `server/stripeClient.ts` for Stripe client setup
  - Endpoints: `/api/donate` (POST) creates checkout session

### Database
- **PostgreSQL**: Configured via Drizzle ORM (schema in `shared/schema.ts`)
  - Currently defines users table (for future auth features)
  - Chat/conversation models exist in `shared/models/chat.ts` for potential chat features
  - Connection via `DATABASE_URL` environment variable

### Key NPM Packages
- **expo**: Core framework for cross-platform development
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **react-native-reanimated**: Animation library
- **openai**: Official OpenAI client SDK
- **expo-haptics**: Haptic feedback for user interactions

### Replit Integrations
Pre-built utilities in `server/replit_integrations/` for:
- Audio/voice chat processing
- Image generation
- Batch processing with rate limiting
- Chat storage patterns

These are available but not actively used in the main verse feature.