import {
  DEFAULT_HSN,
  EV_HSN,
  STATES,
  stateName,
  gstTotals,
  validGstin,
} from "./gst.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cash = (n) =>
  "₹" +
  ((n || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const field = (label, name, value = "", extra = "") =>
  `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${esc(value)}" ${extra}></div>`;
const area = (label, name, value = "") =>
  `<div class="field full"><label for="${name}">${label}</label><textarea id="${name}" name="${name}">${esc(value)}</textarea></div>`;
const select = (label, name, options, value = "", required = true) =>
  `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" ${required ? "required" : ""}>${options.map(([key, text]) => `<option value="${key}" ${key === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></div>`;
const stateOptions = [
  ["", "Select state / UT"],
  ...Object.entries(STATES)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, name]) => [key, `${name} (${key})`]),
];
const priceOptions = [
  ["", "Choose price basis"],
  ["inclusive", "Price already includes 5% GST"],
  ["exclusive", "Add 5% GST to the price"],
];
const rows = (data) => [
  ["Quoted subtotal", data.subtotal],
  ["Discount", -data.discount],
  ["Taxable value", data.taxable],
  ...(data.intraState
    ? [
        ["CGST · 2.5%", data.cgst],
        [`${data.stateTaxLabel} · 2.5%`, data.sgst],
      ]
    : [["IGST · 5%", data.igst]]),
  ...(data.roundOff ? [["Rounding adjustment", data.roundOff]] : []),
  ["Invoice total", data.total],
  ["Amount received", data.paid || 0],
  ["Balance due", data.total - (data.paid || 0)],
];
const totalsHtml = (data) =>
  rows(data)
    .map(
      ([label, value]) =>
        `<div class="${label === "Invoice total" ? "total grand" : label === "Balance due" ? "balance-row" : ""}"><span>${esc(label)}</span><b>${cash(value)}</b></div>`,
    )
    .join("");

export function gstInvoiceHtml(
  number,
  b,
  { preview = false, logoBase = "" } = {},
) {
  return `<article class="invoice-sheet gst-sheet"><div class="invoice-top"><div class="invoice-identity"><img src="${logoBase}/logo.png" alt="Ride For You logo"><div><h2>${esc(b.seller.name)}</h2><p>${esc(b.seller.address)}<br><b>GSTIN: ${esc(b.seller.taxId)}</b><br>${esc(stateName(b.seller.stateCode))}${b.seller.phone ? " · " + esc(b.seller.phone) : ""}</p></div></div><div class="invoice-ref"><div class="eyebrow">${preview ? "DRAFT · NOT ISSUED" : "TAX INVOICE"}</div><h2>${esc(number)}</h2><p>${esc(b.date)} · FY ${b.financialYear.slice(0, 2)}-${b.financialYear.slice(2)}</p><span class="tag">${b.priceMode === "inclusive" ? "GST included in price" : "GST added to price"}</span></div></div><div class="invoice-parties"><section><div class="eyebrow">BILLED TO</div><h3>${esc(b.customer.name)}</h3><p class="prewrap">${esc(b.customer.address)}</p><p>${esc(stateName(b.customer.stateCode))}<br>Phone: ${esc(b.customer.phone)}<br>${b.customer.taxId ? "GSTIN: " + esc(b.customer.taxId) : "Unregistered customer (B2C)"}</p></section><section><div class="eyebrow">DELIVERY & SUPPLY</div><p class="prewrap">${esc(b.deliveryAddress)}</p><p><b>Place of supply: ${esc(stateName(b.placeOfSupply))}</b><br>Reverse charge: No<br>Payment: ${esc(b.method)}${b.salesperson ? "<br>Salesperson: " + esc(b.salesperson) : ""}</p></section></div><div class="scroll"><table class="invoice-items"><thead><tr><th>Vehicle / HSN</th><th>Qty / unit</th><th>Quoted price</th><th>Discount</th><th>Taxable</th><th>GST · 5%</th><th>Total</th></tr></thead><tbody>${b.lines.map((line) => `<tr><td><b>${esc(line.brand + " " + line.model)}</b><small>Chassis: ${esc(line.vin)}</small><small>HSN: ${esc(line.hsn)}</small>${["battery", "motor", "controller", "charger"].map((type) => `<small>${type[0].toUpperCase() + type.slice(1)}: ${esc(line[type] || "Not recorded")}</small>`).join("")}${!preview ? `<small><a href="#vehicles/${line.id}">Vehicle & service history ↗</a></small>` : ""}</td><td>1 NOS</td><td>${cash(line.salePrice)}</td><td>${cash(line.discount)}</td><td>${cash(line.taxable)}</td><td>${cash(line.tax)}<small>${b.intraState ? `CGST ${cash(line.cgst)}<br>${b.stateTaxLabel} ${cash(line.sgst)}` : `IGST ${cash(line.igst)}`}</small></td><td><b>${cash(line.total)}</b></td></tr>`).join("")}</tbody></table></div><div class="invoice-bottom"><section><div class="eyebrow">COMPLETE ELECTRIC TWO-WHEELERS</div><p>${b.priceMode === "inclusive" ? "Quoted prices include GST. Tax is extracted from the discounted price." : "GST is added to the quoted price after discount."}</p>${b.seller.bank ? `<h3>Payment details</h3><p class="prewrap">${esc(b.seller.bank)}</p>` : ""}<p class="muted">${preview ? "Review only. No stock or invoice number has been committed." : "Amounts received are recorded at issue. Print and obtain the authorised signatory's signature."}</p></section><div class="invoice-totalbox">${totalsHtml(b)}</div></div>${
    b.warranty
      ? `<section class="invoice-note"><h3>Warranty details</h3><dl class="warranty-grid">${[
          ["Vehicle", b.warranty.vehicle],
          ["Battery", b.warranty.battery],
          ["Motor", b.warranty.motor],
          ["Controller", b.warranty.controller],
          ["Charger", b.warranty.charger],
          ["Provided by", b.warranty.provider],
          ["Warranty start", b.warranty.startDate],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
          .join(
            "",
          )}</dl>${b.warranty.terms ? `<p class="prewrap">${esc(b.warranty.terms)}</p>` : ""}</section>`
      : ""
  }${b.notes ? `<div class="invoice-note"><b>Additional terms</b><p class="prewrap">${esc(b.notes)}</p></div>` : ""}<p class="invoice-thanks">${esc(b.seller.footer)}</p><div class="invoice-signatures"><span>Customer acknowledgment</span><span>${esc(b.seller.signatory || "Authorised signatory")}<br>For ${esc(b.seller.name)}</span></div></article>`;
}

export function gstInvoiceView({ row, route, shell, heading, appBase }) {
  shell(
    heading(
      "GST TAX INVOICE",
      esc(row.number),
      "Saved seller, customer, HSN and tax details are preserved.",
      `<a href="#invoices">← All invoices</a><a class="primary download-link" href="${appBase}/api/invoices/${row.id}/pdf">↓ Download tax invoice PDF</a><a href="${appBase}/api/invoices/${row.id}/pdf?copy=transporter">Transporter copy</a><a href="${appBase}/api/invoices/${row.id}/pdf?copy=supplier">Supplier copy</a>`,
    ) + gstInvoiceHtml(row.number, row.body, { logoBase: appBase }),
    route,
  );
}

export function gstSettingsForm({
  state,
  route,
  shell,
  heading,
  api,
  load,
  toast,
  error,
}) {
  const s = state.settings;
  shell(
    heading(
      "BUSINESS & GST",
      "Ready for every EV sale.",
      "Check your registered business details, pricing and invoice sequence before your first sale.",
    ) +
      `<form id="gstsettings" class="panel"><div class="panelhead"><h2>Registered dealership</h2></div><div class="panelbody"><div id="error"></div><div class="formgrid">${field("Legal business name *", "name", s.name, 'required maxlength="150"')}${field("GSTIN *", "taxId", s.taxId, 'required maxlength="15" minlength="15" autocomplete="off"')}${area("Registered address *", "address", s.address)}${select("Seller state / UT *", "stateCode", stateOptions, s.stateCode)}${field("Business contact number", "phone", s.phone, 'type="tel" maxlength="30"')}${field("Email", "email", s.email, 'type="email"')}${field("Authorised signatory name", "signatory", s.signatory, 'maxlength="100"')}${select("Default price basis", "priceMode", [["", "Choose on each invoice"], ...priceOptions.slice(1)], s.priceMode, false)}${select(
        "B2B e-invoicing applicability",
        "eInvoiceMode",
        [
          ["unconfirmed", "Not yet confirmed with accountant"],
          ["not_required", "Accountant confirmed: not required"],
          ["required", "IRN / e-invoicing required"],
        ],
        s.eInvoiceMode,
      )}${field("Invoice prefix · max 5 characters *", "prefix", s.prefix, 'required maxlength="5" pattern="[A-Za-z0-9-]{1,5}"')}${field(`Next number · FY ${state.numbering.financialYear} *`, "nextNumber", state.numbering.nextNumber, 'required type="number" min="1" max="99999" step="1"')}${area("Bank / payment details", "bank", s.bank)}${area("Invoice footer / terms", "footer", s.footer)}</div><div class="notice">Invoice format: <b>PREFIX/FY/00001</b> (up to 16 characters). Confirm the next number against any invoices issued outside this app. Used numbers cannot be reset. HSN preset <b>871160</b> covers complete electric two-wheelers; select a more specific category in inventory when appropriate. Separate batteries, chargers, parts, exports and SEZ supplies are outside this workflow.</div><p class="form-note">B2C invoices are available. GST-registered buyers require confirmed e-invoicing applicability; required IRNs must be handled through your accountant until IRP integration is configured. PDFs provide an authorised-signature space.</p></div><div class="formfooter"><span>Saved details apply to new invoices.</span><button class="primary">Save GST settings ↗</button></div></form>`,
    route,
  );
  const form = document.querySelector("#gstsettings");
  form.address.required = true;
  form.taxId.onchange = () => {
    const gst = form.taxId.value.trim().toUpperCase();
    if (validGstin(gst)) form.stateCode.value = gst.slice(0, 2);
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    event.submitter.disabled = true;
    try {
      await api("/settings", "PUT", Object.fromEntries(new FormData(form)));
      await load();
      toast("Business and GST settings saved");
    } catch (e) {
      error(e);
      event.submitter.disabled = false;
    }
  };
}

export function gstInvoiceForm({
  state,
  route,
  shell,
  heading,
  api,
  load,
  toast,
  error,
  appBase,
}) {
  const available = state.bikes.filter((b) => b.status === "available"),
    key = crypto.randomUUID();
  if (!available.length) {
    shell(
      heading(
        "NEW TAX INVOICE",
        "Add your available EV stock first.",
        "Each chassis can be invoiced once.",
        '<a class="primary download-link" href="#inventory/new">+ Add a bike</a>',
      ),
      route,
    );
    return;
  }
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  shell(
    heading(
      "EV SALES · GST INVOICING",
      "A complete record. Every time.",
      "Choose the price basis, review the GST breakdown, then issue the invoice.",
      '<a href="#invoices">← All invoices</a>',
    ) +
      `<div class="invoice-steps"><span><b>01</b> Customer</span><span><b>02</b> Vehicle & GST</span><span><b>03</b> Review</span><span><b>04</b> Issue & download</span></div><div class="notice"><b>${esc(state.settings.name)}</b> · GSTIN ${esc(state.settings.taxId)} · <a href="#settings">Business settings</a></div><form id="gstinvoiceform"><div class="split"><div><section class="panel"><div class="panelhead"><h2>Customer & delivery</h2></div><div class="panelbody"><div id="error"></div><div class="formgrid">${field("Customer name *", "name", "", 'required maxlength="150"')}${field("Customer phone *", "phone", "", 'required type="tel" maxlength="30"')}${area("Billing address *", "address")}${field("Customer GSTIN · optional for personal buyers", "taxId", "", 'maxlength="15" autocomplete="off"')}${select("Customer billing state *", "customerState", stateOptions)}${area("Delivery address · leave blank to use billing address", "deliveryAddress")}${select("Place of supply / delivery state *", "placeOfSupply", stateOptions)}${select("Price basis *", "priceMode", priceOptions, state.settings.priceMode)}${field("Invoice date *", "date", date, `required type="date" max="${date}"`)}${field("Salesperson", "salesperson", "", 'maxlength="100"')}${select(
        "Payment method *",
        "method",
        ["Bank transfer", "UPI", "Cash", "Not received"].map((x) => [x, x]),
        "Bank transfer",
      )}</div><p class="form-note">Use the actual place of supply. For a normal goods delivery, this is generally where delivery ends. GST is fixed at 5% for complete EVs in this workflow.</p></div></section><section class="panel"><div class="panelhead"><h2>Electric two-wheelers</h2><button type="button" id="gstaddbike">+ Add bike</button></div><div class="panelbody"><div id="gstlines"></div><p class="form-note">HSN is stored on each bike. <a href="#inventory">Review inventory classification</a>. Prices follow the basis chosen above.</p></div></section><section class="panel"><div class="panelbody"><h2>Warranty details</h2><p class="form-note">Enter only the coverage promised for these vehicles. Leave unknown terms blank; no warranty periods are assumed. These terms apply to all bikes on this invoice.</p><div class="formgrid">${field("Vehicle warranty", "warrantyVehicle", "", 'maxlength="150" placeholder="e.g. duration / distance limit"')}${field("Battery warranty", "warrantyBattery", "", 'maxlength="150"')}${field("Motor warranty", "warrantyMotor", "", 'maxlength="150"')}${field("Controller warranty", "warrantyController", "", 'maxlength="150"')}${field("Charger warranty", "warrantyCharger", "", 'maxlength="150"')}${field("Warranty provided by", "warrantyProvider", "", 'maxlength="150"')}${field("Warranty start · defaults to invoice date", "warrantyStart", "", 'type="date"')}${area("Warranty coverage, exclusions & claim process", "warrantyTerms")}${area("Additional invoice notes / delivery terms", "notes")}</div></div></section></div><aside><section class="panel gst-sticky"><div class="panelhead"><h2>Invoice summary</h2><span class="tag">GST 5%</span></div><div class="panelbody"><div class="formgrid">${field("Discount (₹)", "discount", 0, 'type="number" min="0" step="0.01"')}${field("Amount received (₹)", "paid", 0, 'type="number" min="0" step="0.01"')}</div></div><div id="gstsummary" class="summary"></div><div class="panelbody gst-action-stack"><button type="button" id="gstpreview" class="primary">Review tax invoice →</button><button type="button" id="gstdraft">↓ Download draft PDF</button><p class="form-note">PDFs print on one A4 page, including warranty details. Review and draft downloads do not mark bikes sold or consume an invoice number.</p></div></section></aside></div><section id="gstreview" hidden></section></form>`,
    route,
  );
  const form = document.querySelector("#gstinvoiceform");
  form.address.required = true;
  let review = null;
  const payload = () => ({
    requestKey: key,
    ...Object.fromEntries(new FormData(form)),
    lines: [...document.querySelectorAll("#gstlines .line")].map((row) => ({
      id: row.querySelector("select").value,
      price: row.querySelector(".bike-price").value,
      components: Object.fromEntries(
        [...row.querySelectorAll("[data-component]")].map((input) => [
          input.dataset.component,
          input.value,
        ]),
      ),
    })),
  });
  const invalidate = () => {
    review = null;
    document.querySelector("#gstreview").hidden = true;
  };
  function calculate() {
    try {
      const body = payload(),
        lines = body.lines
          .filter((line) => line.id)
          .map((line) => ({
            ...available.find((b) => b.id === line.id),
            salePrice: Math.round(Number(line.price || 0) * 100),
          }));
      const result = gstTotals(
        lines,
        Math.round(Number(body.discount || 0) * 100),
        body.priceMode,
        state.settings.stateCode,
        body.placeOfSupply,
      );
      result.paid = Math.round(Number(body.paid || 0) * 100);
      document.querySelector("#gstsummary").innerHTML = totalsHtml(result);
    } catch (e) {
      document.querySelector("#gstsummary").innerHTML =
        `<p class="muted">${esc(e.message)}</p>`;
    }
  }
  function addLine() {
    const row = document.createElement("div");
    row.className = "line";
    row.innerHTML =
      '<div class="bike-picker"><input class="bike-search" aria-label="Search bikes" type="search" placeholder="Search model, chassis or battery…" autocomplete="off"><select aria-label="Choose bike" required></select><small class="bike-matches" role="status"></small></div><input class="bike-price" aria-label="Bike sale price" type="number" min="0.01" step="0.01" required placeholder="Price ₹"><button type="button" class="remove-bike" aria-label="Remove bike">×</button><div class="serial-fields"></div>';
    const picker = row.querySelector("select"),
      search = row.querySelector(".bike-search");
    function filter() {
      const chosen = picker.value,
        terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean),
        matches = available.filter((b) =>
          terms.every((t) =>
            `${b.brand} ${b.model} ${b.vin} ${b.battery || ""} ${b.motor || ""} ${b.controller || ""} ${b.charger || ""} ${b.color || ""}`
              .toLowerCase()
              .includes(t),
          ),
        ),
        kept = available.find((b) => b.id === chosen && !matches.includes(b));
      picker.innerHTML =
        '<option value="">Choose a bike…</option>' +
        [...(kept ? [kept] : []), ...matches]
          .map(
            (b) =>
              `<option value="${b.id}">${esc(b.brand + " " + b.model + " · " + b.vin)}</option>`,
          )
          .join("");
      picker.value = chosen;
      row.querySelector(".bike-matches").textContent =
        `${matches.length} matches${chosen ? " · HSN " + (available.find((b) => b.id === chosen)?.hsn || DEFAULT_HSN) : ""}`;
    }
    search.oninput = filter;
    picker.onchange = () => {
      const bike = available.find((b) => b.id === picker.value);
      row.querySelector(".serial-fields").innerHTML = bike
        ? `<div class="serial-heading">Component identification<small>Chassis: ${esc(bike.vin)} · Numbers below are saved when this invoice is issued.</small></div><div class="formgrid">${["battery", "motor", "controller", "charger"].map((type) => `<div class="field"><label>${type[0].toUpperCase() + type.slice(1)} number<input data-component="${type}" maxlength="100" value="${esc(bike[type] || "")}" placeholder="Enter serial number"></label></div>`).join("")}</div>`
        : "";

      row.querySelector(".bike-price").value =
        (available.find((b) => b.id === picker.value)?.price || 0) / 100;
      filter();
      invalidate();
      calculate();
    };
    row.querySelector(".remove-bike").onclick = () => {
      row.remove();
      invalidate();
      calculate();
    };
    document.querySelector("#gstlines").append(row);
    filter();
    invalidate();
    calculate();
  }
  document.querySelector("#gstaddbike").onclick = addLine;
  addLine();
  form.oninput = (event) => {
    if (event.target.id === "gstissueconfirm") return;
    invalidate();
    calculate();
  };
  form.onchange = (event) => {
    if (event.target.id === "gstissueconfirm") return;
    if (event.target.name === "customerState" && !form.placeOfSupply.value)
      form.placeOfSupply.value = form.customerState.value;
    if (
      event.target.name === "taxId" &&
      validGstin(form.taxId.value.toUpperCase())
    )
      form.customerState.value = form.taxId.value.slice(0, 2);
    invalidate();
    calculate();
  };
  document.querySelector("#gstpreview").onclick = async (event) => {
    if (!form.reportValidity()) return;
    event.target.disabled = true;
    try {
      const body = payload(),
        result = await api("/invoices/preview", "POST", body);
      review = { fingerprint: JSON.stringify(body), result };
      const panel = document.querySelector("#gstreview");
      panel.hidden = false;
      panel.innerHTML = `<div class="heading"><div><div class="eyebrow">FINAL REVIEW</div><h2>Check before you issue.</h2></div><span class="tag">Nothing posted yet</span></div>${gstInvoiceHtml(result.number, result.invoice, { preview: true, logoBase: appBase })}<div class="panelbody gst-issue-bar"><label class="check-label"><input type="checkbox" id="gstissueconfirm"> I confirm the HSN matches these complete EVs, the price basis, place of supply and next invoice number are correct.</label><button class="primary" type="submit">Issue tax invoice & mark sold ↗</button><p class="form-note">Issue is permanent. The PDF includes a space for the seller's authorised signature.</p></div>`;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      error(e);
    } finally {
      event.target.disabled = false;
    }
  };
  document.querySelector("#gstdraft").onclick = async (event) => {
    if (!form.reportValidity()) return;
    event.target.disabled = true;
    try {
      const response = await fetch(appBase + "/api/invoices/preview/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!response.ok) throw Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "Ride-For-You-DRAFT.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      error(e);
    } finally {
      event.target.disabled = false;
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const body = payload();
    delete body.gstissueconfirm;
    if (!review || review.fingerprint !== JSON.stringify(body)) {
      error(Error("Review the current invoice before issuing."));
      return;
    }
    if (!document.querySelector("#gstissueconfirm")?.checked) {
      error(
        Error("Confirm the reviewed GST and invoice details before issuing."),
      );
      return;
    }
    event.submitter.disabled = true;
    try {
      const result = await api("/invoices", "POST", {
        ...body,
        issueConfirmed: true,
        previewHash: review.result.previewHash,
      });
      await load();
      location.hash = "invoices/" + result.id;
      toast("GST tax invoice issued. Your PDF is ready.");
    } catch (e) {
      error(e);
      event.submitter.disabled = false;
    }
  };
}
