import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  maxRetries: 1, // Prevent SDK retry cascade on 429 errors
});

// --- Rate Limiting ---
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private max: number;

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;
    // Prune expired entries every 5 minutes to prevent memory leak
    setInterval(() => this.prune(), 5 * 60 * 1000);
  }

  check(ip: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.store.get(ip);
    if (!entry || now > entry.resetAt) {
      this.store.set(ip, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (entry.count >= this.max) {
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    }
    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
  }

  private prune() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) this.store.delete(key);
    }
  }
}

// AI endpoints: 30 requests / minute per IP
const aiLimiter = new RateLimiter(60_000, 30);
// Prayer/Reflection: 10 requests / minute per IP (more expensive)
const deepLimiter = new RateLimiter(60_000, 10);

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function applyRateLimit(limiter: RateLimiter, req: Request, res: Response): boolean {
  const ip = getClientIp(req);
  const { allowed, retryAfterMs } = limiter.check(ip);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
    res.status(429).json({
      error: "Too many requests. Please wait a moment before trying again.",
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    });
    return false;
  }
  return true;
}

// Input sanitization: trim and cap length
function sanitizeString(value: unknown, maxLen = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

const TRANSLATIONS: Record<string, string> = {
  NIV: "New International Version",
  ESV: "English Standard Version",
  NLT: "New Living Translation",
  KJV: "King James Version",
  NKJV: "New King James Version",
  CSB: "Christian Standard Bible",
  NASB: "New American Standard Bible",
  AMP: "Amplified Bible",
  MSG: "The Message",
};

// --- In-memory cache ---
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMinutes: number) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }
}

// Cache verse lookups for 60 minutes to reduce OpenAI API calls
const verseCache = new TTLCache<any[]>(60);
// Cache daily verse for 24 hours
const dailyVerseCache = new TTLCache<any>(1440);
// Cache prayer prompts for 4 hours
const prayerCache = new TTLCache<string>(240);
// Cache verse reflections for 4 hours
const reflectionCache = new TTLCache<string>(240);
// Cache random verses for 30 minutes
const randomVerseCache = new TTLCache<any>(30);
// Cache reading plans for 12 hours (they are long and expensive)
const readingPlanCache = new TTLCache<any>(720);
// Cache ask-verse answers for 2 hours (question-specific, lower reuse than reflection)
const askVerseCache = new TTLCache<string>(120);
// Cache related verses for 4 hours (same verse → same relatives)
const relatedVersesCache = new TTLCache<any[]>(240);

// --- Trending Emotions Tracker (in-memory, privacy-safe, no PII) ---
// Tracks how many times each emotion has been searched across all sessions.
// Resets on server restart. Used to power "Trending" UI on the HomeScreen.
const emotionTrends = new Map<string, number>();

function recordEmotionTrend(emotion: string): void {
  const key = emotion.toLowerCase().trim().slice(0, 50);
  if (!key) return;
  emotionTrends.set(key, (emotionTrends.get(key) || 0) + 1);
}

function getTrendingEmotions(limit = 10): Array<{ emotion: string; count: number }> {
  return Array.from(emotionTrends.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([emotion, count]) => ({ emotion, count }));
}

// --- Bible Reference Validation ---
// Canonical list of all 66 Bible books with their maximum chapter counts.
// Used to reject hallucinated references from the AI before sending to the client.
const BIBLE_CANON: Record<string, number> = {
  // Old Testament
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
  "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24,
  "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36,
  "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150,
  "Psalm": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8,
  "Song of Songs": 8, "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5,
  "Ezekiel": 48, "Daniel": 12, "Hosea": 14, "Joel": 3, "Amos": 9,
  "Obadiah": 1, "Jonah": 4, "Micah": 7, "Nahum": 3, "Habakkuk": 3,
  "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  // New Testament
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
  "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6,
  "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5,
  "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, "Titus": 3,
  "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3,
  "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22,
};

/**
 * Validates a Bible reference string (e.g. "John 3:16", "Psalm 23:1-4").
 * Returns true if the book exists in the canon and the chapter is within range.
 * Returns false for hallucinated books (e.g. "Wisdom 4:12") or out-of-range chapters.
 */
function isValidBibleReference(reference: string): boolean {
  if (!reference || typeof reference !== "string") return false;
  // Extract book name and chapter — handles formats like "John 3:16", "1 John 4:8", "Psalm 23"
  const match = reference.trim().match(/^(.+?)\s+(\d+)(?::\d+(?:-\d+)?)?$/);
  if (!match) return false;
  const book = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const maxChapters = BIBLE_CANON[book];
  if (maxChapters === undefined) return false;
  return chapter >= 1 && chapter <= maxChapters;
}

/**
 * Filters an array of verse objects, removing any with hallucinated references.
 * If filtering removes all verses, returns the original array unfiltered
 * (better to show a possibly-wrong reference than nothing).
 */
function filterValidVerses<T extends { reference: string }>(verses: T[]): T[] {
  const valid = verses.filter((v) => isValidBibleReference(v.reference));
  return valid.length > 0 ? valid : verses;
}

// Helper to get seasonal context for improved verse selection
function getSeasonalContext(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const hour = now.getHours();

  let season = "spring";
  if (month >= 3 && month <= 5) season = "spring";
  else if (month >= 6 && month <= 8) season = "summer";
  else if (month >= 9 && month <= 11) season = "autumn";
  else season = "winter";

  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return `Today is ${dayOfWeek}, in ${season}. The time of day is ${timeOfDay}.`;
}

/**
 * Returns a day-of-week thematic hint to guide the Verse of the Day selection.
 * Each day of the week carries a distinct spiritual posture that high-engagement
 * devotional apps lean into (YouVersion, Hallow, Glorify).
 */
