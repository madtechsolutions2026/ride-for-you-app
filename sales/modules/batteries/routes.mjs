import { randomUUID } from "node:crypto";
import { fail, text, money } from "../../core/validation.mjs";
import { transaction } from "../../core/transactions.mjs";
import { serial } from "../../components.mjs";
import { batteryEvent } from "./stock.mjs";
export function gstRate(value, { optional = false } = {}) {
  if (optional && (value === "" || value == null)) return null;
  const rate = money(value, "GST percentage");
  if (rate <= 0 || rate > 4000)
    fail(
      "Enter the applicable GST percentage above 0 and up to 40. Exempt / nil-rated bill-of-supply sales are outside this workflow.",
    );
  return rate;
}
export function hsnCode(value, { optional = false } = {}) {
  const hsn = text(value, "HSN", 8, !optional);
  if (hsn && !/^\d{4}(?:\d{2}){0,2}$/.test(hsn))
    fail("Enter a 4, 6 or 8 digit HSN supplied for this battery.");
  return hsn;
}
export function batteryRoutes(db, app) {
  app.get("/api/batteries", (_req, res) =>
    res.json(db.prepare("SELECT * FROM batteries ORDER BY created DESC").all()),
  );
  app.get("/api/batteries/:id", (req, res) => {
    const battery = db
      .prepare("SELECT * FROM batteries WHERE id=?")
      .get(req.params.id);
    if (!battery) fail("Battery not found.", 404);
    const sale = db
      .prepare(
        "SELECT i.* FROM invoices i JOIN invoice_batteries ib ON ib.invoice_id=i.id WHERE ib.battery_id=?",
      )
      .get(battery.id);
    res.json({
      battery,
      sale: sale ? { ...sale, body: JSON.parse(sale.body) } : null,
      events: db
        .prepare(
          "SELECT * FROM battery_events WHERE battery_id=? ORDER BY created,rowid",
        )
        .all(battery.id)
        .map((e) => ({ ...e, body: JSON.parse(e.body) })),
      installedBike: battery.installed_bike_id
        ? db
            .prepare("SELECT id,vin,brand,model FROM bikes WHERE id=?")
            .get(battery.installed_bike_id)
        : null,
    });
  });
  function save(req, id) {
    return transaction(db, () => {
      const old = id
          ? db.prepare("SELECT * FROM batteries WHERE id=?").get(id)
          : null,
        body = req.body;
      if (id && !old) fail("Battery not found.", 404);
      if (old && old.status !== "available")
        fail(
          "Sold or installed batteries cannot be edited. Their sale and stock history are preserved.",
        );
      if (old && body.version !== old.version)
        fail("Battery details changed. Reload before saving.", 409);
      const number = serial(text(body.serial, "battery serial number", 100));
      if (
        db
          .prepare("SELECT id FROM batteries WHERE serial=? AND id<>?")
          .get(number, id || "")
      )
        fail("That battery number is already in inventory.", 409);
      if (
        db
          .prepare("SELECT id FROM bikes WHERE UPPER(TRIM(battery))=?")
          .get(number) ||
        db
          .prepare(
            "SELECT bike_id FROM component_records WHERE type='battery' AND serial=?",
          )
          .get(number)
      )
        fail("That battery number is already tracked against a bike.", 409);
      const data = {
        brand: text(body.brand, "battery brand", 100),
        model: text(body.model, "battery model", 100),
        serial: number,
        chemistry: text(body.chemistry, "battery type", 80, false),
        voltage: text(body.voltage, "voltage", 60, false),
        capacity: text(body.capacity, "capacity", 60, false),
        warranty: text(body.warranty, "battery warranty", 150, false),
        warranty_terms: text(
          body.warranty_terms,
          "warranty terms",
          1000,
          false,
        ),
        provider: text(body.provider, "warranty provider", 150, false),
        hsn: hsnCode(body.hsn, { optional: true }),
        gst_bps: gstRate(body.gstPercent, { optional: true }),
        cost: money(body.cost, "purchase cost"),
        price: money(body.price, "selling price"),
      };
      const batteryId = id || randomUUID(),
        now = new Date().toISOString(),
        values = Object.values(data);
      if (id)
        db.prepare(
          "UPDATE batteries SET brand=?,model=?,serial=?,chemistry=?,voltage=?,capacity=?,warranty=?,warranty_terms=?,provider=?,hsn=?,gst_bps=?,cost=?,price=?,version=version+1,updated=? WHERE id=?",
        ).run(...values, now, id);
      else
        db.prepare(
          "INSERT INTO batteries(id,brand,model,serial,chemistry,voltage,capacity,warranty,warranty_terms,provider,hsn,gst_bps,cost,price,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(batteryId, ...values, now, now);
      batteryEvent(db, batteryId, old ? "updated" : "received", {
        before: old,
        after: data,
      });
      return { id: batteryId };
    });
  }
  app.post("/api/batteries", (req, res) => res.json(save(req)));
  app.put("/api/batteries/:id", (req, res) =>
    res.json(save(req, req.params.id)),
  );
}
