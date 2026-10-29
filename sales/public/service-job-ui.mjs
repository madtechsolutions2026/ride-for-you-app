import {
  COMPONENTS,
  esc,
  cash,
  stamp,
  field,
  area,
  select,
  tag,
  cards,
  warranty,
  panel,
} from "./service-common.mjs";

const moneyInput = (value) => (value || 0) / 100;
const partInput = (p) => ({
  ...p,
  unitCost: moneyInput(p.unitCost),
  unitCharge: moneyInput(p.unitCharge),
});
const readOnlyParts = (parts) =>
  parts?.length
    ? `<div class="scroll"><table><thead><tr><th>Part / material</th><th>Qty</th><th>Your cost</th><th>Customer charge</th><th>New component number</th></tr></thead><tbody>${parts.map((p) => `<tr><td>${esc(p.description)}</td><td>${p.quantity}</td><td>${cash(p.quantity * p.unitCost)}</td><td>${cash(p.quantity * p.unitCharge)}</td><td>${p.componentType ? esc(COMPONENTS[p.componentType] + ": " + p.newSerial) : "—"}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="muted">No parts or materials recorded.</p>';
const flow = (stage) =>
  `<ol class="service-flow">${["Customer complaint", "Service carried out", "Payment & handover"].map((label, i) => `<li class="${i === stage ? "current" : i < stage ? "done" : ""}" ${i === stage ? 'aria-current="step"' : ""}><b>${String(i + 1).padStart(2, "0")}</b><span>${label}</span></li>`).join("")}</ol>`;

