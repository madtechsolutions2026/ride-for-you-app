import { STATES } from "../gst.mjs";
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const cash = (value) =>
  "₹" +
  ((value || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
export const field = (label, name, value = "", extra = "") =>
  `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${esc(value)}" ${extra}></div>`;
export const area = (label, name, value = "", max = 1000) =>
  `<div class="field full"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" maxlength="${max}">${esc(value)}</textarea></div>`;
export const select = (label, name, options, value = "", required = false) =>
  `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" ${required ? "required" : ""}>${options.map(([key, label]) => `<option value="${esc(key)}" ${key === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></div>`;
export const panel = (title, body, actions = "") =>
  `<section class="panel"><div class="panelhead"><h2>${title}</h2>${actions}</div><div class="panelbody">${body}</div></section>`;
export const stateOptions = [
  ["", "Choose state / UT"],
  ...Object.entries(STATES)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([k, v]) => [k, `${v} (${k})`]),
];
export const basisOptions = [
  ["", "Choose price basis"],
  ["inclusive", "Price includes GST"],
  ["exclusive", "Add GST to the price"],
];
export function customerFields(settings, { quotation = false } = {}) {
  return `<div class="formgrid">${field("Customer name *", "name", "", 'required maxlength="150"')}${field("Customer phone *", "phone", "", 'required type="tel" maxlength="30"')}${area("Billing address *", "address")}${field("Customer GSTIN · optional", "taxId", "", 'maxlength="15"')}${select("Customer billing state *", "customerState", stateOptions, "", true)}${select("Place of supply / delivery state *", "placeOfSupply", stateOptions, settings.stateCode, true)}${area("Delivery address · optional", "deliveryAddress")}${select("Price basis *", "priceMode", basisOptions, settings.priceMode || "", true)}${field(quotation ? "Quotation date *" : "Invoice date *", "date", today(), `required type="date" max="${today()}"`)}${field(quotation ? "Prepared by" : "Salesperson", "salesperson", "", 'maxlength="100"')}${
    !quotation
      ? select(
          "Payment method *",
          "method",
          ["Not received", "Cash", "UPI", "Bank transfer"].map((v) => [v, v]),
          "Not received",
          true,
        )
      : ""
  }</div>`;
}
export async function downloadPdf(appBase, path, body, filename) {
  const response = await fetch(appBase + "/api" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw Error((await response.json()).error);
  const url = URL.createObjectURL(await response.blob()),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function showFormError(error, handler) {
  handler(error);
  document
    .querySelector("#error")
    ?.scrollIntoView({ block: "center", behavior: "smooth" });
}
