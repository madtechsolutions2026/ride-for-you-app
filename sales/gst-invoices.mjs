import { randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_HSN,
  EV_HSN,
  STATES,
  financialYear,
  validGstin,
  gstTotals,
} from "./public/gst.mjs";
import { invoicePdf } from "./invoice-pdf.mjs";
import { assertSinglePageInvoice } from "./gst-pdf.mjs";

const fail = (message) => {
  throw Object.assign(Error(message), { status: 400 });
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
const sequenceKey = (prefix, fy) => `${prefix}/${fy}`;
export const SELLER_DEFAULTS = {
  name: "RIDEFORYOU.EV MOBILITY INDIA PRIVATE LIMITED",
  address:
    "Door No. 3-76, Dayanand Nagar, Suraram, Hyderabad, Medchal Malkajgiri, Telangana - 500055",
  taxId: "36AAQCR3663P1ZG",
  stateCode: "36",
  prefix: "RFY",
  priceMode: "",
  eInvoiceMode: "unconfirmed",
  signatory: "",
};

export function upgradeGst(db, { backupPath } = {}) {
  const metaExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_meta'",
    )
    .get();
  const applied =
    metaExists &&
    db.prepare("SELECT 1 FROM app_meta WHERE key='gst-invoices-v2'").get();
  if (applied) return;
  if (backupPath) {
    mkdirSync(path.dirname(backupPath), { recursive: true });
    db.prepare("VACUUM INTO ?").run(backupPath);
    console.log(
      "GST upgrade: pre-upgrade database snapshot saved on persistent storage.",
    );
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS invoice_sequences(series TEXT PRIMARY KEY,next_number INTEGER NOT NULL CHECK(next_number>0)); CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT);",
    );
    if (
      !db
        .prepare("PRAGMA table_info(bikes)")
        .all()
        .some((c) => c.name === "hsn")
    )
      db.exec(
        `ALTER TABLE bikes ADD COLUMN hsn TEXT NOT NULL DEFAULT '${DEFAULT_HSN}'`,
      );
    if (
      !db
        .prepare("PRAGMA table_info(invoices)")
        .all()
        .some((c) => c.name === "request_hash")
    )
      db.exec("ALTER TABLE invoices ADD COLUMN request_hash TEXT");
    if (
      !db.prepare("SELECT 1 FROM app_meta WHERE key='gst-invoices-v2'").get()
    ) {
      const settings = JSON.parse(
        db.prepare("SELECT body FROM settings WHERE id=1").get().body,
      );
      const knownSeller =
        !settings.name ||
        ["Ride For You", SELLER_DEFAULTS.name].includes(settings.name);
      for (const [key, value] of Object.entries(SELLER_DEFAULTS)) {
        if (["name", "address", "taxId"].includes(key) && !knownSeller)
          continue;
        if (
          !settings[key] ||
          (key === "name" && settings.name === "Ride For You")
        )
          settings[key] = value;
      }
      if (settings.taxId) settings.stateCode = settings.taxId.slice(0, 2);
      db.prepare("UPDATE settings SET body=? WHERE id=1").run(
        JSON.stringify(settings),
      );
      db.prepare(
        "INSERT INTO app_meta VALUES('gst-invoices-v2','enabled')",
      ).run();
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function gstInvoiceRoutes(db, app, { text, money, root }) {
  const settings = () =>
    JSON.parse(db.prepare("SELECT body FROM settings WHERE id=1").get().body);
  const nextNumber = (seller, fy) =>
    db
      .prepare("SELECT next_number n FROM invoice_sequences WHERE series=?")
      .get(sequenceKey(seller.prefix, fy))?.n || 1;
  const invoiceNumber = (seller, fy) =>
    `${seller.prefix}/${fy}/${String(nextNumber(seller, fy)).padStart(5, "0")}`;
  const previewHash = (invoice, number) =>
    createHash("sha256")
      .update(JSON.stringify(stable({ invoice, number })))
      .digest("hex");
  function sellerCheck(seller) {
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
  app.get("/api/state", (_req, res) => {
    const seller = settings(),
      fy = financialYear(today());
    res.json({
      settings: seller,
      numbering: {
        financialYear: fy,
        nextNumber: nextNumber(seller, fy),
        example: invoiceNumber(seller, fy),
      },
      bikes: db.prepare("SELECT * FROM bikes ORDER BY created DESC").all(),
      invoices: db
        .prepare("SELECT * FROM invoices ORDER BY created DESC")
        .all()
        .map((row) => ({ ...row, body: JSON.parse(row.body) })),
    });
  });
  app.put("/api/settings", (req, res) => {
    const body = req.body,
      seller = {};
    for (const key of [
      "name",
      "address",
      "phone",
      "email",
      "taxId",
      "prefix",
      "footer",
      "bank",
      "signatory",
    ])
      seller[key] = text(
        body[key],
        key,
        ["address", "footer", "bank"].includes(key) ? 1500 : 150,
        ["name", "address", "taxId", "prefix"].includes(key),
      );
    seller.taxId = seller.taxId.toUpperCase();
    seller.prefix = seller.prefix.toUpperCase();
    seller.stateCode = String(body.stateCode || seller.taxId.slice(0, 2));
    seller.priceMode = body.priceMode || "";
    seller.eInvoiceMode = body.eInvoiceMode || "unconfirmed";
    seller.logo = true;
    sellerCheck(seller);
    if (!["", "inclusive", "exclusive"].includes(seller.priceMode))
      fail("Choose a valid default price basis.");
    if (
      !["unconfirmed", "not_required", "required"].includes(seller.eInvoiceMode)
    )
      fail("Choose the B2B e-invoicing status.");
    const fy = financialYear(today()),
      existing = nextNumber(seller, fy);
    const requested =
      body.nextNumber === undefined || body.nextNumber === ""
        ? existing
        : Number(body.nextNumber);
    if (
      !Number.isInteger(requested) ||
      requested < existing ||
      requested > 99999
    )
      fail(
        `Next invoice number must be between ${existing} and 99999. Issued numbers cannot be reused.`,
      );
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE settings SET body=? WHERE id=1").run(
        JSON.stringify(seller),
      );
      db.prepare(
        "INSERT INTO invoice_sequences VALUES(?,?) ON CONFLICT(series) DO UPDATE SET next_number=excluded.next_number",
      ).run(sequenceKey(seller.prefix, fy), requested);
      db.exec("COMMIT");
      res.json({ ok: true });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
  const saveBike = (req, res, id) => {
    const body = req.body,
      old = id ? db.prepare("SELECT * FROM bikes WHERE id=?").get(id) : null;
    if (id && !old) return res.status(404).json({ error: "Bike not found." });
    if (old?.status === "sold")
      fail(
        "Sold bikes cannot be edited. Their invoice preserves the original details.",
      );
    const hsn = text(body.hsn || old?.hsn || DEFAULT_HSN, "HSN", 8);
    if (!EV_HSN[hsn])
      fail(
        "Select an HSN for a complete electric two-wheeler. This workspace does not classify separate batteries, chargers or parts.",
      );
    const values = [
      text(body.model, "model", 100),
      text(body.brand, "brand", 100),
      text(body.color, "colour", 60, false),
      text(body.vin, "chassis/frame number", 100).toUpperCase(),
      text(body.battery, "battery/serial", 100, false),
      money(body.cost, "purchase cost"),
      money(body.price, "selling price"),
      text(body.notes, "notes", 1500, false),
      hsn,
    ];
    if (id)
      db.prepare(
        "UPDATE bikes SET model=?,brand=?,color=?,vin=?,battery=?,cost=?,price=?,notes=?,hsn=? WHERE id=?",
      ).run(...values, id);
    else
      db.prepare(
        "INSERT INTO bikes(id,model,brand,color,vin,battery,cost,price,notes,hsn,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      ).run(randomUUID(), ...values, new Date().toISOString());
    res.json({ ok: true });
  };
  app.post("/api/bikes", (req, res) => saveBike(req, res));
  app.put("/api/bikes/:id", (req, res) => saveBike(req, res, req.params.id));

  function build(body) {
    const seller = settings();
    sellerCheck(seller);
    const date = text(body.date, "invoice date", 10);
    let fy;
    try {
      fy = financialYear(date);
    } catch (error) {
      fail(error.message);
    }
    if (date > today() || date < "2017-07-01")
      fail("Invoice date must be a valid past or current GST date.");
    const customer = {
      name: text(body.name, "customer name", 150),
      phone: text(body.phone, "customer phone", 30),
      address: text(body.address, "customer address", 1000),
      taxId: text(body.taxId, "customer GSTIN", 15, false).toUpperCase(),
      stateCode: String(body.customerState || ""),
    };
    if (!STATES[customer.stateCode])
      fail("Choose the customer's billing state.");
    if (
      customer.taxId &&
      (!validGstin(customer.taxId) ||
        customer.taxId.slice(0, 2) !== customer.stateCode)
    )
      fail("Customer GSTIN must be valid and match the billing state.");
    if (customer.taxId && seller.eInvoiceMode !== "not_required")
      fail(
        seller.eInvoiceMode === "required"
          ? "This B2B invoice requires an IRN. IRP integration is not configured; use your accountant's e-invoicing process."
          : "Confirm B2B e-invoicing applicability in Business settings with your accountant before issuing to a GST-registered buyer.",
      );
    if (body.reverseCharge || body.export || body.sez)
      fail("This workflow supports regular domestic EV sales only.");
    const priceMode = body.priceMode;
    if (body.taxRate !== undefined && Number(body.taxRate) !== 5)
      fail("Complete EV sales use the configured 5% GST rate.");
    if (
      !Array.isArray(body.lines) ||
      !body.lines.length ||
      body.lines.length > 20
    )
      fail("Choose 1-20 bikes.");
    if (new Set(body.lines.map((line) => line.id)).size !== body.lines.length)
      fail("A bike cannot appear twice.");
    const input = body.lines.map((line) => {
      const bike = db.prepare("SELECT * FROM bikes WHERE id=?").get(line.id);
      if (!bike || bike.status !== "available")
        fail("One of these bikes is no longer available.");
      const salePrice = money(line.price, "sale price");
      if (!salePrice) fail("Bike sale price must be greater than zero.");
      return { ...bike, salePrice };
    });
    let totals;
    try {
      totals = gstTotals(
        input,
        money(body.discount || 0, "discount"),
        priceMode,
        seller.stateCode,
        String(body.placeOfSupply || ""),
      );
    } catch (error) {
      fail(error.message);
    }
    const paid = money(body.paid || 0, "amount received");
    if (paid > totals.total)
      fail("Amount received cannot exceed the invoice total.");
    const method = text(body.method, "payment method", 30);
    if (
      !["Bank transfer", "UPI", "Cash", "Not received"].includes(method) ||
      (method === "Not received" && paid)
    )
      fail("Select a payment method matching the amount received.");
    const warranty = {};
    for (const key of [
      "vehicle",
      "battery",
      "motor",
      "charger",
      "provider",
      "terms",
    ])
      warranty[key] = text(
        body["warranty" + key[0].toUpperCase() + key.slice(1)],
        "warranty " + key,
        key === "terms" ? 1500 : 150,
        false,
      );
    const hasWarranty = Object.values(warranty).some(Boolean);
    if (body.warrantyStart && !hasWarranty)
      fail("Enter the warranty coverage or terms along with its start date.");
    if (hasWarranty) {
      warranty.startDate = text(
        body.warrantyStart || date,
        "warranty start date",
        10,
      );
      try {
        financialYear(warranty.startDate);
      } catch {
        fail("Choose a valid warranty start date.");
      }
    }
    const invoice = {
      version: 2,
      seller,
      customer,
      date,
      financialYear: fy,
      ...totals,
      paid,
      balance: totals.total - paid,
      method,
      salesperson: text(body.salesperson, "salesperson", 100, false),
      notes: text(body.notes, "notes", 1500, false),
      deliveryAddress: text(
        body.deliveryAddress || customer.address,
        "delivery address",
        1000,
      ),
      reverseCharge: false,
      warranty: hasWarranty ? warranty : null,
    };
    assertSinglePageInvoice(invoice, root);
    return invoice;
  }
  app.post("/api/invoices/preview", (req, res) => {
    const invoice = build(req.body),
      number = invoiceNumber(invoice.seller, invoice.financialYear);
    res.json({ number, invoice, previewHash: previewHash(invoice, number) });
  });
  app.post("/api/invoices/preview/pdf", (req, res) => {
    const invoice = build(req.body);
    invoice.draft = true;
    invoicePdf(
      res,
      {
        number: invoiceNumber(invoice.seller, invoice.financialYear),
        body: JSON.stringify(invoice),
      },
      root,
    );
  });
  app.post("/api/invoices", (req, res) => {
    const body = req.body,
      key = text(body.requestKey, "request key", 80);
    const hash = createHash("sha256")
      .update(JSON.stringify(stable(body)))
      .digest("hex");
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = db
        .prepare("SELECT id,request_hash FROM invoices WHERE request_key=?")
        .get(key);
      if (previous) {
        db.exec("ROLLBACK");
        if (previous.request_hash !== hash)
          return res.status(409).json({
            error:
              "This request was already used for different invoice details. Reload and review the saved invoice.",
          });
        return res.json({ id: previous.id });
      }
      if (body.issueConfirmed !== true)
        fail(
          "Review the GST basis, HSN, place of supply and invoice number, then confirm issue.",
        );
      const invoice = build(body),
        seller = invoice.seller,
        fy = invoice.financialYear,
        seq = nextNumber(seller, fy);
      if (seq > 99999)
        fail(
          "This invoice series is full. Configure a new prefix in Business settings.",
        );
      const number = invoiceNumber(seller, fy),
        id = randomUUID();
      if (body.previewHash !== previewHash(invoice, number)) {
        db.exec("ROLLBACK");
        return res.status(409).json({
          error:
            "Invoice details or numbering changed since review. Review the invoice again before issuing.",
        });
      }
      for (const line of invoice.lines)
        if (
          !db
            .prepare(
              "UPDATE bikes SET status='sold' WHERE id=? AND status='available'",
            )
            .run(line.id).changes
        )
          fail("Bike was already sold.");
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
        hash,
      );
      db.prepare(
        "INSERT INTO invoice_sequences VALUES(?,?) ON CONFLICT(series) DO UPDATE SET next_number=excluded.next_number",
      ).run(sequenceKey(seller.prefix, fy), seq + 1);
      for (const line of invoice.lines)
        db.prepare("INSERT INTO invoice_bikes VALUES(?,?)").run(id, line.id);
      db.exec("COMMIT");
      res.json({ id });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}
