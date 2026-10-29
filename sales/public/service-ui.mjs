const COMPONENTS = {
  battery: "Battery",
  motor: "Motor",
  controller: "Controller",
  charger: "Charger",
};
const STATES = {
  received: "Received",
  diagnosing: "Diagnosing",
  in_progress: "In progress",
  waiting_parts: "Waiting for parts",
  ready: "Ready for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const NEXT = {
  received: ["diagnosing", "cancelled"],
  diagnosing: ["in_progress", "waiting_parts", "cancelled"],
  in_progress: ["waiting_parts", "ready", "cancelled"],
  waiting_parts: ["in_progress", "cancelled"],
  ready: ["in_progress", "delivered"],
  delivered: [],
  cancelled: [],
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
    ? `<div class="scroll"><table><thead><tr><th>Job / received</th><th>Customer / bike</th><th>Technician</th><th>Status</th><th>Charges / balance</th><th></th></tr></thead><tbody>${jobs.map((j) => `<tr><td><b>${esc(j.number)}</b><small>${stamp(j.created)}</small></td><td>${esc(j.body.customer.name)}<small>${esc(j.body.bike.model)} · ${esc(j.body.bike.vin)}</small></td><td>${esc(j.technician?.name || "Unassigned")}</td><td>${tag(j.status)}</td><td>${cash(j.body.totalCharge)}<small>${cash(j.balance)} due</small></td><td><a href="#service/${j.id}">Open job ↗</a></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty"><b>No service visits yet.</b><p>Receive a sold bike to start its service history.</p></div>';

export async function serviceScreen(ctx) {
  const { state, route, shell, heading, api, toast, error, appBase } = ctx;
  const current = () => (location.hash.slice(1) || "overview") === route;
  const refresh = () => serviceScreen(ctx);
  try {
    const [page, id, preselected] = route.split("/");
    if (page === "technicians") {
      const [people, jobs] = await Promise.all([
        api("/technicians"),
        api("/services"),
      ]);
      if (!current()) return;
      if (!id) {
        shell(
          heading(
            "OWNER · SERVICE TEAM",
            "The people behind every repair.",
            "Manage technicians and their assignments from your owner workspace.",
            '<a class="primary download-link" href="#technicians/new">+ Add technician</a>',
          ) +
            panel(
              "Technicians",
              people.length
                ? `<div class="scroll"><table><thead><tr><th>Name / contact</th><th>Speciality</th><th>Open jobs</th><th>Status</th><th></th></tr></thead><tbody>${people.map((t) => `<tr><td><b>${esc(t.name)}</b><small>${esc(t.phone || "No phone recorded")}</small></td><td>${esc(t.speciality || "—")}</td><td>${jobs.filter((j) => j.technician_id === t.id && !["delivered", "cancelled"].includes(j.status)).length}</td><td><span class="tag">${t.active ? "Active" : "Inactive"}</span></td><td><a href="#technicians/${t.id}">Manage ↗</a></td></tr>`).join("")}</tbody></table></div>`
                : '<p class="muted">Add your first technician, then assign them when a bike arrives for service.</p>',
            ),
          route,
        );
        return;
      }
      const person = id === "new" ? {} : people.find((t) => t.id === id);
      if (!person) throw Error("Technician not found.");
      shell(
        heading(
          "SERVICE TEAM",
          id === "new" ? "Add a technician." : "Manage technician.",
          "Technicians are managed by the owner; a separate login is not needed.",
          '<a href="#technicians">← Technicians</a>',
        ) +
          `<form id="technicianform" class="panel"><div class="panelbody"><div id="error"></div><div class="formgrid">${field("Full name *", "name", person.name, 'required maxlength="100"')}${field("Contact number", "phone", person.phone, 'type="tel" maxlength="30"')}${field("Speciality / skills", "speciality", person.speciality, 'maxlength="150"')}${id !== "new" ? `<label class="check"><input type="checkbox" name="active" ${person.active ? "checked" : ""}> Active · available for assignment</label>` : ""}</div><p class="form-note">Deactivating a technician preserves their past jobs. Reassign open work to an active technician before continuing.</p></div><div class="formfooter"><a href="#technicians">Cancel</a><button class="primary">Save technician →</button></div></form>`,
        route,
      );
      document.querySelector("#technicianform").onsubmit = async (e) => {
        e.preventDefault();
        const b = e.submitter;
        b.disabled = true;
        try {
          const data = Object.fromEntries(new FormData(e.target));
          data.active = e.target.elements.active?.checked ?? true;
          await api(
            "/technicians" + (id === "new" ? "" : "/" + id),
            id === "new" ? "POST" : "PUT",
            data,
          );
          location.hash = "technicians";
          toast("Technician saved");
        } catch (x) {
          error(x);
          b.disabled = false;
        }
      };
      return;
    }
    if (page === "vehicles") {
      const v = await api("/vehicles/" + id);
      if (!current()) return;
      const original = v.sale.body.lines.find((l) => l.id === id) || {};
      const open = v.jobs.find(
        (j) => !["delivered", "cancelled"].includes(j.status),
      );
      shell(
        heading(
          "VEHICLE PASSPORT",
          esc(v.bike.brand + " " + v.bike.model),
          `Chassis ${esc(v.bike.vin)} · ${esc(v.sale.body.customer.name)} · ${esc(v.sale.body.customer.phone)}`,
          `<a href="#inventory">← Inventory</a><a href="#invoices/${v.sale.id}">Original invoice ↗</a><a class="primary download-link" href="#service/${open ? open.id : "new/" + id}">${open ? "Open current service" : "+ Receive for service"}</a>`,
        ) +
          panel("Currently installed components", cards(v.bike)) +
          panel(
            "Original sale & warranty",
            `<p><b>${esc(v.sale.number)}</b> · ${esc(v.sale.body.date)} · ${esc(v.sale.body.customer.name)}</p><p class="muted">The original invoice retains the numbers and warranty recorded at sale.</p>${cards(original)}${warranty(v.sale.body.warranty)}<a class="download-link" href="${appBase}/api/invoices/${v.sale.id}/pdf">↓ Download original invoice</a>`,
          ) +
          panel("Service visits", jobsTable(v.jobs)) +
          panel(
            "Component register",
            v.components.length
              ? `<div class="scroll"><table><thead><tr><th>Component</th><th>Number</th><th>State</th><th>First recorded</th></tr></thead><tbody>${v.components.map((c) => `<tr><td>${esc(COMPONENTS[c.type])}</td><td><b>${esc(c.serial)}</b></td><td>${esc(c.state)}</td><td>${esc(c.source)}<small>${stamp(c.created)}</small></td></tr>`).join("")}</tbody></table></div>`
              : '<p class="muted">Component numbers will be registered at the first service intake. Original sale details above remain unchanged.</p>',
          ),
        route,
      );
      return;
    }
    if (!id) {
      const jobs = await api("/services");
      if (!current()) return;
      const active = jobs.filter(
        (j) => !["delivered", "cancelled"].includes(j.status),
      );
      shell(
        heading(
          "AFTER-SALES · SERVICE DESK",
          "Every visit. A complete history.",
          "Receive sold bikes, assign technicians, track repairs and record service costs.",
          '<a href="#technicians">Manage technicians</a><a class="primary download-link" href="#service/new">+ Receive a bike</a>',
        ) +
          `<div class="service-summary"><div>Open jobs<strong>${active.length}</strong></div><div>Waiting for parts<strong>${active.filter((j) => j.status === "waiting_parts").length}</strong></div><div>Ready for delivery<strong>${active.filter((j) => j.status === "ready").length}</strong></div><div>Service balance due<strong>${cash(jobs.reduce((n, j) => n + j.balance, 0))}</strong></div></div><div class="search"><input id="serviceSearch" type="search" aria-label="Search service jobs" placeholder="Search job, customer, chassis, component or technician…"><select id="serviceStatus" aria-label="Filter service status"><option value="">All statuses</option>${Object.entries(
            STATES,
          )
            .map(([k, v]) => `<option value="${k}">${v}</option>`)
            .join(
              "",
            )}</select></div><section class="panel" id="serviceJobs"></section>`,
        route,
      );
      const draw = () => {
        const q = document
            .querySelector("#serviceSearch")
            .value.trim()
            .toLowerCase(),
          status = document.querySelector("#serviceStatus").value;
        document.querySelector("#serviceJobs").innerHTML = jobsTable(
          jobs.filter(
            (j) =>
              (!status || j.status === status) &&
              [
                j.number,
                j.body.customer.name,
                j.body.customer.phone,
                j.body.bike.vin,
                j.body.bike.model,
                ...Object.keys(COMPONENTS).map((k) => j.body.bike[k]),
                ...(j.body.replacements || []).map((r) => r.newSerial),
                j.technician?.name,
              ]
                .join(" ")
                .toLowerCase()
                .includes(q),
          ),
        );
      };
      draw();
      document.querySelector("#serviceSearch").oninput = draw;
      document.querySelector("#serviceStatus").onchange = draw;
      return;
    }
    const creating = id === "new";
    const [techs, record] = await Promise.all([
      api("/technicians"),
      creating ? Promise.resolve(null) : api("/services/" + id),
    ]);
    if (!current()) return;
    const body = record?.body || {},
      closed = record && ["delivered", "cancelled"].includes(record.status),
      key = crypto.randomUUID();
    const sold = state.bikes.filter((b) => b.status === "sold");
    if (creating && !sold.length) {
      shell(
        heading(
          "SERVICE INTAKE",
          "Sell a bike before its first service.",
          "Service jobs link to an issued sale invoice and its customer.",
          '<a href="#invoices">View invoices →</a>',
        ),
        route,
      );
      return;
    }
    const statusOptions = record
      ? [record.status, ...NEXT[record.status]].map((k) => [k, STATES[k]])
      : [];
    shell(
      heading(
        creating ? "NEW SERVICE VISIT" : "SERVICE JOB",
        creating ? "Receive a bike for service." : esc(record.number),
        creating
          ? "Record the concern, check identification, and assign the right technician."
          : `${tag(record.status)} · ${esc(body.customer.name)} · ${esc(body.bike.vin)}`,
        '<a href="#service">← Service desk</a>' +
          (record
            ? `<a href="#vehicles/${record.bike_id}">Vehicle history ↗</a>`
            : ""),
      ) +
        `<form id="serviceform"><div class="split"><div><section class="panel"><div class="panelhead"><h2>Vehicle & customer</h2></div><div class="panelbody"><div id="error"></div>${creating ? `<div class="search"><input id="vehicleSearch" type="search" aria-label="Search sold bikes" placeholder="Search sold bike by chassis, component or model"></div>${select("Sold bike *", "bikeId", [["", "Choose a sold bike…"], ...sold.map((b) => [b.id, b.brand + " " + b.model + " · " + b.vin])], preselected)}` : ""}<div id="vehicleDetails"></div></div></section><section class="panel"><div class="panelhead"><h2>Concern & assignment</h2></div><div class="panelbody"><fieldset ${closed ? "disabled" : ""}><div class="formgrid">${area("Customer complaint *", "complaint", body.complaint)}${field("Odometer reading (km)", "odometer", body.odometer, 'maxlength="30"')}${field("Expected completion", "dueDate", body.dueDate, 'type="date"')}${select("Assigned technician", "technicianId", [["", "Unassigned"], ...techs.filter((t) => t.active || t.id === record?.technician_id).map((t) => [t.id, t.name + (t.active ? "" : " (inactive)")])], record?.technician_id || "")}${select(
          "Charge type",
          "chargeType",
          [
            ["paid", "Paid service"],
            ["warranty", "Warranty · no customer charge"],
            ["goodwill", "Goodwill · no customer charge"],
          ],
          body.chargeType || "paid",
        )}${record ? select("Job status", "status", statusOptions, record.status) : ""}${area("Diagnosis / inspection findings", "diagnosis", body.diagnosis)}${area("Work performed", "workPerformed", body.workPerformed)}${area("Internal service notes", "notes", body.notes, 1500)}</div></fieldset><p class="form-note">Warranty coverage is reviewed by the owner against the original terms. No automatic approval is assumed. <a href="#technicians">Manage technicians ↗</a></p></div></section><section class="panel"><div class="panelhead"><h2>Parts & tracked replacements</h2>${!closed ? '<button type="button" id="addPart">+ Add part</button>' : ""}</div><div class="panelbody"><p class="form-note">Enter a component type and new number only for an actual replacement. Current component numbers change when the job is delivered.</p><div class="scroll"><table class="service-parts"><thead><tr><th>Part / work material</th><th>Qty</th><th>Unit cost ₹</th><th>Unit charge ₹</th><th>Replacement type</th><th>New number</th><th></th></tr></thead><tbody id="serviceParts"></tbody></table></div></div></section><section class="panel"><div class="panelbody"><fieldset ${closed ? "disabled" : ""}><div class="formgrid">${field("Internal labour cost (₹)", "labourCost", (body.labourCost || 0) / 100, 'type="number" min="0" step="0.01"')}${field("Customer labour charge (₹)", "labourCharge", (body.labourCharge || 0) / 100, 'type="number" min="0" step="0.01"')}</div></fieldset></div></section></div><aside><section class="panel gst-sticky"><div class="panelhead"><h2>Service summary</h2></div><div class="panelbody"><div id="serviceTotals" class="invoice-totalbox"></div><p class="form-note">Costs are internal. Customer charges and receipts here are service job records; this page does not issue a GST service invoice.</p>${!closed ? `<label class="check"><input type="checkbox" name="allowOutstandingDelivery"> Owner approves delivery with an outstanding service balance</label><button class="primary" id="saveService">${creating ? "Create service job" : "Save service job"} →</button>` : '<p class="notice">Closed visit · work details are preserved. Start another visit for further work.</p>'}</div></section></aside></div></form>${record ? `<div id="serviceReceipts"></div>${panel("Service timeline", `<div class="service-timeline">${record.events.map((e) => `<div class="service-event"><b>${esc(e.description)}</b><small>${stamp(e.created)}${e.data?.technician ? " · " + esc(e.data.technician) : ""}</small>${e.data?.after?.replacements?.length ? `<p>${e.data.after.replacements.map((r) => `${esc(COMPONENTS[r.type])}: ${esc(r.oldSerial || "Not recorded")} → ${esc(r.newSerial)}`).join("<br>")}</p>` : ""}</div>`).join("")}</div>`)}` : ""}`,
      route,
    );
    const form = document.querySelector("#serviceform");
    form.elements.complaint.required = true;
    let vehicle = record ? { bike: record.bike, sale: record.sale } : null,
      requestVersion = 0;
    function showVehicle(v) {
      vehicle = v;
      const w = v.sale.body.warranty;
      document.querySelector("#vehicleDetails").innerHTML =
        `<p><b>${esc(v.sale.body.customer.name)}</b> · ${esc(v.sale.body.customer.phone)}<br><a href="#invoices/${v.sale.id}">${esc(v.sale.number)} · ${esc(v.sale.body.date)} ↗</a></p>${cards(v.bike)}${
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
        }<details><summary>Original warranty terms</summary>${warranty(w)}</details>`;
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
          '<option value="">Choose a sold bike…</option>' +
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
      [...document.querySelectorAll("#serviceParts tr")].map((row) =>
        Object.fromEntries(
          [...row.querySelectorAll("[data-part]")].map((input) => [
            input.dataset.part,
            input.value,
          ]),
        ),
      );
    function total() {
      const parts = readParts(),
        cost =
          parts.reduce(
            (n, p) => n + Number(p.quantity) * Number(p.unitCost),
            0,
          ) + Number(form.elements.labourCost.value),
        charge =
          parts.reduce(
            (n, p) => n + Number(p.quantity) * Number(p.unitCharge),
            0,
          ) + Number(form.elements.labourCharge.value);
      document.querySelector("#serviceTotals").innerHTML = [
        ["Internal cost", Math.round(cost * 100)],
        ["Customer charges", Math.round(charge * 100)],
        ["Received", record?.received || 0],
        ["Service balance", Math.round(charge * 100) - (record?.received || 0)],
      ]
        .map(([k, v]) => `<div><span>${k}</span><b>${cash(v)}</b></div>`)
        .join("");
    }
    function addPart(p = {}) {
      const row = document.createElement("tr");
      row.innerHTML = `${["description", "quantity", "unitCost", "unitCharge"].map((k) => `<td><input class="${k === "description" ? "part-description" : ""}" data-part="${k}" aria-label="Part ${k}" value="${esc(k === "quantity" ? p[k] || 1 : k === "description" ? p[k] || "" : (p[k] || 0) / 100)}" ${k === "description" ? 'required maxlength="150"' : `type="number" required min="${k === "quantity" ? 1 : 0}" step="${k === "quantity" ? 1 : "0.01"}" ${k === "quantity" ? 'max="1000"' : ""}`} ${closed ? "disabled" : ""}></td>`).join("")}<td><select aria-label="Replacement component type" data-part="componentType" ${closed ? "disabled" : ""}><option value="">Consumable / other</option>${Object.entries(
        COMPONENTS,
      )
        .map(
          ([k, label]) =>
            `<option value="${k}" ${k === p.componentType ? "selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select></td><td><input aria-label="Replacement serial number" data-part="newSerial" maxlength="100" value="${esc(p.newSerial)}" ${closed ? "disabled" : ""}></td><td>${!closed ? '<button type="button" aria-label="Remove part">×</button>' : ""}</td>`;
      row.querySelector("button")?.addEventListener("click", () => {
        row.remove();
        total();
      });
      document.querySelector("#serviceParts").append(row);
      total();
    }
    body.parts?.forEach(addPart);
    document
      .querySelector("#addPart")
      ?.addEventListener("click", () => addPart());
    form.addEventListener("input", total);
    total();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = e.submitter;
      if (closed) return;
      button.disabled = true;
      try {
        if (creating && !vehicle)
          throw Error("Select a sold bike and wait for its details to load.");
        const data = {
          ...Object.fromEntries(new FormData(form)),
          parts: readParts(),
          version: record?.version,
          requestKey: key,
          allowOutstandingDelivery:
            form.elements.allowOutstandingDelivery.checked,
        };
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
        await ctx.load();
        if (!current()) return;
        if (creating) location.hash = "service/" + saved.id;
        toast(creating ? "Service job created" : "Service job saved");
      } catch (x) {
        error(x);
        button.disabled = false;
      }
    };
    if (record) {
      const canPay = record.balance > 0 && record.status !== "cancelled",
        paymentKey = crypto.randomUUID();
      document.querySelector("#serviceReceipts").innerHTML = panel(
        "Service receipts",
        `${
          canPay
            ? `<form id="servicePayment"><div class="formgrid">${field("Amount received (₹) *", "amount", record.balance / 100, `required type="number" min="0.01" max="${record.balance / 100}" step="0.01"`)}${select(
                "Payment method",
                "method",
                ["Cash", "UPI", "Bank transfer"].map((x) => [x, x]),
              )}${field("Reference / receipt note", "reference", "", 'maxlength="100"')}</div><p class="form-note">Save any job changes first. This records money already received; it does not collect a payment.</p><button class="primary">Record service payment →</button></form>`
            : ""
        }${record.payments.length ? `<div class="scroll"><table><thead><tr><th>Received</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>${record.payments.map((p) => `<tr><td>${stamp(p.created)}</td><td>${cash(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.reference || "—")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">No service payments recorded.</p>'}`,
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
            await refresh();
            toast("Service payment recorded");
          } catch (x) {
            error(x);
            button.disabled = false;
          }
        });
    }
  } catch (e) {
    if (current() && e.status !== 401) {
      shell(
        heading(
          "SERVICE WORKSPACE",
          "Unable to open this page.",
          esc(e.message),
          '<a href="#service">← Service desk</a>',
        ),
        route,
      );
    }
  }
}
