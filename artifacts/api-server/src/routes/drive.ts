/**
 * Google Drive backup endpoints.
 *
 * Auth model (defense in depth):
 *   GET  /drive/status  — returns Drive health + a short-lived CSRF token.
 *                         Responds to any same-origin request (no Origin header)
 *                         OR an explicit trusted-origin request; explicitly blocks
 *                         untrusted cross-origin reads via CORS.
 *   POST /drive/upload  — requires a valid CSRF token from /drive/status AND the
 *                         request must be same-origin or from a trusted origin.
 *
 * The CSRF token is a 5-minute-window HMAC(SESSION_SECRET, …).
 * If SESSION_SECRET is absent the module refuses to register any route and
 * the import site (routes/index.ts) falls through — Drive endpoints return 404.
 */

import { Router } from "express";
import type { Request, Response as ExpressResponse, NextFunction } from "express";
import multer from "multer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";

const SESSION_SECRET = process.env.SESSION_SECRET;
const router = Router();

if (!SESSION_SECRET) {
  // Fail closed: without the secret we cannot issue or validate CSRF tokens.
  // Every drive route returns 503 so the client gets a clear error instead
  // of silently passing with a forgeable key.
  console.error(
    "[drive] SESSION_SECRET is not set — Google Drive endpoints are disabled. " +
    "Set the secret and restart the server.",
  );
  router.use("/drive", (_req: Request, res: ExpressResponse) => {
    res.status(503).json({ error: "Google Drive is not available (server misconfiguration)." });
  });
} else {
  registerDriveRoutes(router, SESSION_SECRET);
}

export default router;

// ─────────────────────────────────────────────────────────────────────────────

