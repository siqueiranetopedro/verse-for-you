import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  log("Serving static Expo files with dynamic manifest routing");

  const distDir = path.resolve(process.cwd(), "dist");
  const hasWebBuild = fs.existsSync(path.join(distDir, "index.html"));

  if (hasWebBuild) {
    log("Expo web build found — serving from dist/");
  } else {
    log("No web build found in dist/ — falling back to landing page");
  }

  // Expo Go native manifest routing (for iOS/Android Expo Go client)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path === "/manifest") {
      const platform = req.header("expo-platform");
      if (platform && (platform === "ios" || platform === "android")) {
        return serveExpoManifest(platform, res);
      }
    }

    next();
  });

  // Static assets
  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  if (hasWebBuild) {
    // Serve Expo web build — static assets first, then SPA fallback
    app.use(express.static(distDir));

    // SPA fallback: any non-API, non-asset route serves index.html
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/_expo") || req.path.startsWith("/assets")) {
        return next();
      }
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    // Fallback: serve landing page template
    const templatePath = path.resolve(process.cwd(), "server", "templates", "landing-page.html");
    if (fs.existsSync(templatePath)) {
      const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
      const appName = getAppName();
      app.get("/", (req: Request, res: Response) => {
        serveLandingPage({ req, res, landingPageTemplate, appName });
      });
    }
  }

  log("Expo routing: configured");
}


function configureLegalPages(app: express.Application) {
  const legalStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 700px; margin: 0 auto; padding: 40px 24px; color: #1C2B26; line-height: 1.7; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 600; margin-top: 32px; }
    p { color: #5A7267; }
    a { color: #4E7C6B; }
    .back { display:inline-block; margin-bottom:32px; color:#4E7C6B; text-decoration:none; font-weight:500; }
  `;

  app.get("/privacy", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Privacy Policy — Verse for You</title>
      <style>${legalStyle}</style></head><body>
      <a href="/" class="back">← Back to App</a>
      <h1>Privacy Policy</h1>
      <p>Last updated: May 2026</p>
      <p>Verse for You ("we", "our", or "us") is committed to protecting your privacy.
      This policy explains how we handle your information.</p>
      <h2>Information We Collect</h2>
      <p>We collect only what is necessary to provide the service: your saved verses and journal entries
      are stored locally on your device. We do not sell or share your data with third parties.</p>
      <h2>Data Storage</h2>
      <p>Your verses, journal entries, and preferences are stored locally on your device using
      AsyncStorage. No personal data is transmitted to our servers unless you explicitly use
      a cloud sync feature.</p>
      <h2>Third-Party Services</h2>
      <p>We use OpenAI to generate verse recommendations and prayers based on your emotional input.
      This interaction is anonymous — we do not attach your identity to these requests.</p>
      <h2>Contact</h2>
      <p>Questions? Email us at <a href="mailto:hello@verseforyou.app">hello@verseforyou.app</a></p>
    </body></html>`);
  });

  app.get("/terms", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Terms of Service — Verse for You</title>
      <style>${legalStyle}</style></head><body>
      <a href="/" class="back">← Back to App</a>
      <h1>Terms of Service</h1>
      <p>Last updated: May 2026</p>
      <p>By using Verse for You, you agree to these terms. Please read them carefully.</p>
      <h2>Use of the App</h2>
      <p>Verse for You is a spiritual companion app designed to connect you with Scripture.
      You agree to use it for personal, non-commercial purposes only.</p>
      <h2>Content</h2>
      <p>Bible verses are sourced from publicly available translations. AI-generated prayers and
      reflections are provided for personal spiritual guidance and are not a substitute for
      pastoral or professional counsel.</p>
      <h2>Disclaimer</h2>
      <p>Verse for You is provided "as is." We make no warranties regarding the accuracy or
      completeness of AI-generated content.</p>
      <h2>Contact</h2>
      <p>Questions? Email us at <a href="mailto:hello@verseforyou.app">hello@verseforyou.app</a></p>
    </body></html>`);
  });
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);
  configureLegalPages(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
