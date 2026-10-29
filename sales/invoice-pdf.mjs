import { gstInvoicePdf } from "./gst-pdf.mjs";

// Reflow stored invoices without changing their saved amounts or tax treatment.
export function invoicePdf(res, row, root, options) {
  return gstInvoicePdf(res, row, root, options);
}