function registerDriveRoutes(router: ReturnType<typeof Router>, secret: string) {

  // ── Trusted origins ───────────────────────────────────────────────────────
  // Exact match only — no subdomain wildcard.
  const TRUSTED_ORIGINS: readonly string[] = [
    "http://localhost",
    "http://localhost:22986",
    "http://127.0.0.1",
    ...(process.env.REPLIT_DEV_DOMAIN
      ? [`https://${process.env.REPLIT_DEV_DOMAIN}`]
      : []),
  ];

  function isTrustedOrigin(req: Request): boolean {
    const o = req.headers.origin ?? "";
    return TRUSTED_ORIGINS.includes(o);
  }

  /**
   * Override the global cors() middleware for drive endpoints.
   *
   * Browsers send an `Origin` header on cross-origin requests but typically
   * omit it on same-origin GET requests.  The rules:
   *
   *   no Origin        → same-origin fetch; ACAO not needed; remove the '*'
   *                      that the global cors() middleware already set.
   *   trusted Origin   → set ACAO to that specific origin only.
   *   untrusted Origin → remove ACAO so the browser blocks the cross-origin read.
   *
   * Returns true when the request is allowed (same-origin or trusted).
   */
  function applyDriveCors(req: Request, res: ExpressResponse): boolean {
    const origin = req.headers.origin;
    if (!origin) {
      // Same-origin: no CORS header needed; clear the wildcard from global cors().
      res.removeHeader("Access-Control-Allow-Origin");
      return true;
    }
    if (isTrustedOrigin(req)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      return true;
    }
    // Untrusted cross-origin: remove ACAO → browser blocks the read.
    res.removeHeader("Access-Control-Allow-Origin");
    return false;
  }

  // ── CSRF token ─────────────────────────────────────────────────────────────
  function tokenWindow(offset = 0): string {
    return (Math.floor(Date.now() / 300_000) + offset).toString();
  }

  function makeCsrfToken(window: string = tokenWindow()): string {
    return createHmac("sha256", secret).update(`drive-csrf:${window}`).digest("hex");
  }

  function isValidCsrfToken(token: string): boolean {
    if (!/^[0-9a-f]{64}$/.test(token)) return false;
    for (const offset of [0, -1]) {
      const expected = Buffer.from(makeCsrfToken(tokenWindow(offset)), "hex");
      const provided = Buffer.from(token, "hex");
      if (timingSafeEqual(expected, provided)) return true;
    }
    return false;
  }

  // ── Connector helper ───────────────────────────────────────────────────────
  // Local alias avoids the Express Response vs Fetch Response name clash.
  type FetchLike = {
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
  };

  function getConnectors(): ReplitConnectors | null {
    try {
      return new ReplitConnectors();
    } catch {
      return null;
    }
  }

  // ── GET /api/drive/status ─────────────────────────────────────────────────
  router.get("/drive/status", async (req: Request, res: ExpressResponse) => {
    const allowed = applyDriveCors(req, res);

    // Silently reject untrusted cross-origin probes.
    if (!allowed) {
      // Return minimal 403 — no account info leaks.
      res.status(403).json({ connected: false, reason: "Forbidden." });
      return;
    }

    const connectors = getConnectors();
    if (!connectors) {
      res.json({ connected: false, reason: "Google Drive is not configured on this server." });
      return;
    }

    try {
      const probe = await connectors.proxy(
        "google-drive",
        "/drive/v3/about?fields=user",
      ) as FetchLike;

      if (!probe.ok) {
        res.json({ connected: false, reason: `Drive returned ${probe.status}.` });
        return;
      }

      const body = await probe.json() as { user?: { emailAddress?: string; displayName?: string } };
      res.json({
        connected: true,
        email: body.user?.emailAddress ?? null,
        displayName: body.user?.displayName ?? null,
        csrfToken: makeCsrfToken(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Drive probe failed.";
      res.json({ connected: false, reason: msg });
    }
  });

  // ── Upload auth middleware ─────────────────────────────────────────────────
  function requireDriveAuth(req: Request, res: ExpressResponse, next: NextFunction): void {
    if (!applyDriveCors(req, res)) {
      res.status(403).json({ error: "Forbidden: request must originate from the Maplog app." });
      return;
    }
    const token = req.headers["x-drive-token"];
    if (typeof token !== "string" || !isValidCsrfToken(token)) {
      res.status(403).json({ error: "Missing or expired upload token — reload Settings and try again." });
      return;
    }
    next();
  }

  // ── POST /api/drive/upload ────────────────────────────────────────────────
  // Accepts a backup zip and uploads it to Google Drive.
  //
  // Memory note: multer buffers the file (capped at MAX_UPLOAD_BYTES). We build
  // the multipart body with Buffer.concat — peak is 2× file size. At the 50 MiB
  // cap that is ≤ 100 MiB total. Streaming large backups is a separate task.

  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MiB

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  router.post(
    "/drive/upload",
    requireDriveAuth,
    upload.single("backup"),
    async (req: Request, res: ExpressResponse) => {
      if (!req.file) {
        res.status(400).json({ error: "No backup file provided." });
        return;
      }

      const filename =
        typeof req.body?.filename === "string" && req.body.filename.trim()
          ? req.body.filename.trim()
          : `maplog-backup-${new Date().toISOString().slice(0, 10)}.zip`;

      const connectors = getConnectors();
      if (!connectors) {
        res.status(503).json({ error: "Google Drive is not configured on this server." });
        return;
      }

      // Build multipart/related body (Buffer, not ReadableStream — connectors.proxy
      // does not forward the duplex:"half" option required for streaming).
      const boundary = `maplog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      const enc = (s: string) => Buffer.from(s, "utf-8");

      const multipartBody = Buffer.concat([
        enc(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
        enc(JSON.stringify({ name: filename, mimeType: "application/zip" })),
        enc(`\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`),
        req.file.buffer,
        enc(`\r\n--${boundary}--`),
      ]);

      let driveRes: FetchLike;
      try {
        driveRes = await connectors.proxy(
          "google-drive",
          "/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
          {
            method: "POST",
            body: multipartBody,
            headers: {
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
          },
        ) as FetchLike;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        res.status(502).json({ error: `Drive upload failed: ${msg}` });
        return;
      }

      if (!driveRes.ok) {
        const text = await driveRes.text().catch(() => "");
        res.status(driveRes.status).json({
          error: `Google Drive returned ${driveRes.status}: ${text.slice(0, 200)}`,
        });
        return;
      }

      const file = await driveRes.json() as { id?: string; name?: string; webViewLink?: string };
      res.json({
        id: file.id ?? null,
        name: file.name ?? filename,
        webViewLink: file.webViewLink ?? null,
        // Fresh token so the client can upload again without reloading Settings.
        csrfToken: makeCsrfToken(),
      });
    },
  );
}