export async function serviceJobScreen(ctx, id, preselected) {
  const { state, route, shell, heading, api, load, toast, error, appBase } =
    ctx;
  const current = () => location.hash.slice(1) === route,
    creating = id === "new";
  const [techs, record, batteryStock] = await Promise.all([
    api("/technicians"),
    creating ? Promise.resolve(null) : api("/services/" + id),
    api("/batteries"),
  ]);
  if (!current()) return;
  const body = record?.body || {},
    closed = record && ["delivered", "cancelled"].includes(record.status),
    received = creating || record.status === "received",
    working =
      record &&
      ["diagnosing", "in_progress", "waiting_parts"].includes(record.status),
    finished = record && ["ready", "delivered"].includes(record.status),
    stage = received ? 0 : working ? 1 : 2,
    key = crypto.randomUUID();
  const sold = state.bikes.filter((b) => b.status === "sold");
  if (creating && !sold.length) {
    shell(
      heading(
        "REGISTER COMPLAINT",
        "Select a sold bike first.",
        "Service visits are linked to a bike’s original sale and customer.",
        '<a href="#invoices">View invoices →</a>',
      ),
      route,
    );
    return;
  }
  const techOptions = [
    ["", "Assign later"],
    ...techs
      .filter((t) => t.active || t.id === record?.technician_id)
      .map((t) => [t.id, t.name + (t.active ? "" : " (inactive)")]),
  ];
  const workFields = working
    ? `${panel("2. Services carried out", `<div class="formgrid">${area("Services carried out", "workPerformed", body.workPerformed)}${area("Inspection notes · optional", "diagnosis", body.diagnosis)}${area("Internal notes", "notes", body.notes, 1500)}</div><p class="form-note">After doing the work, describe each service on a new line. For example: adjusted the rear brake, cleaned battery terminals, and tested charging. This becomes part of this bike’s history.</p>`)}${panel("Parts & materials used", `<p class="form-note">Add only what was actually used. For a battery, motor, controller or charger replacement, record the new component number.</p><div class="scroll"><table class="service-parts"><thead><tr><th>Part / material</th><th>Qty</th><th>Your unit cost ₹</th><th>Customer unit charge ₹</th><th>Replacement type</th><th>New number</th><th>Stock battery</th><th></th></tr></thead><tbody id="serviceParts"></tbody></table></div>`, '<button type="button" id="addPart">+ Add part</button>')}${panel(
        "Service charges",
        `<div class="formgrid">${select(
          "Charge type",
          "chargeType",
          [
            ["paid", "Paid service"],
            ["warranty", "Warranty · free to customer"],
            ["goodwill", "Goodwill · free to customer"],
          ],
          body.chargeType || "paid",
        )}${field("Your labour cost (₹)", "labourCost", moneyInput(body.labourCost), 'type="number" min="0" step="0.01"')}${field("Customer labour charge (₹)", "labourCharge", moneyInput(body.labourCharge), 'type="number" min="0" step="0.01"')}</div><p class="form-note">Your cost is an internal expense. Customer charge is what the customer pays. Warranty and goodwill visits have zero customer charge.</p>`,
      )}`
    : record && !received
      ? panel(
          "2. Services carried out",
          `<p class="prewrap service-completed-work">${esc(body.workPerformed || (closed ? "No completed work recorded." : "Service work has not been recorded yet."))}</p>${body.diagnosis ? `<p><b>Inspection notes</b><br>${esc(body.diagnosis)}</p>` : ""}${body.notes ? `<details><summary>Internal notes</summary><p class="prewrap">${esc(body.notes)}</p></details>` : ""}${body.completedAt ? `<p class="muted">Completed ${stamp(body.completedAt)} · ${esc(body.completedByTechnician || record.technician?.name || "")}</p>` : ""}${readOnlyParts(body.parts)}${body.replacements?.length ? `<p>${body.replacements.map((r) => `${esc(COMPONENTS[r.type])}: ${esc(r.oldSerial || "Not recorded")} → ${esc(r.newSerial)}`).join("<br>")}</p>` : ""}`,
        )
      : "";
  const summary = received
    ? `<h3>${creating ? "Register the complaint first" : "Complaint saved for this bike"}</h3><p>${creating ? "Save the customer’s problem against this bike." : "The complaint is recorded. Assign a technician and select Start service when work begins."}</p><p class="muted">Services carried out, parts and charges are entered after the work begins.</p>`
    : `<div id="serviceTotals" class="invoice-totalbox"></div><p class="form-note">${body.chargeType === "warranty" ? "Warranty visit · coverage is reviewed by the owner against the original terms. " : ""}Service charges and receipts are job records. GST service billing is handled separately.</p>`;
  const actions = creating
    ? '<button class="primary" value="received">Register complaint →</button>'
    : closed
      ? '<p class="notice">This visit is closed. Register a new complaint for another service visit.</p>'
      : record.status === "received"
        ? '<button class="primary" value="in_progress">Start service →</button><button value="received">Save complaint details</button><button value="cancelled">Cancel visit</button>'
        : working
          ? `${record.status === "in_progress" ? '<button class="primary" value="ready">Complete service →</button>' : '<button class="primary" value="in_progress">' + (record.status === "waiting_parts" ? "Resume service" : "Start repair") + " →</button>"}<button value="${record.status}">Save service details</button>${record.status === "in_progress" ? '<button value="waiting_parts">Waiting for parts</button>' : ""}${!record.received ? '<button value="cancelled">Cancel visit</button>' : ""}`
          : `<p>Service is complete. Record the customer’s payment, then hand over the bike.</p>${record.balance > 0 ? '<label class="check-label"><input type="checkbox" name="allowOutstandingDelivery">Owner approves handover with the remaining service balance due</label>' : ""}<button class="primary" value="delivered">Hand over bike →</button><button value="in_progress">Reopen service</button>`;
  const bikePanel = panel(
    "Bike & customer",
    `${creating ? `<div class="search"><input id="vehicleSearch" type="search" aria-label="Search sold bikes" placeholder="Search chassis, model or component number"></div>${select("Sold bike *", "bikeId", [["", "Choose the customer’s bike…"], ...sold.map((b) => [b.id, b.brand + " " + b.model + " · " + b.vin])], preselected)}` : ""}<div id="vehicleDetails"></div>`,
  );
  const complaintFields = received
    ? `<div class="formgrid">${area("Customer complaint *", "complaint", body.complaint)}${field("Odometer reading (km)", "odometer", body.odometer, 'maxlength="30"')}${field("Expected completion", "dueDate", body.dueDate, 'type="date"')}${select("Assigned technician", "technicianId", techOptions, record?.technician_id || "")}${area("Reception notes · optional", "notes", body.notes, 1500)}</div><p class="form-note">Record the customer’s own concerns, one per line. Example: rear brake is loose; bike is not charging. Repair details are recorded after service starts.</p>`
    : `<div class="service-complaint"><p class="prewrap">${esc(body.complaint)}</p><small>Odometer at arrival: ${esc(body.odometer || "Not recorded")} km · Received ${stamp(record.created)}</small></div>${!closed ? `<div class="formgrid">${select("Assigned technician", "technicianId", techOptions, record.technician_id || "")}${working ? field("Expected completion", "dueDate", body.dueDate, 'type="date"') : ""}</div>` : `<p>Technician: <b>${esc(body.completedByTechnician || record.technician?.name || "Unassigned")}</b></p>`}`;
  const activity = record
    ? '<div id="serviceReceipts"></div>' +
      panel(
        "Visit activity",
        `<div class="service-timeline">${record.events.map((e) => `<div class="service-event"><b>${esc(e.description)}</b><small>${stamp(e.created)}${e.data?.technician ? " · " + esc(e.data.technician) : ""}</small></div>`).join("")}</div>`,
      )
    : "";
  shell(
    heading(
      creating ? "NEW SERVICE JOB CARD" : "SERVICE JOB CARD",
      creating ? "Register the customer’s complaint." : esc(record.number),
      creating
        ? "Select the bike and tell the technician what the customer reported."
        : `${tag(record.status)} · ${esc(body.customer.name)} · Chassis ${esc(body.bike.vin)}`,
      '<a href="#service">← Service desk</a>' +
        (record
          ? `<a href="#vehicles/${record.bike_id}">All visits for this bike ↗</a>`
          : ""),
    ) +
      flow(stage) +
      `<form id="serviceform" class="service-job-form"><div id="error" role="alert"></div><div class="split"><div>${bikePanel}${panel("1. Customer complaint", complaintFields)}${workFields}</div><aside class="service-side"><section class="panel"><div class="panelhead"><h2>${received ? "Next step" : "Service summary"}</h2></div><div class="panelbody">${summary}<div class="service-job-actions">${actions}</div></div></section></aside></div></form>${activity}`,
    route,
  );
  const form = document.querySelector("#serviceform");
  if (received) {
    form.elements.complaint.required = true;
    form.elements.complaint.placeholder =
      "Example: rear brake feels loose; bike is not charging.";
  }
  if (working)
    form.elements.workPerformed.placeholder =
      "Example:\nAdjusted rear brake cable.\nCleaned battery terminals.\nTested charging and road-tested the bike.";
  let vehicle = record ? { bike: record.body.bike, sale: record.sale } : null,
    requestVersion = 0;
  function showVehicle(v) {
    vehicle = v;
    document.querySelector("#vehicleDetails").innerHTML =
      `<div class="service-bike-summary"><b>${esc(v.bike.brand + " " + v.bike.model)}</b><p>Chassis <b>${esc(v.bike.vin)}</b><br>${esc(v.sale.body.customer.name)} · ${esc(v.sale.body.customer.phone)}</p><a href="#vehicles/${v.bike.id}">View this bike’s complaint & service history ↗</a></div><details><summary>${creating ? "Component numbers & sale warranty" : "Numbers at this visit & sale warranty"}</summary>${cards(v.bike)}${
        creating
          ? `<div class="formgrid">${Object.entries(COMPONENTS)
              .filter(([k]) => !v.bike[k])
              .map(([k, label]) =>
                field(
                  label + " number · missing on record",
                  "intake_" + k,
                  "",
                  'maxlength="100"',
                ),
              )
              .join("")}</div>`
          : ""
      }${warranty(v.sale.body.warranty)}<a href="#invoices/${v.sale.id}">Original sale invoice ↗</a></details>`;
  }
  if (record) showVehicle(vehicle);
  if (creating) {
    const picker = form.elements.bikeId;
    picker.required = true;
    picker.onchange = async () => {
      const revision = ++requestVersion;
      vehicle = null;
      document.querySelector("#vehicleDetails").innerHTML = "";
      if (!picker.value) return;
      try {
        const v = await api("/vehicles/" + picker.value);
        if (current() && revision === requestVersion) showVehicle(v);
      } catch (e) {
        error(e);
      }
    };
    document.querySelector("#vehicleSearch").oninput = (e) => {
      const q = e.target.value.toLowerCase(),
        chosen = picker.value;
      picker.innerHTML =
        '<option value="">Choose the customer’s bike…</option>' +
        sold
          .filter(
            (b) =>
              b.id === chosen ||
              [
                b.brand,
                b.model,
                b.vin,
                ...Object.keys(COMPONENTS).map((k) => b[k]),
              ]
                .join(" ")
                .toLowerCase()
                .includes(q),
          )
          .map(
            (b) =>
              `<option value="${b.id}">${esc(b.brand + " " + b.model + " · " + b.vin)}</option>`,
          )
          .join("");
      picker.value = chosen;
    };
    if (preselected) picker.onchange();
  }
  const readParts = () =>
    working
      ? [...document.querySelectorAll("#serviceParts tr")].map((row) =>
          Object.fromEntries(
            [...row.querySelectorAll("[data-part]")].map((input) => [
              input.dataset.part,
              input.value,
            ]),
          ),
        )
      : (body.parts || []).map(partInput);
  function totals() {
    if (received) return;
    const parts = readParts(),
      cost = working
        ? parts.reduce(
            (n, p) => n + Number(p.quantity) * Number(p.unitCost),
            0,
          ) + Number(form.elements.labourCost.value)
        : moneyInput(body.totalCost),
      charge = working
        ? parts.reduce(
            (n, p) => n + Number(p.quantity) * Number(p.unitCharge),
            0,
          ) + Number(form.elements.labourCharge.value)
        : moneyInput(body.totalCharge);
    document.querySelector("#serviceTotals").innerHTML = [
      ["Your cost", Math.round(cost * 100)],
      ["Customer charges", Math.round(charge * 100)],
      ["Received", record?.received || 0],
      ["Balance due", Math.round(charge * 100) - (record?.received || 0)],
    ]
      .map(
        ([label, value]) =>
          `<div><span>${label}</span><b>${cash(value)}</b></div>`,
      )
      .join("");
  }
  function addPart(p = {}) {
    const row = document.createElement("tr");
    row.innerHTML = `${["description", "quantity", "unitCost", "unitCharge"].map((k) => `<td><input class="${k === "description" ? "part-description" : ""}" data-part="${k}" aria-label="Part ${k}" value="${esc(k === "quantity" ? p[k] || 1 : k === "description" ? p[k] || "" : moneyInput(p[k]))}" ${k === "description" ? 'required maxlength="150"' : `type="number" required min="${k === "quantity" ? 1 : 0}" step="${k === "quantity" ? 1 : "0.01"}" ${k === "quantity" ? 'max="1000"' : ""}`}></td>`).join("")}<td><select aria-label="Replacement component type" data-part="componentType"><option value="">Consumable / other</option>${Object.entries(
      COMPONENTS,
    )
      .map(
        ([k, label]) =>
          `<option value="${k}" ${k === p.componentType ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></td><td><input aria-label="Replacement serial number" data-part="newSerial" maxlength="100" value="${esc(p.newSerial)}"></td><td><button type="button" aria-label="Remove part">×</button></td>`;
    const stockCell = document.createElement("td");
    stockCell.innerHTML = `<select aria-label="Battery inventory replacement" data-part="batteryId"><option value="">No stock battery selected</option>${batteryStock
      .filter((b) => b.status === "available" || b.id === p.batteryId)
      .map(
        (b) =>
          `<option value="${b.id}" ${b.id === p.batteryId ? "selected" : ""}>${esc(b.brand + " " + b.model + " · " + b.serial)}</option>`,
      )
      .join("")}</select>`;
    row.insertBefore(stockCell, row.lastElementChild);
    stockCell.querySelector("select").onchange = (e) => {
      const pack = batteryStock.find((b) => b.id === e.target.value);
      if (pack) {
        row.querySelector('[data-part="componentType"]').value = "battery";
        row.querySelector('[data-part="newSerial"]').value = pack.serial;
        row.querySelector('[data-part="quantity"]').value = 1;
        row.querySelector('[data-part="description"]').value =
          pack.brand + " " + pack.model;
        row.querySelector('[data-part="unitCost"]').value = pack.cost / 100;
        row.querySelector('[data-part="unitCharge"]').value =
          form.elements.chargeType.value === "paid" ? pack.price / 100 : 0;
      }
      totals();
    };
    row.querySelector("button").onclick = () => {
      row.remove();
      totals();
    };
    document.querySelector("#serviceParts").append(row);
    totals();
  }
  if (working) {
    body.parts?.forEach(addPart);
    document.querySelector("#addPart").onclick = () => addPart();
    form.addEventListener("input", totals);
  }
  totals();
  const savePayload = (status) => ({
    complaint: body.complaint || "",
    odometer: body.odometer || "",
    dueDate: body.dueDate || "",
    notes: body.notes || "",
    diagnosis: body.diagnosis || "",
    workPerformed: body.workPerformed || "",
    chargeType: body.chargeType || "paid",
    labourCost: moneyInput(body.labourCost),
    labourCharge: moneyInput(body.labourCharge),
    technicianId: record?.technician_id || "",
    ...Object.fromEntries(new FormData(form)),
    parts: readParts(),
    version: record?.version,
    requestKey: key,
    status,
    allowOutstandingDelivery:
      form.elements.allowOutstandingDelivery?.checked === true,
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (closed) return;
    const button = e.submitter,
      status = button.value;
    button.disabled = true;
    try {
      if (creating && !vehicle)
        throw Error("Choose a sold bike and wait for its details to load.");
      const data = savePayload(status);
      if (status === "ready" && !data.workPerformed.trim())
        throw Error(
          "Describe the services carried out before completing this visit.",
        );
      if (creating)
        data.intakeComponents = Object.fromEntries(
          Object.keys(COMPONENTS)
            .filter((k) => form.elements["intake_" + k])
            .map((k) => [k, form.elements["intake_" + k].value]),
        );
      const saved = await api(
        "/services" + (creating ? "" : "/" + id),
        creating ? "POST" : "PUT",
        data,
      );
      await load();
      if (current() && creating) location.hash = "service/" + saved.id;
      toast(
        creating
          ? "Complaint registered against this bike"
          : status === "ready"
            ? "Service completed and saved in the bike’s history"
            : status === "in_progress"
              ? "Service started"
              : status === "delivered"
                ? "Bike handed over"
                : "Job card updated",
      );
    } catch (x) {
      error(x);
      document
        .querySelector("#error")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      button.disabled = false;
    }
  };
  if (record && (finished || record.payments.length)) {
    const canPay = finished && record.balance > 0,
      paymentKey = crypto.randomUUID();
    document.querySelector("#serviceReceipts").innerHTML = panel(
      "3. Payment & handover",
      `${
        canPay
          ? `<form id="servicePayment"><div class="formgrid">${field("Amount received (₹) *", "amount", moneyInput(record.balance), `required type="number" min="0.01" max="${moneyInput(record.balance)}" step="0.01"`)}${select(
              "Payment method",
              "method",
              ["Cash", "UPI", "Bank transfer"].map((x) => [x, x]),
            )}${field("Reference / receipt note", "reference", "", 'maxlength="100"')}</div><p class="form-note">Record the amount actually received for this service visit.</p><button class="primary">Record service payment →</button></form>`
          : !finished && !closed
            ? '<p class="muted">Complete the service first. Then record payment and hand over the bike.</p>'
            : ""
      }${record.payments.length ? `<div class="scroll"><table><thead><tr><th>Received</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>${record.payments.map((p) => `<tr><td>${stamp(p.created)}</td><td>${cash(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.reference || "—")}</td></tr>`).join("")}</tbody></table></div>` : finished ? '<p class="muted">No service payments recorded.</p>' : ""}`,
    );
    document
      .querySelector("#servicePayment")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const button = e.submitter;
        button.disabled = true;
        try {
          await api("/services/" + id + "/payments", "POST", {
            ...Object.fromEntries(new FormData(e.target)),
            version: record.version,
            requestKey: paymentKey,
          });
          await serviceJobScreen(ctx, id);
          toast("Service payment recorded");
        } catch (x) {
          error(x);
          button.disabled = false;
        }
      });
  }
}
