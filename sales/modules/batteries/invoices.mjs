import { fail, text, money } from "../../core/validation.mjs";
import { transaction } from "../../core/transactions.mjs";
import {
  fingerprint,
  getSeller,
  checkSeller,
  customerDetails,
  documentDate,
  receiptDetails,
  invoiceNumbering,
  insertInvoice,
} from "../../core/documents.mjs";
import { financialYear } from "../../public/gst.mjs";
import { productTotals } from "../../public/domain/totals.mjs";
import { gstRate, hsnCode } from "./routes.mjs";
import { batteryEvent } from "./stock.mjs";
import { invoiceDeletion } from "../invoices/deletion.mjs";
import { assertSinglePageInvoice, gstInvoicePdf } from "../../gst-pdf.mjs";
export function batteryInvoiceRoutes(db, app, { root }) {
  function build(body) {
    const seller = getSeller(db);
    checkSeller(seller);
    const date = documentDate(body.date),
      customer = customerDetails(body, { seller });
    if (
      !Array.isArray(body.lines) ||
      !body.lines.length ||
      body.lines.length > 20 ||
      new Set(body.lines.map((l) => l.id)).size !== body.lines.length
    )
      fail("Select 1–20 different batteries.");
    const input = body.lines.map((line) => {
      const pack = db
        .prepare("SELECT * FROM batteries WHERE id=?")
        .get(line.id);
      if (!pack || pack.status !== "available")
        fail("One of these batteries is no longer available.", 409);
      const price = money(line.price, "battery selling price");
      if (!price) fail("The battery selling price must be greater than zero.");
      return {
        ...pack,
        kind: "battery",
        salePrice: price,
        hsn: hsnCode(line.hsn === undefined ? pack.hsn : line.hsn),
        gstRate: gstRate(
          line.gstPercent === undefined
            ? pack.gst_bps == null
              ? ""
              : pack.gst_bps / 100
            : line.gstPercent,
        ),
      };
    });
    if (body.taxConfirmed !== true)
      fail(
        "Confirm the HSN and GST rate entered for these separate battery sales.",
      );
    let totals;
    try {
      totals = productTotals(
        input,
        money(body.discount || 0, "discount"),
        body.priceMode,
        seller.stateCode,
        String(body.placeOfSupply),
      );
    } catch (e) {
      fail(e.message);
    }
    const invoice = {
      version: 2,
      documentType: "invoice",
      saleType: "battery",
      seller,
      customer,
      date,
      financialYear: financialYear(date),
      deliveryAddress: text(
        body.deliveryAddress || customer.address,
        "delivery address",
        1000,
      ),
      salesperson: text(body.salesperson, "salesperson", 100, false),
      notes: text(body.notes, "invoice notes", 1500, false),
      ...totals,
      ...receiptDetails(body, totals.total),
    };
    assertSinglePageInvoice(invoice, root);
    return invoice;
  }
  const review = (body) => {
    const invoice = build(body),
      sequence = invoiceNumbering(db, invoice.seller, invoice.financialYear);
    return {
      invoice,
      ...sequence,
      previewHash: fingerprint({ invoice, number: sequence.number }),
    };
  };
  app.post("/api/battery-invoices/preview", (req, res) =>
    res.json(review(req.body)),
  );
  app.post("/api/battery-invoices/preview/pdf", (req, res) => {
    const r = review(req.body);
    gstInvoicePdf(
      res,
      { number: r.number, body: JSON.stringify({ ...r.invoice, draft: true }) },
      root,
    );
  });
  app.post("/api/battery-invoices", (req, res) =>
    res.json(
      transaction(db, () => {
        const body = req.body,
          key = text(body.requestKey, "request key", 80),
          digest = fingerprint(body),
          existing = db
            .prepare("SELECT id,request_hash FROM invoices WHERE request_key=?")
            .get(key);
        if (existing) {
          if (invoiceDeletion(db, existing.id))
            fail(
              "This request belongs to a deleted invoice. Start and review a new battery invoice.",
              409,
            );
          if (existing.request_hash !== digest)
            fail(
              "This invoice request was already used with different details.",
              409,
            );
          return { id: existing.id };
        }
        if (body.issueConfirmed !== true)
          fail("Review and confirm this battery invoice before issuing.");
        const r = review(body);
        if (body.previewHash !== r.previewHash)
          fail(
            "Battery details or invoice numbering changed. Review this invoice again.",
            409,
          );
        for (const line of r.invoice.lines)
          if (
            !db
              .prepare(
                "UPDATE batteries SET status='sold',hsn=?,gst_bps=?,version=version+1,updated=? WHERE id=? AND status='available'",
              )
              .run(line.hsn, line.gstRate, new Date().toISOString(), line.id)
              .changes
          )
            fail("A battery was already sold or installed.", 409);
        const id = insertInvoice(db, { ...r, invoice: r.invoice, key, digest });
        for (const line of r.invoice.lines) {
          db.prepare("INSERT INTO invoice_batteries VALUES(?,?)").run(
            id,
            line.id,
          );
          batteryEvent(db, line.id, "sold", {
            invoiceId: id,
            number: r.number,
            customer: r.invoice.customer,
            serial: line.serial,
            warranty: line.warranty,
          });
        }
        return { id };
      }),
    ),
  );
}
