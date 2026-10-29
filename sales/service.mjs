import { randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  COMPONENTS,
  componentValues,
  assertComponentsAvailable,
  registerComponents,
  serial,
} from "./components.mjs";
import { financialYear } from "./public/gst.mjs";
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const SERVICE_STATES = {
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
export function upgradeService(db, { backupPath } = {}) {
  if (db.prepare("SELECT 1 FROM app_meta WHERE key='service-v1'").get()) return;
  if (backupPath) {
    mkdirSync(path.dirname(backupPath), { recursive: true });
    db.prepare("VACUUM INTO ?").run(backupPath);
    console.log(
      "Service upgrade: database snapshot saved on persistent storage.",
    );
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const columns = db.prepare("PRAGMA table_info(bikes)").all();
    for (const key of ["motor", "controller", "charger"])
      if (!columns.some((c) => c.name === key))
        db.exec(`ALTER TABLE bikes ADD COLUMN ${key} TEXT NOT NULL DEFAULT ''`);
    db.exec(`CREATE TABLE IF NOT EXISTS component_records(type TEXT NOT NULL,serial TEXT NOT NULL,bike_id TEXT NOT NULL REFERENCES bikes(id),state TEXT NOT NULL,source TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(type,serial));
CREATE TABLE IF NOT EXISTS technicians(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT,speciality TEXT,active INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS service_sequences(fy TEXT PRIMARY KEY,next_number INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS service_jobs(id TEXT PRIMARY KEY,number TEXT UNIQUE NOT NULL,bike_id TEXT NOT NULL REFERENCES bikes(id),invoice_id TEXT NOT NULL REFERENCES invoices(id),technician_id TEXT REFERENCES technicians(id),status TEXT NOT NULL,body TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL,updated TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_service ON service_jobs(bike_id) WHERE status NOT IN ('delivered','cancelled');
CREATE TABLE IF NOT EXISTS service_events(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES service_jobs(id),kind TEXT NOT NULL,description TEXT NOT NULL,data TEXT,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS service_payments(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES service_jobs(id),amount INTEGER NOT NULL CHECK(amount>0),method TEXT NOT NULL,reference TEXT,created TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL);`);
    db.prepare("INSERT INTO app_meta VALUES('service-v1','enabled')").run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function serviceRoutes(db, app, { text, money }) {
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const paid = (id) =>
    Number(
      db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) n FROM service_payments WHERE job_id=?",
        )
        .get(id).n,
    );
  const event = (id, kind, description, data) =>
    db
      .prepare("INSERT INTO service_events VALUES(?,?,?,?,?,?)")
      .run(
        randomUUID(),
        id,
        kind,
        description,
        JSON.stringify(data),
        new Date().toISOString(),
      );
  function vehicle(id) {
    const bike = db.prepare("SELECT * FROM bikes WHERE id=?").get(id);
    if (!bike) fail("Bike not found.", 404);
    const sale = db
      .prepare(
        "SELECT i.* FROM invoices i JOIN invoice_bikes ib ON ib.invoice_id=i.id WHERE ib.bike_id=?",
      )
      .get(id);
    if (!sale || bike.status !== "sold")
      fail("Service jobs are available for sold bikes with an issued invoice.");
    sale.body = JSON.parse(sale.body);
    return { bike, sale };
  }
  function job(id) {
    const row = db.prepare("SELECT * FROM service_jobs WHERE id=?").get(id);
    if (!row) fail("Service job not found.", 404);
    row.body = JSON.parse(row.body);
    return {
      ...row,
      received: paid(id),
      balance: row.body.totalCharge - paid(id),
      technician: row.technician_id
        ? db
            .prepare("SELECT * FROM technicians WHERE id=?")
            .get(row.technician_id)
        : null,
    };
  }
  const technician = (id) => {
    if (!id) return null;
    const t = db
      .prepare("SELECT * FROM technicians WHERE id=? AND active=1")
      .get(id);
    if (!t) fail("Select an active technician.");
    return t;
  };
  const revision = (row, body) => {
    if (!Number.isInteger(body.version) || body.version !== row.version)
      fail(
        "This job changed in another session. Reload it before saving.",
        409,
      );
  };
  function details(body, base = {}) {
    const chargeType = body.chargeType || "paid";
    if (!["paid", "warranty", "goodwill"].includes(chargeType))
      fail("Choose a valid service charge type.");
    const parts = body.parts || [];
    if (!Array.isArray(parts) || parts.length > 30)
      fail("Use up to 30 service parts.");
    const normalized = parts.map((p) => {
      const quantity = Number(p.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000)
        fail("Part quantity must be a whole number between 1 and 1000.");
      const type = p.componentType || "";
      if (type && !Object.hasOwn(COMPONENTS, type))
        fail("Choose a tracked component type.");
      const newSerial = serial(p.newSerial);
      if (newSerial.length > 100) fail("Replacement serial is too long.");
      if (
        (type && !newSerial) ||
        (!type && newSerial) ||
        (type && quantity !== 1)
      )
        fail(
          "A tracked replacement needs a component type, one unit, and its new serial number.",
        );
      return {
        description: text(p.description, "part description", 150),
        quantity,
        unitCost: money(p.unitCost || 0, "part cost"),
        unitCharge: money(p.unitCharge || 0, "part charge"),
        componentType: type,
        newSerial,
      };
    });
    const replacements = normalized.filter((p) => p.componentType);
    if (
      new Set(replacements.map((p) => p.componentType)).size !==
      replacements.length
    )
      fail("Record only one replacement per component on a job.");
    const labourCost = money(body.labourCost || 0, "labour cost"),
      labourCharge = money(body.labourCharge || 0, "labour charge");
    const partsCost = normalized.reduce(
        (n, p) => n + p.quantity * p.unitCost,
        0,
      ),
      partsCharge = normalized.reduce(
        (n, p) => n + p.quantity * p.unitCharge,
        0,
      );
    if (
      !Number.isSafeInteger(partsCost + labourCost) ||
      !Number.isSafeInteger(partsCharge + labourCharge)
    )
      fail("Service amounts are too large.");
    if (chargeType !== "paid" && (partsCharge || labourCharge))
      fail(
        "Warranty and goodwill jobs must have zero customer charges. Internal costs can still be recorded.",
      );
    const dueDate = text(body.dueDate, "expected completion date", 10, false);
    if (dueDate) {
      try {
        financialYear(dueDate);
      } catch {
        fail("Choose a valid expected completion date.");
      }
    }
    return {
      ...base,
      complaint: text(body.complaint, "customer complaint", 2000),
      odometer: text(body.odometer, "odometer reading", 30, false),
      dueDate,
      diagnosis: text(body.diagnosis, "diagnosis", 2000, false),
      workPerformed: text(body.workPerformed, "work performed", 2000, false),
      notes: text(body.notes, "service notes", 1500, false),
      chargeType,
      parts: normalized,
      labourCost,
      labourCharge,
      partsCost,
      partsCharge,
      totalCost: partsCost + labourCost,
      totalCharge: partsCharge + labourCharge,
    };
  }
  app.get("/api/technicians", (_req, res) =>
    res.json(
      db.prepare("SELECT * FROM technicians ORDER BY active DESC,name").all(),
    ),
  );
  app.post("/api/technicians", (req, res) => {
    const id = randomUUID();
    db.prepare("INSERT INTO technicians VALUES(?,?,?,?,1,?)").run(
      id,
      text(req.body.name, "technician name", 100),
      text(req.body.phone, "phone", 30, false),
      text(req.body.speciality, "speciality", 150, false),
      new Date().toISOString(),
    );
    res.json({ id });
  });
  app.put("/api/technicians/:id", (req, res) => {
    if (!db.prepare("SELECT id FROM technicians WHERE id=?").get(req.params.id))
      fail("Technician not found.", 404);
    if (typeof req.body.active !== "boolean")
      fail("Choose the technician status.");
    db.prepare(
      "UPDATE technicians SET name=?,phone=?,speciality=?,active=? WHERE id=?",
    ).run(
      text(req.body.name, "technician name", 100),
      text(req.body.phone, "phone", 30, false),
      text(req.body.speciality, "speciality", 150, false),
      req.body.active ? 1 : 0,
      req.params.id,
    );
    res.json({ ok: true });
  });
  app.get("/api/services", (_req, res) =>
    res.json(
      db
        .prepare("SELECT id FROM service_jobs ORDER BY updated DESC")
        .all()
        .map((row) => job(row.id)),
    ),
  );
  app.get("/api/services/:id", (req, res) => {
    const record = job(req.params.id);
    res.json({
      ...record,
      ...vehicle(record.bike_id),
      events: db
        .prepare(
          "SELECT * FROM service_events WHERE job_id=? ORDER BY created,rowid",
        )
        .all(record.id)
        .map((e) => ({ ...e, data: JSON.parse(e.data) })),
      payments: db
        .prepare(
          "SELECT * FROM service_payments WHERE job_id=? ORDER BY created",
        )
        .all(record.id),
    });
  });
  app.get("/api/vehicles/:id", (req, res) => {
    const record = vehicle(req.params.id);
    res.json({
      ...record,
      jobs: db
        .prepare(
          "SELECT id FROM service_jobs WHERE bike_id=? ORDER BY created DESC",
        )
        .all(record.bike.id)
        .map((r) => job(r.id)),
      components: db
        .prepare(
          "SELECT * FROM component_records WHERE bike_id=? ORDER BY created",
        )
        .all(record.bike.id),
    });
  });
  app.post("/api/services", (req, res) =>
    res.json(
      transaction(() => {
        const body = req.body,
          key = text(body.requestKey, "request key", 80),
          digest = hash(body),
          previous = db
            .prepare(
              "SELECT id,request_hash FROM service_jobs WHERE request_key=?",
            )
            .get(key);
        if (previous) {
          if (previous.request_hash !== digest)
            fail(
              "This service request was already used with different details.",
              409,
            );
          return { id: previous.id };
        }
        const { bike, sale } = vehicle(text(body.bikeId, "bike", 80));
        if (
          db
            .prepare(
              "SELECT id FROM service_jobs WHERE bike_id=? AND status NOT IN ('delivered','cancelled')",
            )
            .get(bike.id)
        )
          fail(
            "This bike already has an open service job. Open its existing job.",
            409,
          );
        const intake = componentValues(body.intakeComponents || {}, bike);
        for (const type of Object.keys(COMPONENTS))
          if (bike[type] && intake[type] !== serial(bike[type]))
            fail(
              "Existing component numbers must be changed through a tracked replacement, not overwritten at intake.",
            );
        registerComponents(db, bike.id, intake, "Service intake");
        db.prepare(
          "UPDATE bikes SET battery=?,motor=?,controller=?,charger=? WHERE id=?",
        ).run(...Object.keys(COMPONENTS).map((k) => intake[k]), bike.id);
        const assigned = technician(body.technicianId),
          data = details(body, {
            customer: sale.body.customer,
            warranty: sale.body.warranty || null,
            bike: { ...bike, ...intake },
            invoiceNumber: sale.number,
          });
        const fy = financialYear(
            new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Kolkata",
            }),
          ),
          seq =
            db
              .prepare("SELECT next_number n FROM service_sequences WHERE fy=?")
              .get(fy)?.n || 1;
        const id = randomUUID(),
          now = new Date().toISOString(),
          number = `SRV/${fy}/${String(seq).padStart(5, "0")}`;
        db.prepare(
          "INSERT INTO service_jobs(id,number,bike_id,invoice_id,technician_id,status,body,created,updated,request_key,request_hash) VALUES(?,?,?,?,?,'received',?,?,?,?,?)",
        ).run(
          id,
          number,
          bike.id,
          sale.id,
          assigned?.id || null,
          JSON.stringify(data),
          now,
          now,
          key,
          digest,
        );
        db.prepare(
          "INSERT INTO service_sequences VALUES(?,?) ON CONFLICT(fy) DO UPDATE SET next_number=excluded.next_number",
        ).run(fy, seq + 1);
        event(id, "received", "Bike received for service", data);
        return { id };
      }),
    ),
  );
  app.put("/api/services/:id", (req, res) =>
    res.json(
      transaction(() => {
        const row = job(req.params.id),
          body = req.body;
        revision(row, body);
        if (["delivered", "cancelled"].includes(row.status))
          fail(
            "Closed service jobs are read-only. Create a new visit for further work.",
          );
        const status = body.status || row.status;
        if (
          !SERVICE_STATES[status] ||
          (status !== row.status && !NEXT[row.status].includes(status))
        )
          fail("That service status transition is not allowed.");
        const assigned = technician(body.technicianId),
          data = details(body, row.body);
        if (!["received", "cancelled"].includes(status) && !assigned)
          fail("Assign an active technician before starting work.");
        if (
          ["ready", "delivered"].includes(status) &&
          (!data.diagnosis || !data.workPerformed)
        )
          fail(
            "Record the diagnosis and work performed before marking the bike ready.",
          );
        if (data.totalCharge < row.received)
          fail("Customer charges cannot be reduced below recorded payments.");
        if (status === "cancelled" && row.received)
          fail(
            "A job with recorded payments cannot be cancelled without a refund workflow.",
          );
        if (status === "delivered") {
          if (
            data.totalCharge > row.received &&
            body.allowOutstandingDelivery !== true
          )
            fail(
              "Record payment or explicitly approve delivery with an outstanding balance.",
            );
          const { bike } = vehicle(row.bike_id),
            updates = componentValues({}, bike);
          data.replacements = [];
          for (const part of data.parts.filter((p) => p.componentType)) {
            const type = part.componentType;
            if (part.newSerial === serial(bike[type]))
              fail(
                "Replacement serial must differ from the current component number.",
              );
            assertComponentsAvailable(db, bike.id, { [type]: part.newSerial });
            if (bike[type])
              db.prepare(
                "UPDATE component_records SET state='removed' WHERE type=? AND serial=? AND bike_id=?",
              ).run(type, serial(bike[type]), bike.id);
            updates[type] = part.newSerial;
            data.replacements.push({
              type,
              oldSerial: bike[type] || "",
              newSerial: part.newSerial,
            });
          }
          registerComponents(db, bike.id, updates, "Service " + row.number);
          db.prepare(
            "UPDATE bikes SET battery=?,motor=?,controller=?,charger=? WHERE id=?",
          ).run(...Object.keys(COMPONENTS).map((k) => updates[k]), bike.id);
          data.deliveredAt = new Date().toISOString();
          data.deliveredByTechnician = assigned.name;
          data.deliveryBalance = data.totalCharge - row.received;
          data.outstandingDeliveryApproved =
            data.deliveryBalance > 0 && body.allowOutstandingDelivery === true;
        }
        db.prepare(
          "UPDATE service_jobs SET status=?,technician_id=?,body=?,version=version+1,updated=? WHERE id=?",
        ).run(
          status,
          assigned?.id || null,
          JSON.stringify(data),
          new Date().toISOString(),
          row.id,
        );
        event(
          row.id,
          status === row.status ? "updated" : status,
          `Owner saved job: ${SERVICE_STATES[status]}`,
          { before: row.body, after: data, technician: assigned?.name || null },
        );
        return { ok: true };
      }),
    ),
  );
  app.post("/api/services/:id/payments", (req, res) =>
    res.json(
      transaction(() => {
        const body = req.body,
          key = text(body.requestKey, "payment request key", 80),
          digest = hash({ ...body, job: req.params.id }),
          previous = db
            .prepare(
              "SELECT id,request_hash FROM service_payments WHERE request_key=?",
            )
            .get(key);
        if (previous) {
          if (previous.request_hash !== digest)
            fail(
              "This payment request was already used for different details.",
              409,
            );
          return { id: previous.id };
        }
        const row = job(req.params.id);
        revision(row, body);
        if (row.status === "cancelled")
          fail("Cancelled jobs cannot receive payments.");
        const amount = money(body.amount, "amount received"),
          method = text(body.method, "payment method", 30);
        if (!amount || amount > row.balance)
          fail(
            "Payment must be greater than zero and not exceed the outstanding service balance.",
          );
        if (!["Cash", "UPI", "Bank transfer"].includes(method))
          fail("Choose Cash, UPI or Bank transfer.");
        const id = randomUUID();
        db.prepare("INSERT INTO service_payments VALUES(?,?,?,?,?,?,?,?)").run(
          id,
          row.id,
          amount,
          method,
          text(body.reference, "payment reference", 100, false),
          new Date().toISOString(),
          key,
          digest,
        );
        db.prepare(
          "UPDATE service_jobs SET version=version+1,updated=? WHERE id=?",
        ).run(new Date().toISOString(), row.id);
        event(row.id, "payment", "Service payment recorded", {
          amount,
          method,
        });
        return { id };
      }),
    ),
  );
}
