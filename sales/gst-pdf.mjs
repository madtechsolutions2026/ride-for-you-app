import PDFDocument from "pdfkit";
import path from "node:path";
import { stateName } from "./public/gst.mjs";
import { taxRows } from "./public/domain/totals.mjs";

const GREEN = "#155232",
  INK = "#22382b",
  MUTED = "#53645a",
  RULE = "#cfdad2",
  PALE = "#f2f6f2";
const money = (n) =>
  ((n || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const clean = (value) =>
  String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .trim();
const tooLong = () =>
  Object.assign(
    new Error(
      "This invoice is too long for one legible A4 page. Shorten the notes or warranty wording, or use fewer bikes on this invoice, then review it again. This request has not changed stock or issued an invoice.",
    ),
    { status: 422 },
  );

function documentFor(invoice, root) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 30,
    bufferPages: true,
    info: {
      Title: `${invoice.documentType === "quotation" ? "Quotation" : invoice.draft ? "Draft" : invoice.version === 2 ? "Tax invoice" : "Sales invoice"}`,
      Author: invoice.seller.name,
    },
  });
  doc.registerFont("R", path.join(root, "assets/regular.ttf"));
  doc.registerFont("B", path.join(root, "assets/bold.ttf"));
  return doc;
}

// Measure every wrapped field before drawing. No text is clipped or discarded.
function planPage(doc, b, number, root, copy, p) {
  const ops = [],
    left = 30,
    width = 535.28,
    right = left + width,
    gap = p.gap;
  const measure = (value, w, size = p.body, bold = false) =>
    doc
      .font(bold ? "B" : "R")
      .fontSize(size)
      .heightOfString(clean(value), { width: w, lineGap: p.lineGap });
  const text = (
    value,
    x,
    y,
    w,
    size = p.body,
    bold = false,
    color = INK,
    align = "left",
  ) => {
    value = clean(value);
    if (!value) return 0;
    const h = measure(value, w, size, bold);
    ops.push(() =>
      doc
        .font(bold ? "B" : "R")
        .fontSize(size)
        .fillColor(color)
        .text(value, x, y, { width: w, lineGap: p.lineGap, align }),
    );
    return h;
  };
  const rect = (x, y, w, h, color = PALE) =>
    ops.push(() => doc.rect(x, y, w, h).fill(color));
  const rule = (y) =>
    ops.push(() =>
      doc
        .moveTo(left, y)
        .lineTo(right, y)
        .lineWidth(0.6)
        .strokeColor(RULE)
        .stroke(),
    );
  const gst = b.version === 2,
    quotation = b.documentType === "quotation",
    battery = b.saleType === "battery",
    draft = Boolean(b.draft);
  let y = 30,
    sy = y;
  ops.push(() =>
    doc.image(path.join(root, "public/logo.png"), left, 30, { fit: [54, 54] }),
  );
  sy +=
    text(b.seller.name, left + 67, sy, width - 67, p.title, true, GREEN) + 3;
  for (const value of [
    b.seller.address,
    [
      b.seller.taxId ? "GSTIN: " + b.seller.taxId : "",
      b.seller.stateCode ? stateName(b.seller.stateCode) : "",
    ]
      .filter(Boolean)
      .join(" | "),
    [b.seller.phone, b.seller.email].filter(Boolean).join(" | "),
  ].filter(Boolean))
    sy += text(value, left + 67, sy, width - 67, p.body, false, MUTED) + 2;
  y = Math.max(y + 54, sy) + gap;
  rule(y);
  y += gap;
  const title = quotation
    ? b.quotationStatus === "cancelled"
      ? "CANCELLED QUOTATION"
      : "QUOTATION"
    : draft
      ? "DRAFT - NOT ISSUED"
      : gst
        ? "TAX INVOICE"
        : "SALES INVOICE";
  const titleHeight = Math.max(
    text(title, left, y, 270, p.title, true, GREEN),
    text(number, left + 285, y, width - 285, 10, true, INK, "right"),
  );
  y += titleHeight + 3;
  const copyLabel = quotation
    ? "PRICE OFFER - NOT A TAX INVOICE"
    : draft
      ? "FOR REVIEW ONLY - NOT VALID FOR SALE"
      : {
          original: "ORIGINAL FOR RECIPIENT",
          transporter: "DUPLICATE FOR TRANSPORTER",
          supplier: "TRIPLICATE FOR SUPPLIER",
        }[copy] || "ORIGINAL FOR RECIPIENT";
  const dateLine = `Date: ${b.date}${quotation ? " | Valid until: " + b.validUntil : b.financialYear ? " | FY " + b.financialYear : ""}`;
  y +=
    Math.max(
      text(copyLabel, left, y, 290, 7.5, true, MUTED),
      text(dateLine, left + 300, y, width - 300, 7.5, false, MUTED, "right"),
    ) + gap;

  const cardWidth = (width - 12) / 2,
    inner = cardWidth - 16;
  const buyer = [
    b.customer.name,
    b.customer.address,
    [
      b.customer.phone ? "Phone: " + b.customer.phone : "",
      b.customer.stateCode ? stateName(b.customer.stateCode) : "",
    ]
      .filter(Boolean)
      .join(" | "),
    b.customer.taxId
      ? "GSTIN: " + b.customer.taxId
      : gst
        ? "Unregistered customer (B2C)"
        : "",
  ].filter(Boolean);
  const delivery = [
    b.deliveryAddress && b.deliveryAddress !== b.customer.address
      ? b.deliveryAddress
      : "Same as billing address",
    gst
      ? `Place of supply: ${stateName(b.placeOfSupply)} | Reverse charge: No`
      : "",
    quotation
      ? b.paymentTerms
        ? "Payment terms: " + b.paymentTerms
        : "Payment terms: As agreed at sale"
      : `Payment: ${b.method} | ${b.balance === 0 ? "Paid" : b.paid ? "Partially paid" : "Unpaid"}`,
    b.salesperson ? "Salesperson: " + b.salesperson : "",
    b.quotationNumber ? "Quotation reference: " + b.quotationNumber : "",
  ].filter(Boolean);
  const cardHeight =
    Math.max(
      ...[buyer, delivery].map((values) =>
        values.reduce(
          (sum, value, index) =>
            sum + measure(value, inner, p.body, index === 0) + 2,
          0,
        ),
      ),
    ) + 24;
  for (const [index, values] of [buyer, delivery].entries()) {
    const x = left + index * (cardWidth + 12);
    rect(x, y, cardWidth, cardHeight);
    text(
      index ? "DELIVERY & SUPPLY" : quotation ? "PREPARED FOR" : "BILLED TO",
      x + 8,
      y + 7,
      inner,
      7.5,
      true,
      MUTED,
    );
    let cy = y + 20;
    for (const [n, value] of values.entries())
      cy += text(value, x + 8, cy, inner, p.body, n === 0 && !index) + 2;
  }
  y += cardHeight + gap;
  text(
    `${battery ? "BATTERY" : "VEHICLE"} DETAILS - ALL AMOUNTS IN INR | ${gst ? (b.priceMode === "inclusive" ? "PRICES INCLUDE GST" : "GST ADDED TO PRICES") : "QUOTED PRICES"}`,
    left,
    y,
    width,
    7.5,
    true,
    MUTED,
  );
  y += 12;
  const columns = [203, 35, 75, 75, 70, 77.28],
    xs = [left];
  for (let i = 0; i < columns.length - 1; i++) xs.push(xs[i] + columns[i]);
  rect(left, y, width, 23, GREEN);
  const headers = [
    battery ? "BATTERY / IDENTIFICATION" : "VEHICLE / IDENTIFICATION",
    "QTY",
    "UNIT PRICE",
    gst ? "TAXABLE" : "AMOUNT",
    gst ? (b.taxRate == null ? "GST" : `GST (${b.taxRate / 100}%)`) : "TAX",
    gst ? "LINE TOTAL" : "LINE AMOUNT",
  ];
  headers.forEach((label, i) =>
    text(
      label,
      xs[i] + 5,
      y + 7,
      columns[i] - 10,
      7.5,
      true,
      "#fff",
      i > 1 ? "right" : "left",
    ),
  );
  y += 23;
  for (const [index, item] of b.lines.entries()) {
    const model = clean(item.brand + " " + item.model);
    const details = [
      battery ? "Battery serial: " + item.serial : "Chassis: " + item.vin,
      [
        item.hsn ? "HSN: " + item.hsn : "",
        item.color ? "Colour: " + item.color : "",
      ]
        .filter(Boolean)
        .join(" | "),
      ...(battery
        ? [
            [item.chemistry, item.voltage, item.capacity]
              .filter(Boolean)
              .join(" | "),
            item.warranty ? "Warranty: " + item.warranty : "",
            item.provider ? "Warranty provider: " + item.provider : "",
            item.warranty_terms ? "Warranty terms: " + item.warranty_terms : "",
            `GST rate: ${item.gstRate / 100}%`,
          ]
        : gst
          ? ["battery", "motor", "controller", "charger"].map(
              (type) =>
                `${type[0].toUpperCase() + type.slice(1)}: ${item[type] || "Not recorded"}`,
            )
          : [item.battery ? "Battery / motor: " + item.battery : ""]),
      item.discount ? "Line discount: INR " + money(item.discount) : "",
    ].filter(Boolean);
    const descHeight =
      measure(model, columns[0] - 10, p.body + 0.5, true) +
      details.reduce(
        (sum, value) => sum + measure(value, columns[0] - 10, 7.5) + 1,
        0,
      ) +
      2;
    const taxes = gst
      ? b.intraState
        ? `CGST${battery ? ` ${item.gstRate / 200}%` : ""}: ${money(item.cgst)}\n${b.stateTaxLabel}${battery ? ` ${item.gstRate / 200}%` : ""}: ${money(item.sgst)}`
        : `IGST${battery ? ` ${item.gstRate / 100}%` : ""}: ${money(item.igst)}`
      : "See totals";
    const cells = [
      "1\nNOS",
      money(item.salePrice),
      money(gst ? item.taxable : item.salePrice),
      taxes,
      money(gst ? item.total : item.salePrice),
    ];
    const rowHeight =
      Math.max(
        descHeight,
        ...cells.map((value, i) =>
          measure(value, columns[i + 1] - 10, i === 3 ? 7.5 : p.body, i === 4),
        ),
      ) + 10;
    if (index % 2 === 0) rect(left, y, width, rowHeight, "#f7faf7");
    let cy = y + 5;
    cy += text(model, left + 5, cy, columns[0] - 10, p.body + 0.5, true) + 2;
    for (const detail of details)
      cy += text(detail, left + 5, cy, columns[0] - 10, 7.5, false, MUTED) + 1;
    cells.forEach((value, i) =>
      text(
        value,
        xs[i + 1] + 5,
        y + 6,
        columns[i + 1] - 10,
        i === 3 ? 7.5 : p.body,
        i === 4,
        INK,
        i === 0 ? "center" : "right",
      ),
    );
    y += rowHeight;
    rule(y);
  }
  y += gap;

  const notesWidth = 302,
    totalsX = left + 320,
    totalsWidth = width - 320;
  let ly = y,
    ty = y + 7;
  const note = (label, value) => {
    if (!value) return;
    ly += text(label, left, ly, notesWidth, 7.5, true, MUTED) + 3;
    ly += text(value, left, ly, notesWidth, p.body) + gap;
  };
  if (gst) {
    note(
      "PRICE BASIS",
      b.priceMode === "inclusive"
        ? "GST is included in the discounted quoted price."
        : "GST is added after discount.",
    );
    if (b.warranty) {
      ly +=
        text("WARRANTY DETAILS", left, ly, notesWidth, 7.5, true, MUTED) + 4;
      const fields = [
        ["Vehicle", b.warranty.vehicle],
        ["Battery", b.warranty.battery],
        ["Motor", b.warranty.motor],
        ["Controller", b.warranty.controller],
        ["Charger", b.warranty.charger],
        ["Provided by", b.warranty.provider],
        ["Start date", b.warranty.startDate],
      ].filter(([, value]) => value);
      const w = (notesWidth - 12) / 2;
      for (let i = 0; i < fields.length; i += 2) {
        let h = 0;
        for (let j = 0; j < 2 && fields[i + j]; j++) {
          const [label, value] = fields[i + j],
            x = left + j * (w + 12);
          const lh = text(label, x, ly, w, 7.5, true, MUTED);
          const vh = text(value, x, ly + lh + 2, w, p.body);
          h = Math.max(h, lh + vh + 2);
        }
        ly += h + 4;
      }
      if (b.warranty.terms)
        ly += text(b.warranty.terms, left, ly, notesWidth, p.body) + gap;
      ly += 2;
    }
  }
  note("PAYMENT / BANK DETAILS", b.seller.bank);
  if (quotation)
    note(
      "QUOTATION CONDITIONS",
      "Price offer only. Subject to stock availability and the validity date. This quotation does not reserve stock or acknowledge payment.",
    );
  note("ADDITIONAL SALE TERMS", b.notes);
  if (b.seller.footer)
    ly += text(b.seller.footer, left, ly, notesWidth, p.body, false, MUTED) + 4;

  const metrics = [
    ["Quoted subtotal", b.subtotal],
    ["Discount", -b.discount],
    ...(gst
      ? [
          ["Taxable value", b.taxable],
          ...taxRows(b),
          ...(b.roundOff ? [["Rounding adjustment", b.roundOff]] : []),
        ]
      : [[`Tax (${b.taxRate / 100}%)`, b.tax]]),
  ];
  const metricHeights = metrics.map(
    ([label, value]) =>
      Math.max(
        measure(label, 112, p.body),
        measure(money(value), totalsWidth - 128, p.body),
      ) + 5,
  );
  const grandHeight = Math.max(
    25,
    measure(money(b.total), totalsWidth - 116, 10, true) + 12,
  );
  const paidHeight = quotation
    ? 0
    : Math.max(
        measure("Amount received", 112, p.body),
        measure(money(b.paid), totalsWidth - 128, p.body),
      ) + 8;
  const balanceHeight = quotation
    ? 0
    : Math.max(
        measure("BALANCE DUE", 105, p.body, true),
        measure(money(b.balance), totalsWidth - 121, 9.5, true),
      ) + 8;
  const totalHeight =
    metricHeights.reduce((a, n) => a + n, 0) +
    grandHeight +
    paidHeight +
    balanceHeight +
    20;
  rect(totalsX, y, totalsWidth, totalHeight);
  metrics.forEach(([label, value], i) => {
    text(label, totalsX + 8, ty, 112, p.body);
    text(
      money(value),
      totalsX + 120,
      ty,
      totalsWidth - 128,
      p.body,
      false,
      INK,
      "right",
    );
    ty += metricHeights[i];
  });
  rect(totalsX + 1, ty, totalsWidth - 2, grandHeight, GREEN);
  text(
    quotation ? "QUOTATION TOTAL" : "INVOICE TOTAL",
    totalsX + 8,
    ty + 8,
    100,
    8,
    true,
    "#fff",
  );
  text(
    money(b.total),
    totalsX + 108,
    ty + 6,
    totalsWidth - 116,
    10,
    true,
    "#fff",
    "right",
  );
  ty += grandHeight + 8;
  if (!quotation) {
    text("Amount received", totalsX + 8, ty, 112, p.body);
    text(
      money(b.paid),
      totalsX + 120,
      ty,
      totalsWidth - 128,
      p.body,
      false,
      INK,
      "right",
    );
    ty += paidHeight;
    text("BALANCE DUE", totalsX + 8, ty, 105, p.body, true);
    text(
      money(b.balance),
      totalsX + 113,
      ty,
      totalsWidth - 121,
      9.5,
      true,
      GREEN,
      "right",
    );
  }
  y = Math.max(ly, y + totalHeight) + gap + 10;
  const signatureY = y;
  ops.push(() =>
    doc
      .moveTo(left, signatureY)
      .lineTo(left + 210, signatureY)
      .strokeColor(RULE)
      .stroke(),
  );
  ops.push(() =>
    doc
      .moveTo(left + 285, signatureY)
      .lineTo(right, signatureY)
      .strokeColor(RULE)
      .stroke(),
  );
  const signatureHeight = Math.max(
    text(
      quotation ? "Customer acceptance (optional)" : "Customer acknowledgment",
      left,
      y + 6,
      220,
      7.5,
      false,
      MUTED,
    ),
    text(
      `For ${b.seller.name}\n${b.seller.signatory || "Authorised signatory"}`,
      left + 285,
      y + 6,
      width - 285,
      7.5,
      true,
      GREEN,
      "right",
    ),
  );
  return { ops, end: y + signatureHeight + 10, profile: p.name };
}

