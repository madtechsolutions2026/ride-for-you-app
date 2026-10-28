import { gstInvoiceForm, gstInvoiceView, gstSettingsForm } from "./gst-ui.mjs";
import { EV_HSN, DEFAULT_HSN } from "./gst.mjs";
const appBase = document.documentElement.dataset.base || "";
const app = document.querySelector("#app");
let state,
  authConfig = {},
  otpChallenge = null,
  resendTimer = null;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const rupee = (n) =>
  "₹" +
  (n / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const today = () => new Date().toLocaleDateString("en-CA");
const brand = () =>
  `<div class="brand"><img src="${appBase}/logo.png" alt="Ride For You logo"><div><strong>Ride For You</strong><small>SALES WORKSPACE</small></div></div>`;
async function api(url, method = "GET", body) {
  const r = await fetch(appBase + "/api" + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401 && state) {
      state = null;
      auth();
    }
    throw Error(data.error || "Request failed");
  }
  return data;
}
function toast(t) {
  const x = document.querySelector("#toast");
  x.textContent = t;
  x.style.display = "block";
  setTimeout(() => (x.style.display = "none"), 4000);
}
function error(e) {
  const x = document.querySelector("#error");
  if (x) {
    x.className = "error";
    x.textContent = e.message;
  } else toast(e.message);
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function area(label, name, value = "", extra = "") {
  return `<div class="field ${extra}"><label for="${name}">${label}</label><textarea id="${name}" name="${name}">${esc(value)}</textarea></div>`;
}
function auth() {
  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
  const verifying = Boolean(otpChallenge);
  const configured = authConfig.configured !== false;
  app.innerHTML = `<div class="auth"><section class="authleft">${brand()}<div class="eyebrow">AUTHORIZED TEAM ACCESS</div><h1>${verifying ? "Check your WhatsApp." : "Your workspace, one code away."}</h1><p class="muted">${verifying ? `We sent a six-digit code to <b>${esc(otpChallenge.phone)}</b>. Enter it below to sign in.` : "Sign in using your approved WhatsApp mobile number. No password to remember."}</p><form id="login" class="authform"><div id="error"></div>${!configured ? '<div class="notice">WhatsApp login needs configuration. Contact the workspace administrator.</div>' : ""}${verifying ? field("Six-digit WhatsApp code", "code", "", "text", 'required inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code"') : field("WhatsApp mobile number", "phone", "", "tel", 'required inputmode="tel" maxlength="16" autocomplete="tel" placeholder="+91 98765 43210"')}<button class="primary" ${!configured ? "disabled" : ""}>${verifying ? "Verify & enter workspace" : "Send code on WhatsApp"} ↗</button></form><div class="authhelp">${verifying ? '<button id="resend" class="textbtn" disabled>Resend code in 60s</button><button id="changephone" class="textbtn">Use another number</button><p class="muted">Code expires in 5 minutes. Never share it with anyone.</p>' : '<p class="muted">Only approved owner/staff numbers can access this workspace.</p>'}</div><p class="muted" style="margin-top:35px">Powered by Madtech Solutions</p></section><section class="authright"><div><div class="eyebrow">RIDE FOR YOU · SALES & BILLING</div><h1>Clear stock.<br>Confident sales.<br>Better journeys.</h1><p>A focused workspace for your dealership.<br>Manage every bike and issue professional invoices,<br>with authorized access through WhatsApp.</p><div class="authbadge">✓ WhatsApp verification <span>·</span> Owner workspace</div></div></section></div>`;
  document.querySelector("#login").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    try {
      if (verifying) {
        await api("/auth/otp/verify", "POST", {
          challengeId: otpChallenge.challengeId,
          code: e.target.code.value,
        });
        otpChallenge = null;
        await load();
      } else {
        otpChallenge = await api("/auth/otp/request", "POST", {
          phone: e.target.phone.value,
        });
        auth();
      }
    } catch (x) {
      error(x);
      button.disabled = false;
    }
  };
  if (verifying) {
    let seconds = 60;
    const resend = document.querySelector("#resend");
    resendTimer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
        resend.disabled = false;
        resend.textContent = "Resend code";
      } else resend.textContent = `Resend code in ${seconds}s`;
    }, 1000);
    resend.onclick = async () => {
      resend.disabled = true;
      try {
        otpChallenge = await api("/auth/otp/request", "POST", {
          phone: otpChallenge.phone,
        });
        auth();
      } catch (x) {
        error(x);
        resend.disabled = false;
      }
    };
    document.querySelector("#changephone").onclick = () => {
      otpChallenge = null;
      auth();
    };
  }
}
async function load() {
  try {
    state = await api("/state");
    render();
  } catch (e) {
    if (!state) {
      const s = await api("/session");
      authConfig = s;
      auth();
    } else error(e);
  }
}
function shell(content, route) {
  const active = route.split("/")[0];
  app.innerHTML = `<div class="shell"><aside>${brand()}<nav class="nav">${[
    ["overview", "◫", "Overview"],
    ["inventory", "◇", "Bike inventory"],
    ["invoices", "▤", "Invoices"],
    ["settings", "⚙", "Business settings"],
  ]
    .map(
      ([r, i, t]) =>
        `<a class="${r === active ? "active" : ""}" href="#${r}"><span>${i}</span>${t}</a>`,
    )
    .join(
      "",
    )}</nav><div class="asidefoot"><b>Made for the road ahead.</b>Ride For You · Sales & billing<hr style="border:0;border-top:1px solid #38604a;margin:18px 0">Built by Madtech Solutions</div></aside><div class="content"><header><span>Workspace <span style="margin:0 12px;color:#bcc6bb">/</span> <b style="color:#315c3d">${{ overview: "Overview", inventory: "Bike inventory", invoices: "Invoices", settings: "Business settings" }[active] || "Workspace"}</b></span><div class="user"><span class="avatar">O</span><span class="muted">Owner access</span><button id="logout" class="smallbtn">Sign out</button></div></header><main class="workspace">${content}</main></div></div>`;
  document.querySelector("#logout").onclick = async () => {
    await api("/logout", "POST", {});
    state = null;
    otpChallenge = null;
    auth();
  };
}
function heading(k, t, sub, actions = "") {
  return `<div class="heading"><div><div class="eyebrow">${k}</div><h1>${t}</h1><div class="muted">${sub}</div></div><div class="actions">${actions}</div></div>`;
}
function empty(title, desc, href, button) {
  return `<div class="empty"><b>${title}</b><p>${desc}</p>${href ? `<a href="${href}"><button class="primary">${button}</button></a>` : ""}</div>`;
}
function invoiceTable(rows) {
  return rows.length
    ? `<div class="scroll"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Total</th><th>Balance</th><th></th></tr></thead><tbody>${rows.map((i) => `<tr><td><b>${esc(i.number)}</b><small>${i.body.lines.length} bike${i.body.lines.length > 1 ? "s" : ""}</small></td><td>${esc(i.body.customer.name)}<small>${esc(i.body.customer.phone)}</small></td><td>${esc(i.body.date)}</td><td>${rupee(i.total)}</td><td>${i.total - i.paid ? `<span class="balance">${rupee(i.total - i.paid)}</span>` : '<span class="tag">Paid</span>'}</td><td><a href="#invoices/${i.id}">View ↗</a></td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "Your next sale starts here.",
        "Create an invoice to build your sales history.",
        "#invoices/new",
        "Create invoice",
      );
}
function render() {
  if (!state) return;
  const route = location.hash.slice(1) || "overview";
  if (route === "inventory/import") return bulkImport(route);
  if (route === "inventory/new" || route.startsWith("inventory/edit/"))
    return bikeForm(route);
  if (route === "invoices/new") return invoiceForm(route);
  if (route.startsWith("invoices/")) return invoiceView(route);
  if (route === "settings") return settings(route);
  if (route === "inventory") return inventory(route);
  if (route === "invoices") return invoices(route);
  overview(route);
}
function overview(route) {
  const bikes = state.bikes,
    inv = state.invoices;
  const available = bikes.filter((b) => b.status === "available");
  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const recent = inv.filter((i) => i.body.date.startsWith(month));
  shell(
    heading(
      "THE SALES OVERVIEW",
      "Good business starts with a clear view.",
      "Your bikes, sales and invoices, all in one place.",
      `<a href="#inventory/new"><button>+ Add bike</button></a><a href="#invoices/new"><button class="primary">Create invoice ↗</button></a>`,
    ) +
      `<div class="stats"><div class="stat"><small>Available bikes</small><strong>${available.length.toString().padStart(2, "0")}</strong><em>Ready for their next owner</em></div><div class="stat"><small>Inventory at cost</small><strong>${rupee(available.reduce((n, b) => n + b.cost, 0))}</strong><em>Available stock purchase value</em></div><div class="stat"><small>Sales this month</small><strong>${rupee(recent.reduce((n, i) => n + i.total, 0))}</strong><em>${recent.reduce((n, i) => n + i.body.lines.length, 0)} bikes invoiced · incl. entered tax</em></div><div class="stat"><small>Outstanding balance</small><strong>${rupee(inv.reduce((n, i) => n + i.total - i.paid, 0))}</strong><em>As recorded when invoiced</em></div></div><div class="hero"><div><div class="eyebrow">READY, SET, RIDE</div><h2>A smooth handover starts here.</h2><p>Add your bikes, enter the customer's details, and download an invoice carrying your dealership's name.</p><a href="#settings">Complete business details →</a></div><div class="art">↗</div></div><section class="panel"><div class="panelhead"><h2>Recent invoices</h2><a href="#invoices">View all →</a></div>${invoiceTable(inv.slice(0, 6))}</section>`,
    route,
  );
}
function inventory(route) {
  shell(
    heading(
      "YOUR STOCKROOM",
      "Every bike, accounted for.",
      "Individual bikes tracked by their unique chassis or frame number.",
      `<button id="export">Export CSV</button><a href="#inventory/import"><button>↑ Bulk upload</button></a><a href="#inventory/new"><button class="primary">+ Add bike</button></a>`,
    ) +
      `<div class="search"><input id="search" placeholder="Search model, brand or chassis number…" aria-label="Search inventory"><select id="status"><option value="">All bikes</option><option value="available">Available</option><option value="sold">Sold</option></select></div><section class="panel" id="biketable"></section>`,
    route,
  );
  function draw() {
    const q = document.querySelector("#search").value.toLowerCase(),
      filter = document.querySelector("#status").value;
    const bikes = state.bikes.filter(
      (b) =>
        (!filter || b.status === filter) &&
        `${b.model} ${b.brand} ${b.vin}`.toLowerCase().includes(q),
    );
    document.querySelector("#biketable").innerHTML = bikes.length
      ? `<div class="scroll"><table><thead><tr><th>Bike</th><th>Chassis / frame</th><th>Purchase cost</th><th>Selling price</th><th>Status</th><th></th></tr></thead><tbody>${bikes.map((b) => `<tr><td><b>${esc(b.brand)} ${esc(b.model)}</b><small>${esc(b.color || "Colour not entered")}</small></td><td>${esc(b.vin)}<small>${esc(b.battery)}</small></td><td>${rupee(b.cost)}</td><td>${rupee(b.price)}</td><td><span class="tag ${b.status}">${b.status === "sold" ? "Sold" : "Available"}</span></td><td>${b.status === "available" ? `<a href="#inventory/edit/${b.id}">Edit ↗</a>` : "—"}</td></tr>`).join("")}</tbody></table></div>`
      : empty(
          "No bikes to show.",
          "Add your first bike or adjust your search.",
          "#inventory/new",
          "Add a bike",
        );
  }
  draw();
  document.querySelector("#search").oninput = draw;
  document.querySelector("#status").onchange = draw;
  document.querySelector("#export").onclick = () =>
    csv("bike-inventory.csv", [
      [
        "Brand",
        "Model",
        "Chassis",
        "Colour",
        "Purchase cost INR",
        "Selling price INR",
        "Status",
      ],
      ...state.bikes.map((b) => [
        b.brand,
        b.model,
        b.vin,
        b.color,
        b.cost / 100,
        b.price / 100,
        b.status,
      ]),
    ]);
}
function bikeForm(route) {
  const id = route.split("/")[2];
  const b = state.bikes.find((x) => x.id === id) || {};
  if (id && (!b.id || b.status === "sold")) {
    location.hash = "inventory";
    return;
  }
  shell(
    heading(
      "BIKE INVENTORY",
      id ? "Edit bike details." : "Add a bike to your inventory.",
      "Enter one physical bike per record. Chassis numbers must be unique.",
      `<a href="#inventory">← Back to inventory</a>`,
    ) +
      `<form id="bikeform" class="panel"><div class="panelbody"><div id="error"></div><div class="formgrid">${field("Brand *", "brand", b.brand, "text", 'required maxlength="100"')}${field("Model / variant *", "model", b.model, "text", 'required maxlength="100"')}${field("Chassis / frame number *", "vin", b.vin, "text", 'required maxlength="100"')}${field("Colour", "color", b.color)}${field("Battery / motor serial number", "battery", b.battery)}${field("Purchase cost (₹) *", "cost", b.cost != null ? b.cost / 100 : "", "number", 'required min="0" step="0.01"')}${field("Default selling price (₹) *", "price", b.price != null ? b.price / 100 : "", "number", 'required min="0" step="0.01"')}<div class="field full"><label for="hsn">Complete EV category / HSN *</label><select name="hsn" id="hsn">${Object.entries(
        EV_HSN,
      )
        .map(
          ([code, label]) =>
            `<option value="${code}" ${code === (b.hsn || DEFAULT_HSN) ? "selected" : ""}>${esc(label)} · ${code}</option>`,
        )
        .join(
          "",
        )}</select><small>Choose the classification that matches the actual vehicle. Batteries, chargers and parts are excluded.</small></div>${area("Internal notes", "notes", b.notes, "full")}</div></div><div class="formfooter"><a href="#inventory"><button type="button">Cancel</button></a><button class="primary">${id ? "Save changes" : "Add bike"} ↗</button></div></form>`,
    route,
  );
  document.querySelector("#bikeform").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    try {
      await api(
        "/bikes" + (id ? "/" + id : ""),
        id ? "PUT" : "POST",
        Object.fromEntries(new FormData(e.target)),
      );
      location.hash = "inventory";
      await load();
      toast(id ? "Bike updated" : "Bike added to inventory");
    } catch (x) {
      error(x);
      button.disabled = false;
    }
  };
}
function invoices(route) {
  shell(
    heading(
      "SALES & BILLING",
      "Invoices, neatly in order.",
      "Branded PDF invoices with customer and individual bike details.",
      `<button id="export">Export CSV</button><a href="#invoices/new"><button class="primary">+ Create invoice</button></a>`,
    ) +
      `<div class="search"><input id="search" placeholder="Search invoice number or customer…" aria-label="Search invoices"><div class="datefilters">Month <input id="month" type="month"><button id="clear" class="smallbtn">Clear</button></div></div><section class="panel" id="invoicetable"></section>`,
    route,
  );
  function draw() {
    const q = document.querySelector("#search").value.toLowerCase(),
      m = document.querySelector("#month").value;
    const rows = state.invoices.filter(
      (i) =>
        (!m || i.body.date.startsWith(m)) &&
        `${i.number} ${i.body.customer.name} ${i.body.customer.phone}`
          .toLowerCase()
          .includes(q),
    );
    document.querySelector("#invoicetable").innerHTML = invoiceTable(rows);
  }
  draw();
  document.querySelector("#search").oninput = draw;
  document.querySelector("#month").onchange = draw;
  document.querySelector("#clear").onclick = () => {
    document.querySelector("#month").value = "";
    draw();
  };
  document.querySelector("#export").onclick = () =>
    csv("sales-invoices.csv", [
      [
        "Invoice",
        "Date",
        "Customer",
        "Phone",
        "Salesperson",
        "Bikes",
        "Total INR",
        "Received INR",
        "Balance INR",
        "Document type",
        "Buyer GSTIN",
        "Place of supply",
        "Price basis",
        "HSN codes",
        "Taxable INR",
        "CGST INR",
        "SGST/UTGST INR",
        "IGST INR",
      ],
      ...state.invoices.map((i) => [
        i.number,
        i.body.date,
        i.body.customer.name,
        i.body.customer.phone,
        i.body.salesperson,
        i.body.lines.length,
        i.total / 100,
        i.paid / 100,
        (i.total - i.paid) / 100,
        i.body.version === 2 ? "GST tax invoice" : "Legacy sales invoice",
        i.body.customer.taxId,
        i.body.placeOfSupply || "",
        i.body.priceMode || "",
        [...new Set(i.body.lines.map((l) => l.hsn).filter(Boolean))].join("; "),
        ...["taxable", "cgst", "sgst", "igst"].map((k) =>
          i.body[k] === undefined ? "" : i.body[k] / 100,
        ),
      ]),
    ]);
}
function invoiceForm(route) {
  return gstInvoiceForm({
    state,
    route,
    shell,
    heading,
    api,
    load,
    toast,
    error,
    appBase,
  });
}
function invoiceView(route) {
  const i = state.invoices.find((x) => x.id === route.split("/")[1]);
  if (!i) {
    location.hash = "invoices";
    return;
  }
  if (i.body.version === 2)
    return gstInvoiceView({ row: i, route, shell, heading, appBase });
  const b = i.body,
    seller = b.seller;
  shell(
    heading(
      "SALES DOCUMENT",
      esc(i.number),
      "Issued invoice · saved sale details cannot be changed.",
      `<a href="#invoices"><button>← All invoices</button></a><a href="${appBase}/api/invoices/${i.id}/pdf"><button class="primary">↓ Download invoice PDF</button></a>`,
    ) +
      `<div class="invoice-sheet"><div class="invoice-top"><div class="invoice-identity"><img src="${appBase}/logo.png" alt="Ride For You mobile app logo"><div><h2>${esc(seller.name)}</h2><p>${esc(seller.address)}<br>${esc(seller.phone)} ${esc(seller.email)}${seller.taxId ? "<br>Tax ID / GSTIN: " + esc(seller.taxId) : ""}</p></div></div><div class="invoice-ref"><div class="eyebrow">SALES INVOICE</div><h2>${esc(i.number)}</h2><p>${esc(b.date)}</p><span class="tag ${b.balance ? "due" : ""}">${b.balance === 0 ? "Paid" : b.paid ? "Partially paid" : "Unpaid"}</span></div></div><div class="invoice-parties"><section><div class="eyebrow">BILLED TO</div><h3>${esc(b.customer.name)}</h3><p>${esc(b.customer.address)}<br>Phone: ${esc(b.customer.phone)}${b.customer.taxId ? "<br>Tax ID / GSTIN: " + esc(b.customer.taxId) : ""}</p></section><section><div class="eyebrow">SALE DETAILS</div><dl><dt>Payment method</dt><dd>${esc(b.method)}</dd><dt>Salesperson</dt><dd>${esc(b.salesperson || "—")}</dd><dt>Bikes supplied</dt><dd>${b.lines.length}</dd></dl></section></div><div class="scroll"><table class="invoice-items"><thead><tr><th>No.</th><th>Bike & identification</th><th>Qty</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead><tbody>${b.lines.map((l, n) => `<tr><td>${n + 1}</td><td><b>${esc(l.brand + " " + l.model)}</b><small>Chassis / frame: ${esc(l.vin)}</small><small>${esc(l.color ? "Colour: " + l.color : "")}${l.battery ? " · Battery / motor serial: " + esc(l.battery) : ""}</small></td><td>1</td><td class="right">${rupee(l.salePrice)}</td><td class="right"><b>${rupee(l.salePrice)}</b></td></tr>`).join("")}</tbody></table></div><div class="invoice-bottom"><div><div class="eyebrow">SALE SUMMARY</div><p>${b.lines.length} bike${b.lines.length === 1 ? "" : "s"} supplied.<br>Amounts shown in Indian Rupees (INR).</p><p class="muted">Payment amounts reflect the seller’s recorded receipt at invoice issue.</p>${seller.bank ? `<h3>Payment / bank details</h3><p class="prewrap">${esc(seller.bank)}</p>` : ""}</div><div class="invoice-totalbox">${[
        ["Subtotal", b.subtotal],
        ["Discount", -b.discount],
        [`Tax (${b.taxRate / 100}%)`, b.tax],
        ["Invoice total", b.total],
        ["Amount received", b.paid],
        ["Balance due", b.balance],
      ]
        .map(
          ([k, v]) =>
            `<div class="${k === "Invoice total" ? "grand" : k === "Balance due" ? "balance-row" : ""}"><span>${k}</span><b>${rupee(v)}</b></div>`,
        )
        .join(
          "",
        )}</div></div>${b.notes ? `<div class="invoice-note"><div class="eyebrow">NOTES / WARRANTY / TERMS</div><p class="prewrap">${esc(b.notes)}</p></div>` : ""}<p class="invoice-thanks">${esc(seller.footer)}</p><div class="invoice-signatures"><span>Customer acknowledgment</span><span>For ${esc(seller.name)}</span></div></div>`,
    route,
  );
}
function settings(route) {
  return gstSettingsForm({
    state,
    route,
    shell,
    heading,
    api,
    load,
    toast,
    error,
  });
}
function bulkImport(route) {
  let savedCsv = "",
    requestKey = crypto.randomUUID();
  shell(
    heading(
      "BULK INVENTORY UPLOAD",
      "Bring your stock in, all at once.",
      "Upload up to 500 bikes from a CSV. Preview and correct errors before saving.",
      `<a href="#inventory">← Back to inventory</a>`,
    ) +
      `<div class="invoice-steps"><span><b>01</b> Download template</span><span><b>02</b> Upload & preview</span><span><b>03</b> Import inventory</span></div><section class="panel"><div class="panelhead"><h2>Prepare your inventory file</h2><a href="${appBase}/api/inventory/template"><button>↓ CSV template</button></a></div><div class="panelbody"><p class="muted">Use these columns: <b>brand, model, vin, color, battery, cost, price, notes</b>. Brand, model, unique chassis/frame number (vin), purchase cost and selling price are required. Amounts are in rupees without currency symbols or commas. Optional fields may be empty.</p><div class="upload-zone"><label for="csvfile"><b>Choose your inventory CSV</b><span>Export Excel / Google Sheets as CSV · max 800 KB · 500 bikes</span></label><input type="file" id="csvfile" accept=".csv,text/csv"><button class="primary" id="previewcsv">Preview inventory →</button></div><p class="form-note">Replace the template example row. Every imported bike starts as Available. No bikes are added until you confirm the preview.</p><div id="error"></div></div></section><section id="importpreview"></section>`,
    route,
  );
  document.querySelector("#csvfile").onchange = () => {
    savedCsv = "";
    requestKey = crypto.randomUUID();
    document.querySelector("#importpreview").innerHTML = "";
    document.querySelector("#error").innerHTML = "";
    document.querySelector("#error").className = "";
  };
  document.querySelector("#previewcsv").onclick = async () => {
    const file = document.querySelector("#csvfile").files[0];
    if (!file) {
      error(Error("Choose a CSV file first."));
      return;
    }
    if (file.size > 800000) {
      error(Error("File is too large. Maximum size: 800 KB."));
      return;
    }
    const button = document.querySelector("#previewcsv");
    button.disabled = true;
    try {
      savedCsv = await file.text();
      const result = await api("/inventory/import/preview", "POST", {
        csv: savedCsv,
      });
      document.querySelector("#error").innerHTML = "";
      document.querySelector("#error").className = "";
      document.querySelector("#importpreview").innerHTML =
        `<section class="panel"><div class="panelhead"><h2>Review before importing</h2><span class="tag ${result.errors.length ? "due" : ""}">${result.valid} valid / ${result.total} rows</span></div>${
          result.errors.length
            ? `<div class="panelbody"><div class="error">Nothing will be imported until every error is corrected.</div><div class="scroll"><table><thead><tr><th>CSV row</th><th>Chassis</th><th>Error</th></tr></thead><tbody>${result.errors
                .slice(0, 100)
                .map(
                  (e) =>
                    `<tr><td>${e.row}</td><td>${esc(e.chassis)}</td><td>${esc(e.message)}</td></tr>`,
                )
                .join(
                  "",
                )}</tbody></table></div>${result.errors.length > 100 ? "<p>Only the first 100 errors are shown.</p>" : ""}</div>`
            : ""
        }<div class="scroll"><table><thead><tr><th>Brand / model</th><th>Chassis / frame</th><th>Purchase cost</th><th>Selling price</th></tr></thead><tbody>${result.rows
          .slice(0, 20)
          .map(
            (b) =>
              `<tr><td>${esc(b.brand + " " + b.model)}</td><td>${esc(b.vin)}</td><td>${rupee(b.cost)}</td><td>${rupee(b.price)}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div><div class="formfooter"><span class="muted">${result.rows.length > 20 ? "First 20 valid rows shown. " : ""}${result.total} rows in this file.</span><button id="commitimport" class="primary" ${result.errors.length ? "disabled" : ""}>Import ${result.valid} bikes ↗</button></div></section>`;
      document.querySelector("#commitimport").onclick = async (e) => {
        const commit = e.target;
        commit.disabled = true;
        try {
          const r = await api("/inventory/import", "POST", {
            csv: savedCsv,
            requestKey,
          });
          location.hash = "inventory";
          await load();
          toast(`${r.imported} bikes imported successfully`);
        } catch (x) {
          error(x);
          commit.disabled = false;
        }
      };
    } catch (x) {
      error(x);
    } finally {
      button.disabled = false;
    }
  };
}
function csv(name, rows) {
  const content =
    "\ufeff" +
    rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[=+@\-\t\r]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
window.onhashchange = () => {
  render();
  window.scrollTo(0, 0);
};
load();
