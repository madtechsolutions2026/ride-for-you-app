import { esc, cash } from "../../shared/ui.mjs";
import { stateName } from "../../gst.mjs";
import { taxRows } from "../../domain/totals.mjs";
export function totalsHtml(b) {
  const quote = b.documentType === "quotation";
  return [
    ["Subtotal", b.subtotal],
    ["Discount", -b.discount],
    ["Taxable value", b.taxable],
    ...taxRows(b),
    ...(b.roundOff ? [["Rounding adjustment", b.roundOff]] : []),
    [quote ? "Quotation total" : "Invoice total", b.total],
    ...(!quote
      ? [
          ["Amount received", b.paid || 0],
          ["Balance due", b.balance ?? b.total - (b.paid || 0)],
        ]
      : []),
  ]
    .map(
      ([label, value]) =>
        `<div class="${label.endsWith("total") ? "grand" : ""}"><span>${esc(label)}</span><b>${cash(value)}</b></div>`,
    )
    .join("");
}
export function documentHtml(
  number,
  b,
  { preview = false, logoBase = "" } = {},
) {
  const quote = b.documentType === "quotation",
    battery = b.saleType === "battery";
  return `<article class="invoice-sheet gst-sheet"><div class="invoice-top"><div class="invoice-identity"><img src="${logoBase}/logo.png" alt="Ride For You EV"><div><h2>${esc(b.seller.name)}</h2><p class="prewrap">${esc(b.seller.address)}<br>GSTIN: ${esc(b.seller.taxId)} · ${esc(stateName(b.seller.stateCode))}</p></div></div><div class="invoice-ref"><div class="eyebrow">${quote ? "QUOTATION · NOT A TAX INVOICE" : preview ? "DRAFT · NOT ISSUED" : "TAX INVOICE"}</div><h2>${esc(number)}</h2><p>${esc(b.date)}${quote ? "<br>Valid until " + esc(b.validUntil) : ""}</p></div></div><div class="invoice-parties"><section><div class="eyebrow">${quote ? "PREPARED FOR" : "BILLED TO"}</div><h3>${esc(b.customer.name)}</h3><p class="prewrap">${esc(b.customer.address)}</p><p>Phone: ${esc(b.customer.phone)}<br>${esc(stateName(b.customer.stateCode))}${b.customer.taxId ? "<br>GSTIN: " + esc(b.customer.taxId) : ""}</p></section><section><div class="eyebrow">DELIVERY & SUPPLY</div><p class="prewrap">${esc(b.deliveryAddress)}</p><p>Place of supply: ${esc(stateName(b.placeOfSupply))}<br>${b.priceMode === "inclusive" ? "Prices include GST" : "GST added to prices"}${b.salesperson ? "<br>Prepared by: " + esc(b.salesperson) : ""}</p>${quote ? "<p>Subject to stock availability. Stock is not reserved.</p>" : "<p>Payment: " + esc(b.method) + "</p>"}</section></div><div class="scroll"><table class="invoice-items"><thead><tr><th>${battery ? "Battery / serial" : "Bike / chassis"}</th><th>Qty</th><th>Price</th><th>Discount</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead><tbody>${b.lines
    .map(
      (l) =>
        `<tr><td><b>${esc(l.brand + " " + l.model)}</b><small>${battery ? "Battery number: " + esc(l.serial) : "Chassis: " + esc(l.vin)}</small><small>HSN ${esc(l.hsn)}${battery ? " · " + esc([l.chemistry, l.voltage, l.capacity].filter(Boolean).join(" · ")) : ""}</small>${
          battery
            ? `${l.warranty ? "<small>Warranty: " + esc(l.warranty) + "</small>" : ""}${l.provider ? "<small>Provided by: " + esc(l.provider) + "</small>" : ""}${l.warranty_terms ? "<small>" + esc(l.warranty_terms) + "</small>" : ""}`
            : ["battery", "motor", "controller", "charger"]
                .filter((k) => l[k])
                .map((k) => `<small>${esc(k)}: ${esc(l[k])}</small>`)
                .join("")
        }</td><td>1 NOS</td><td>${cash(l.salePrice)}</td><td>${cash(l.discount)}</td><td>${cash(l.taxable)}</td><td>${l.gstRate / 100}%<small>${b.intraState ? `CGST ${cash(l.cgst)}<br>${esc(b.stateTaxLabel)} ${cash(l.sgst)}` : `IGST ${cash(l.igst)}`}</small></td><td><b>${cash(l.total)}</b></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><div class="invoice-bottom"><section>${quote ? "<h3>Quotation conditions</h3><p>This is a price offer. It does not record a sale or acknowledge payment.</p>" : ""}${b.paymentTerms ? '<h3>Payment terms</h3><p class="prewrap">' + esc(b.paymentTerms) + "</p>" : ""}${
    b.warranty
      ? '<h3>Warranty offered</h3><p class="prewrap">' +
        Object.entries(b.warranty)
          .filter(([, v]) => v)
          .map(([k, v]) => esc(k) + ": " + esc(v))
          .join("<br>") +
        "</p>"
      : ""
  }${b.notes ? '<h3>Terms / notes</h3><p class="prewrap">' + esc(b.notes) + "</p>" : ""}${b.seller.bank ? '<h3>Bank / payment details</h3><p class="prewrap">' + esc(b.seller.bank) + "</p>" : ""}</section><div class="invoice-totalbox">${totalsHtml(b)}</div></div><p class="invoice-thanks">${esc(b.seller.footer)}</p><div class="invoice-signatures"><span>${quote ? "Customer acceptance" : "Customer acknowledgment"}</span><span>For ${esc(b.seller.name)}<br>${esc(b.seller.signatory || "Authorised signatory")}</span></div></article>`;
}