function getDayOfWeekVOTDHint(): string {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const hints: Record<string, string> = {
    Monday: "It's the start of a new week — lean toward verses about fresh starts, God's mercies being new every morning, new beginnings, and strength for what lies ahead. 'His mercies are new every morning' energy.",
    Tuesday: "It's mid-early week — lean toward verses about faithfulness, perseverance in daily tasks, and finding purpose in ordinary moments.",
    Wednesday: "It's the midpoint of the week — lean toward verses about endurance, staying the course, and God's steadiness when energy flags.",
    Thursday: "It's late week — lean toward verses about gratitude, seeing the week's blessings, and anticipating rest.",
    Friday: "It's the end of the work week — lean toward verses about Sabbath, rest, reflection, and God's provision through the week.",
    Saturday: "It's the weekend — lean toward verses about rest, renewal, family, and savoring God's creation.",
    Sunday: "It's Sunday — lean toward verses about worship, community, the body of Christ, and the Lord's Day as a gift.",
  };
  return hints[day] || "";
}

// --- Verified Bible API Helpers ---
// Priority 1 improvement: verse TEXT is now sourced from verified APIs whenever possible.
// AI (GPT-4o-mini) is only used to SELECT which references to show AND to transcribe
// references that aren't covered by the free verified sources — never to freely generate text.

/**
 * Fetches verse text from bible-api.com (free, no authentication required).
 * Supports KJV translation only.
 */
async function fetchFromBibleApiCom(reference: string, translation: string): Promise<string | null> {
  const translationMap: Record<string, string> = { KJV: "kjv" };
  const apiTranslation = translationMap[translation];
  if (!apiTranslation) return null;
  try {
    // "1 John 4:8" → "1+john+4:8"
    const refForUrl = reference.toLowerCase().replace(/\s+/g, "+");
    const url = `https://bible-api.com/${refForUrl}?translation=${apiTranslation}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json() as { text?: string };
    const text = data.text?.trim().replace(/\n/g, " ");
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Fetches verse text from the ESV API (https://api.esv.org).
 * Requires ESV_API_KEY environment variable (free key at api.esv.org/account).
 * Returns null when the key is absent or the request fails.
 */
async function fetchFromEsvApi(reference: string): Promise<string | null> {
  const apiKey = process.env.ESV_API_KEY;
  if (!apiKey) return null;
  try {
    const params = new URLSearchParams({
      q: reference,
      "include-headings": "false",
      "include-footnotes": "false",
      "include-verse-numbers": "false",
      "include-short-copyright": "false",
      "include-passage-references": "false",
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, {
      headers: { Authorization: `Token ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json() as { passages?: string[] };
    const text = data.passages?.[0]?.trim().replace(/\n/g, " ");
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Dispatches to the appropriate verified Bible source based on translation.
 * Returns null when no verified source is available for the given translation.
 */
async function fetchVerifiedVerseText(reference: string, translation: string): Promise<string | null> {
  if (translation === "ESV") return fetchFromEsvApi(reference);
  if (translation === "KJV") return fetchFromBibleApiCom(reference, translation);
  return null;
}

/**
 * Hydrates a list of pre-validated Bible references with actual verse texts.
 *
 * Two-phase strategy:
 *   Phase 1 — Verified API: ESV API (api.esv.org) for ESV, bible-api.com for KJV.
 *             These sources are ground-truth; no AI is involved.
 *   Phase 2 — Focused AI transcription: for all other translations (NIV, NLT, etc.),
 *             GPT is given a specific, validated reference and asked to TRANSCRIBE it
 *             exactly — not generate from scratch. This is far less prone to hallucination
 *             than the previous approach (where AI simultaneously selected AND generated text).
 *
 * This separation means AI is never free-wheeling over both selection and text generation
 * at the same time, which was the primary source of hallucinated or inaccurate verses.
 */
async function hydrateVerseTexts(
  references: string[],
  translation: string,
  translationName: string
): Promise<Array<{ verse: string; reference: string; translation: string }>> {
  // Phase 1: try verified API for each reference in parallel
  const results: Array<{ verse: string | null; reference: string }> = await Promise.all(
    references.map(async (reference) => ({
      verse: await fetchVerifiedVerseText(reference, translation),
      reference,
    }))
  );

  // Phase 2: batch-transcribe any references that didn't resolve via verified API
  const unresolved = results.filter((r) => !r.verse);
  if (unresolved.length > 0) {
    const refList = unresolved.map((r) => `"${r.reference}"`).join(", ");
    const transcriptionPrompt = `Transcribe the following Bible verses EXACTLY as they appear in the ${translationName} (${translation}) translation. Do not paraphrase, summarize, or change a single word — copy the text precisely.

References to transcribe: ${refList}

Respond with ONLY a JSON array (no markdown, no code blocks):
[{"reference": "Book Chapter:Verse", "verse": "Exact verse text here"}, ...]`;

    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a precise Bible transcription tool. Your only job is to copy verse text exactly as it appears in the specified translation. Return valid JSON only.",
          },
          { role: "user", content: transcriptionPrompt },
        ],
        max_completion_tokens: unresolved.length * 200 + 100,
      });
      const raw = resp.choices[0]?.message?.content?.trim() || "";
      const parsed = JSON.parse(
        raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      ) as Array<{ reference: string; verse: string }>;
      if (Array.isArray(parsed)) {
        const map = new Map(parsed.map((p) => [p.reference, p.verse]));
        for (const r of results) {
          if (!r.verse) r.verse = map.get(r.reference) ?? null;
        }
      }
    } catch {
      // Transcription failed — remaining nulls will be filtered below
    }
  }

  return results
    .filter((r): r is { verse: string; reference: string } => !!r.verse)
    .map(({ verse, reference }) => ({ verse, reference, translation }));
}




// Pre-warm reading plan cache for all 7 themes after server startup.
// Runs one theme every 30 seconds so it never overwhelms memory.
// Only runs in production (Railway) to avoid burning API credits locally.
const PLAN_THEMES = ["anxiety", "grief", "hope", "identity", "prayer", "strength", "faith"];

