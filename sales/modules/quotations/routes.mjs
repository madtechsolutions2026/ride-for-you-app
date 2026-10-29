import { randomUUID } from "node:crypto";
import { fail, text, money, today } from "../../core/validation.mjs";
import { transaction } from "../../core/transactions.mjs";
import {
  fingerprint,
  getSeller,
  checkSeller,
  customerDetails,
  documentDate,
} from "../../core/documents.mjs";
import { financialYear, gstTotals } from "../../public/gst.mjs";
import { assertSinglePageInvoice, gstInvoicePdf } from "../../gst-pdf.mjs";
export function convertibleQuotation(db, id, bikeIds) {
  const row = db.prepare("SELECT * FROM quotations WHERE id=?").get(id);
  if (!row) fail("Quotation not found.", 404);
  const body = JSON.parse(row.body);
  if (!["issued", "accepted"].includes(row.status) || body.validUntil < today())
    fail(
      "This quotation is expired, cancelled or already converted. Create a new quotation before invoicing.",
      409,
    );
  if (bikeIds.length !== 1 || bikeIds[0] !== body.lines[0].id)
    fail("The selected bike does not match this quotation.");
  return { ...row, body };
}
export function linkQuotation(db, id, invoiceId) {
  if (
    id &&
    !db
      .prepare(
        "UPDATE quotations SET status='converted',invoice_id=?,version=version+1,updated=? WHERE id=? AND status IN ('issued','accepted') AND invoice_id IS NULL",
      )
      .run(invoiceId, new Date().toISOString(), id).changes
  )
    fail("This quotation was already converted or cancelled.", 409);
}
export function quotationRoutes(db, app, { root }) {
  const numbering = (fy) => {
    const n =
      db
        .prepare("SELECT next_number n FROM quotation_sequences WHERE fy=?")
        .get(fy)?.n || 1;
    if (n > 99999)
      fail("The quotation sequence for this financial year is full.");
    return { next: n, number: `QUO/${fy}/${String(n).padStart(5, "0")}` };
  };
  function build(body) {
    const seller = getSeller(db);
    checkSeller(seller);
    const customer = customerDetails(body, { seller, quotation: true }),
      date = documentDate(body.date, "quotation date"),
      validUntil = text(body.validUntil, "valid until", 10);
    try {
      financialYear(validUntil);
    } catch {
      fail("Choose a valid quotation expiry date.");
    }
    if (validUntil < date)
      fail("Quotation validity cannot end before its date.");
    const bike = db
      .prepare("SELECT * FROM bikes WHERE id=?")
      .get(text(body.bikeId, "bike", 80));
    if (!bike || bike.status !== "available")
      fail("Choose a bike currently available in inventory.", 409);
    const salePrice = money(body.price, "quotation price");
    if (!salePrice) fail("Quotation price must be greater than zero.");
    let totals;
    try {
      totals = gstTotals(
        [{ ...bike, kind: "bike", salePrice }],
        money(body.discount || 0, "discount"),
        body.priceMode,
        seller.stateCode,
        String(body.placeOfSupply),
      );
    } catch (e) {
      fail(e.message);
    }
    const warranty = {};
    for (const key of [
      "vehicle",
      "battery",
      "motor",
      "controller",
      "charger",
      "provider",
      "terms",
    ])
      warranty[key] = text(
        body["warranty" + key[0].toUpperCase() + key.slice(1)],
        "warranty " + key,
        key === "terms" ? 1000 : 150,
        false,
      );
    const invoice = {
      version: 2,
      documentType: "quotation",
      saleType: "bike",
      seller,
      customer,
      date,
      validUntil,
      financialYear: financialYear(date),
      ...totals,
      paid: 0,
      balance: totals.total,
      method: "As agreed at sale",
      deliveryAddress: text(
        body.deliveryAddress || customer.address,
        "delivery address",
        1000,
      ),
      salesperson: text(body.salesperson, "prepared by", 100, false),
      notes: text(body.notes, "quotation terms", 1000, false),
      paymentTerms: text(body.paymentTerms, "payment terms", 500, false),
      warranty: Object.values(warranty).some(Boolean) ? warranty : null,
    };
    assertSinglePageInvoice(invoice, root);
    return invoice;
  }
  app.get("/api/quotations", (_req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM quotations ORDER BY created DESC")
        .all()
        .map((row) => ({ ...row, body: JSON.parse(row.body) })),
    ),
  );
  app.get("/api/quotations/:id", (req, res) => {
    const row = db
      .prepare("SELECT * FROM quotations WHERE id=?")
      .get(req.params.id);
    if (!row) fail("Quotation not found.", 404);
    res.json({ ...row, body: JSON.parse(row.body) });
  });
  app.post("/api/quotations/preview", (req, res) => {
    const invoice = build(req.body),
      n = numbering(invoice.financialYear);
    res.json({
      invoice,
      number: n.number,
      previewHash: fingerprint({ invoice, number: n.number }),
    });
  });
  app.post("/api/quotations", (req, res) =>
    res.json(
      transaction(db, () => {
        const body = req.body,
          key = text(body.requestKey, "request key", 80),
          digest = fingerprint(body),
          previous = db
            .prepare("SELECT * FROM quotations WHERE request_key=?")
            .get(key);
        if (previous) {
          if (previous.request_hash !== digest)
            fail(
              "This quotation request was already used with different details.",
              409,
            );
          return { id: previous.id };
        }
        const invoice = build(body),
          n = numbering(invoice.financialYear);
        if (body.previewHash !== fingerprint({ invoice, number: n.number }))
          fail(
            "Quotation details or numbering changed. Review again before saving.",
            409,
          );
        const id = randomUUID(),
          now = new Date().toISOString();
        db.prepare(
          "INSERT INTO quotations(id,number,request_key,request_hash,body,created,updated) VALUES(?,?,?,?,?,?,?)",
        ).run(id, n.number, key, digest, JSON.stringify(invoice), now, now);
        db.prepare(
          "INSERT INTO quotation_sequences VALUES(?,?) ON CONFLICT(fy) DO UPDATE SET next_number=excluded.next_number",
        ).run(invoice.financialYear, n.next + 1);
        return { id };
      }),
    ),
  );
  app.put("/api/quotations/:id/status", (req, res) =>
    res.json(
      transaction(db, () => {
        const row = db
          .prepare("SELECT * FROM quotations WHERE id=?")
          .get(req.params.id);
        if (!row) fail("Quotation not found.", 404);
        if (req.body.version !== row.version)
          fail("Quotation status changed. Reload before saving.", 409);
        if (
          !["issued", "accepted"].includes(row.status) ||
          !["accepted", "cancelled"].includes(req.body.status) ||
          row.status === req.body.status
        )
          fail("This quotation status change is not allowed.");
        if (
          req.body.status === "accepted" &&
          JSON.parse(row.body).validUntil < today()
        )
          fail("An expired quotation cannot be accepted.");
        db.prepare(
          "UPDATE quotations SET status=?,version=version+1,updated=? WHERE id=?",
        ).run(req.body.status, new Date().toISOString(), row.id);
        return { ok: true };
      }),
    ),
  );
  app.get("/api/quotations/:id/pdf", (req, res) => {
    const row = db
      .prepare("SELECT * FROM quotations WHERE id=?")
      .get(req.params.id);
    if (!row) fail("Quotation not found.", 404);
    gstInvoicePdf(res, row, root, { inline: req.query.inline === "1" });
  });
}
