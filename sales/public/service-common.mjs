const COMPONENTS = {
  battery: "Battery",
  motor: "Motor",
  controller: "Controller",
  charger: "Charger",
};
const STATES = {
  received: "Complaint registered",
  diagnosing: "Under inspection",
  in_progress: "Under service",
  waiting_parts: "Waiting for parts",
  ready: "Service completed",
  delivered: "Handed over",
  cancelled: "Cancelled",
};
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cash = (value) =>
  "₹" +
  ((value || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const stamp = (value) =>
  new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const field = (label, name, value = "", extra = "") =>
  `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${esc(value)}" ${extra}></div>`;
const area = (label, name, value = "", max = 2000) =>
  `<div class="field full"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" maxlength="${max}">${esc(value)}</textarea></div>`;
const select = (label, name, options, value = "") =>
  `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${options.map(([k, v]) => `<option value="${esc(k)}" ${k === value ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>`;
const tag = (status) =>
  `<span class="tag ${status === "waiting_parts" ? "due" : ""}">${esc(STATES[status] || status)}</span>`;
const cards = (bike) =>
  `<div class="component-cards">${[["vin", "Chassis"], ...Object.entries(COMPONENTS)].map(([key, label]) => `<div><small>${label} number</small><b>${esc(bike[key] || "Not recorded")}</b></div>`).join("")}</div>`;
const warranty = (w) =>
  w
    ? `<dl class="warranty-grid">${[
        ["vehicle", "Vehicle"],
        ...Object.entries(COMPONENTS),
        ["provider", "Provided by"],
        ["startDate", "Starts on"],
      ]
        .filter(([k]) => w[k])
        .map(
          ([k, label]) => `<div><dt>${label}</dt><dd>${esc(w[k])}</dd></div>`,
        )
        .join(
          "",
        )}</dl>${w.terms ? `<p class="prewrap">${esc(w.terms)}</p>` : ""}`
    : '<p class="muted">No warranty terms were recorded on the original invoice.</p>';
const panel = (title, body, action = "") =>
  `<section class="panel"><div class="panelhead"><h2>${title}</h2>${action}</div><div class="panelbody">${body}</div></section>`;
const jobsTable = (jobs) =>
  jobs.length
    ? `<div class="scroll"><table><thead><tr><th>Job / received</th><th>Customer / bike</th><th>Technician</th><th>Status</th><th>Charges / balance</th><th></th></tr></thead><tbody>${jobs.map((j) => `<tr><td><b>${esc(j.number)}</b><small>${stamp(j.created)}</small></td><td>${esc(j.body.customer.name)}<small>${esc(j.body.bike.model)} · ${esc(j.body.bike.vin)}</small></td><td>${esc(j.technician?.name || "Unassigned")}</td><td>${tag(j.status)}</td><td>${cash(j.body.totalCharge)}<small>${cash(j.balance)} due</small></td><td><a href="#service/${j.id}">View job card ↗</a><small><a href="#vehicles/${j.bike_id}">Bike history ↗</a></small></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty"><b>No service visits yet.</b><p>Register a complaint against a sold bike to start its service history.</p></div>';

export {
  COMPONENTS,
  STATES,
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
  jobsTable,
};
