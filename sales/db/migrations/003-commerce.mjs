import { mkdirSync } from "node:fs";
import path from "node:path";
import { transaction } from "../../core/transactions.mjs";
export function upgradeCommerce(db, { backupPath } = {}) {
  if (db.prepare("SELECT 1 FROM app_meta WHERE key='commerce-v1'").get())
    return;
  if (backupPath) {
    mkdirSync(path.dirname(backupPath), { recursive: true });
    db.prepare("VACUUM INTO ?").run(backupPath);
    console.log(
      "Commerce upgrade: database snapshot saved on persistent storage.",
    );
  }
  transaction(db, () => {
    db.exec(`CREATE TABLE batteries(id TEXT PRIMARY KEY,brand TEXT NOT NULL,model TEXT NOT NULL,serial TEXT NOT NULL UNIQUE COLLATE NOCASE,chemistry TEXT,voltage TEXT,capacity TEXT,warranty TEXT,warranty_terms TEXT,provider TEXT,hsn TEXT NOT NULL DEFAULT '',gst_bps INTEGER,cost INTEGER NOT NULL CHECK(cost>=0),price INTEGER NOT NULL CHECK(price>=0),status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','sold','installed')),installed_bike_id TEXT REFERENCES bikes(id),created TEXT NOT NULL,updated TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE invoice_batteries(invoice_id TEXT NOT NULL REFERENCES invoices(id),battery_id TEXT NOT NULL UNIQUE REFERENCES batteries(id));
CREATE TABLE battery_events(id TEXT PRIMARY KEY,battery_id TEXT NOT NULL REFERENCES batteries(id),kind TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE quotations(id TEXT PRIMARY KEY,number TEXT NOT NULL UNIQUE,request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','accepted','cancelled','converted')),invoice_id TEXT UNIQUE REFERENCES invoices(id),version INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE quotation_sequences(fy TEXT PRIMARY KEY,next_number INTEGER NOT NULL CHECK(next_number>0));
CREATE INDEX idx_battery_status ON batteries(status,created);
CREATE INDEX idx_quotation_status ON quotations(status,created);`);
    db.prepare("INSERT INTO app_meta VALUES('commerce-v1','enabled')").run();
  });
}
