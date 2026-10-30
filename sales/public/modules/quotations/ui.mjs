import {
  esc,
  cash,
  field,
  area,
  panel,
  customerFields,
  today,
  showFormError,
} from "../../shared/ui.mjs";
import { gstTotals } from "../../gst.mjs";
import { documentHtml, totalsHtml } from "../documents/view.mjs";
export async function quotationScreen(ctx) {
  const { state, route, shell, heading, api, load, toast, error, appBase } =
      ctx,
    current = () => location.hash.slice(1) === route,
    [, id] = route.split("/");
  try {
    if (id === "new") return quoteForm(ctx);
    if (id) {
      const row = await api("/quotations/" + id);
      if (!current()) return;
      const b = row.body,
        expired = b.validUntil < today(),
        canConvert =
          ["issued", "accepted"].includes(row.status) &&
          !expired &&
          state.bikes.some(
            (p) => p.id === b.lines[0].id && p.status === "available",
          );
      shell(
        heading(
          "BIKE QUOTATION",
          esc(row.number),
          `${esc(row.status)}${expired ? " · validity ended" : ""} · Prepared ${esc(b.date)} · Valid until ${esc(b.validUntil)}`,
          `<a href="#quotations">← Quotations</a><a class="download-link" href="${appBase}/api/quotations/${id}/pdf" target="_blank" rel="noopener">Download PDF</a><a class="primary download-link" href="${appBase}/api/quotations/${id}/pdf?inline=1" target="_blank" rel="noopener">Print quotation ↗</a>${canConvert ? `<a href="#invoices/new/${id}">Create invoice from quote →</a>` : ""}${row.invoice_id ? `<a href="#invoices/${row.invoice_id}">View converted invoice ↗</a>` : ""}`,
        ) +
          `<div id="error" role="alert"></div>${state.deletedInvoices?.some((i) => i.id === row.invoice_id) ? '<div class="deletion-record"><b>The converted invoice was deleted from active sales.</b><p>Its original record remains available above. This quotation cannot be converted a second time; create a new quotation if needed.</p></div>' : ""}<div class="notice">This quotation is a price offer. It does not reserve the bike, change stock, or acknowledge a payment.${!canConvert && row.status !== "converted" ? " Conversion requires a valid quotation and an available bike." : ""}</div>${documentHtml(row.number, b, { logoBase: appBase })}${["issued", "accepted"].includes(row.status) ? `<div class="panelbody actions">${row.status === "issued" && !expired ? '<button id="acceptQuote">Mark accepted</button>' : ""}<button id="cancelQuote">Cancel quotation</button></div>` : ""}`,
        route,
      );
      for (const [button, status] of [
        ["acceptQuote", "accepted"],
        ["cancelQuote", "cancelled"],
      ])
        document
          .querySelector("#" + button)
          ?.addEventListener("click", async (e) => {
            e.target.disabled = true;
            try {
              await api("/quotations/" + id + "/status", "PUT", {
                version: row.version,
                status,
              });
              await quotationScreen(ctx);
              toast("Quotation " + status);
            } catch (x) {
              showFormError(x, error);
              e.target.disabled = false;
            }
          });
      return;
    }
    const rows = await api("/quotations");
    if (!current()) return;
    shell(
      heading(
        "PRICE OFFERS",
        "Bike quotations.",
        "Prepare, print and carry an agreed quotation into a reviewed sales invoice.",
        '<a class="primary download-link" href="#quotations/new">+ Create quotation</a>',
      ) +
        `<div class="search"><input id="quoteSearch" type="search" aria-label="Search quotations" placeholder="Search quote, customer, phone or bike"><select id="quoteStatus" aria-label="Quotation status"><option value="">All statuses</option><option value="issued">Issued</option><option value="accepted">Accepted</option><option value="converted">Converted</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></div><section class="panel" id="quoteTable"></section>`,
      route,
    );
    const draw = () => {
      const q = document.querySelector("#quoteSearch").value.toLowerCase(),
        s = document.querySelector("#quoteStatus").value;
      const filtered = rows.filter(
        (r) =>
          (!s ||
            (s === "expired"
              ? r.body.validUntil < today() &&
                ["issued", "accepted"].includes(r.status)
              : r.status === s)) &&
          [
            r.number,
            r.body.customer.name,
            r.body.customer.phone,
            r.body.lines[0].model,
            r.body.lines[0].vin,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
      );
      document.querySelector("#quoteTable").innerHTML = filtered.length
        ? `<div class="scroll"><table><thead><tr><th>Quotation</th><th>Customer</th><th>Bike</th><th>Total</th><th>Validity</th><th>Status</th><th></th></tr></thead><tbody>${filtered.map((r) => `<tr><td><b>${esc(r.number)}</b><small>${esc(r.body.date)}</small></td><td>${esc(r.body.customer.name)}<small>${esc(r.body.customer.phone)}</small></td><td>${esc(r.body.lines[0].brand + " " + r.body.lines[0].model)}<small>${esc(r.body.lines[0].vin)}</small></td><td>${cash(r.body.total)}</td><td>${esc(r.body.validUntil)}</td><td><span class="tag">${["issued", "accepted"].includes(r.status) && r.body.validUntil < today() ? "Expired" : esc(r.status)}</span></td><td><a href="#quotations/${r.id}">View & print ↗</a></td></tr>`).join("")}</tbody></table></div>`
        : '<div class="empty"><b>No quotations to show.</b><p>Create the first price offer for a bike in stock.</p></div>';
    };
    draw();
    document.querySelector("#quoteSearch").oninput = draw;
    document.querySelector("#quoteStatus").onchange = draw;
  } catch (e) {
    if (current() && e.status !== 401)
      shell(
        heading(
          "QUOTATIONS",
          "Unable to open this page.",
          esc(e.message),
          '<a href="#quotations">← Quotations</a>',
        ),
        route,
      );
  }
}
function quoteForm(ctx) {
  const { state, route, shell, heading, api, load, toast, error, appBase } =
      ctx,
    available = state.bikes.filter((b) => b.status === "available"),
    key = crypto.randomUUID();
  if (!available.length) {
    shell(
      heading(
        "QUOTATION",
        "Add available bikes first.",
        "A quotation refers to a bike currently in stock.",
        '<a href="#inventory/new">+ Add bike</a>',
      ),
      route,
    );
    return;
  }
  const expiry = new Date(today() + "T12:00:00Z");
  expiry.setUTCDate(expiry.getUTCDate() + 7);
  shell(
    heading(
      "NEW BIKE QUOTATION",
      "A clear offer, ready to print.",
      "Select a bike, enter customer details and review the complete price.",
      '<a href="#quotations">← Quotations</a>',
    ) +
      `<form id="quoteform" class="commerce-form"><div id="error" role="alert"></div><div class="split"><div>${panel("Customer & delivery", customerFields(state.settings, { quotation: true }))}${panel("Bike & offer", `<div class="search"><input id="quoteBikeSearch" type="search" aria-label="Search quotation bikes" placeholder="Search model or chassis"></div><div class="formgrid"><div class="field full"><label for="quoteBike">Bike *</label><select id="quoteBike" name="bikeId" required><option value="">Choose a bike…</option>${available.map((b) => `<option value="${b.id}">${esc(b.brand + " " + b.model + " · " + b.vin)}</option>`).join("")}</select></div>${field("Quoted bike price (₹) *", "price", "", 'required type="number" min="0.01" step="0.01"')}${field("Discount (₹)", "discount", 0, 'type="number" min="0" step="0.01"')}${field("Valid until *", "validUntil", expiry.toISOString().slice(0, 10), 'required type="date"')}<div id="quoteBikeDetails" class="field full form-note"></div></div><p class="form-note">A quotation does not reserve or sell this bike. Bike prices use the existing complete-EV GST configuration.</p>`)}${panel("Warranty offered", `<div class="formgrid">${["Vehicle", "Battery", "Motor", "Controller", "Charger", "Provider"].map((k) => field(k === "Provider" ? "Warranty provider" : k + " warranty", "warranty" + k, "", 'maxlength="150"')).join("")}${area("Warranty coverage / exclusions", "warrantyTerms")}</div>`)}${panel("Terms", `<div class="formgrid">${area("Payment terms", "paymentTerms", "", 500)}${area("Quotation notes / delivery terms", "notes")}</div>`)}</div><aside class="commerce-side">${panel("Quotation summary", '<div id="quoteTotals" class="invoice-totalbox"></div><p class="form-note">Review the price, tax, warranty and validity before generating the quotation.</p><button type="button" class="primary" id="reviewQuote">Review quotation →</button>')}</aside></div><section id="quoteReview" hidden></section></form>`,
    route,
  );
  const form = document.querySelector("#quoteform");
  form.elements.address.required = true;
  const picker = form.elements.bikeId;
  let review = null;
  const payload = () => ({
    ...Object.fromEntries(new FormData(form)),
    requestKey: key,
  });
  const invalidate = () => {
    review = null;
    document.querySelector("#quoteReview").hidden = true;
  };
  const calc = () => {
    try {
      const b = available.find((x) => x.id === picker.value),
        p = payload(),
        totals = gstTotals(
          b ? [{ ...b, salePrice: Math.round(Number(p.price) * 100) }] : [],
          Math.round(Number(p.discount || 0) * 100),
          p.priceMode,
          state.settings.stateCode,
          p.placeOfSupply,
        );
      totals.documentType = "quotation";
      document.querySelector("#quoteTotals").innerHTML = totalsHtml(totals);
    } catch (e) {
      document.querySelector("#quoteTotals").innerHTML =
        '<p class="muted">' + esc(e.message) + "</p>";
    }
  };
  picker.onchange = () => {
    const b = available.find((x) => x.id === picker.value);
    form.elements.price.value = b ? b.price / 100 : "";
    document.querySelector("#quoteBikeDetails").textContent = b
      ? `Chassis ${b.vin} · ${b.color || ""} · HSN ${b.hsn}`
      : "";
    invalidate();
    calc();
  };
  document.querySelector("#quoteBikeSearch").oninput = (e) => {
    const q = e.target.value.toLowerCase(),
      keep = picker.value;
    picker.innerHTML =
      '<option value="">Choose a bike…</option>' +
      available
        .filter(
          (b) =>
            b.id === keep ||
            [b.brand, b.model, b.vin].join(" ").toLowerCase().includes(q),
        )
        .map(
          (b) =>
            `<option value="${b.id}">${esc(b.brand + " " + b.model + " · " + b.vin)}</option>`,
        )
        .join("");
    picker.value = keep;
  };
  form.oninput = () => {
    invalidate();
    calc();
  };
  form.onchange = () => {
    invalidate();
    calc();
  };
  document.querySelector("#reviewQuote").onclick = async (e) => {
    if (!form.reportValidity()) return;
    e.target.disabled = true;
    try {
      const body = payload(),
        result = await api("/quotations/preview", "POST", body);
      review = { fingerprint: JSON.stringify(body), result };
      const el = document.querySelector("#quoteReview");
      el.hidden = false;
      el.innerHTML = panel(
        "Review quotation",
        documentHtml(result.number, result.invoice, {
          preview: true,
          logoBase: appBase,
        }) +
          '<p>No stock or invoice number will be consumed.</p><button type="submit" class="primary">Generate quotation →</button>',
      );
      el.scrollIntoView({ behavior: "smooth" });
    } catch (x) {
      showFormError(x, error);
    } finally {
      e.target.disabled = false;
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = payload();
    if (!review || review.fingerprint !== JSON.stringify(body)) {
      showFormError(
        Error("Review this quotation before generating it."),
        error,
      );
      return;
    }
    e.submitter.disabled = true;
    try {
      const saved = await api("/quotations", "POST", {
        ...body,
        previewHash: review.result.previewHash,
      });
      await load();
      location.hash = "quotations/" + saved.id;
      toast("Quotation ready to print");
    } catch (x) {
      showFormError(x, error);
      e.submitter.disabled = false;
    }
  };
  calc();
}
