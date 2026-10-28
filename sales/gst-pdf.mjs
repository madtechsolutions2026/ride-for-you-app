import PDFDocument from "pdfkit";
import path from "node:path";
import { stateName } from "./public/gst.mjs";
const green = "#155232",
  ink = "#22382b",
  muted = "#647268",
  rule = "#dce5de";
const cash = (n) =>
  "INR " +
  ((n || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function gstInvoicePdf(res, row, root, { copy = "original" } = {}) {
  const b = JSON.parse(row.body),
    draft = Boolean(b.draft),
    number = row.number;
  const filename =
    (draft ? "DRAFT-" : "") +
    number.replace(/[^A-Za-z0-9_-]/g, "-") +
    "-" +
    copy +
    ".pdf";
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
    info: {
      Title: `${draft ? "Draft" : "Tax invoice"} ${number}`,
      Author: b.seller.name,
    },
  });
  doc.pipe(res);
  doc.registerFont("R", path.join(root, "assets/regular.ttf"));
  doc.registerFont("B", path.join(root, "assets/bold.ttf"));
  const left = 40,
    width = 515,
    right = 555,
    bottom = 758;
  const text = (
    value,
    x,
    y,
    size = 9,
    w = width,
    bold = false,
    color = ink,
    align = "left",
  ) =>
    doc
      .font(bold ? "B" : "R")
      .fontSize(size)
      .fillColor(color)
      .text(String(value), x, y, { width: w, lineGap: 1, align });
  const height = (value, size, w, bold = false) =>
    doc
      .font(bold ? "B" : "R")
      .fontSize(size)
      .heightOfString(String(value), { width: w, lineGap: 1 });
  const line = (y) =>
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .lineWidth(0.65)
      .strokeColor(rule)
      .stroke();
  let y = 40;
  const ensure = (h) => {
    if (y + h > bottom) {
      doc.addPage();
      y = 40;
      text(
        `${draft ? "DRAFT" : "TAX INVOICE"} ${number} / CONTINUED`,
        left,
        y,
        9,
        width,
        true,
        green,
      );
      y += 25;
    }
  };
  doc.image(path.join(root, "public/logo.png"), left, y, { fit: [70, 70] });
  let sy = y;
  const nameWidth = 425;
  text(b.seller.name, 130, sy, 15, nameWidth, true, green);
  sy += height(b.seller.name, 15, nameWidth, true) + 5;
  for (const value of [
    b.seller.address,
    `GSTIN: ${b.seller.taxId}  |  ${stateName(b.seller.stateCode)}`,
    [b.seller.phone, b.seller.email].filter(Boolean).join(" | "),
  ].filter(Boolean)) {
    text(value, 130, sy, 8.5, nameWidth, false, muted);
    sy += height(value, 8.5, nameWidth) + 3;
  }
  y = Math.max(110, sy + 9);
  line(y);
  y += 15;
  text(
    draft ? "DRAFT - NOT ISSUED" : "TAX INVOICE",
    left,
    y,
    19,
    290,
    true,
    green,
  );
  text(number, 340, y + 2, 11, 215, true, ink, "right");
  y += 29;
  text(
    draft
      ? "FOR REVIEW ONLY - STOCK AND NUMBER NOT COMMITTED"
      : {
          original: "ORIGINAL FOR RECIPIENT",
          supplier: "TRIPLICATE FOR SUPPLIER",
          transporter: "DUPLICATE FOR TRANSPORTER",
        }[copy] || "ORIGINAL FOR RECIPIENT",
    left,
    y,
    7.5,
    315,
    true,
    muted,
  );
  text(
    `Date: ${b.date}  |  FY ${b.financialYear}`,
    340,
    y,
    8,
    215,
    false,
    muted,
    "right",
  );
  y += 25;
  const buyer = [
    b.customer.name,
    b.customer.address,
    stateName(b.customer.stateCode),
    "Phone: " + b.customer.phone,
    b.customer.taxId
      ? "GSTIN: " + b.customer.taxId
      : "Unregistered buyer (B2C)",
  ];
  const delivery = [
    b.deliveryAddress,
    "Place of supply: " + stateName(b.placeOfSupply),
    "Reverse charge: No",
    "Payment: " + b.method,
    "Payment status: " +
      (b.balance === 0 ? "Paid" : b.paid ? "Partially paid" : "Unpaid"),
    ...(b.salesperson ? ["Salesperson: " + b.salesperson] : []),
  ];
  const cardWidth = 250;
  const cardHeight =
    Math.max(
      ...[buyer, delivery].map((values) =>
        values.reduce((n, value) => n + height(value, 8.5, 226) + 3, 0),
      ),
    ) + 30;
  ensure(cardHeight + 12);
  for (const [index, values] of [buyer, delivery].entries()) {
    const x = left + index * 265;
    doc
      .roundedRect(x, y, cardWidth, cardHeight, 4)
      .lineWidth(0.65)
      .strokeColor(rule)
      .stroke();
    text(
      index ? "DELIVERY & SUPPLY" : "BILLED TO",
      x + 12,
      y + 12,
      7.5,
      226,
      true,
      muted,
    );
    let cy = y + 29;
    for (const [n, value] of values.entries()) {
      text(value, x + 12, cy, 8.5, 226, n === 0 && !index);
      cy += height(value, 8.5, 226, n === 0 && !index) + 3;
    }
  }
  y += cardHeight + 16;
  function tableHeader() {
    doc.rect(left, y, width, 25).fill(green);
    text("VEHICLE / HSN", left + 8, y + 8, 7.5, 227, true, "#fff");
    text("QTY", 279, y + 8, 7.5, 34, true, "#fff");
    text("QUOTED PRICE", 317, y + 8, 7, 78, true, "#fff", "right");
    text("TAXABLE", 400, y + 8, 7.5, 74, true, "#fff", "right");
    text("LINE TOTAL", 479, y + 8, 7.5, 68, true, "#fff", "right");
    y += 25;
  }
  ensure(115);
  tableHeader();
  for (const [index, item] of b.lines.entries()) {
    const model = item.brand + " " + item.model;
    const details = [
      "Chassis: " + item.vin,
      `HSN ${item.hsn}  |  GST 5%`,
      ...(item.battery ? ["Battery / motor: " + item.battery] : []),
      ...(item.color ? ["Colour: " + item.color] : []),
      `Discount: ${cash(item.discount)}`,
      b.intraState
        ? `CGST: ${cash(item.cgst)}  |  ${b.stateTaxLabel}: ${cash(item.sgst)}`
        : `IGST: ${cash(item.igst)}`,
      ...(item.roundOff ? ["Rounding: " + cash(item.roundOff)] : []),
    ];
    const rh =
      height(model, 9.5, 220, true) +
      details.reduce((n, v) => n + height(v, 7.5, 220) + 2, 0) +
      21;
    if (y + rh > bottom) {
      ensure(rh);
      tableHeader();
    }
    if (index % 2 === 0) doc.rect(left, y, width, rh).fill("#f4f8f4");
    text(model, left + 8, y + 9, 9.5, 220, true);
    let iy = y + height(model, 9.5, 220, true) + 13;
    for (const detail of details) {
      text(detail, left + 8, iy, 7.5, 220, false, muted);
      iy += height(detail, 7.5, 220) + 2;
    }
    text("1 NOS", 279, y + 11, 7.5, 34);
    text(cash(item.salePrice), 317, y + 11, 7.5, 78, false, ink, "right");
    text(cash(item.taxable), 400, y + 11, 7.5, 74, false, ink, "right");
    text(cash(item.total), 479, y + 11, 7.5, 68, true, ink, "right");
    y += rh;
    line(y);
  }
  y += 15;
  const metrics = [
    ["Quoted subtotal", b.subtotal],
    ["Discount", -b.discount],
    ["Taxable value", b.taxable],
    ...(b.intraState
      ? [
          ["CGST (2.5%)", b.cgst],
          [`${b.stateTaxLabel} (2.5%)`, b.sgst],
        ]
      : [["IGST (5%)", b.igst]]),
    ...(b.roundOff ? [["Rounding adjustment", b.roundOff]] : []),
  ];
  const summaryHeight = metrics.length * 18 + 96;
  ensure(summaryHeight);
  doc.roundedRect(300, y, 255, summaryHeight, 4).fill("#f0f5f1");
  let ty = y + 12;
  for (const [label, value] of metrics) {
    text(label, 311, ty, 8.5, 120);
    text(cash(value), 431, ty, 8.5, 112, false, ink, "right");
    ty += 18;
  }
  doc.rect(301, ty, 253, 30).fill(green);
  text("INVOICE TOTAL", 311, ty + 9, 8.5, 110, true, "#fff");
  text(cash(b.total), 421, ty + 8, 10, 122, true, "#fff", "right");
  ty += 43;
  text("Amount received", 311, ty, 8.5, 120);
  text(cash(b.paid), 431, ty, 8.5, 112, false, ink, "right");
  ty += 23;
  text("BALANCE DUE", 311, ty, 9, 110, true);
  text(cash(b.balance), 421, ty, 10, 122, true, green, "right");
  let ly = y + 2;
  const deferred = [];
  const notes = [
    [
      "PRICE BASIS",
      b.priceMode === "inclusive"
        ? "Quoted prices include GST. Tax is extracted after discount."
        : "GST is added to quoted prices after discount.",
    ],
    [
      "WARRANTY DETAILS",
      b.warranty
        ? [
            ["Vehicle", b.warranty.vehicle],
            ["Battery", b.warranty.battery],
            ["Motor", b.warranty.motor],
            ["Charger", b.warranty.charger],
            ["Provided by", b.warranty.provider],
            ["Start date", b.warranty.startDate],
            ["Terms", b.warranty.terms],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => label + ": " + value)
            .join("\n")
        : "",
    ],
    ["PAYMENT DETAILS", b.seller.bank],
    ["ADDITIONAL SALE TERMS", b.notes],
    ["SELLER MESSAGE", b.seller.footer],
  ].filter(([, value]) => value);
  for (const [title, value] of notes) {
    if (title === "WARRANTY DETAILS") {
      deferred.push([title, value]);
      continue;
    }
    const nh = height(value, 8, 240) + 23;
    if (ly + nh > y + summaryHeight) {
      deferred.push([title, value]);
      continue;
    }
    text(title, left, ly, 7, 240, true, muted);
    text(value, left, ly + 14, 8, 240);
    ly += nh + 10;
  }
  y += summaryHeight + 15;
  const signatureReserve = Math.max(
    65,
    height(
      `For ${b.seller.name}\n${b.seller.signatory || "Authorised signatory"}`,
      8,
      245,
      true,
    ) + 44,
  );
  for (const [index, [title, value]] of deferred.entries()) {
    const nh = height(value, 8.5, width - 20) + 37;
    ensure(nh + (index === deferred.length - 1 ? signatureReserve : 0));
    text(title, left, y, 7.5, width, true, muted);
    text(value, left, y + 16, 8.5, width);
    y += nh;
  }
  const signatureText = `For ${b.seller.name}\n${b.seller.signatory || "Authorised signatory"}`;
  const sh = Math.max(65, height(signatureText, 8, 245, true) + 44);
  ensure(sh);
  y += 16;
  doc
    .moveTo(left, y + 15)
    .lineTo(235, y + 15)
    .strokeColor(rule)
    .stroke();
  doc
    .moveTo(310, y + 15)
    .lineTo(right, y + 15)
    .stroke();
  text("Customer acknowledgment", left, y + 22, 8, 230, false, muted);
  text(signatureText, 310, y + 22, 8, 245, true, green, "right");
  const pages = doc.bufferedPageRange();
  for (let n = 0; n < pages.count; n++) {
    doc.switchToPage(n);
    line(775);
    text(
      `${draft ? "DRAFT - NOT VALID FOR SALE" : "Signature of seller / authorised representative required"}  |  ${number}`,
      left,
      785,
      7,
      445,
      false,
      muted,
    );
    text(`${n + 1} / ${pages.count}`, 495, 785, 7, 60, false, muted, "right");
  }
  doc.end();
}
