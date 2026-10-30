import { mkdirSync } from "node:fs";
import path from "node:path";
import { transaction } from "../../core/transactions.mjs";

export function upgradeInvoiceDeletion(db, { backupPath } = {}) {
  if (
    db.prepare("SELECT 1 FROM app_meta WHERE key='invoice-deletion-v1'").get()
  )
    return;
  if (backupPath) {
    mkdirSync(path.dirname(backupPath), { recursive: true });
    db.prepare("VACUUM INTO ?").run(backupPath);
    console.log(
      "Invoice deletion upgrade: database snapshot saved on persistent storage.",
    );
  }
  transaction(db, () => {
    db.exec(`CREATE TABLE invoice_deletions(
      invoice_id TEXT PRIMARY KEY REFERENCES invoices(id),
      deleted_at TEXT NOT NULL, reason TEXT NOT NULL, actor_hash TEXT NOT NULL,
      request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
      stock_body TEXT NOT NULL
    );`);
    db.prepare(
      "INSERT INTO app_meta VALUES('invoice-deletion-v1','enabled')",
    ).run();
  });
}
