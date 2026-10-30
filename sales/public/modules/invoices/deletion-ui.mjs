import {
  esc,
  cash,
  field,
  area,
  panel,
  showFormError,
} from "../../shared/ui.mjs";
import { gstInvoiceHtml } from "../../gst-ui.mjs";

export async function invoiceDeleteScreen(ctx) {
  const { route, api, shell, heading, load, toast, error } = ctx;
  const id = route.split("/")[1];
  try {
    const r = await api("/invoices/" + id + "/delete-review");
    if (location.hash.slice(1) !== route) return;
    const key = crypto.randomUUID();
    shell(
      heading(
        "OWNER ACTION",
        "Delete invoice",
        "Review the invoice and its stock before removing it from active sales.",
        `<a href="#invoices/${id}">← Back to invoice</a>`,
      ) +
        `<form id="deleteInvoiceForm" class="commerce-form"><div class="invoice-delete-grid"><section class="panel"><div class="panelhead"><div><span class="eyebrow">INVOICE TO DELETE</span><h2>${esc(r.number)}</h2></div><span class="tag">${r.stock.length} item${r.stock.length === 1 ? "" : "s"}</span></div><div class="panelbody"><div id="error" role="alert"></div><h3>${esc(r.customer.name)}</h3><p class="muted">${esc(r.customer.phone)}</p><div class="delete-effects"><div><b>Sales totals update</b><p>This invoice is removed from active sales, collected amounts and balance totals.</p></div><div><b>Stock becomes available</b><p>The listed bikes or batteries become available to sell again.</p></div><div><b>Original record stays</b><p>The saved invoice, number, reason and deletion time remain in Deleted invoices. Its number is not reused.</p></div></div><div class="scroll"><table><thead><tr><th>Stock to release</th><th>Identification</th></tr></thead><tbody>${r.stock.map((b) => `<tr><td><b>${esc(b.name)}</b><small>${esc(b.type)}</small></td><td>${esc(b.serial)}</td></tr>`).join("")}</tbody></table></div>${r.canDelete ? `${area("Reason for deletion *", "reason", "", 500)}${field("Type the exact invoice number *", "invoiceNumber", "", 'required autocomplete="off" spellcheck="false"')}<p class="form-note">Enter <b>${esc(r.number)}</b> exactly as shown above.</p>` : `<div class="error"><b>This invoice cannot be deleted.</b>${r.blockers.map((s) => `<p>${esc(s)}</p>`).join("")}</div>`}</div></section><section class="panel invoice-delete-confirm"><div class="panelhead"><h2>Deletion summary</h2></div><div class="panelbody"><dl class="delete-amounts"><dt>Invoice total</dt><dd>${cash(r.total)}</dd><dt>Received at issue</dt><dd>${cash(r.paid)}</dd><dt>Recorded balance</dt><dd>${cash(r.total - r.paid)}</dd></dl><div class="notice">Use this for an invoice created in error. Deletion does not refund a customer, issue a credit note, cancel an IRN, or update GST filings.</div>${r.canDelete ? `<div class="delete-checks"><label><input type="checkbox" name="stockConfirmed" required><span>I confirm that all listed stock is physically with the dealership and available for sale.</span></label><label><input type="checkbox" name="correctionsConfirmed" required><span>I have handled any required payment and tax corrections outside this app.</span></label><label><input type="checkbox" name="deleteConfirmed" required><span>I confirm this invoice was created in error and should be removed from active sales.</span></label></div><button class="danger-button" type="submit">Delete invoice & update stock</button>` : ""}<a class="delete-back" href="#invoices/${id}">Keep invoice</a></div></section></div></form>`,
      route,
    );
    if (!r.canDelete) return;
    const form = document.querySelector("#deleteInvoiceForm");
    form.elements.reason.required = true;
    form.elements.reason.minLength = 10;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = e.submitter;
      button.disabled = true;
      try {
        await api("/invoices/" + id, "DELETE", {
          requestKey: key,
          reviewHash: r.reviewHash,
          invoiceNumber: form.elements.invoiceNumber.value,
          reason: form.elements.reason.value,
          stockConfirmed: form.elements.stockConfirmed.checked,
          correctionsConfirmed: form.elements.correctionsConfirmed.checked,
          deleteConfirmed: form.elements.deleteConfirmed.checked,
        });
        location.hash = "invoices";
        await load();
        toast("Invoice deleted. Sales totals and available stock updated.");
      } catch (x) {
        showFormError(x, error);
        button.disabled = false;
      }
    };
  } catch (x) {
    if (location.hash.slice(1) === route) error(x);
  }
}

export function retainedInvoiceView(ctx, row) {
  const { shell, heading, route, appBase } = ctx;
  const b = row.body;
  const content =
    b.version === 2
      ? gstInvoiceHtml(row.number, b, { logoBase: appBase })
      : panel(
          "Saved sale details",
          `<h3>${esc(b.customer.name)}</h3><p>${esc(b.customer.phone)} · ${esc(b.date)}</p><div class="scroll"><table><thead><tr><th>Item</th><th>Chassis / serial</th><th>Saved amount</th></tr></thead><tbody>${b.lines.map((l) => `<tr><td>${esc(l.brand + " " + l.model)}</td><td>${esc(l.vin || l.serial)}</td><td>${cash(l.salePrice)}</td></tr>`).join("")}</tbody></table></div><p>Original total: <b>${cash(row.total)}</b> · Received at issue: ${cash(row.paid)}</p>`,
        );
  shell(
    heading(
      "RETAINED RECORD",
      esc(row.number),
      "Deleted from active sales. Original invoice details are retained for review.",
      '<a href="#invoices/deleted">← Deleted invoices</a><a href="#invoices">Active invoices</a>',
    ) +
      `<section class="deletion-record"><b>DELETED FROM ACTIVE SALES</b><p>Deleted ${esc(new Date(row.deletion.deletedAt).toLocaleString("en-IN"))}</p><p><strong>Reason:</strong> ${esc(row.deletion.reason)}</p><p>This record is excluded from current sales totals. It cannot be downloaded as an active invoice.</p></section><div class="retained-invoice">${content}</div>`,
    route,
  );
}
