import {
  esc,
  cash,
  field,
  area,
  select,
  panel,
  customerFields,
  downloadPdf,
  showFormError,
} from "../../shared/ui.mjs";
import { productTotals } from "../../domain/totals.mjs";
import { documentHtml, totalsHtml } from "../documents/view.mjs";
export async function batteryScreen(ctx) {
  const { state, route, shell, heading, api, load, toast, error, appBase } =
      ctx,
    current = () => location.hash.slice(1) === route;
  try {
    const [, action, id] = route.split("/"),
      packs = await api("/batteries");
    if (!current()) return;
    if (action === "sale") return saleForm(ctx, packs, id);
    if (action === "new" || action === "edit") {
      const pack = action === "edit" ? packs.find((p) => p.id === id) : {};
      if (!pack) throw Error("Battery not found.");
      if (pack.status && pack.status !== "available")
        throw Error(
          "Sold or installed batteries are preserved as read-only records.",
        );
      shell(
        heading(
          "BATTERY INVENTORY",
          action === "edit" ? "Edit battery." : "Receive a separate battery.",
          "Track each physical battery by its unique serial number.",
          '<a href="#batteries">← Battery inventory</a>',
        ) +
          `<form id="batteryform" class="panel"><div class="panelbody"><div id="error"></div><div class="formgrid">${field("Brand *", "brand", pack.brand, 'required maxlength="100"')}${field("Model / variant *", "model", pack.model, 'required maxlength="100"')}${field("Battery serial number *", "serial", pack.serial, 'required maxlength="100"')}${field("Battery type / chemistry", "chemistry", pack.chemistry, 'maxlength="80" placeholder="e.g. Lithium-ion, LFP, lead-acid"')}${field("Voltage", "voltage", pack.voltage, 'maxlength="60" placeholder="e.g. 48 V"')}${field("Capacity", "capacity", pack.capacity, 'maxlength="60" placeholder="e.g. 30 Ah"')}${field("Purchase cost (₹) *", "cost", pack.cost == null ? "" : pack.cost / 100, 'required type="number" min="0" step="0.01"')}${field("Default selling price (₹) *", "price", pack.price == null ? "" : pack.price / 100, 'required type="number" min="0.01" step="0.01"')}${field("HSN · enter supplier / accountant classification", "hsn", pack.hsn, 'maxlength="8" inputmode="numeric"')}${field("GST % · enter applicable rate", "gstPercent", pack.gst_bps == null ? "" : pack.gst_bps / 100, 'type="number" min="0.01" max="40" step="0.01"')}${field("Warranty coverage", "warranty", pack.warranty, 'maxlength="150"')}${field("Warranty provider", "provider", pack.provider, 'maxlength="150"')}${area("Warranty terms / exclusions", "warranty_terms", pack.warranty_terms)}</div><p class="form-note">HSN and GST may be completed before sale. Each battery invoice shows and confirms the entered rate. Inventory receipts do not create sales invoices.</p></div><div class="formfooter"><a href="#batteries">Cancel</a><button class="primary">Save battery →</button></div></form>`,
        route,
      );
      document.querySelector("#batteryform").onsubmit = async (e) => {
        e.preventDefault();
        const button = e.submitter;
        button.disabled = true;
        try {
          const saved = await api(
            "/batteries" + (action === "edit" ? "/" + id : ""),
            action === "edit" ? "PUT" : "POST",
            {
              ...Object.fromEntries(new FormData(e.target)),
              version: pack.version,
            },
          );
          await load();
          location.hash = "batteries/" + saved.id;
          toast("Battery inventory saved");
        } catch (x) {
          showFormError(x, error);
          button.disabled = false;
        }
      };
      return;
    }
    if (action) {
      const detail = await api("/batteries/" + action);
      if (!current()) return;
      const p = detail.battery;
      shell(
        heading(
          "BATTERY PASSPORT",
          esc(p.brand + " " + p.model),
          `Serial ${esc(p.serial)} · ${esc(p.status)}`,
          `<a href="#batteries">← Batteries</a>${p.status === "available" ? `<a href="#batteries/edit/${p.id}">Edit details</a><a class="primary download-link" href="#batteries/sale/${p.id}">Create battery invoice ↗</a>` : ""}`,
        ) +
          panel(
            "Battery details",
            `<div class="component-cards">${[
              ["Serial", p.serial],
              ["Type", p.chemistry],
              ["Voltage", p.voltage],
              ["Capacity", p.capacity],
              ["Purchase cost", cash(p.cost)],
              ["Selling price", cash(p.price)],
              ["HSN", p.hsn],
              [
                "GST %",
                p.gst_bps == null ? "Not entered" : p.gst_bps / 100 + "%",
              ],
              ["Warranty", p.warranty],
              ["Provider", p.provider],
            ]
              .map(
                ([k, v]) =>
                  `<div><small>${k}</small><b>${esc(v || "Not recorded")}</b></div>`,
              )
              .join(
                "",
              )}</div>${p.warranty_terms ? '<p class="prewrap">' + esc(p.warranty_terms) + "</p>" : ""}`,
          ) +
          (detail.sale
            ? panel(
                "Sold to customer",
                `<h3>${esc(detail.sale.body.customer.name)}</h3><p class="prewrap">${esc(detail.sale.body.customer.address)}<br>${esc(detail.sale.body.customer.phone)}</p><a href="#invoices/${detail.sale.id}">${esc(detail.sale.number)} · ${esc(detail.sale.body.date)} ↗</a>`,
              )
            : detail.installedBike
              ? panel(
                  "Installed in bike",
                  `<a href="#vehicles/${detail.installedBike.id}">${esc(detail.installedBike.brand + " " + detail.installedBike.model + " · " + detail.installedBike.vin)} ↗</a>`,
                )
              : "") +
          panel(
            "Stock history",
            `<div class="service-timeline">${detail.events.map((e) => `<div class="service-event"><b>${esc({ received: "Received into battery stock", updated: "Inventory details updated", sold: "Sold separately to customer", installed: "Installed during bike service" }[e.kind] || e.kind)}</b><small>${new Date(e.created).toLocaleString("en-IN")}</small>${e.body.number ? "<p>Invoice " + esc(e.body.number) + "</p>" : ""}${e.body.jobNumber ? "<p>Service " + esc(e.body.jobNumber) + "</p>" : ""}</div>`).join("")}</div>`,
          ),
        route,
      );
      return;
    }
    shell(
      heading(
        "SERIALIZED STOCK",
        "Battery inventory.",
        "Separate stock, customer sales, warranties and installation history.",
        '<a href="#batteries/sale">Create battery invoice</a><a class="primary download-link" href="#batteries/new">+ Add battery</a>',
      ) +
        `<div class="service-summary"><div>Available<strong>${packs.filter((p) => p.status === "available").length}</strong></div><div>Sold separately<strong>${packs.filter((p) => p.status === "sold").length}</strong></div><div>Installed in bikes<strong>${packs.filter((p) => p.status === "installed").length}</strong></div><div>Available at cost<strong>${cash(packs.filter((p) => p.status === "available").reduce((n, p) => n + p.cost, 0))}</strong></div></div><div class="search"><input id="batterySearch" type="search" aria-label="Search batteries" placeholder="Search serial, brand, model or capacity"><select id="batteryStatus" aria-label="Battery status"><option value="">All statuses</option><option value="available">Available</option><option value="sold">Sold</option><option value="installed">Installed</option></select></div><section class="panel" id="batteryTable"></section>`,
      route,
    );
    const draw = () => {
      const q = document.querySelector("#batterySearch").value.toLowerCase(),
        status = document.querySelector("#batteryStatus").value;
      const rows = packs.filter(
        (p) =>
          (!status || p.status === status) &&
          [p.brand, p.model, p.serial, p.chemistry, p.voltage, p.capacity]
            .join(" ")
            .toLowerCase()
            .includes(q),
      );
      document.querySelector("#batteryTable").innerHTML = rows.length
        ? `<div class="scroll"><table><thead><tr><th>Battery</th><th>Serial number</th><th>Specification</th><th>Selling price</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((p) => `<tr><td><b>${esc(p.brand + " " + p.model)}</b></td><td>${esc(p.serial)}</td><td>${esc([p.chemistry, p.voltage, p.capacity].filter(Boolean).join(" · "))}</td><td>${cash(p.price)}</td><td><span class="tag">${esc(p.status)}</span></td><td><a href="#batteries/${p.id}">History & details ↗</a></td></tr>`).join("")}</tbody></table></div>`
        : '<div class="empty"><b>No batteries to show.</b><p>Add stock or change your search.</p></div>';
    };
    draw();
    document.querySelector("#batterySearch").oninput = draw;
    document.querySelector("#batteryStatus").onchange = draw;
  } catch (e) {
    if (current() && e.status !== 401)
      shell(
        heading(
          "BATTERIES",
          "Unable to open this page.",
          esc(e.message),
          '<a href="#batteries">← Battery inventory</a>',
        ),
        route,
      );
  }
}
function saleForm(ctx, packs, chosen) {
  const { state, route, shell, heading, api, load, toast, error, appBase } =
      ctx,
    available = packs.filter((p) => p.status === "available"),
    key = crypto.randomUUID();
  if (!available.length) {
    shell(
      heading(
        "BATTERY SALE",
        "Receive battery stock first.",
        "Only available, separately tracked batteries can be sold.",
        '<a href="#batteries/new">+ Add battery</a>',
      ),
      route,
    );
    return;
  }
  shell(
    heading(
      "BATTERY TAX INVOICE",
      "Sell a separate battery.",
      "Review the serial number, warranty, HSN and owner-entered GST for every pack.",
      '<a href="#batteries">← Batteries</a>',
    ) +
      `<form id="batteryinvoice" class="commerce-form"><div id="error" role="alert"></div><div class="split"><div>${panel("Customer & delivery", customerFields(state.settings))}${panel("Batteries to sell", '<div id="batteryLines"></div><label class="check-label"><input type="checkbox" name="taxConfirmed" required>I have checked the HSN and GST rate entered for each separate battery.</label>', '<button type="button" id="addBatteryLine">+ Add battery</button>')}${panel("Additional terms", area("Invoice notes / delivery terms", "notes", "", 1500))}</div><aside class="commerce-side">${panel("Invoice summary", `<div class="formgrid">${field("Discount (₹)", "discount", 0, 'type="number" min="0" step="0.01"')}${field("Amount received (₹)", "paid", 0, 'type="number" min="0" step="0.01"')}</div><div id="batteryTotals" class="invoice-totalbox"></div><div class="service-job-actions"><button type="button" class="primary" id="batteryReview">Review battery invoice →</button><button type="button" id="batteryDraft">Download draft PDF</button></div>`)}</aside></div><section id="batteryReviewPanel" hidden></section></form>`,
    route,
  );
  const form = document.querySelector("#batteryinvoice");
  form.elements.address.required = true;
  let review = null;
  const payload = () => ({
    ...Object.fromEntries(new FormData(form)),
    requestKey: key,
    taxConfirmed: form.elements.taxConfirmed.checked,
    lines: [...document.querySelectorAll(".battery-sale-line")].map((row) =>
      Object.fromEntries(
        [...row.querySelectorAll("[data-line]")].map((input) => [
          input.dataset.line,
          input.value,
        ]),
      ),
    ),
  });
  const invalidate = () => {
    review = null;
    document.querySelector("#batteryReviewPanel").hidden = true;
  };
  const calc = () => {
    try {
      const p = payload(),
        totals = productTotals(
          p.lines
            .filter((l) => l.id)
            .map((l) => ({
              ...available.find((b) => b.id === l.id),
              salePrice: Math.round(Number(l.price) * 100),
              hsn: l.hsn,
              gstRate: Math.round(Number(l.gstPercent) * 100),
            })),
          Math.round(Number(p.discount || 0) * 100),
          p.priceMode,
          state.settings.stateCode,
          p.placeOfSupply,
        );
      totals.paid = Math.round(Number(p.paid || 0) * 100);
      document.querySelector("#batteryTotals").innerHTML = totalsHtml(totals);
    } catch (e) {
      document.querySelector("#batteryTotals").innerHTML =
        '<p class="muted">' + esc(e.message) + "</p>";
    }
  };
  function addLine(id = "") {
    const row = document.createElement("section");
    row.className = "battery-sale-line";
    row.innerHTML = `<div class="formgrid"><div class="field full"><label>Search battery<input type="search" class="battery-line-search" placeholder="Serial, brand or model"></label></div><div class="field full"><label>Battery to sell<select data-line="id" aria-label="Battery to sell" required><option value="">Choose a battery…</option>${available.map((p) => `<option value="${p.id}">${esc(p.brand + " " + p.model + " · " + p.serial)}</option>`).join("")}</select></label></div><div class="field"><label>Price ₹<input data-line="price" required type="number" min="0.01" step="0.01"></label></div><div class="field"><label>HSN<input data-line="hsn" required maxlength="8" inputmode="numeric"></label></div><div class="field"><label>GST %<input data-line="gstPercent" required type="number" min="0.01" max="40" step="0.01"></label></div></div><p class="battery-line-details form-note"></p><button type="button" class="remove-battery">Remove battery</button>`;
    const select = row.querySelector("select");
    select.onchange = () => {
      const p = available.find((b) => b.id === select.value);
      row.querySelector("[data-line=price]").value = p ? p.price / 100 : "";
      row.querySelector("[data-line=hsn]").value = p?.hsn || "";
      row.querySelector("[data-line=gstPercent]").value =
        p?.gst_bps == null ? "" : p.gst_bps / 100;
      row.querySelector(".battery-line-details").textContent = p
        ? `Serial: ${p.serial} · ${[p.chemistry, p.voltage, p.capacity].filter(Boolean).join(" · ")} · Warranty: ${p.warranty || "Not recorded"}`
        : "";
      invalidate();
      calc();
    };
    row.querySelector(".battery-line-search").oninput = (e) => {
      const q = e.target.value.toLowerCase(),
        keep = select.value;
      select.innerHTML =
        '<option value="">Choose a battery…</option>' +
        available
          .filter(
            (p) =>
              p.id === keep ||
              [p.brand, p.model, p.serial].join(" ").toLowerCase().includes(q),
          )
          .map(
            (p) =>
              `<option value="${p.id}">${esc(p.brand + " " + p.model + " · " + p.serial)}</option>`,
          )
          .join("");
      select.value = keep;
    };
    row.querySelector(".remove-battery").onclick = () => {
      row.remove();
      invalidate();
      calc();
    };
    document.querySelector("#batteryLines").append(row);
    if (id) {
      select.value = id;
      select.onchange();
    }
  }
  addLine(chosen || "");
  document.querySelector("#addBatteryLine").onclick = () => addLine();
  form.oninput = () => {
    invalidate();
    calc();
  };
  form.onchange = () => {
    invalidate();
    calc();
  };
  document.querySelector("#batteryReview").onclick = async (e) => {
    if (!form.reportValidity()) return;
    e.target.disabled = true;
    try {
      const body = payload(),
        result = await api("/battery-invoices/preview", "POST", body);
      review = { fingerprint: JSON.stringify(body), result };
      const el = document.querySelector("#batteryReviewPanel");
      el.hidden = false;
      el.innerHTML = panel(
        "Review before issue",
        documentHtml(result.number, result.invoice, {
          preview: true,
          logoBase: appBase,
        }) +
          '<p>Issuing permanently records the sale and removes these batteries from available stock.</p><button type="submit" class="primary">Issue battery invoice →</button>',
      );
      el.scrollIntoView({ behavior: "smooth" });
    } catch (x) {
      showFormError(x, error);
    } finally {
      e.target.disabled = false;
    }
  };
  document.querySelector("#batteryDraft").onclick = async (e) => {
    if (!form.reportValidity()) return;
    e.target.disabled = true;
    try {
      await downloadPdf(
        appBase,
        "/battery-invoices/preview/pdf",
        payload(),
        "Ride-For-You-Battery-DRAFT.pdf",
      );
    } catch (x) {
      showFormError(x, error);
    } finally {
      e.target.disabled = false;
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = payload();
    if (!review || review.fingerprint !== JSON.stringify(data)) {
      showFormError(
        Error("Review the current battery invoice before issuing."),
        error,
      );
      return;
    }
    e.submitter.disabled = true;
    try {
      const result = await api("/battery-invoices", "POST", {
        ...data,
        previewHash: review.result.previewHash,
        issueConfirmed: true,
      });
      await load();
      location.hash = "invoices/" + result.id;
      toast("Battery invoice issued");
    } catch (x) {
      showFormError(x, error);
      e.submitter.disabled = false;
    }
  };
  calc();
}
