import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { today } from "../core/validation.mjs";

export async function invoiceDeletionChecks(req, dbPath) {
  const json = async (url, method = "GET", body, status = 200) => {
    const r = await req(url, method, body),
      data = await r.json();
    assert.equal(r.status, status, JSON.stringify(data));
    return data;
  };
  const initial = await json("/state");
  const oldSequence = initial.numbering.nextNumber;
  const bike = {
    brand: "Deletion Test",
    model: "EV",
    vin: "DELETE-TEST-001",
    cost: "20000",
    price: "40000",
    hsn: "87116020",
    battery: "DELETE-BAT-1",
    motor: "DELETE-MOTOR-1",
  };
  await json("/bikes", "POST", bike);
  const item = (await json("/state")).bikes.find((b) => b.vin === bike.vin);
  const sale = {
    requestKey: randomUUID(),
    name: "Deletion test only",
    phone: "0000000000",
    address: "Local test address",
    customerState: "36",
    placeOfSupply: "36",
    priceMode: "inclusive",
    date: today(),
    lines: [{ id: item.id, price: "40000" }],
    discount: "0",
    paid: "5000",
    method: "UPI",
    issueConfirmed: true,
  };
  sale.previewHash = (
    await json("/invoices/preview", "POST", sale)
  ).previewHash;
  const issued = await json("/invoices", "POST", sale);
  const before = await json("/state");
  const saved = before.invoices.find((i) => i.id === issued.id);
  const review = await json(`/invoices/${issued.id}/delete-review`);
  assert.equal(review.canDelete, true);
  assert.equal(review.stock[0].serial, bike.vin);
  const deletion = {
    requestKey: randomUUID(),
    reviewHash: review.reviewHash,
    invoiceNumber: review.number,
    reason: "Created in error during testing",
    deleteConfirmed: true,
    stockConfirmed: true,
    correctionsConfirmed: true,
  };
  const endpoint = `/invoices/${issued.id}`;
  await json(endpoint, "DELETE", { ...deletion, deleteConfirmed: false }, 400);
  await json(endpoint, "DELETE", { ...deletion, stockConfirmed: false }, 400);
  await json(
    endpoint,
    "DELETE",
    { ...deletion, correctionsConfirmed: false },
    400,
  );
  await json(endpoint, "DELETE", { ...deletion, invoiceNumber: "WRONG" }, 400);
  await json(endpoint, "DELETE", { ...deletion, reason: "short" }, 400);
  await json(endpoint, "DELETE", { ...deletion, reviewHash: "stale" }, 409);
  assert.deepEqual((await json("/state")).invoices, before.invoices);

  // Simulate a failure after the audit entry and stock links have been changed.
  const fault = new DatabaseSync(dbPath);
  fault.exec(
    `CREATE TRIGGER test_delete_rollback BEFORE UPDATE OF status ON bikes WHEN NEW.status='available' AND OLD.id='${item.id}' BEGIN SELECT RAISE(ABORT,'test forced rollback'); END;`,
  );
  await json(endpoint, "DELETE", deletion, 500);
  assert.equal(
    fault
      .prepare("SELECT COUNT(*) n FROM invoice_deletions WHERE invoice_id=?")
      .get(issued.id).n,
    0,
  );
  assert.equal(
    fault.prepare("SELECT status FROM bikes WHERE id=?").get(item.id).status,
    "sold",
  );
  assert.equal(
    fault
      .prepare("SELECT COUNT(*) n FROM invoice_bikes WHERE invoice_id=?")
      .get(issued.id).n,
    1,
  );
  fault.exec("DROP TRIGGER test_delete_rollback");
  fault.close();
  assert.equal((await json(endpoint, "DELETE", deletion)).released, 1);
  assert.equal((await json(endpoint, "DELETE", deletion)).alreadyDeleted, true);
  await json(
    endpoint,
    "DELETE",
    { ...deletion, reason: "Changed repeated request" },
    409,
  );
  await json("/invoices", "POST", sale, 409);
  const after = await json("/state");
  assert.equal(after.invoices.length, initial.invoices.length);
  assert.equal(
    after.invoices.some((i) => i.id === issued.id),
    false,
  );
  assert.equal(after.bikes.find((b) => b.id === item.id).status, "available");
  assert.equal(after.numbering.nextNumber, oldSequence + 1);
  const retained = after.deletedInvoices.find((i) => i.id === issued.id);
  assert.deepEqual(retained.body, saved.body);
  assert.equal(retained.deletion.reason, deletion.reason);
  assert.equal((await req(endpoint + "/pdf")).status, 410);
  assert.equal(
    after.invoices.reduce((s, i) => s + i.total, 0),
    initial.invoices.reduce((s, i) => s + i.total, 0),
  );
  assert.equal(
    after.invoices.reduce((s, i) => s + i.paid, 0),
    initial.invoices.reduce((s, i) => s + i.paid, 0),
  );

  // The released bike can be sold with a new number, and existing service history blocks deletion.
  const resale = { ...sale, requestKey: randomUUID() };
  resale.previewHash = (
    await json("/invoices/preview", "POST", resale)
  ).previewHash;
  const resold = await json("/invoices", "POST", resale);
  const resoldReview = await json(`/invoices/${resold.id}/delete-review`);
  assert.notEqual(resoldReview.number, review.number);
  await json("/services", "POST", {
    requestKey: randomUUID(),
    bikeId: item.id,
    complaint: "Test service prevents deletion",
    odometer: "10",
    chargeType: "paid",
    parts: [],
  });
  const blocked = await json(`/invoices/${resold.id}/delete-review`);
  assert.equal(blocked.canDelete, false);
  assert.match(blocked.blockers.join(" "), /service history/);
  await json(
    `/invoices/${resold.id}`,
    "DELETE",
    {
      ...deletion,
      requestKey: randomUUID(),
      invoiceNumber: resoldReview.number,
      reviewHash: resoldReview.reviewHash,
    },
    409,
  );
  assert.equal(
    (await json("/state")).invoices.some((i) => i.id === resold.id),
    true,
  );

  // Battery sale deletion uses the same guarded workflow and preserves its stock event history.
  const pack = await json("/batteries", "POST", {
    brand: "Deletion test",
    model: "Pack",
    serial: "DELETE-PACK-001",
    cost: "100",
    price: "200",
    hsn: "85076000",
    gstPercent: "18",
  });
  const batterySale = {
    ...sale,
    requestKey: randomUUID(),
    paid: "0",
    method: "Not received",
    taxConfirmed: true,
    lines: [{ id: pack.id, price: "200", hsn: "85076000", gstPercent: "18" }],
  };
  batterySale.previewHash = (
    await json("/battery-invoices/preview", "POST", batterySale)
  ).previewHash;
  const batteryIssued = await json("/battery-invoices", "POST", batterySale);
  const br = await json(`/invoices/${batteryIssued.id}/delete-review`);
  await json(`/invoices/${batteryIssued.id}`, "DELETE", {
    ...deletion,
    requestKey: randomUUID(),
    reviewHash: br.reviewHash,
    invoiceNumber: br.number,
  });
  await json("/battery-invoices", "POST", batterySale, 409);
  const history = await json(`/batteries/${pack.id}`);
  assert.equal(history.battery.status, "available");
  assert.equal(history.sale, null);
  assert.equal(
    history.events.filter((e) => e.kind === "invoice_deleted").length,
    1,
  );
  const repeatSale = { ...batterySale, requestKey: randomUUID() };
  repeatSale.previewHash = (
    await json("/battery-invoices/preview", "POST", repeatSale)
  ).previewHash;
  assert.ok((await json("/battery-invoices", "POST", repeatSale)).id);
  await json("/invoices/does-not-exist/delete-review", "GET", undefined, 404);
  const check = new DatabaseSync(dbPath, { readOnly: true });
  assert.deepEqual(check.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(
    check.prepare("SELECT body FROM invoices WHERE id=?").get(issued.id).body,
    JSON.stringify(saved.body),
  );
  check.close();
  console.log(
    "PASS: invoice deletion confirmation, stale guards, full rollback, retained originals, dashboard totals, protected service history, stock resale and battery event history.",
  );
}
