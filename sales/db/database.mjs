import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { upgradeGst } from "../gst-invoices.mjs";
import { upgradeService } from "../service.mjs";
import { upgradeCommerce } from "./migrations/003-commerce.mjs";
export function openDatabase(data) {
  mkdirSync(data, { recursive: true });
  const db = new DatabaseSync(path.join(data, "sales.sqlite"));
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
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

  upgradeCommerce(db, {
    backupPath:
      process.env.NODE_ENV === "production"
        ? path.join(
            data,
            "backups",
            "before-commerce-v1-" + Date.now() + ".sqlite",
          )
        : undefined,
  });
  return db;
}