async function warmOneTheme(theme: string): Promise<void> {
  const cacheKey = `plan-${theme}-NIV`;
  if (readingPlanCache.get(cacheKey)) return; // already cached

  const translationName = TRANSLATIONS["NIV"];
  const prompt = `You are a pastor designing a 7-day Bible reading plan on the theme of "${theme}".

Create a structured 7-day reading plan where each day:
1. Has a short title (e.g. "Day 1: Naming the Fear")
2. Has ONE primary Bible verse in the ${translationName} (NIV) translation
3. Has a 1–2 sentence devotional focus
4. Has a short practical application (1 sentence)

Respond with ONLY a JSON object (no markdown, no code blocks):
{"theme":"${theme}","title":"...","description":"...","days":[{"day":1,"title":"...","verse":"...","reference":"...","focus":"...","application":"..."}]}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a pastor. Respond with valid JSON only." },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 2000,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";
  const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
  if (parsed.days) parsed.days = parsed.days.map((d: any) => ({ ...d, translation: "NIV" }));
  readingPlanCache.set(cacheKey, parsed);
  console.log(`[cache-warm] ✓ ${theme}`);
}

function scheduleWarmup(): void {
  if (process.env.NODE_ENV === "development") return; // skip locally
  PLAN_THEMES.forEach((theme, i) => {
    // Stagger: first theme after 10s, then one every 30s
    setTimeout(() => {
      warmOneTheme(theme).catch((err) =>
        console.warn(`[cache-warm] failed for "${theme}":`, err)
      );
    }, (10 + i * 30) * 1000);
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint — for uptime monitoring
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Get available translations
  app.get("/api/translations", (_req: Request, res: Response) => {
    res.json(TRANSLATIONS);
  });

  // Trending emotions — returns the top searched emotions since server start
  // No personal data stored; just aggregate counts.
  app.get("/api/trending-emotions", (_req: Request, res: Response) => {
    const trending = getTrendingEmotions(10);
    res.json({ trending });
  });

  // Random inspirational verse — "Inspire Me" feature
  app.get("/api/random-verse", async (req: Request, res: Response) => {
    if (!applyRateLimit(aiLimiter, req, res)) return;
    try {
      const translation = (req.query.translation as string) || "NIV";
      const translationName = TRANSLATIONS[translation] || TRANSLATIONS["NIV"];
      const translationCode = TRANSLATIONS[translation] ? translation : "NIV";

      // Use a rolling 30-min bucket so the verse changes periodically but isn't hammered
      const bucket = Math.floor(Date.now() / (30 * 60 * 1000));
      const cacheKey = `random-${translationCode}-${bucket}`;
      const cached = randomVerseCache.get(cacheKey);
      if (cached) return res.json(cached);

      const categories = [
        "comfort and peace",
        "strength and courage",
        "love and grace",
        "hope and future",
        "wisdom and guidance",
        "joy and celebration",
        "faith and trust",
        "forgiveness and redemption",
      ];
      const category = categories[Math.floor(Math.random() * categories.length)];

      // Phase 1: AI selects a reference only (no verse text — reduces hallucination risk)
      const prompt = `Select one uplifting Bible verse REFERENCE on the theme of "${category}".

Vary your selections widely across the full canon — Old Testament Psalms, Proverbs, Isaiah, and New Testament epistles are all welcome. Avoid always returning the same handful of famous verses.

In 2026, people are especially hungry for verses about: rest from digital noise, finding identity outside achievement, courage amid uncertainty, and genuine human connection. Favor references that feel timeless yet speak to today's soul.

Respond with ONLY a JSON object (no markdown, no code blocks) — do NOT include verse text:
{"reference": "Book Chapter:Verse", "theme": "${category}"}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful Bible assistant. Respond with valid JSON only. Return only a reference and theme — no verse text.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 80,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      let selectionParsed: { reference: string; theme: string };
      try {
        selectionParsed = JSON.parse(
          content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        );
      } catch {
        selectionParsed = { reference: "Proverbs 3:5-6", theme: "trust" };
      }

      // Validate the returned reference — fall back to known-good if hallucinated
      if (!isValidBibleReference(selectionParsed.reference)) {
        selectionParsed = { reference: "Proverbs 3:5-6", theme: "trust" };
      }

      // Phase 2: hydrate with actual verse text from verified source (or AI transcription)
      const hydrated = await hydrateVerseTexts(
        [selectionParsed.reference],
        translationCode,
        translationName
      );
      const verseText =
        hydrated[0]?.verse ||
        "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.";

      const result = {
        verse: verseText,
        reference: selectionParsed.reference,
        theme: selectionParsed.theme,
        translation: translationCode,
      };
      randomVerseCache.set(cacheKey, result);
      res.json(result);
    } catch (error) {
      console.error("Error fetching random verse:", error);
      res.status(500).json({ error: "Failed to fetch random verse" });
    }
  });

  // Verse of the Day — changes daily, cached for 24 hours
  app.get("/api/verse-of-day", async (req: Request, res: Response) => {
    if (!applyRateLimit(aiLimiter, req, res)) return;
    try {
      const today = new Date().toISOString().split("T")[0]; // e.g. "2026-04-06"
      const translation = (req.query.translation as string) || "NIV";

      // Full result cache — if we already have this translation for today, return immediately
      const fullCacheKey = `votd-${today}-${translation}`;
      const cached = dailyVerseCache.get(fullCacheKey);
      if (cached) {
        return res.json(cached);
      }

      const translationName = TRANSLATIONS[translation] || TRANSLATIONS["NIV"];

      // Phase 1: Reference selection is shared across ALL translations for the day.
      // This ensures the same verse is shown regardless of which translation the user picks.
      const refCacheKey = `votd-ref-${today}`;
      let selectionParsed: { reference: string; theme: string } | undefined =
        dailyVerseCache.get(refCacheKey);

      if (!selectionParsed) {
        const seasonal = getSeasonalContext();
        const dayHint = getDayOfWeekVOTDHint();

        const prompt = `Today is ${today}. ${seasonal} Select one uplifting Bible verse REFERENCE suitable as a "Verse of the Day".

Day-of-week guidance: ${dayHint}

Consider the season, time of day, AND the specific day of the week when choosing — e.g. morning verses of awakening, evening verses of peace, Monday verses of fresh starts, Friday verses of rest.

Vary your selection widely across Scripture — Psalms, Proverbs, Isaiah, Lamentations, the Gospels, Epistles, etc. Avoid defaulting to a small set of famous verses. Prefer beautiful but less-quoted passages that will feel like a discovery.

Respond with ONLY a JSON object (no markdown, no code blocks) — do NOT include verse text:
{"reference": "Book Chapter:Verse", "theme": "A one or two word theme, e.g. Fresh Start, Rest, Endurance, Gratitude"}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a helpful Bible assistant. Respond with valid JSON only. Return only a reference and theme — no verse text.",
            },
            { role: "user", content: prompt },
          ],
          max_completion_tokens: 80,
        });

        const content = response.choices[0]?.message?.content?.trim() || "";
        try {
          selectionParsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        } catch {
          selectionParsed = { reference: "Jeremiah 29:11", theme: "Hope" };
        }

        // Validate the returned reference — fall back to known-good if hallucinated
        if (!isValidBibleReference(selectionParsed!.reference)) {
          selectionParsed = { reference: "Psalm 118:24", theme: "Gratitude" };
        }

        // Cache the reference for the whole day (all translations share it)
        dailyVerseCache.set(refCacheKey, selectionParsed);
      }

      // Phase 2: Hydrate with actual verse text in the requested translation
      const hydrated = await hydrateVerseTexts(
        [selectionParsed!.reference],
        translation,
        translationName
      );
      const verseText =
        hydrated[0]?.verse ||
        "This is the day that the Lord has made; let us rejoice and be glad in it.";

      const result = {
        verse: verseText,
        reference: selectionParsed!.reference,
        theme: selectionParsed!.theme,
        translation,
        date: today,
      };
      dailyVerseCache.set(fullCacheKey, result);
      res.json(result);
    } catch (error) {
      console.error("Error fetching verse of the day:", error);
      res.status(500).json({ error: "Failed to fetch verse of the day" });
    }
  });

  // Find multiple Bible verses based on emotion
  app.post("/api/verses", async (req: Request, res: Response) => {
    if (!applyRateLimit(aiLimiter, req, res)) return;
    try {
      const rawEmotion = sanitizeString(req.body.emotion, 150);
      const { translation = "NIV", count = 5 } = req.body;
      const emotion = rawEmotion;

      if (!emotion) {
        return res.status(400).json({ error: "Emotion is required and must be a non-empty string under 150 characters" });
      }

      const translationName = TRANSLATIONS[translation] || TRANSLATIONS["NIV"];
      const translationCode = TRANSLATIONS[translation] ? translation : "NIV";
      const verseCount = Math.min(Math.max(count, 1), 5);

      // Record for trending (fire-and-forget, non-blocking)
      recordEmotionTrend(emotion);

      // Check cache first
      const cacheKey = `verses-${emotion.toLowerCase().trim()}-${translationCode}-${verseCount}`;
      const cachedVerses = verseCache.get(cacheKey);
      if (cachedVerses) {
        return res.json({ verses: cachedVerses, cached: true });
      }

      const seasonal = getSeasonalContext();

      // Phase 1: AI selects verse REFERENCES only — no text generation
      const prompt = `You are a compassionate pastor and Bible scholar in 2026. Someone is feeling "${emotion}" and needs Scripture that speaks directly to their heart. ${seasonal}

Modern context: People in 2026 face unique pressures — AI-driven job uncertainty, social media comparison culture, digital burnout, loneliness despite constant connectivity, information overload, doomscrolling anxiety, and a longing for authentic community.

Select exactly ${verseCount} Bible verse REFERENCES for someone feeling "${emotion}". Requirements:
1. Each verse must DIRECTLY address the feeling of "${emotion}" — not tangentially related
2. Include a diverse mix of Old Testament (Psalms, Proverbs, Isaiah, Prophets) and New Testament (Gospels, Paul's letters, Revelation)
3. Prioritize lesser-known gems alongside familiar passages — avoid defaulting to Jeremiah 29:11, John 3:16, or Philippians 4:13 every time
4. Choose references that offer comfort, hope, perspective, or practical spiritual guidance
5. Let the season and time of day subtly inform your selection if relevant

Respond with ONLY a JSON array of reference strings (no verse text, no markdown, no code blocks):
["Book Chapter:Verse", "Book Chapter:Verse", ...]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful Bible assistant. Return ONLY a JSON array of verse reference strings — no verse text. No markdown.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 300,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";

      let rawRefs: string[];
      try {
        const cleanContent = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        const parsedRefs = JSON.parse(cleanContent);
        // Accept both ["ref", ...] and [{reference: "ref"}, ...] shapes for robustness
        if (Array.isArray(parsedRefs)) {
          rawRefs = parsedRefs.map((item: unknown) =>
            typeof item === "string" ? item : (item as any)?.reference || ""
          );
        } else {
          rawRefs = ["Jeremiah 29:11"];
        }
      } catch (parseError) {
        console.error("Failed to parse AI reference response:", content);
        rawRefs = ["Jeremiah 29:11"];
      }

      // Filter to valid canonical references
      const validRefs = rawRefs.filter(isValidBibleReference);
      const refsToHydrate = validRefs.length > 0 ? validRefs : ["Jeremiah 29:11"];

      // Phase 2: hydrate references with actual verse texts (verified API or AI transcription)
      const rawVerses = await hydrateVerseTexts(refsToHydrate, translationCode, translationName);
      const verses = filterValidVerses(rawVerses);

      // Store in cache
      verseCache.set(cacheKey, verses);

      res.json({ verses });
    } catch (error) {
      console.error("Error finding verses:", error);
      res.status(500).json({ error: "Failed to find verses" });
    }
  });

  // Hardcoded fallback verses — shown when OpenAI fails to return valid JSON.
  // Keyed by lowercase keyword stem; each entry provides 3 reliable verses.
  const SEARCH_FALLBACKS: Record<string, Array<{ verse: string; reference: string }>> = {
    strength: [
      { verse: "I can do all this through him who gives me strength.", reference: "Philippians 4:13" },
      { verse: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.", reference: "Isaiah 40:31" },
      { verse: "The Lord is my strength and my shield; my heart trusts in him, and he helps me.", reference: "Psalm 28:7" },
    ],
    love: [
      { verse: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", reference: "John 3:16" },
      { verse: "Love is patient, love is kind. It does not envy, it does not boast, it is not proud.", reference: "1 Corinthians 13:4" },
      { verse: "And now these three remain: faith, hope and love. But the greatest of these is love.", reference: "1 Corinthians 13:13" },
    ],
    peace: [
      { verse: "And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.", reference: "Philippians 4:7" },
      { verse: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.", reference: "John 14:27" },
      { verse: "You will keep in perfect peace those whose minds are steadfast, because they trust in you.", reference: "Isaiah 26:3" },
    ],
    faith: [
      { verse: "Now faith is confidence in what we hope for and assurance about what we do not see.", reference: "Hebrews 11:1" },
      { verse: "For we live by faith, not by sight.", reference: "2 Corinthians 5:7" },
      { verse: "Truly I tell you, if you have faith as small as a mustard seed, you can say to this mountain, 'Move from here to there,' and it will move.", reference: "Matthew 17:20" },
    ],
    hope: [
      { verse: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", reference: "Jeremiah 29:11" },
      { verse: "May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.", reference: "Romans 15:13" },
      { verse: "But those who hope in the Lord will renew their strength.", reference: "Isaiah 40:31" },
    ],
    grace: [
      { verse: "For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God.", reference: "Ephesians 2:8" },
      { verse: "But he said to me, 'My grace is sufficient for you, for my power is made perfect in weakness.'", reference: "2 Corinthians 12:9" },
      { verse: "Let us then approach God's throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.", reference: "Hebrews 4:16" },
    ],
    fear: [
      { verse: "For God has not given us a spirit of fear, but of power and of love and of a sound mind.", reference: "2 Timothy 1:7" },
      { verse: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.", reference: "Isaiah 41:10" },
      { verse: "When I am afraid, I put my trust in you.", reference: "Psalm 56:3" },
    ],
    prayer: [
      { verse: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", reference: "Philippians 4:6" },
      { verse: "The prayer of a righteous person is powerful and effective.", reference: "James 5:16" },
      { verse: "Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.", reference: "Matthew 7:7" },
    ],
    forgive: [
      { verse: "Bear with each other and forgive one another if any of you has a grievance against someone. Forgive as the Lord forgave you.", reference: "Colossians 3:13" },
      { verse: "If we confess our sins, he is faithful and just and will forgive us our sins and purify us from all unrighteousness.", reference: "1 John 1:9" },
      { verse: "For if you forgive other people when they sin against you, your heavenly Father will also forgive you.", reference: "Matthew 6:14" },
    ],
    wisdom: [
      { verse: "If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.", reference: "James 1:5" },
      { verse: "For the Lord gives wisdom; from his mouth come knowledge and understanding.", reference: "Proverbs 2:6" },
      { verse: "The fear of the Lord is the beginning of wisdom, and knowledge of the Holy One is understanding.", reference: "Proverbs 9:10" },
    ],
    deliver: [
      { verse: "And lead us not into temptation, but deliver us from the evil one.", reference: "Matthew 6:13" },
      { verse: "The righteous person may have many troubles, but the Lord delivers him from them all.", reference: "Psalm 34:19" },
      { verse: "He has delivered us from such a deadly peril, and he will deliver us again.", reference: "2 Corinthians 1:10" },
    ],
    joy: [
      { verse: "Rejoice in the Lord always. I will say it again: Rejoice!", reference: "Philippians 4:4" },
      { verse: "The joy of the Lord is your strength.", reference: "Nehemiah 8:10" },
      { verse: "You make known to me the path of life; you will fill me with joy in your presence.", reference: "Psalm 16:11" },
    ],
    trust: [
      { verse: "Trust in the Lord with all your heart and lean not on your own understanding.", reference: "Proverbs 3:5" },
      { verse: "When I am afraid, I put my trust in you. In God, whose word I praise—in God I trust and am not afraid.", reference: "Psalm 56:3-4" },
      { verse: "Those who trust in the Lord are like Mount Zion, which cannot be shaken but endures forever.", reference: "Psalm 125:1" },
    ],
  };

  function getFallbackVerses(keyword: string): Array<{ verse: string; reference: string }> | null {
    const lower = keyword.toLowerCase();
    // Exact match first
    if (SEARCH_FALLBACKS[lower]) return SEARCH_FALLBACKS[lower];
    // Stem match — e.g. "forgiveness" matches "forgive", "trusting" matches "trust"
    for (const key of Object.keys(SEARCH_FALLBACKS)) {
      if (lower.startsWith(key) || key.startsWith(lower)) {
        return SEARCH_FALLBACKS[key];
      }
    }
    return null;
  }

  // Concordance search - find verses by keyword
  app.post("/api/search", async (req: Request, res: Response) => {
    if (!applyRateLimit(aiLimiter, req, res)) return;
    try {
      const keyword = sanitizeString(req.body.keyword, 100);
      const { translation = "NIV", count = 10 } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: "Keyword is required and must be a non-empty string under 100 characters" });
      }

      const translationName = TRANSLATIONS[translation] || TRANSLATIONS["NIV"];
      const translationCode = TRANSLATIONS[translation] ? translation : "NIV";
      const verseCount = Math.min(Math.max(count, 1), 15);

      const prompt = `You are a Bible concordance - a reference tool that finds every occurrence of a word in Scripture.

The user is searching for: "${keyword}"

Find ${verseCount} Bible verses where "${keyword}" or its variations (plurals, verb forms, synonyms) actually appear in the verse text. For example:
- If searching "snake", include verses with: snake, snakes, serpent, serpents, viper, vipers
- If searching "water", include verses with: water, waters, watered, watering
- If searching "shepherd", include verses with: shepherd, shepherds, shepherding

Requirements:
1. The word or its variation MUST appear in the actual verse text - this is a concordance lookup, not a topical search
2. Use the ${translationName} (${translationCode}) translation
3. Include verses from different books of the Bible (Old and New Testament)
4. Prioritize well-known and significant verses first

CRITICAL: Respond with ONLY a raw JSON array. No markdown. No backticks. No code fences. No explanatory text before or after. Start your response with [ and end with ].
Format: [{"verse": "The actual Bible verse text here", "reference": "Book Chapter:Verse"}, ...]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a Bible concordance assistant. Always respond with valid JSON only, no markdown formatting. Return an array of verse objects.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      
      let parsed;
      try {
        const cleanContent = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsed = JSON.parse(cleanContent);
      } catch (parseError) {
        // Fallback: try to extract individual verse objects with regex
        console.warn("JSON.parse failed for search, attempting regex extraction. Raw content:", content);
        try {
          const verseMatches = content.matchAll(/\{\s*"verse"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"reference"\s*:\s*"([^"]+)"\s*\}/g);
          const extracted = Array.from(verseMatches).map(m => ({ verse: m[1], reference: m[2] }));
          if (extracted.length > 0) {
            parsed = extracted;
          } else {
            // Also try reverse field order
            const reverseMatches = content.matchAll(/\{\s*"reference"\s*:\s*"([^"]+)"\s*,\s*"verse"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g);
            const reverseExtracted = Array.from(reverseMatches).map(m => ({ reference: m[1], verse: m[2] }));
            if (reverseExtracted.length > 0) {
              parsed = reverseExtracted;
            } else {
              console.error("Regex extraction also failed. Raw content:", content);
              const fallback = getFallbackVerses(keyword);
              if (fallback) {
                return res.json({ verses: fallback.map(v => ({ ...v, translation: translationCode })), keyword });
              }
              return res.status(500).json({ error: "Failed to parse search results" });
            }
          }
        } catch (regexError) {
          console.error("Failed to parse AI response:", content);
          const fallback = getFallbackVerses(keyword);
          if (fallback) {
            return res.json({ verses: fallback.map(v => ({ ...v, translation: translationCode })), keyword });
          }
          return res.status(500).json({ error: "Failed to parse search results" });
        }
      }

      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      const rawVerses = parsed.map((v: any) => ({
        verse: v.verse || "",
        reference: v.reference || "",
        translation: translationCode,
      })).filter((v: any) => v.verse && v.reference);

      const verses = filterValidVerses(rawVerses);

      res.json({ verses, keyword });
    } catch (error) {
      console.error("Error searching verses:", error);
      // Last resort: serve hardcoded fallback so the user always sees something
      try {
        const keyword = sanitizeString(req.body.keyword, 100) || "";
        const { translation = "NIV" } = req.body;
        const translationCode = TRANSLATIONS[translation] ? translation : "NIV";
        const fallback = getFallbackVerses(keyword);
        if (fallback) {
          return res.json({ verses: fallback.map(v => ({ ...v, translation: translationCode })), keyword });
        }
      } catch (_) { /* ignore */ }
      res.status(500).json({ error: "Failed to search verses" });
    }
  });

  // Keep old single verse endpoint for backwards compatibility
  app.post("/api/verse", async (req: Request, res: Response) => {
    if (!applyRateLimit(aiLimiter, req, res)) return;
    try {
      const emotion = sanitizeString(req.body.emotion, 150);
      const { translation = "NIV" } = req.body;

      if (!emotion) {
        return res.status(400).json({ error: "Emotion is required" });
      }

      const translationName = TRANSLATIONS[translation] || TRANSLATIONS["NIV"];
      const translationCode = TRANSLATIONS[translation] ? translation : "NIV";

      const prompt = `You are a compassionate Bible scholar helping someone find comfort in scripture. The person is feeling "${emotion}".

Find the most relevant and comforting Bible verse for someone experiencing this emotion. The verse should:
1. Directly address or relate to the feeling of "${emotion}"
2. Provide comfort, hope, or guidance
3. Be from the ${translationName} (${translationCode}) translation specifically

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{"verse": "The actual Bible verse text here", "reference": "Book Chapter:Verse"}

Example response:
{"verse": "Cast all your anxiety on him because he cares for you.", "reference": "1 Peter 5:7"}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful Bible assistant. Always respond with valid JSON only, no markdown formatting.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 500,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      
      let parsed;
      try {
        const cleanContent = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsed = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error("Failed to parse AI response:", content);
        parsed = {
          verse: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
          reference: "Jeremiah 29:11",
        };
      }

      if (!parsed.verse || !parsed.reference) {
        throw new Error("Invalid response structure");
      }

      res.json({
        verse: parsed.verse,
        reference: parsed.reference,
        translation: translationCode,
      });
    } catch (error) {
      console.error("Error finding verse:", error);
      res.status(500).json({ error: "Failed to find verse" });
    }
  });

  // Generate a short guided prayer based on emotion
  app.post("/api/prayer", async (req: Request, res: Response) => {
    if (!applyRateLimit(deepLimiter, req, res)) return;
    try {
      const emotion = sanitizeString(req.body.emotion, 150);

      if (!emotion) {
        return res.status(400).json({ error: "Emotion is required" });
      }

      const cacheKey = `prayer-${emotion.toLowerCase().trim()}`;
      const cached = prayerCache.get(cacheKey);
      if (cached) {
        return res.json({ prayer: cached, cached: true });
      }

      const prompt = `Write a short, heartfelt conversational prayer (3-5 sentences) for someone who is feeling "${emotion}".
The prayer should:
1. Acknowledge the person's current emotional state with empathy
2. Surrender that feeling to God
3. Ask for His comfort, strength, or guidance relevant to "${emotion}"
4. End with a note of trust or hope

Write in first person ("Lord, I come to you..."). Keep it sincere, warm, and non-denominational Christian.
Respond with ONLY the prayer text — no title, no label, no quotation marks, no markdown.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a compassionate prayer guide. Write sincere, personal prayers. Respond with only the prayer text.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 200,
      });

      const prayer = response.choices[0]?.message?.content?.trim() || "";
      if (prayer) {
        prayerCache.set(cacheKey, prayer);
      }

      res.json({ prayer });
    } catch (error) {
      console.error("Error generating prayer:", error);
      res.status(500).json({ error: "Failed to generate prayer" });
    }
  });

  // Generate a brief devotional reflection on a specific Bible verse
  app.post("/api/reflection", async (req: Request, res: Response) => {
    if (!applyRateLimit(deepLimiter, req, res)) return;
    try {
      const verse = sanitizeString(req.body.verse, 500);
      const reference = sanitizeString(req.body.reference, 100);
      const emotion = sanitizeString(req.body.emotion, 150) || undefined;

      if (!verse || !reference) {
        return res.status(400).json({ error: "Verse and reference are required" });
      }

      const cacheKey = `reflection-${reference.toLowerCase().replace(/\s/g, "-")}`;
      const cached = reflectionCache.get(cacheKey);
      if (cached) {
        return res.json({ reflection: cached, cached: true });
      }

      const emotionContext = emotion && emotion !== "undefined"
        ? ` The person reading this is feeling "${emotion}".`
        : "";

      const prompt = `You are a thoughtful devotional writer. Given this Bible verse:

"${verse}" — ${reference}${emotionContext}

Write a brief 2–3 sentence devotional reflection that:
1. Unpacks the meaning of this verse in plain, modern language
2. Connects it to real, everyday life experience
3. Ends with a single, encouraging takeaway or question to ponder

Keep it warm, accessible, and under 80 words total. No headers, no bullet points — just flowing prose.
Respond with ONLY the reflection text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a warm, accessible devotional writer. Write sincere, brief reflections in plain language.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 150,
      });

      const reflection = response.choices[0]?.message?.content?.trim() || "";
      if (reflection) {
        reflectionCache.set(cacheKey, reflection);
      }

      res.json({ reflection });
    } catch (error) {
      console.error("Error generating reflection:", error);
      res.status(500).json({ error: "Failed to generate reflection" });
    }
  });

  // Answer a user question about a specific Bible verse ("Ask About This Verse")
  app.post("/api/ask-verse", async (req: Request, res: Response) => {
    if (!applyRateLimit(deepLimiter, req, res)) return;
    try {
      const verse = sanitizeString(req.body.verse, 500);
      const reference = sanitizeString(req.body.reference, 100);
      const question = sanitizeString(req.body.question, 300);

      if (!verse || !reference || !question) {
        return res.status(400).json({ error: "Verse, reference, and question are required" });
      }

      // Cache key: reference slug + question slug (question-specific, not global)
      const questionSlug = question.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 60);
      const cacheKey = `ask-${reference.toLowerCase().replace(/\s/g, "-")}-${questionSlug}`;
      const cached = askVerseCache.get(cacheKey);
      if (cached) {
        return res.json({ answer: cached, cached: true });
      }

      const prompt = `A person is reading this Bible verse:

"${verse}" — ${reference}

They have this question about it: "${question}"

Answer their question in 2–4 sentences. Be warm, clear, and accessible — like a knowledgeable friend, not an academic. Ground your answer in the verse itself and biblical context. If the question is about application, be concrete and practical. If it's about meaning or history, be brief and illuminating.

Respond with ONLY the answer text — no greeting, no sign-off, no markdown.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a knowledgeable, warm Bible study companion. Answer questions about Bible verses clearly and accessibly. Respond with only the answer text.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 200,
      });

      const answer = response.choices[0]?.message?.content?.trim() || "";
      if (answer) {
        askVerseCache.set(cacheKey, answer);
      }

      res.json({ answer });
    } catch (error) {
      console.error("Error answering verse question:", error);
      res.status(500).json({ error: "Failed to answer question" });
    }
  });

  // Generate a 7-day thematic reading plan
  app.get("/api/reading-plan", async (req: Request, res: Response) => {
    if (!applyRateLimit(deepLimiter, req, res)) return;

    // ── Structured per-request logging ────────────────────────────────────────
    const reqId = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clientIp = getClientIp(req);
    const theme = sanitizeString(req.query.theme as string, 100) || "hope";
    const translation = (req.query.translation as string) || "NIV";
    const translationName = TRANSLATIONS[translation] || TRANSLATIONS["NIV"];
    const translationCode = TRANSLATIONS[translation] ? translation : "NIV";

    console.log(
      `[reading-plan] ${reqId} | ip=${clientIp} | theme=${theme} | lang=${translationCode}`
    );

    try {
      const cacheKey = `plan-${theme.toLowerCase().trim()}-${translationCode}`;
      const cached = readingPlanCache.get(cacheKey);
      if (cached) {
        console.log(`[reading-plan] ${reqId} | cache=HIT`);
        return res.json(cached);
      }

      console.log(`[reading-plan] ${reqId} | cache=MISS | calling OpenAI…`);

      const prompt = `You are a pastor designing a 7-day Bible reading plan on the theme of "${theme}".

Create a structured 7-day reading plan where each day:
1. Has a short title (e.g. "Day 1: Naming the Fear")
2. Has ONE primary Bible verse (a meaningful, well-chosen passage) in the ${translationName} (${translationCode}) translation
3. Has a 1–2 sentence devotional focus (what to meditate on today)
4. Has a short practical application (1 sentence — what the reader can do today)

Make the plan progressively build from awareness/acknowledgment → understanding → transformation → action.
Choose a diverse range of Old and New Testament passages. Avoid repeating the same books.

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{
  "theme": "${theme}",
  "title": "A compelling plan title (e.g. '7 Days of Peace')",
  "description": "One sentence describing the journey",
  "days": [
    {
      "day": 1,
      "title": "Day title",
      "verse": "The full verse text",
      "reference": "Book Chapter:Verse",
      "focus": "What to meditate on",
      "application": "One practical action for today"
    }
  ]
}`;

      // Abort after 9 s to prevent Railway request timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      let response;
      try {
        response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a thoughtful pastor creating Bible reading plans. Respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          max_completion_tokens: 2000,
        }, { signal: controller.signal });
      } catch (timeoutErr: any) {
        clearTimeout(timeoutId);
        if (timeoutErr.name === "AbortError" || timeoutErr.code === "ERR_OPERATION_TIMED_OUT") {
          console.error(`[reading-plan] ${reqId} | TIMEOUT after 9s`);
          return res.status(504).json({ error: "Reading plan generation timed out. Please try again in a moment." });
        }
        if (timeoutErr.status === 429 || timeoutErr.code === "rate_limit_exceeded") {
          console.warn(`[reading-plan] ${reqId} | OpenAI 429 (rate limit)`);
          res.setHeader("Retry-After", "30");
          return res.status(429).json({ error: "Service is temporarily busy. Please wait a moment and try again." });
        }
        throw timeoutErr;
      }
      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content?.trim() || "";
      let parsed: any;
      try {
        parsed = JSON.parse(
          content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        );
      } catch (parseErr) {
        console.error(
          `[reading-plan] ${reqId} | JSON parse failed | raw="${content.slice(0, 200)}"`
        );
        return res.status(500).json({ error: "Failed to parse reading plan. Please try again." });
      }

      if (parsed.days && Array.isArray(parsed.days)) {
        parsed.days = parsed.days.map((d: any) => ({ ...d, translation: translationCode }));

        // Hydrate any day where OpenAI returned only a reference as the verse text.
        // A "bare reference" is anything ≤ 60 chars that looks like "Book Chapter:Verse"
        // or doesn't contain multiple words (i.e. no real sentence content).
        const isBareReference = (text: string) => {
          if (!text || text.trim().length === 0) return true;
          if (text.trim().length <= 60 && /^[A-Z1-3]/.test(text.trim()) && text.includes(":")) return true;
          // Fewer than 5 words → likely just a reference, not real verse text
          if (text.trim().split(/\s+/).length < 5) return true;
          return false;
        };

        const refsNeedingHydration = parsed.days
          .filter((d: any) => isBareReference(d.verse))
          .map((d: any) => d.reference)
          .filter(Boolean);

        if (refsNeedingHydration.length > 0) {
          console.log(`[reading-plan] ${reqId} | hydrating ${refsNeedingHydration.length} bare-reference verses`);
          const hydrated = await hydrateVerseTexts(refsNeedingHydration, translationCode, translationName);
          const hydratedMap: Record<string, string> = {};
          for (const h of hydrated) {
            if (h.reference && h.verse) hydratedMap[h.reference] = h.verse;
          }
          parsed.days = parsed.days.map((d: any) => ({
            ...d,
            verse: isBareReference(d.verse) ? (hydratedMap[d.reference] || d.verse) : d.verse,
          }));
        }
      }

      readingPlanCache.set(cacheKey, parsed);
      console.log(`[reading-plan] ${reqId} | OK | days=${parsed.days?.length ?? 0} | cached`);
      res.json(parsed);
    } catch (error: any) {
      // ── Classify the error before surfacing ───────────────────────────────
      const errType = error?.constructor?.name ?? "UnknownError";
      const errStatus = error?.status ?? error?.statusCode ?? null;
      const errCode = error?.code ?? null;
      console.error(
        `[reading-plan] ${reqId} | ERROR | type=${errType} | status=${errStatus} | code=${errCode} | ip=${clientIp} | theme=${theme} | lang=${translationCode} | msg=${error?.message}`
      );

      // OpenAI rate limit that leaked past the inner catch
      if (errStatus === 429 || errCode === "rate_limit_exceeded") {
        res.setHeader("Retry-After", "30");
        return res.status(429).json({ error: "Service is temporarily busy. Please wait a moment and try again." });
      }
      // OpenAI or upstream 5xx
      if (errStatus >= 500 && errStatus < 600) {
        return res.status(502).json({ error: "AI service temporarily unavailable. Please try again in a moment." });
      }

      res.status(500).json({ error: "Failed to generate reading plan" });
    }
  });

  // Get Stripe publishable key for frontend
  app.get("/api/stripe/config", async (_req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ error: "Failed to get payment configuration" });
    }
  });

  // Create donation checkout session
  app.post("/api/donate", async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;

      if (!amount || typeof amount !== "number" || amount < 1) {
        return res.status(400).json({ error: "Valid amount is required (minimum $1)" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Get the base URL for success/cancel redirects
      const protocol = req.header("x-forwarded-proto") || req.protocol || "https";
      const host = req.header("x-forwarded-host") || req.get("host");
      const baseUrl = `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Keep the Mission Going",
                description: "Your gift helps keep this app free and supports spreading the gospel through missions worldwide",
              },
              unit_amount: Math.round(amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${baseUrl}/donation-success`,
        cancel_url: `${baseUrl}/donation-cancel`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating donation session:", error);
      res.status(500).json({ error: "Failed to create donation session" });
    }
  });

  // Related verses — given a verse + reference, return 2 thematically related verses
  // from different Bible books. Powers the "You Might Also Like" section in VerseDetailModal.
  app.post("/api/related-verses", async (req: Request, res: Response) => {
    if (!applyRateLimit(aiLimiter, req, res)) return;
    try {
      const verse = sanitizeString(req.body.verse, 500);
      const reference = sanitizeString(req.body.reference, 100);
      const translation = (req.body.translation as string) || "NIV";

      if (!verse || !reference) {
        return res.status(400).json({ error: "Verse and reference are required" });
      }

      const translationName = TRANSLATIONS[translation] || TRANSLATIONS["NIV"];
      const translationCode = TRANSLATIONS[translation] ? translation : "NIV";

      const cacheKey = `related-${reference.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${translationCode}`;
      const cached = relatedVersesCache.get(cacheKey);
      if (cached) return res.json({ verses: cached, cached: true });

      // Extract just the book name from the reference so we can exclude it
      const sourceBook = reference.replace(/\s+\d+.*$/, "").trim();

      const prompt = `This Bible verse was meaningful to someone: "${verse}" — ${reference}

Find 2 other Bible verses that relate to the same theme or deepen this passage's message. Requirements:
1. Both must come from DIFFERENT Bible books than "${sourceBook}" — variety is essential
2. One should be from the Old Testament, one from the New Testament
3. Each verse should connect to a distinct angle of the original — e.g. one on the same emotion, one on the underlying promise
4. Use the ${translationName} (${translationCode}) translation
5. Prefer lesser-known gems over overused classics

Respond with ONLY a JSON array (no markdown, no code blocks):
[{"verse": "exact verse text", "reference": "Book Chapter:Verse", "connection": "One sentence: how this verse relates to the original"}]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a Bible scholar finding thematically related verses. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 600,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      let parsed: any[];
      try {
        parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        if (!Array.isArray(parsed)) parsed = [parsed];
      } catch {
        return res.json({ verses: [] });
      }

      const rawVerses = parsed
        .slice(0, 2)
        .map((v: any) => ({
          verse: v.verse || "",
          reference: v.reference || "",
          translation: translationCode,
          connection: v.connection || "",
        }))
        .filter((v: any) => v.verse && v.reference);

      const verses = filterValidVerses(rawVerses);
      relatedVersesCache.set(cacheKey, verses);
      res.json({ verses });
    } catch (error) {
      console.error("Error finding related verses:", error);
      res.status(500).json({ error: "Failed to find related verses" });
    }
  });

  const httpServer = createServer(app);

  scheduleWarmup();

  return httpServer;
}
