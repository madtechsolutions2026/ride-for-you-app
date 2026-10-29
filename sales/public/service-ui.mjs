import {
  COMPONENTS,
  STATES,
  esc,
  cash,
  stamp,
  field,
  tag,
  cards,
  warranty,
  panel,
  jobsTable,
} from "./service-common.mjs";
import { visitsHtml } from "./service-history.mjs";
import { serviceJobScreen } from "./service-job-ui.mjs";

export async function serviceScreen(ctx) {
  const { state, route, shell, heading, api, toast, error, appBase } = ctx;
  const current = () => (location.hash.slice(1) || "overview") === route;
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
          `<a href="#inventory">← Inventory</a><a href="#invoices/${v.sale.id}">Original invoice ↗</a><a class="primary download-link" href="#service/${open ? open.id : "new/" + id}">${open ? "Open current service" : "+ Register complaint"}</a>`,
        ) +
          panel("Complaints & services for this bike", visitsHtml(v.jobs)) +
          panel("Currently installed components", cards(v.bike)) +
          panel(
            "Original sale & warranty",
            `<p><b>${esc(v.sale.number)}</b> · ${esc(v.sale.body.date)} · ${esc(v.sale.body.customer.name)}</p><p class="muted">The original invoice retains the numbers and warranty recorded at sale.</p>${cards(original)}${warranty(v.sale.body.warranty)}<a class="download-link" href="${appBase}/api/invoices/${v.sale.id}/pdf">↓ Download original invoice</a>`,
          ) +
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
          "Bike service records.",
          "Register the complaint, record the service carried out, and keep every visit against the same bike.",
          '<a href="#technicians">Manage technicians</a><a class="primary download-link" href="#service/new">+ Register complaint</a>',
        ) +
          `<div class="service-summary"><div>Open jobs<strong>${active.length}</strong></div><div>Waiting for parts<strong>${active.filter((j) => j.status === "waiting_parts").length}</strong></div><div>Service completed<strong>${active.filter((j) => j.status === "ready").length}</strong></div><div>Service balance due<strong>${cash(jobs.reduce((n, j) => n + j.balance, 0))}</strong></div></div><div class="search"><input id="serviceSearch" type="search" aria-label="Search service jobs" placeholder="Search job, customer, chassis, component or technician…"><select id="serviceStatus" aria-label="Filter service status"><option value="">All statuses</option>${Object.entries(
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
                j.body.complaint,
                j.body.workPerformed,
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
    await serviceJobScreen(ctx, id, preselected);
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
