import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

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
      await req("/auth/otp/request", "POST", { phone: "9000000001" })
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
          name: "Ride For You",
          address: "Test showroom, Hyderabad",
          phone: "0000000000",
          email: "test@example.test",
          taxId: "",
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
      name: "Customer Test",
      phone: "0000000000",
      address: "Test customer address, Hyderabad",
      taxId: "",
      salesperson: "Sales test",
      date: "2026-10-28",
      lines: [{ id, price: "35000" }],
      discount: "500",
      taxRate: "5",
      paid: "10000",
      method: "Bank transfer",
      notes: "Warranty and delivery terms recorded by the seller.",
    };
    assert.equal(
      (await req("/invoices", "POST", { ...sale, paid: "999999" })).status,
      400,
    );
    const invoice = await (await req("/invoices", "POST", sale)).json();
    assert(invoice.id);
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
    const pdf = await req("/invoices/" + invoice.id + "/pdf");
    assert.equal(pdf.status, 200);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    assert(bytes.length > 1000);
    if (process.env.PDF_CHECK_PATH)
      writeFileSync(process.env.PDF_CHECK_PATH, bytes);
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
