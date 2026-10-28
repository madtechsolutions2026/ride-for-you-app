import { Router } from "express";
import {
  randomBytes,
  randomInt,
  randomUUID,
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto";

export const sessionHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export function normalizePhone(value) {
  let digits = String(value ?? "").replace(/[\s()+-]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) digits = "91" + digits;
  return /^91[6-9]\d{9}$/.test(digits) ? "+" + digits : null;
}
export function authRouter(db) {
  const router = Router();
  const allowed = new Set(
    (process.env.OTP_ALLOWED_PHONES || "")
      .split(",")
      .map(normalizePhone)
      .filter(Boolean),
  );
  const secret = process.env.OTP_HASH_SECRET;
  const configured = Boolean(
    allowed.size &&
    secret &&
    process.env.WAY2CHATS_API_KEY &&
    process.env.WAY2CHATS_PHONE_ID,
  );
  db.exec(`CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE IF NOT EXISTS otp_challenges(id TEXT PRIMARY KEY,phone TEXT,hash TEXT,expires INTEGER,attempts INTEGER DEFAULT 0,used INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS otp_requests(phone TEXT,ip TEXT,created INTEGER);`);
  // Invalidate legacy password sessions once; password routes are no longer mounted.
  if (
    !db.prepare("SELECT 1 FROM app_meta WHERE key='whatsapp-auth-v1'").get()
  ) {
    db.exec("DELETE FROM sessions");
    db.prepare("INSERT INTO app_meta VALUES(?,?)").run(
      "whatsapp-auth-v1",
      "enabled",
    );
  }
  const digest = (id, code) =>
    createHmac("sha256", secret)
      .update(id + ":" + code)
      .digest("hex");
  const issueSession = (res) => {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?)").run(
      sessionHash(token),
      Date.now() + 43200000,
    );
    res.cookie("rfy_sales", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 43200000,
      path: (process.env.BASE_PATH || "") + "/",
    });
  };
  router.get("/session", (_req, res) =>
    res.json({ mode: "whatsapp", configured }),
  );
  router.post("/auth/otp/request", async (req, res, next) => {
    try {
      if (!configured)
        return res.status(503).json({
          error:
            "WhatsApp login is not configured. Contact the workspace administrator.",
        });
      const phone = normalizePhone(req.body.phone);
      if (!phone)
        return res
          .status(400)
          .json({ error: "Enter a valid Indian WhatsApp mobile number." });
      const now = Date.now(),
        ip = sessionHash(req.ip || "local");
      db.prepare("DELETE FROM otp_requests WHERE created<?").run(
        now - 86400000,
      );
      db.prepare("DELETE FROM otp_challenges WHERE expires<?").run(
        now - 86400000,
      );
      const ipCount = db
        .prepare("SELECT COUNT(*) n FROM otp_requests WHERE ip=? AND created>?")
        .get(ip, now - 3600000).n;
      const count = db
        .prepare(
          "SELECT COUNT(*) n FROM otp_requests WHERE phone=? AND created>?",
        )
        .get(phone, now - 3600000).n;
      const last = db
        .prepare("SELECT MAX(created) last FROM otp_requests WHERE phone=?")
        .get(phone).last;
      if (ipCount >= 15 || count >= 5)
        return res.status(429).json({
          error: "OTP request limit reached. Please try again later.",
        });
      if (last && now - last < 60000)
        return res
          .status(429)
          .json({ error: "Wait one minute before requesting another code." });
      db.prepare("INSERT INTO otp_requests VALUES(?,?,?)").run(phone, ip, now);
      if (!allowed.has(phone))
        return res.status(403).json({
          error: "This number is not authorized for this sales workspace.",
        });
      // No fixed test code, log fallback or password bypass is accepted.
      const code = String(randomInt(100000, 1000000)),
        id = randomUUID();
      db.prepare(
        "UPDATE otp_challenges SET used=1 WHERE phone=? AND used=0",
      ).run(phone);
      db.prepare(
        "INSERT INTO otp_challenges(id,phone,hash,expires) VALUES(?,?,?,?)",
      ).run(id, phone, digest(id, code), now + 300000);
      let url =
        process.env.WAY2CHATS_URL ||
        "https://app.way2chats.com/api/v2/whatsapp-business/messages";
      const target = new URL(url);
      if (
        target.protocol !== "https:" &&
        !(process.env.NODE_ENV === "test" && target.hostname === "127.0.0.1")
      )
        throw Error("Invalid messaging endpoint.");
      let sent = false;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WAY2CHATS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phone.slice(1),
            phoneNoId: process.env.WAY2CHATS_PHONE_ID,
            type: "template",
            name: "otp",
            language: "en",
            bodyParams: [code],
            buttons: [{ type: "button", sub_type: "url", text: code }],
          }),
          signal: AbortSignal.timeout(10000),
        });
        const body = await response.json().catch(() => null);
        sent =
          response.ok &&
          body !== null &&
          body.success !== false &&
          !body.error &&
          body.status !== "error" &&
          body.status !== "failed";
      } catch {
        sent = false;
      }
      if (!sent) {
        db.prepare("UPDATE otp_challenges SET used=1 WHERE id=?").run(id);
        return res.status(502).json({
          error:
            "WhatsApp could not accept the message. Please try again in one minute.",
        });
      }
      res.json({
        challengeId: id,
        phone,
        expiresIn: 300,
        resendAfter: 60,
        message: "Code sent to WhatsApp.",
      });
    } catch (e) {
      next(e);
    }
  });
  router.post("/auth/otp/verify", (req, res) => {
    if (!configured)
      return res
        .status(503)
        .json({ error: "WhatsApp login is not configured." });
    const id =
        typeof req.body.challengeId === "string" ? req.body.challengeId : "",
      code = String(req.body.code || "");
    const row = db.prepare("SELECT * FROM otp_challenges WHERE id=?").get(id);
    if (
      !row ||
      row.used ||
      row.expires <= Date.now() ||
      row.attempts >= 5 ||
      !allowed.has(row.phone)
    )
      return res
        .status(400)
        .json({ error: "Code expired or unavailable. Request a new code." });
    db.prepare("UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?").run(
      id,
    );
    if (
      !/^\d{6}$/.test(code) ||
      !timingSafeEqual(
        Buffer.from(digest(id, code), "hex"),
        Buffer.from(row.hash, "hex"),
      )
    )
      return res.status(400).json({
        error: "Incorrect code. Please check WhatsApp and try again.",
      });
    db.exec("BEGIN IMMEDIATE");
    try {
      const changed = db
        .prepare(
          "UPDATE otp_challenges SET used=1 WHERE id=? AND used=0 AND expires>?",
        )
        .run(id, Date.now());
      if (!changed.changes) throw Error("Code already used.");
      issueSession(res);
      db.exec("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
  return router;
}
