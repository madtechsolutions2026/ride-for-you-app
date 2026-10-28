import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import path from "node:path";
const green = "#155232",
  ink = "#22382b",
  muted = "#647268",
  rule = "#dce5de",
  pale = "#f0f5f1";
const cash = (n) =>
  "INR " +
  (n / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function invoicePdf(res, row, root) {
  const i = JSON.parse(row.body);
  const doc = new PDFDocument({
    size: "A4",
    margin: 44,
    bufferPages: true,
    info: { Title: `${row.number} - ${i.seller.name}`, Author: i.seller.name },
  });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${row.number}.pdf"`,
  });
  doc.pipe(res);
  const regular = path.join(root, "assets/regular.ttf"),
    bold = path.join(root, "assets/bold.ttf");
  doc.registerFont("R", existsSync(regular) ? regular : "Helvetica");
  doc.registerFont("B", existsSync(bold) ? bold : "Helvetica-Bold");
  const left = 44,
    width = 507,
    bottom = 738;
  const measure = (value, size, w, bold = false) =>
    doc
      .font(bold ? "B" : "R")
      .fontSize(size)
      .heightOfString(String(value), { width: w, lineGap: 2 });
  const write = (
    value,
    x,
    y,
    size = 10,
    w = width,
    bold = false,
    color = ink,
    align = "left",
  ) =>
    doc
      .font(bold ? "B" : "R")
      .fontSize(size)
      .fillColor(color)
      .text(String(value), x, y, { width: w, lineGap: 2, align });
  const horizontal = (y) =>
    doc
      .moveTo(left, y)
      .lineTo(left + width, y)
      .strokeColor(rule)
      .lineWidth(0.7)
      .stroke();
  let y = 44;
  const logo = path.join(root, "public/logo.png");
  if (existsSync(logo))
    doc.image(logo, left, y, {
      fit: [84, 84],
      align: "center",
      valign: "center",
    });
  const seller = [
    i.seller.address,
    [i.seller.phone, i.seller.email].filter(Boolean).join("  |  "),
    i.seller.taxId ? "Tax ID / GSTIN: " + i.seller.taxId : "",
  ].filter(Boolean);
  let sy = y;
  write(i.seller.name, 146, sy, 20, 405, true, green);
  sy += measure(i.seller.name, 20, 405, true) + 7;
  for (const value of seller) {
    write(value, 146, sy, 9, 405, false, muted);
    sy += measure(value, 9, 405) + 3;
  }
  y = Math.max(y + 99, sy + 12);
  horizontal(y);
  y += 19;
  write("SALES INVOICE", left, y, 23, 280, true, green);
  write(row.number, 340, y + 2, 13, 211, true, ink, "right");
  write("Invoice date: " + i.date, 340, y + 25, 9, 211, false, muted, "right");
  y += 62;
  const buyer = [
    i.customer.name,
    i.customer.address,
    "Phone: " + i.customer.phone,
    i.customer.taxId ? "Tax ID / GSTIN: " + i.customer.taxId : "",
  ].filter(Boolean);
  const sale = [
    ["Payment method", i.method],
    [
      "Payment status",
      i.balance === 0 ? "Paid" : i.paid > 0 ? "Partially paid" : "Unpaid",
    ],
    ["Salesperson", i.salesperson || "—"],
  ];
  const bw = 245,
    gap = 17;
  const buyerHeight =
    buyer.reduce(
      (sum, v, index) =>
        sum + measure(v, index === 0 ? 11 : 9, bw - 24, index === 0) + 5,
      0,
    ) + 45;
  const saleHeight =
    sale.reduce(
      (sum, entry) => sum + Math.max(13, measure(entry[1], 9, 125)) + 10,
      0,
    ) + 28;
  const cardHeight = Math.max(buyerHeight, saleHeight);
  if (y + cardHeight > bottom) {
    doc.addPage();
    y = 44;
  }
  for (const x of [left, left + bw + gap])
    doc
      .roundedRect(x, y, bw, cardHeight, 4)
      .lineWidth(0.7)
      .strokeColor(rule)
      .stroke();
  write("BILLED TO", left + 12, y + 12, 8, bw - 24, true, muted);
  let by = y + 32;
  for (const [index, value] of buyer.entries()) {
    write(value, left + 12, by, index === 0 ? 11 : 9, bw - 24, index === 0);
    by += measure(value, index === 0 ? 11 : 9, bw - 24, index === 0) + 5;
  }
  let dy = y + 16;
  for (const [label, value] of sale) {
    write(label, left + bw + gap + 12, dy, 8, 88, false, muted);
    write(value, left + bw + gap + 105, dy, 9, 125, true);
    dy += Math.max(13, measure(value, 9, 125, true)) + 10;
  }
  y += cardHeight + 22;
  function tableHeader() {
    doc.rect(left, y, width, 29).fill(green);
    write("NO.", left + 9, y + 9, 8, 25, true, "#ffffff");
    write("BIKE & IDENTIFICATION", left + 40, y + 9, 8, 253, true, "#ffffff");
    write("QTY", left + 295, y + 9, 8, 30, true, "#ffffff", "center");
    write("UNIT PRICE", left + 332, y + 9, 8, 77, true, "#ffffff", "right");
    write("AMOUNT", left + 414, y + 9, 8, 83, true, "#ffffff", "right");
    y += 29;
  }
  if (y > bottom - 95) {
    doc.addPage();
    y = 44;
  }
  tableHeader();
  for (const [index, l] of i.lines.entries()) {
    const model = l.brand + " " + l.model;
    const details = [
      "Chassis / frame: " + l.vin,
      l.color ? "Colour: " + l.color : "",
      l.battery ? "Battery / motor serial: " + l.battery : "",
    ].filter(Boolean);
    const rowHeight = Math.max(
      64,
      measure(model, 10, 247, true) +
        details.reduce((s, v) => s + measure(v, 8.5, 247) + 3, 0) +
        23,
    );
    if (y + rowHeight > bottom) {
      doc.addPage();
      y = 44;
      write(
        "INVOICE " + row.number + " / CONTINUED",
        left,
        y,
        10,
        width,
        true,
        green,
      );
      y += 27;
      tableHeader();
    }
    if (index % 2 === 0) doc.rect(left, y, width, rowHeight).fill("#f7faf7");
    write(index + 1, left + 9, y + 12, 9, 24);
    write(model, left + 40, y + 10, 10, 247, true);
    let ly = y + 10 + measure(model, 10, 247, true) + 5;
    for (const value of details) {
      write(value, left + 40, ly, 8.5, 247, false, muted);
      ly += measure(value, 8.5, 247) + 3;
    }
    write("1", left + 295, y + 12, 9, 30, false, ink, "center");
    write(cash(l.salePrice), left + 330, y + 12, 8.5, 79, false, ink, "right");
    write(cash(l.salePrice), left + 414, y + 12, 8.5, 83, true, ink, "right");
    y += rowHeight;
    horizontal(y);
  }
  y += 18;
  const summaryHeight = 175;
  if (y + summaryHeight > bottom) {
    doc.addPage();
    y = 44;
  }
  const sx = 294,
    sw = 257;
  doc.roundedRect(sx, y, sw, summaryHeight, 5).fill(pale);
  let ty = y + 13;
  for (const [label, value] of [
    ["Subtotal", i.subtotal],
    ["Discount", -i.discount],
    [`Tax (${i.taxRate / 100}%)`, i.tax],
  ]) {
    write(label, sx + 13, ty, 9, 125);
    write(cash(value), sx + 138, ty, 9, 106, false, ink, "right");
    ty += 20;
  }
  doc.rect(sx + 1, ty - 1, sw - 2, 34).fill(green);
  write("INVOICE TOTAL", sx + 13, ty + 9, 9, 120, true, "#ffffff");
  write(cash(i.total), sx + 131, ty + 7, 12, 113, true, "#ffffff", "right");
  ty += 43;
  write("Amount received", sx + 13, ty, 9, 125);
  write(cash(i.paid), sx + 138, ty, 9, 106, false, ink, "right");
  ty += 23;
  write("BALANCE DUE", sx + 13, ty, 9, 120, true);
  write(cash(i.balance), sx + 131, ty, 12, 113, true, green, "right");
  let ly = y + 5;
  const deferred = [];
  const notes = [
    ["PAYMENT / BANK DETAILS", i.seller.bank],
    ["NOTES / WARRANTY / TERMS", i.notes],
    ["SELLER MESSAGE", i.seller.footer],
  ].filter((x) => x[1]);
  for (const [title, content] of notes) {
    const h = measure(content, 8.5, 225) + 24;
    if (ly + h > y + summaryHeight) {
      deferred.push([title, content]);
      continue;
    }
    write(title, left, ly, 7.5, 225, true, muted);
    write(content, left, ly + 14, 8.5, 225);
    ly += h + 9;
  }
  if (!notes.length) {
    write("SALE SUMMARY", left, ly, 8, 220, true, muted);
    write(
      `${i.lines.length} bike${i.lines.length === 1 ? "" : "s"} supplied. Amounts in INR.`,
      left,
      ly + 18,
      9,
      220,
    );
  }
  y += summaryHeight + 13;
  function block(title, content) {
    if (!content) return;
    const h = measure(content, 9, width - 24) + 43;
    if (y + h > bottom) {
      doc.addPage();
      y = 44;
    }
    doc
      .roundedRect(left, y, width, h, 4)
      .lineWidth(0.7)
      .strokeColor(rule)
      .stroke();
    write(title, left + 12, y + 11, 8, width - 24, true, muted);
    write(content, left + 12, y + 29, 9, width - 24);
    y += h + 12;
  }
  for (const [title, content] of deferred) block(title, content);
  if (y + 50 > bottom) {
    doc.addPage();
    y = 44;
  }
  y += 8;
  doc
    .moveTo(left, y + 14)
    .lineTo(left + 185, y + 14)
    .strokeColor(rule)
    .stroke();
  doc
    .moveTo(350, y + 14)
    .lineTo(551, y + 14)
    .stroke();
  write("Customer acknowledgment", left, y + 21, 8, 200, false, muted);
  write("For " + i.seller.name, 350, y + 21, 8, 201, true, green, "right");
  const pages = doc.bufferedPageRange();
  for (let n = 0; n < pages.count; n++) {
    doc.switchToPage(n);
    horizontal(776);
    write(
      row.number + "  |  " + i.seller.name,
      left,
      786,
      8,
      410,
      false,
      muted,
    );
    write(`${n + 1} / ${pages.count}`, 490, 786, 8, 61, false, muted, "right");
  }
  doc.end();
}
