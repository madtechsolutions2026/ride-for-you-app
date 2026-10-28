import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { financialYear, validGstin, gstTotals } from "./public/gst.mjs";
import { upgradeGst } from "./gst-invoices.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

test("5% EV GST: inclusive/exclusive, intra/interstate, discounts and paise rounding", () => {
  const input = [{ salePrice: 5000000, hsn: "87116020" }];
  let result = gstTotals(input, 0, "exclusive", "36", "36");
  assert.equal(result.cgst, 125000);
  assert.equal(result.sgst, 125000);
  assert.equal(result.igst, 0);
  assert.equal(result.total, 5250000);
  result = gstTotals(
    [{ salePrice: 5250000, hsn: "871160" }],
    0,
    "inclusive",
    "36",
    "29",
  );
  assert.equal(result.taxable, 5000000);
  assert.equal(result.igst, 250000);
  assert.equal(result.total, 5250000);
  result = gstTotals(
    [{ salePrice: 5250000, hsn: "871160" }],
    105000,
    "inclusive",
    "36",
    "36",
  );
  assert.equal(result.taxable, 4900000);
  assert.equal(result.cgst, 122500);
  assert.equal(result.total, 5145000);
  result = gstTotals(
    [{ salePrice: 21, hsn: "871160" }],
    0,
    "inclusive",
    "36",
    "36",
  );
  assert.equal(result.roundOff, -1);
  assert.equal(result.total, 21);
  assert.throws(() => gstTotals(input, 0, "", "36", "36"));
  assert.throws(() => gstTotals(input, 5000000, "exclusive", "36", "36"));
  assert.throws(() =>
    gstTotals([{ salePrice: 100, hsn: "850760" }], 0, "exclusive", "36", "36"),
  );
  let seed = 312;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };
  for (let n = 0; n < 500; n++) {
    const lines = Array.from({ length: 1 + (random() % 20) }, () => ({
      salePrice: 1 + (random() % 10000000),
      hsn: "871160",
    }));
    const sum = lines.reduce((s, l) => s + l.salePrice, 0),
      discount = random() % sum,
      mode = n % 2 ? "inclusive" : "exclusive",
      pos = n % 3 ? "36" : "29";
    const totals = gstTotals(lines, discount, mode, "36", pos);
    assert.equal(
      totals.lines.reduce((s, l) => s + l.discount, 0),
      discount,
    );
    assert.equal(
      totals.total,
      totals.taxable +
        totals.cgst +
        totals.sgst +
        totals.igst +
        totals.roundOff,
    );
    assert.equal(
      totals.total,
      totals.lines.reduce((s, l) => s + l.total, 0),
    );
    if (mode === "inclusive") assert.equal(totals.total, sum - discount);
    for (const l of totals.lines) {
      assert(l.discount <= l.salePrice);
      assert(Number.isSafeInteger(l.total));
      assert(l.taxable >= 0);
      assert(Math.abs(l.roundOff) <= 1);
    }
    assert.equal(pos === "36" ? totals.igst : totals.cgst + totals.sgst, 0);
  }
});
test("GSTIN checksum and financial-year rollover", () => {
  assert(validGstin("36AAQCR3663P1ZG"));
  assert(!validGstin("36AAQCR3663P1ZA"));
  assert(!validGstin("99AAQCR3663P1ZG"));
  assert.equal(financialYear("2026-03-31"), "2526");
  assert.equal(financialYear("2026-04-01"), "2627");
  assert.throws(() => financialYear("2026-02-30"));
});
test("upgrade preserves existing invoices and other business identities; is repeatable", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE bikes(id TEXT); CREATE TABLE invoices(id TEXT,body TEXT);CREATE TABLE settings(id INTEGER,body TEXT);",
  );
  const legacy = JSON.stringify({
    seller: { name: "Historical business" },
    tax: 50,
  });
  db.prepare("INSERT INTO invoices VALUES('old',?)").run(legacy);
  db.prepare("INSERT INTO settings VALUES(1,?)").run(
    JSON.stringify({
      name: "Different legal entity",
      address: "Existing address",
      prefix: "OLD",
    }),
  );
  const folder = mkdtempSync(path.join(os.tmpdir(), "gst-backup-test-"));
  const backupPath = path.join(folder, "before-upgrade.sqlite");
  upgradeGst(db, { backupPath });
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  assert.equal(
    backup.prepare("SELECT body FROM invoices WHERE id='old'").get().body,
    legacy,
  );
  assert(
    !backup
      .prepare("PRAGMA table_info(invoices)")
      .all()
      .some((c) => c.name === "request_hash"),
  );
  backup.close();
  rmSync(folder, { recursive: true, force: true });
  upgradeGst(db);
  assert.equal(
    db.prepare("SELECT body FROM invoices WHERE id='old'").get().body,
    legacy,
  );
  const s = JSON.parse(db.prepare("SELECT body FROM settings").get().body);
  assert.equal(s.name, "Different legal entity");
  assert.equal(s.address, "Existing address");
  assert.equal(s.taxId, undefined);
  assert(
    db
      .prepare("PRAGMA table_info(bikes)")
      .all()
      .some((c) => c.name === "hsn"),
  );
  db.close();
});
