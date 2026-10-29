import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { invoicePdf } from "./invoice-pdf.mjs";
import { serviceChecks } from "./service-checks.mjs";

test("WhatsApp-only auth, bulk inventory, immutable invoices and branded PDFs", async () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "rfy-sales-test-"));
  const port = 18000 + Math.floor(Math.random() * 10000);
  const prefix = process.env.TEST_BASE_PATH || "";
  const base = `http://127.0.0.1:${port}${prefix}`;
  const captured = [];
  let providerFails = false;
  const provider = createServer((req, res) => {
    let data = "";
    req.on("data", (x) => (data += x));
    req.on("end", () => {
      captured.push(JSON.parse(data));
      res.setHeader("Content-Type", "application/json");
      res.statusCode = providerFails ? 503 : 200;
      res.end(
        JSON.stringify(
          providerFails
            ? { error: "unavailable" }
            : { success: true, id: "test-message" },
        ),
      );
    });
  });
  await new Promise((r) => provider.listen(0, "127.0.0.1", r));
  const child = spawn(process.execPath, ["server.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATA_DIR: folder,
      BASE_PATH: prefix,
      PUBLIC_ORIGIN: "https://primary.example",
      ADDITIONAL_PUBLIC_ORIGINS: "https://dealership.example",
      OTP_HASH_SECRET: "test-only-secret-not-used-in-production",
      OTP_ALLOWED_PHONES: "+919000000001,+919000000002,+919000000003",
      WAY2CHATS_URL: `http://127.0.0.1:${provider.address().port}`,
      WAY2CHATS_API_KEY: "test-only",
      WAY2CHATS_PHONE_ID: "test-sender",
    },
    stdio: "pipe",
    windowsHide: true,
  });
  let log = "";
  child.stderr.on("data", (x) => (log += x));
  let cookie = "";
  const req = async (url, method = "GET", body, headers = {}) => {
    const r = await fetch(base + "/api" + url, {
      method,
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return r;
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(base + "/api/session");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert(ready, log);
    const page = await (await fetch(base + "/")).text();
    assert(page.includes(`data-base="${prefix}"`));
    assert(page.includes(`src="${prefix}/app.js"`));
    assert.equal((await fetch(base + "/logo.png")).status, 200);
    assert.equal((await req("/state")).status, 401);
    assert.equal((await req("/services")).status, 401);
    assert.equal((await req("/technicians")).status, 401);
    assert.equal(
      (await req("/state", "POST", {}, { Origin: "https://primary.example" }))
        .status,
      401,
    );
    assert.equal(
      (await req("/setup", "POST", { password: "OldPassword123!" })).status,
      401,
    );
    assert.equal(
      (await req("/login", "POST", { password: "OldPassword123!" })).status,
      401,
    );
    assert.equal(
      (await req("/auth/otp/request", "POST", { phone: "9000000009" })).status,
      403,
    );
    assert.equal(captured.length, 0);
    assert.equal(
      (
        await req(
          "/auth/otp/request",
          "POST",
          { phone: "9000000001" },
          { Origin: "https://other.example" },
        )
      ).status,
      403,
    );
    const otp = await (
      await req(
        "/auth/otp/request",
        "POST",
        { phone: "9000000001" },
        { Origin: "https://dealership.example" },
      )
    ).json();
    assert(otp.challengeId);
    const code = captured.at(-1).bodyParams[0];
    assert(/^\d{6}$/.test(code));
    assert(!JSON.stringify(otp).includes(code));
    assert.equal(captured.at(-1).to, "919000000001");
    assert.equal(
      (await req("/auth/otp/request", "POST", { phone: "9000000001" })).status,
      429,
    );
    assert.equal(
      (
        await req("/auth/otp/verify", "POST", {
          challengeId: otp.challengeId,
          code: code === "123456" ? "654321" : "123456",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("/auth/otp/verify", "POST", {
          challengeId: otp.challengeId,
          code,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req("/auth/otp/verify", "POST", {
          challengeId: otp.challengeId,
          code,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("/settings", "PUT", {
          name: "RIDEFORYOU.EV MOBILITY INDIA PRIVATE LIMITED",
          address:
            "Door No. 3-76, Dayanand Nagar, Suraram, Hyderabad, Medchal Malkajgiri, Telangana - 500055",
          phone: "",
          email: "",
          taxId: "36AAQCR3663P1ZG",
          stateCode: "36",
          eInvoiceMode: "not_required",
          prefix: "TEST",
          footer: "Thank you for choosing Ride For You.",
          bank: "Test bank details only",
        })
      ).status,
      200,
    );
    const bike = {
      brand: "RFY",
      model: "Test scooter",
      vin: "TEST-001",
      color: "Forest green",
      battery: "BAT-001",
      motor: "MOTOR-001",
      controller: "CONTROLLER-001",
      charger: "CHARGER-001",
      cost: "25000",
      price: "35000",
      notes: "",
    };
    assert.equal((await req("/bikes", "POST", bike)).status, 200);
    assert.notEqual((await req("/bikes", "POST", bike)).status, 200);
    assert.equal(
      (await req("/bikes", "POST", { ...bike, vin: "TEST-002", cost: "-1" }))
        .status,
      400,
    );
    const header = "brand,model,vin,color,battery,cost,price,notes\r\n";
    const invalid =
      header +
      "RFY,City,IMPORT-001,Green,,25000,35000,Good\r\nRFY,City,IMPORT-002,Green,,-1,35000,Invalid\r\n";
    let preview = await (
      await req("/inventory/import/preview", "POST", { csv: invalid })
    ).json();
    assert.equal(preview.valid, 1);
    assert.equal(preview.errors[0].row, 3);
    assert.equal(
      (
        await req("/inventory/import", "POST", {
          csv: invalid,
          requestKey: crypto.randomUUID(),
        })
      ).status,
      400,
    );
    assert.equal((await (await req("/state")).json()).bikes.length, 1);
    const valid =
      header +
      'RFY,City,IMPORT-001,Green,,25000,35000,"Quoted, note"\r\nRFY,Touring,IMPORT-002,White,,30000,45000,Second\r\n';
    const key = crypto.randomUUID();
    preview = await (
      await req("/inventory/import/preview", "POST", { csv: valid })
    ).json();
    assert.equal(preview.errors.length, 0);
    assert.equal(preview.rows[0].notes, "Quoted, note");
    assert.equal(
      (
        await (
          await req("/inventory/import", "POST", {
            csv: valid,
            requestKey: key,
          })
        ).json()
      ).imported,
      2,
    );
    assert.equal(
      (
        await (
          await req("/inventory/import", "POST", {
            csv: valid,
            requestKey: key,
          })
        ).json()
      ).imported,
      2,
    );
    assert.equal(
      (
        await req("/inventory/import", "POST", {
          csv: valid + "\n",
          requestKey: key,
        })
      ).status,
      409,
    );
    preview = await (
      await req("/inventory/import/preview", "POST", { csv: valid })
    ).json();
    assert.equal(preview.errors.length, 2);
    let state = await (await req("/state")).json();
    assert.equal(state.bikes.length, 3);
    const id = state.bikes.find((b) => b.vin === "TEST-001").id;
    const sale = {
      requestKey: crypto.randomUUID(),
      name: "Sample Customer - Demonstration Only",
      phone: "0000000000",
      address: "Test customer address, Hyderabad",
      taxId: "",
      salesperson: "Sales test",
      date: "2026-10-28",
      lines: [{ id, price: "35000" }],
      discount: "500",
      taxRate: "5",
      priceMode: "exclusive",
      customerState: "36",
      placeOfSupply: "36",
      issueConfirmed: true,
      paid: "10000",
      method: "Bank transfer",
      notes: "Warranty and delivery terms recorded by the seller.",
      warrantyVehicle: "12 months / 10,000 km, whichever is earlier",
      warrantyBattery: "24 months, as per manufacturer's terms",
      warrantyMotor: "12 months",
      warrantyController: "12 months",
      warrantyCharger: "6 months",
      warrantyProvider: "Example manufacturer - sample only",
      warrantyStart: "2026-10-28",
      warrantyTerms:
        "Demonstration coverage only. Damage, wear and misuse excluded as agreed by the seller.",
    };
    assert.equal(
      (await req("/invoices", "POST", { ...sale, paid: "999999" })).status,
      400,
    );
    const reviewed = await (
      await req("/invoices/preview", "POST", sale)
    ).json();
    assert.equal(reviewed.invoice.cgst, 86250);
    assert.equal(reviewed.invoice.sgst, 86250);
    assert.equal(reviewed.invoice.igst, 0);
    assert.equal(reviewed.invoice.lines[0].hsn, "871160");
    assert.equal(reviewed.invoice.warranty.battery, sale.warrantyBattery);
    assert.equal(reviewed.invoice.warranty.controller, sale.warrantyController);
    assert.equal(reviewed.invoice.lines[0].motor, bike.motor);
    assert.equal(reviewed.invoice.lines[0].controller, bike.controller);
    assert.equal(reviewed.invoice.lines[0].charger, bike.charger);
    assert.equal(reviewed.invoice.warranty.startDate, sale.warrantyStart);
    assert.equal(
      (
        await req("/invoices/preview", "POST", {
          ...sale,
          warrantyStart: "2026-02-30",
        })
      ).status,
      400,
    );
    assert.equal(reviewed.number, "TEST/2627/00001");
    assert.equal((await (await req("/state")).json()).invoices.length, 0);
    const draft = await req("/invoices/preview/pdf", "POST", sale);
    assert.equal(draft.status, 200);
    const draftBytes = Buffer.from(await draft.arrayBuffer());
    assert.equal(
      (draftBytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
      1,
    );
    if (process.env.PDF_DRAFT_PATH)
      writeFileSync(process.env.PDF_DRAFT_PATH, draftBytes);
    assert.equal(
      (await (await req("/state")).json()).bikes.find((b) => b.id === id)
        .status,
      "available",
    );
    const interstate = await (
      await req("/invoices/preview", "POST", { ...sale, placeOfSupply: "29" })
    ).json();
    assert.equal(interstate.invoice.igst, 172500);
    assert.equal(interstate.invoice.cgst, 0);
    assert.equal(interstate.invoice.sgst, 0);
    const inclusive = await (
      await req("/invoices/preview", "POST", {
        ...sale,
        priceMode: "inclusive",
        discount: "0",
        lines: [{ id, price: "52500" }],
      })
    ).json();
    assert.equal(inclusive.invoice.taxable, 5000000);
    assert.equal(inclusive.invoice.cgst, 125000);
    assert.equal(inclusive.invoice.total, 5250000);
    assert.equal(
      (await req("/invoices/preview", "POST", { ...sale, priceMode: "" }))
        .status,
      400,
    );
    assert.equal(
      (
        await req("/invoices/preview", "POST", {
          ...sale,
          taxId: "36AAQCR3663P1ZA",
        })
      ).status,
      400,
    );
    assert.equal(
      (await req("/invoices/preview", "POST", { ...sale, placeOfSupply: "99" }))
        .status,
      400,
    );
    assert.equal(
      (await req("/invoices/preview", "POST", { ...sale, taxRate: "0" }))
        .status,
      400,
    );
    assert.equal(
      (await req("/invoices", "POST", { ...sale, previewHash: "stale" }))
        .status,
      409,
    );
    sale.previewHash = reviewed.previewHash;
    const invoice = await (await req("/invoices", "POST", sale)).json();
    assert(invoice.id);
    assert.equal(
      (
        await req("/invoices", "POST", {
          ...sale,
          notes: "Changed after issue",
        })
      ).status,
      409,
    );
    assert.equal(
      (await (await req("/invoices", "POST", sale)).json()).id,
      invoice.id,
    );
    assert.equal(
      (
        await req("/invoices", "POST", {
          ...sale,
          requestKey: crypto.randomUUID(),
        })
      ).status,
      400,
    );
    assert.equal((await req("/bikes/" + id, "PUT", bike)).status, 400);
    state = await (await req("/state")).json();
    assert.equal(state.invoices.length, 1);
    assert.equal(state.bikes.find((b) => b.id === id).status, "sold");
    assert.equal(state.invoices[0].total, 3622500);
    assert.equal(state.invoices[0].body.balance, 2622500);
    assert.deepEqual(
      state.invoices[0].body.warranty,
      reviewed.invoice.warranty,
    );
    const pdf = await req("/invoices/" + invoice.id + "/pdf");
    assert.equal(pdf.status, 200);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    assert(bytes.length > 1000);
    assert.equal(
      (bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
      1,
    );
    if (process.env.PDF_CHECK_PATH)
      writeFileSync(process.env.PDF_CHECK_PATH, bytes);
    const supplierCopy = await req(
      "/invoices/" + invoice.id + "/pdf?copy=supplier",
    );
    assert.equal(supplierCopy.status, 200);
    assert(
      supplierCopy.headers.get("content-disposition").includes("supplier"),
    );
    const settingsAfter = (await (await req("/state")).json()).settings;
    assert.equal(
      (await req("/settings", "PUT", { ...settingsAfter, nextNumber: 1 }))
        .status,
      400,
    );
    const remainingBike = state.bikes.find((b) => b.status === "available");
    const registeredSale = {
      ...sale,
      lines: [{ id: remainingBike.id, price: "10000" }],
      discount: "0",
      taxId: "36AAQCR3663P1ZG",
      issueConfirmed: true,
      requestKey: crypto.randomUUID(),
    };
    assert.equal(
      (
        await req("/settings", "PUT", {
          ...settingsAfter,
          eInvoiceMode: "required",
        })
      ).status,
      200,
    );
    assert.equal(
      (await req("/invoices/preview", "POST", registeredSale)).status,
      400,
    );
    assert.equal(
      (
        await req("/settings", "PUT", {
          ...settingsAfter,
          eInvoiceMode: "unconfirmed",
        })
      ).status,
      200,
    );
    assert.equal(
      (await req("/invoices/preview", "POST", registeredSale)).status,
      400,
    );
    assert.equal((await req("/settings", "PUT", settingsAfter)).status, 200);
    const oldReview = await (
      await req("/invoices/preview", "POST", registeredSale)
    ).json();
    assert.equal(
      (
        await req("/settings", "PUT", {
          ...settingsAfter,
          footer: "Changed seller terms",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req("/invoices", "POST", {
          ...registeredSale,
          previewHash: oldReview.previewHash,
        })
      ).status,
      409,
    );
    assert.equal(
      (await (await req("/state")).json()).bikes.find(
        (b) => b.id === remainingBike.id,
      ).status,
      "available",
    );
    const beforeLimitCheck = await (await req("/state")).json();
    const oversizedSale = {
      ...registeredSale,
      requestKey: crypto.randomUUID(),
      taxId: "",
      notes: "Additional sale terms. ".repeat(100).slice(0, 1500),
      warrantyTerms: "Detailed warranty coverage. ".repeat(100).slice(0, 1500),
      ...Object.fromEntries(
        ["Vehicle", "Battery", "Motor", "Charger", "Provider"].map((key) => [
          "warranty" + key,
          "Extended manufacturer warranty conditions. ".repeat(6).slice(0, 150),
        ]),
      ),
    };
    assert.equal(
      (await req("/invoices/preview", "POST", oversizedSale)).status,
      422,
    );
    const oversizedPdf = await req(
      "/invoices/preview/pdf",
      "POST",
      oversizedSale,
    );
    assert.equal(oversizedPdf.status, 422);
    assert((await oversizedPdf.json()).error.includes("one legible A4 page"));
    assert.equal((await req("/invoices", "POST", oversizedSale)).status, 422);
    const afterLimitCheck = await (await req("/state")).json();
    assert.equal(
      afterLimitCheck.invoices.length,
      beforeLimitCheck.invoices.length,
    );
    assert.equal(
      afterLimitCheck.numbering.nextNumber,
      beforeLimitCheck.numbering.nextNumber,
    );
    assert.equal(
      afterLimitCheck.bikes.find((b) => b.id === remainingBike.id).status,
      "available",
    );
    if (process.env.PDF_STRESS_PATH) {
      for (let n = 0; n < 20; n++)
        assert.equal(
          (
            await req("/bikes", "POST", {
              ...bike,
              vin: "STRESS-" + n,
              battery: "STRESS-BAT-" + n,
              motor: "STRESS-MOTOR-" + n,
              controller: "STRESS-CTRL-" + n,
              charger: "STRESS-CHG-" + n,
              model: "Long-distance electric scooter model " + n,
              hsn: "87116020",
            })
          ).status,
          200,
        );
      const stressState = await (await req("/state")).json();
      const stress = await req("/invoices/preview/pdf", "POST", {
        ...sale,
        requestKey: crypto.randomUUID(),
        lines: stressState.bikes
          .filter((b) => b.vin.startsWith("STRESS-"))
          .map((b) => ({ id: b.id, price: "52500" })),
        priceMode: "inclusive",
        placeOfSupply: "29",
        notes: "Demonstration warranty terms. ".repeat(40),
      });
      assert.equal(stress.status, 422);
      assert((await stress.json()).error.includes("one legible A4 page"));
    }
    await serviceChecks(req, id, invoice.id, bike);
    assert.equal((await req("/logout", "POST", {})).status, 200);
    assert.equal((await req("/state")).status, 401);
    const otp2 = await (
      await req("/auth/otp/request", "POST", { phone: "9000000002" })
    ).json();
    const code2 = captured.at(-1).bodyParams[0];
    for (let j = 0; j < 5; j++)
      assert.equal(
        (
          await req("/auth/otp/verify", "POST", {
            challengeId: otp2.challengeId,
            code: code2 === "000000" ? "111111" : "000000",
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await req("/auth/otp/verify", "POST", {
          challengeId: otp2.challengeId,
          code: code2,
        })
      ).status,
      400,
    );
    providerFails = true;
    assert.equal(
      (await req("/auth/otp/request", "POST", { phone: "9000000003" })).status,
      502,
    );
    assert.equal((await req("/state")).status, 401);
    const check = new DatabaseSync(path.join(folder, "sales.sqlite"));
    const row = check
      .prepare("SELECT hash FROM otp_challenges WHERE id=?")
      .get(otp.challengeId);
    assert.notEqual(row.hash, code);
    check.close();
    console.log(
      "PASS: WhatsApp delivery protocol, allowlist, one-use codes, rate limits, lockout, delivery failure, atomic CSV import, invoice calculations and PDF.",
    );
  } finally {
    child.kill();
    await new Promise((r) => child.once("exit", r));
    await new Promise((r) => provider.close(r));
    rmSync(folder, { recursive: true, force: true });
  }
});

test("legacy invoices reflow to one page without changing their saved tax data", async () => {
  const body = {
    seller: {
      name: "Historical Dealership",
      address: "Historical address",
      phone: "",
      email: "",
      taxId: "",
      footer: "Saved seller terms",
      bank: "",
    },
    customer: {
      name: "Historical buyer",
      address: "Saved buyer address",
      phone: "9000000000",
      taxId: "",
    },
    date: "2026-10-28",
    method: "Bank transfer",
    salesperson: "",
    lines: [
      {
        brand: "Legacy",
        model: "EV scooter",
        vin: "HISTORICAL-001",
        salePrice: 100000,
      },
    ],
    subtotal: 100000,
    discount: 1000,
    taxRate: 500,
    tax: 4950,
    total: 103950,
    paid: 10000,
    balance: 93950,
    notes: "Historical terms remain unchanged",
  };
  const row = { number: "OLD-00001", body: JSON.stringify(body) },
    original = row.body;
  const response = new PassThrough(),
    chunks = [];
  response.set = () => response;
  response.on("data", (chunk) => chunks.push(chunk));
  const complete = new Promise((resolve, reject) => {
    response.on("end", resolve);
    response.on("error", reject);
  });
  invoicePdf(response, row, import.meta.dirname);
  await complete;
  const bytes = Buffer.concat(chunks);
  assert.equal(
    (bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
    1,
  );
  assert.equal(row.body, original);
  if (process.env.PDF_LEGACY_PATH)
    writeFileSync(process.env.PDF_LEGACY_PATH, bytes);
});
