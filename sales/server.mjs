import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter, sessionHash } from "./auth.mjs";
import { inventoryImport } from "./inventory-import.mjs";
import { invoicePdf } from "./invoice-pdf.mjs";
import { upgradeGst, gstInvoiceRoutes } from "./gst-invoices.mjs";
import { upgradeService, serviceRoutes } from "./service.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(root, ".env")))
  process.loadEnvFile(path.join(root, ".env"));
const basePath = process.env.BASE_PATH || "";
if (basePath && !/^\/[a-z0-9-]+$/.test(basePath))
  throw new Error(
    "BASE_PATH must be a single lowercase URL path, e.g. /sales.",
  );
if (process.env.NODE_ENV === "production" && !process.env.DATA_DIR)
  throw new Error("Production requires DATA_DIR on a persistent volume.");
const data = process.env.DATA_DIR || path.join(root, "data");
mkdirSync(data, { recursive: true });
const db = new DatabaseSync(path.join(data, "sales.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),salt TEXT,hash TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER);
CREATE TABLE IF NOT EXISTS bikes(id TEXT PRIMARY KEY,model TEXT NOT NULL,brand TEXT NOT NULL,color TEXT,vin TEXT UNIQUE NOT NULL,battery TEXT,cost INTEGER NOT NULL,price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'available',notes TEXT,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,number TEXT UNIQUE NOT NULL,request_key TEXT UNIQUE NOT NULL,body TEXT NOT NULL,total INTEGER NOT NULL,paid INTEGER NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invoice_bikes(invoice_id TEXT REFERENCES invoices(id),bike_id TEXT UNIQUE REFERENCES bikes(id));`);
const defaults = {
  name: "Ride For You",
  address: "",
  phone: "",
  email: "",
  taxId: "",
  prefix: "RFY",
  footer: "Thank you for choosing Ride For You.",
  bank: "",
  logo: true,
};
db.prepare("INSERT OR IGNORE INTO settings VALUES(1,?)").run(
  JSON.stringify(defaults),
);
upgradeGst(db, {
  backupPath:
    process.env.NODE_ENV === "production"
      ? path.join(data, "backups", "before-gst-v2-" + Date.now() + ".sqlite")
      : undefined,
});
const app = express();
upgradeService(db, {
  backupPath:
    process.env.NODE_ENV === "production"
      ? path.join(
          data,
          "backups",
          "before-service-v1-" + Date.now() + ".sqlite",
        )
      : undefined,
});
app.disable("x-powered-by");
const publicOrigins = new Set(
  [
    process.env.PUBLIC_ORIGIN,
    ...(process.env.ADDITIONAL_PUBLIC_ORIGINS || "").split(","),
  ]
    .map((origin) => origin?.trim())
    .filter(Boolean),
);
for (const origin of publicOrigins) {
  const parsed = new URL(origin);
  if (
    parsed.origin !== origin ||
    !["http:", "https:"].includes(parsed.protocol)
  )
    throw new Error(
      "Public origins must be exact HTTP(S) origins, without paths.",
    );
}
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
  });
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") &&
    !(publicOrigins.size
      ? publicOrigins.has(req.get("origin"))
      : req.get("origin") === `${req.protocol}://${req.get("host")}`)
  )
    return res.status(403).json({ error: "Request origin is not allowed." });
  next();
});
const fail = (m) => {
  throw Object.assign(new Error(m), { status: 400 });
};
const text = (v, label, max = 300, required = true) => {
  const s = typeof v === "string" ? v.trim() : "";
  if ((required && !s) || s.length > max) fail(`Check ${label}.`);
  return s;
};
export function money(v, label = "amount") {
  if (!/^\d+(\.\d{1,2})?$/.test(String(v)))
    fail(`Enter a valid ${label} (up to two decimal places).`);
  const [a, b = ""] = String(v).split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 1e12) fail(`${label} is too large.`);
  return n;
}
app.use("/api", authRouter(db));
app.use("/api", (req, res, next) => {
  const token = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("rfy_sales="))
    ?.slice(10);
  if (
    !token ||
    !db
      .prepare("SELECT token FROM sessions WHERE token=? AND expires>?")
      .get(sessionHash(token), Date.now())
  )
    return res.status(401).json({ error: "Please sign in." });
  req.sessionToken = sessionHash(token);
  next();
});
app.post("/api/logout", (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.sessionToken);
  res.clearCookie("rfy_sales", { path: (process.env.BASE_PATH || "") + "/" });
  res.json({ ok: true });
});
gstInvoiceRoutes(db, app, { text, money, root });
serviceRoutes(db, app, { text, money });
inventoryImport(db, app, { text, money });
app.get("/api/invoices/:id/pdf", (req, res) => {
  const row = db
    .prepare("SELECT * FROM invoices WHERE id=?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Invoice not found." });
  invoicePdf(res, row, root, {
    copy: ["original", "supplier", "transporter"].includes(req.query.copy)
      ? req.query.copy
      : "original",
  });
});
app.get(["/", "/index.html"], (_req, res) => {
  res
    .type("html")
    .send(
      readFileSync(path.join(root, "public/index.html"), "utf8").replaceAll(
        "__BASE_PATH__",
        basePath,
      ),
    );
});
app.use(express.static(path.join(root, "public")));
app.use((err, req, res, next) => {
  console.error(err.message);
  if (res.headersSent) return next(err);
  res
    .status(err.status || (err.code?.includes("CONSTRAINT") ? 409 : 500))
    .json({
      error: err.status
        ? err.message
        : err.code?.includes("CONSTRAINT")
          ? "That chassis number already exists."
          : "Could not save. Please try again.",
    });
});
const parent = express();
parent.enable("strict routing");
parent.get("/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
if (basePath)
  parent.get(basePath, (_req, res) => res.redirect(308, basePath + "/"));
parent.use(basePath || "/", app);
const server = parent.listen(
  Number(process.env.PORT || 3050),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "Ride For You Sales: http://127.0.0.1:" + (process.env.PORT || 3050),
    ),
);
process.on("SIGTERM", () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);