const PROFILES = [
  { name: "regular", body: 9, title: 14, lineGap: 1, gap: 8 },
  { name: "compact", body: 8, title: 12.5, lineGap: 0.6, gap: 6 },
  { name: "dense", body: 7.5, title: 12, lineGap: 0.3, gap: 5 },
];
function selectPlan(doc, b, number, root, copy) {
  for (const profile of PROFILES) {
    const plan = planPage(doc, b, number, root, copy, profile);
    if (plan.end <= 770) return plan;
  }
  throw tooLong();
}

export function assertSinglePageInvoice(invoice, root) {
  const doc = documentFor(invoice, root);
  try {
    return selectPlan(doc, invoice, "XXXXX/2627/99999", root, "original")
      .profile;
  } finally {
    doc.end();
    doc.resume();
  }
}

export function gstInvoicePdf(
  res,
  row,
  root,
  { copy = "original", inline = false } = {},
) {
  const invoice = JSON.parse(row.body),
    doc = documentFor(invoice, root);
  if (invoice.documentType === "quotation")
    invoice.quotationStatus = row.status;
  let plan;
  try {
    plan = selectPlan(doc, invoice, row.number, root, copy);
    for (const draw of plan.ops) draw();
  } catch (error) {
    doc.end();
    doc.resume();
    throw error;
  }
  if (doc.bufferedPageRange().count !== 1) {
    doc.end();
    doc.resume();
    throw tooLong();
  }
  doc
    .moveTo(30, 786)
    .lineTo(565.28, 786)
    .lineWidth(0.6)
    .strokeColor(RULE)
    .stroke();
  doc
    .font("R")
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(
      `${invoice.documentType === "quotation" ? "QUOTATION - NOT A TAX INVOICE" : invoice.draft ? "DRAFT - NOT VALID FOR SALE" : "Seller / authorised representative signature required"} | ${row.number}`,
      30,
      794,
      { width: 480, lineGap: 0 },
    );
  doc.text("1 / 1", 520, 794, { width: 45, align: "right", lineGap: 0 });
  const filename =
    (invoice.draft ? "DRAFT-" : "") +
    row.number.replace(/[^A-Za-z0-9_-]/g, "-") +
    "-" +
    copy +
    ".pdf";
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
  });
  doc.pipe(res);
  doc.end();
}
