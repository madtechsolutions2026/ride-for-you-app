import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { productTotals } from "../public/domain/totals.mjs";
import { upgradeCommerce } from "../db/migrations/003-commerce.mjs";
test("configurable product GST preserves paise, mixed rates and inclusive/exclusive totals", () => {
  for (const rate of [500, 750, 1200, 1800, 2800, 4000]) {
    const result = productTotals(
      [{ salePrice: 1000000, hsn: "85076000", gstRate: rate }],
      0,
      "exclusive",
      "36",
      "36",
    );
    assert.equal(result.tax, rate * 100);
    assert.equal(result.cgst, result.sgst);
    const inclusive = productTotals(
      [{ salePrice: result.total, hsn: "85076000", gstRate: rate }],
      0,
      "inclusive",
      "36",
      "29",
    );
    assert.equal(inclusive.taxable, 1000000);
    assert.equal(inclusive.total, result.total);
  }
  for (let n = 1; n <= 200; n++) {
    const data = [
        { salePrice: n * 12345, hsn: "85076000", gstRate: 1800 },
        { salePrice: n * 23456, hsn: "85072000", gstRate: 1200 },
      ],
      discount = n * 100;
    for (const mode of ["inclusive", "exclusive"]) {
      const r = productTotals(data, discount, mode, "36", n % 2 ? "36" : "29");
      assert.equal(
        r.lines.reduce((s, l) => s + l.discount, 0),
        discount,
      );
      assert.equal(r.total, r.taxable + r.tax + r.roundOff);
      if (mode === "inclusive") assert.equal(r.total, r.subtotal - discount);
    }
  }
  assert.throws(() =>
    productTotals(
      [{ salePrice: 100, hsn: "x", gstRate: 1800 }],
      0,
      "inclusive",
      "36",
      "36",
    ),
  );
});
test("commerce migration is repeatable and snapshots existing live records before upgrade", () => {
  const db = new DatabaseSync(":memory:"),
    dir = mkdtempSync(path.join(os.tmpdir(), "rfy-commerce-migration-"));
  db.exec(
    "CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE bikes(id TEXT PRIMARY KEY); CREATE TABLE invoices(id TEXT PRIMARY KEY,body TEXT); INSERT INTO bikes VALUES('old-bike'); INSERT INTO invoices VALUES('issued','immutable invoice');",
  );
  const backupPath = path.join(dir, "snapshot.sqlite");
  try {
    upgradeCommerce(db, { backupPath });
    upgradeCommerce(db);
    assert.equal(
      db.prepare("SELECT body FROM invoices").get().body,
      "immutable invoice",
    );
    const backup = new DatabaseSync(backupPath, { readOnly: true });
    assert(
      !backup
        .prepare("SELECT name FROM sqlite_master WHERE name='batteries'")
        .get(),
    );
    backup.close();
    assert.equal(db.prepare("SELECT COUNT(*) n FROM batteries").get().n, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
