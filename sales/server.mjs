import express from "express";
import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter, sessionHash } from "./auth.mjs";
import { inventoryImport } from "./inventory-import.mjs";
import { invoicePdf } from "./invoice-pdf.mjs";
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
const app = express();
app.disable("x-powered-by");
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
    req.get("origin") !==
      (process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`)
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
const getSettings = () =>
  JSON.parse(db.prepare("SELECT body FROM settings WHERE id=1").get().body);
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
app.get("/api/state", (_req, res) =>
  res.json({
    settings: getSettings(),
    bikes: db.prepare("SELECT * FROM bikes ORDER BY created DESC").all(),
    invoices: db
      .prepare("SELECT * FROM invoices ORDER BY created DESC")
      .all()
      .map((i) => ({ ...i, body: JSON.parse(i.body) })),
  }),
);
app.put("/api/settings", (req, res) => {
  const s = {};
  for (const k of [
    "name",
    "address",
    "phone",
    "email",
    "taxId",
    "prefix",
    "footer",
    "bank",
  ])
    s[k] = text(
      req.body[k],
      k,
      k === "address" || k === "footer" || k === "bank" ? 1500 : 150,
      k === "name" || k === "prefix",
    );
  if (!/^[A-Z0-9-]{1,12}$/i.test(s.prefix))
    fail("Invoice prefix must contain letters, digits or hyphens.");
  s.logo = true;
  db.prepare("UPDATE settings SET body=? WHERE id=1").run(JSON.stringify(s));
  res.json({ ok: true });
});
app.post("/api/bikes", (req, res) => saveBike(req, res));
app.put("/api/bikes/:id", (req, res) => saveBike(req, res, req.params.id));
function saveBike(req, res, id) {
  const b = req.body;
  const old = id ? db.prepare("SELECT * FROM bikes WHERE id=?").get(id) : null;
  if (id && !old) return res.status(404).json({ error: "Bike not found." });
  if (old?.status === "sold")
    fail("Sold bikes cannot be edited. The invoice preserves their details.");
  const values = [
    text(b.model, "model", 100),
    text(b.brand, "brand", 100),
    text(b.color, "colour", 60, false),
    text(b.vin, "chassis/frame number", 100).toUpperCase(),
    text(b.battery, "battery/serial number", 100, false),
    money(b.cost, "purchase cost"),
    money(b.price, "selling price"),
    text(b.notes, "notes", 1500, false),
  ];
  if (id)
    db.prepare(
      "UPDATE bikes SET model=?,brand=?,color=?,vin=?,battery=?,cost=?,price=?,notes=? WHERE id=?",
    ).run(...values, id);
  else
    db.prepare(
      "INSERT INTO bikes(id,model,brand,color,vin,battery,cost,price,notes,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).run(randomUUID(), ...values, new Date().toISOString());
  res.json({ ok: true });
}
app.post("/api/invoices", (req, res) => {
  const b = req.body;
  const key = text(b.requestKey, "request key", 80);
  const previous = db
    .prepare("SELECT id FROM invoices WHERE request_key=?")
    .get(key);
  if (previous) return res.json(previous);
  const settings = getSettings();
  if (!settings.address)
    fail("Add your business address in Settings before issuing invoices.");
  const customer = {
    name: text(b.name, "customer name", 150),
    phone: text(b.phone, "customer phone", 30),
    address: text(b.address, "customer address", 1000),
    taxId: text(b.taxId, "customer tax ID", 50, false),
  };
  const salesperson = text(b.salesperson, "salesperson", 100, false);
  const date = text(b.date, "invoice date", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    fail("Invalid invoice date.");
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 20)
    fail("Choose between 1 and 20 bikes.");
  if (new Set(b.lines.map((l) => l.id)).size !== b.lines.length)
    fail("A bike cannot appear twice.");
  const lines = b.lines.map((l) => {
    const bike = db.prepare("SELECT * FROM bikes WHERE id=?").get(l.id);
    if (!bike || bike.status !== "available")
      fail("One of these bikes is no longer available.");
    return { ...bike, salePrice: money(l.price, "sale price") };
  });
  const subtotal = lines.reduce((n, l) => n + l.salePrice, 0);
  const discount = money(b.discount || 0, "discount");
  if (discount > subtotal) fail("Discount cannot exceed subtotal.");
  const taxBps = money(b.taxRate || 0, "tax percentage");
  if (taxBps > 10000) fail("Tax rate cannot exceed 100%.");
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * taxBps) / 10000);
  const total = taxable + tax;
  const paid = money(b.paid || 0, "amount received");
  if (paid > total) fail("Amount received cannot exceed the invoice total.");
  const invoice = {
    seller: settings,
    customer,
    date,
    salesperson,
    lines,
    subtotal,
    discount,
    taxRate: taxBps,
    tax,
    total,
    paid,
    balance: total - paid,
    method: text(b.method, "payment method", 30),
    notes: text(b.notes, "notes", 1500, false),
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const l of lines) {
      const result = db
        .prepare(
          "UPDATE bikes SET status='sold' WHERE id=? AND status='available'",
        )
        .run(l.id);
      if (!result.changes) fail("Bike was already sold.");
    }
    const id = randomUUID();
    const seq =
      Number(db.prepare("SELECT COUNT(*) AS n FROM invoices").get().n) + 1;
    const number = `${settings.prefix}-${String(seq).padStart(5, "0")}`;
    db.prepare("INSERT INTO invoices VALUES(?,?,?,?,?,?,?)").run(
      id,
      number,
      key,
      JSON.stringify(invoice),
      total,
      paid,
      new Date().toISOString(),
    );
    for (const l of lines)
      db.prepare("INSERT INTO invoice_bikes VALUES(?,?)").run(id, l.id);
    db.exec("COMMIT");
    res.json({ id });
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
});
inventoryImport(db, app, { text, money });
app.get("/api/invoices/:id/pdf", (req, res) => {
  const row = db
    .prepare("SELECT * FROM invoices WHERE id=?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Invoice not found." });
  invoicePdf(res, row, root);
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
