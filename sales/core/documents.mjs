import { createHash, randomUUID } from "node:crypto";
import { STATES, validGstin, financialYear } from "../public/gst.mjs";
import { fail, text, today, stable, money } from "./validation.mjs";
export const fingerprint = (value) =>
  createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
export const getSeller = (db) =>
  JSON.parse(db.prepare("SELECT body FROM settings WHERE id=1").get().body);
export function checkSeller(seller) {
  if (!seller.name || !seller.address)
    fail(
      "Complete the legal business name and registered address in Business settings.",
    );
  if (
    !validGstin(seller.taxId || "") ||
    seller.taxId.slice(0, 2) !== seller.stateCode
  )
    fail(
      "Confirm a valid seller GSTIN and matching state in Business settings.",
    );
  if (!/^[A-Z0-9-]{1,5}$/i.test(seller.prefix))
    fail(
      "Use an invoice prefix of 1-5 letters, numbers or hyphens in Business settings.",
    );
}
export function customerDetails(body, { seller, quotation = false } = {}) {
  const customer = {
    name: text(body.name, "customer name", 150),
    phone: text(body.phone, "customer phone", 30),
    address: text(body.address, "customer address", 1000),
    taxId: text(body.taxId, "customer GSTIN", 15, false).toUpperCase(),
    stateCode: String(body.customerState || ""),
  };
  if (!STATES[customer.stateCode]) fail("Choose the customer’s billing state.");
  if (
    customer.taxId &&
    (!validGstin(customer.taxId) ||
      customer.taxId.slice(0, 2) !== customer.stateCode)
  )
    fail("Customer GSTIN must be valid and match the billing state.");
  if (!quotation && customer.taxId && seller.eInvoiceMode !== "not_required")
    fail(
      seller.eInvoiceMode === "required"
        ? "This B2B invoice requires an IRN. IRP integration is not configured; use your accountant’s e-invoicing process."
        : "Confirm B2B e-invoicing applicability in Business settings before issuing to a GST-registered buyer.",
    );
  if (!STATES[String(body.placeOfSupply || "")])
    fail("Choose the place of supply / delivery state.");
  if (body.reverseCharge || body.export || body.sez)
    fail("This workflow supports regular domestic sales only.");
  return customer;
}
export function documentDate(value, label = "document date") {
  const result = text(value, label, 10);
  try {
    financialYear(result);
  } catch {
    fail(`Choose a valid ${label}.`);
  }
  if (result > today() || result < "2017-07-01")
    fail(`Choose a past or current ${label}.`);
  return result;
}
export function receiptDetails(body, total) {
  const paid = money(body.paid || 0, "amount received"),
    method = text(body.method, "payment method", 30);
  if (paid > total) fail("Amount received cannot exceed the invoice total.");
  if (
    !["Bank transfer", "UPI", "Cash", "Not received"].includes(method) ||
    (method === "Not received" && paid)
  )
    fail("Select a payment method matching the amount received.");
  return { paid, balance: total - paid, method };
}
export function invoiceNumbering(db, seller, fy) {
  const series = `${seller.prefix}/${fy}`,
    next =
      db
        .prepare("SELECT next_number n FROM invoice_sequences WHERE series=?")
        .get(series)?.n || 1;
  if (next > 99999)
    fail(
      "This invoice series is full. Configure a new prefix in Business settings.",
    );
  return { series, next, number: `${series}/${String(next).padStart(5, "0")}` };
}
// Called only inside the caller's stock transaction. Bike and battery invoices share one legal sequence.
export function insertInvoice(
  db,
  { number, series, next, invoice, key, digest, id = randomUUID() },
) {
  db.prepare(
    "INSERT INTO invoices(id,number,request_key,body,total,paid,created,request_hash) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    id,
    number,
    key,
    JSON.stringify(invoice),
    invoice.total,
    invoice.paid,
    new Date().toISOString(),
    digest,
  );
  db.prepare(
    "INSERT INTO invoice_sequences VALUES(?,?) ON CONFLICT(series) DO UPDATE SET next_number=excluded.next_number",
  ).run(series, next + 1);
  return id;
}
