import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { today } from "../core/validation.mjs";
export async function commerceChecks(req) {
  const json = async (url, method = "GET", body, status = 200) => {
    const r = await req(url, method, body),
      d = await r.json();
    assert.equal(r.status, status, JSON.stringify(d));
    return d;
  };
  const pdf = async (url, filename) => {
    const r = await req(url);
    assert.equal(r.status, 200);
    const bytes = Buffer.from(await r.arrayBuffer());
    assert.equal(
      (bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
      1,
    );
    if (process.env.COMMERCE_PDF_DIR) {
      mkdirSync(process.env.COMMERCE_PDF_DIR, { recursive: true });
      writeFileSync(path.join(process.env.COMMERCE_PDF_DIR, filename), bytes);
    }
    return bytes;
  };
  const settings = (await json("/state")).settings;
  await json("/settings", "PUT", {
    ...settings,
    footer: "Ride For You EV - Clean rides, brighter tomorrow.",
  });
  const original = await json("/state"),
    bike = original.bikes.find((b) => b.status === "available");
  const pack = {
    brand: "Sample Battery Brand",
    model: "LFP pack",
    serial: "SEPARATE-BAT-001",
    chemistry: "LFP",
    voltage: "48 V",
    capacity: "30 Ah",
    cost: "15000",
    price: "23600",
    hsn: "85076000",
    gstPercent: "18",
    warranty: "24 months",
    provider: "Sample manufacturer",
    warranty_terms: "Demonstration coverage; exclusions apply.",
  };
  const battery = (await json("/batteries", "POST", pack)).id;
  await json(
    "/batteries",
    "POST",
    { ...pack, serial: "separate-bat-001" },
    409,
  );
  await json(
    "/batteries",
    "POST",
    { ...pack, serial: "BAD-GST", gstPercent: "101" },
    400,
  );
  await json(
    "/batteries",
    "POST",
    { ...pack, serial: "BAD-GST2", gstPercent: "18.001" },
    400,
  );
  await json(
    "/batteries",
    "POST",
    {
      ...pack,
      serial: original.bikes.find((b) => b.status === "sold").battery,
    },
    409,
  );
  const missing = (
    await json("/batteries", "POST", {
      ...pack,
      serial: "GST-MISSING",
      hsn: "",
      gstPercent: "",
    })
  ).id;
  const sale = {
    requestKey: randomUUID(),
    name: "Sample Customer - Demonstration Only",
    phone: "0000000000",
    address: "Local test address, Hyderabad",
    taxId: "",
    customerState: "36",
    placeOfSupply: "36",
    priceMode: "inclusive",
    date: today(),
    lines: [{ id: battery, price: "23600", hsn: pack.hsn, gstPercent: "18" }],
    discount: "0",
    paid: "5000",
    method: "UPI",
    issueConfirmed: true,
    taxConfirmed: true,
    notes: "Test battery sale only",
  };
  await json(
    "/battery-invoices/preview",
    "POST",
    { ...sale, taxConfirmed: false },
    400,
  );
  await json(
    "/battery-invoices/preview",
    "POST",
    { ...sale, lines: [{ id: missing, price: "100" }] },
    400,
  );
  await json(
    "/battery-invoices/preview",
    "POST",
    { ...sale, lines: [{ ...sale.lines[0], gstPercent: "0" }] },
    400,
  );
  const review = await json("/battery-invoices/preview", "POST", sale);
  assert.equal(review.invoice.taxable, 2000000);
  assert.equal(review.invoice.cgst, 180000);
  assert.equal(review.invoice.sgst, 180000);
  assert.equal(review.invoice.taxRate, 1800);
  assert.equal(review.invoice.lines[0].serial, pack.serial);
  const before = (await json("/state")).numbering.nextNumber;
  await json(
    "/battery-invoices",
    "POST",
    { ...sale, previewHash: "stale" },
    409,
  );
  assert.equal(
    (await json("/batteries/" + battery)).battery.status,
    "available",
  );
  const invoice = await json("/battery-invoices", "POST", {
    ...sale,
    previewHash: review.previewHash,
  });
  assert.equal(
    (
      await json("/battery-invoices", "POST", {
        ...sale,
        previewHash: review.previewHash,
      })
    ).id,
    invoice.id,
  );
  await json(
    "/battery-invoices",
    "POST",
    { ...sale, previewHash: review.previewHash, notes: "Changed retry" },
    409,
  );
  await json(
    "/battery-invoices",
    "POST",
    { ...sale, requestKey: randomUUID(), previewHash: review.previewHash },
    409,
  );
  const sold = await json("/batteries/" + battery);
  assert.equal(sold.battery.status, "sold");
  assert.equal(sold.sale.id, invoice.id);
  assert.equal(sold.sale.body.customer.name, sale.name);
  assert.equal(sold.sale.body.lines[0].warranty, "24 months");
  await json(
    "/batteries/" + battery,
    "PUT",
    { ...pack, version: sold.battery.version },
    400,
  );
  await pdf(
    "/invoices/" + invoice.id + "/pdf",
    "ride-for-you-battery-invoice-sample.pdf",
  );
  assert.equal((await json("/state")).numbering.nextNumber, before + 1);
  // Quotation numbering is independent and cannot change stock or the next legal invoice number.
  const valid = new Date(today() + "T12:00:00Z");
  valid.setUTCDate(valid.getUTCDate() + 7);
  const quote = {
    requestKey: randomUUID(),
    ...sale,
    bikeId: bike.id,
    price: "52500",
    discount: "500",
    validUntil: valid.toISOString().slice(0, 10),
    warrantyVehicle: "12 months",
    warrantyBattery: "24 months",
    paymentTerms: "Pay at delivery",
    notes: "Demonstration offer only",
    lines: undefined,
    paid: undefined,
    method: undefined,
  };
  quote.requestKey = randomUUID();
  const baseline = await json("/state"),
    qr = await json("/quotations/preview", "POST", quote);
  assert.equal(qr.invoice.documentType, "quotation");
  assert(qr.number.startsWith("QUO/"));
  await json("/quotations", "POST", { ...quote, previewHash: "stale" }, 409);
  const created = await json("/quotations", "POST", {
    ...quote,
    previewHash: qr.previewHash,
  });
  assert.equal(
    (
      await json("/quotations", "POST", {
        ...quote,
        previewHash: qr.previewHash,
      })
    ).id,
    created.id,
  );
  await json(
    "/quotations",
    "POST",
    { ...quote, previewHash: qr.previewHash, price: "50000" },
    409,
  );
  let q = await json("/quotations/" + created.id),
    after = await json("/state");
  assert.equal(after.numbering.nextNumber, baseline.numbering.nextNumber);
  assert.equal(after.invoices.length, baseline.invoices.length);
  assert.equal(after.bikes.find((b) => b.id === bike.id).status, "available");
  await pdf(
    "/quotations/" + created.id + "/pdf",
    "ride-for-you-bike-quotation-sample.pdf",
  );
  const inline = await req("/quotations/" + created.id + "/pdf?inline=1");
  assert(inline.headers.get("content-disposition").startsWith("inline"));
  await json("/quotations/" + created.id + "/status", "PUT", {
    status: "accepted",
    version: q.version,
  });
  q = await json("/quotations/" + created.id);
  await json(
    "/quotations/" + created.id + "/status",
    "PUT",
    { status: "cancelled", version: 1 },
    409,
  );
  const toInvoice = {
    ...sale,
    requestKey: randomUUID(),
    quotationId: q.id,
    lines: [{ id: bike.id, price: "52500" }],
    discount: "500",
    paid: "0",
    method: "Not received",
  };
  const conversionReview = await json("/invoices/preview", "POST", toInvoice),
    converted = await json("/invoices", "POST", {
      ...toInvoice,
      previewHash: conversionReview.previewHash,
    });
  q = await json("/quotations/" + q.id);
  assert.equal(q.status, "converted");
  assert.equal(q.invoice_id, converted.id);
  const stored = (await json("/state")).invoices.find(
    (i) => i.id === converted.id,
  );
  assert.equal(stored.body.quotationNumber, q.number);
  assert.equal(
    (
      await json("/invoices", "POST", {
        ...toInvoice,
        previewHash: conversionReview.previewHash,
      })
    ).id,
    converted.id,
  );
  await json(
    "/invoices",
    "POST",
    {
      ...toInvoice,
      requestKey: randomUUID(),
      previewHash: conversionReview.previewHash,
    },
    409,
  );
  // A battery selected from available stock is consumed only by successful service handover.
  const replacement = (
    await json("/batteries", "POST", {
      ...pack,
      serial: "SERVICE-STOCK-BAT",
      price: "8000",
      cost: "7000",
    })
  ).id;
  await json(
    "/bikes",
    "POST",
    {
      brand: "RFY",
      model: "Stock conflict",
      vin: "CONFLICT-VIN",
      battery: "SERVICE-STOCK-BAT",
      cost: "1",
      price: "2",
    },
    409,
  );
  const tech = (await json("/technicians")).find((t) => t.active),
    intake = {
      requestKey: randomUUID(),
      bikeId: bike.id,
      complaint: "Replace the battery from stock",
      technicianId: tech.id,
      chargeType: "paid",
    };
  const jobId = (await json("/services", "POST", intake)).id,
    url = "/services/" + jobId;
  let job = await json(url);
  const repair = {
    ...intake,
    workPerformed: "Installed a replacement battery and tested charging.",
    parts: [
      {
        description: "LFP replacement",
        quantity: 1,
        unitCost: "7000",
        unitCharge: "8000",
        componentType: "battery",
        newSerial: "SERVICE-STOCK-BAT",
        batteryId: replacement,
      },
    ],
  };
  await json(url, "PUT", {
    ...intake,
    status: "in_progress",
    version: job.version,
  });
  job = await json(url);
  await json(url, "PUT", { ...repair, status: "ready", version: job.version });
  job = await json(url);
  await json(url, "PUT", {
    ...repair,
    status: "delivered",
    allowOutstandingDelivery: true,
    version: job.version,
  });
  const installed = await json("/batteries/" + replacement);
  assert.equal(installed.battery.status, "installed");
  assert.equal(installed.installedBike.id, bike.id);
  assert(installed.events.some((e) => e.kind === "installed"));
  await json(
    "/battery-invoices/preview",
    "POST",
    {
      ...sale,
      lines: [
        { id: replacement, price: "8000", hsn: pack.hsn, gstPercent: "18" },
      ],
    },
    409,
  );
  assert.equal(
    (await json("/vehicles/" + bike.id)).bike.battery,
    "SERVICE-STOCK-BAT",
  );
  assert.deepEqual(
    (await json("/state")).invoices.find((i) => i.id === converted.id),
    stored,
  );
  // Cancelling and expiry prevent conversion, and different entered rates can coexist on an invoice.
  const another = (await json("/state")).bikes.find(
    (b) => b.status === "available",
  );
  const cancelInput = {
      ...quote,
      bikeId: another.id,
      requestKey: randomUUID(),
    },
    cancelReview = await json("/quotations/preview", "POST", cancelInput),
    cancel = (
      await json("/quotations", "POST", {
        ...cancelInput,
        previewHash: cancelReview.previewHash,
      })
    ).id;
  await json("/quotations/" + cancel + "/status", "PUT", {
    status: "cancelled",
    version: 1,
  });
  await json(
    "/invoices/preview",
    "POST",
    {
      ...toInvoice,
      quotationId: cancel,
      lines: [{ id: another.id, price: "52500" }],
    },
    409,
  );
  const mixed1 = (
      await json("/batteries", "POST", { ...pack, serial: "MIXED-18" })
    ).id,
    mixed2 = (
      await json("/batteries", "POST", {
        ...pack,
        serial: "MIXED-12",
        gstPercent: "12",
      })
    ).id;
  const mixed = await json("/battery-invoices/preview", "POST", {
    ...sale,
    lines: [
      { id: mixed1, price: "11800", hsn: pack.hsn, gstPercent: "18" },
      { id: mixed2, price: "11200", hsn: pack.hsn, gstPercent: "12" },
    ],
    paid: "0",
  });
  assert.equal(mixed.invoice.taxRate, null);
  assert.equal(mixed.invoice.taxable, 2000000);
  assert.equal(mixed.invoice.tax, 300000);
  assert.equal(mixed.invoice.total, 2300000);
  assert.deepEqual(
    (await json("/state")).invoices.filter((i) =>
      original.invoices.some((o) => o.id === i.id),
    ),
    original.invoices,
  );
  console.log(
    "PASS: serialized battery inventory/sales, custom GST, shared invoice numbering, one-page PDFs, quotation snapshots/conversion and atomic service-stock consumption.",
  );
}
