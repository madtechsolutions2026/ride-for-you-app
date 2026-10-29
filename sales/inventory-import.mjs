import { parse } from "csv-parse/sync";
import { randomUUID, createHash } from "node:crypto";
import { DEFAULT_HSN, EV_HSN } from "./public/gst.mjs";
import { componentValues, assertComponentsAvailable } from "./components.mjs";
export const csvTemplate =
  "brand,model,vin,color,battery,motor,controller,charger,cost,price,notes,hsn\r\nRide For You,City EV,REPLACE-WITH-UNIQUE-CHASSIS,Green,,,,,25000.00,35000.00,Replace this example row with your inventory,871160\r\n";
export function inventoryImport(db, app, { text, money }) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS inventory_imports(request_key TEXT PRIMARY KEY,hash TEXT,count INTEGER,created TEXT)",
  );
  function validate(csv) {
    if (typeof csv !== "string" || Buffer.byteLength(csv) > 800000)
      throw Object.assign(Error("Choose a CSV file smaller than 800 KB."), {
        status: 400,
      });
    let records;
    try {
      records = parse(csv, {
        columns: (headers) => {
          const keys = headers.map((h) => h.trim().toLowerCase());
          if (new Set(keys).size !== keys.length)
            throw Error("Duplicate headers.");
          return keys;
        },
        bom: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 20000,
      });
    } catch {
      throw Object.assign(
        Error(
          "Invalid CSV. Use the downloadable template and keep quoted fields intact.",
        ),
        { status: 400 },
      );
    }
    if (!records.length || records.length > 500)
      throw Object.assign(Error("Upload between 1 and 500 inventory rows."), {
        status: 400,
      });
    const columns = Object.keys(records[0]);
    if (
      ["brand", "model", "vin", "cost", "price"].some(
        (k) => !columns.includes(k),
      )
    )
      throw Object.assign(
        Error(
          "Required columns: brand, model, vin, cost, price. Start with the CSV template.",
        ),
        { status: 400 },
      );
    const errors = [],
      rows = [],
      seen = new Set();
    records.forEach((b, index) => {
      try {
        const row = {
          brand: text(b.brand, "brand", 100),
          model: text(b.model, "model", 100),
          vin: text(b.vin, "chassis/frame number", 100).toUpperCase(),
          color: text(b.color, "colour", 60, false),
          ...componentValues(b),
          cost: money(b.cost, "purchase cost"),
          price: money(b.price, "selling price"),
          notes: text(b.notes, "notes", 1500, false),
          hsn: text(b.hsn || DEFAULT_HSN, "HSN", 8),
        };
        if (!EV_HSN[row.hsn])
          throw Error(
            "Select a complete electric two-wheeler HSN; batteries, chargers and parts require separate classification.",
          );
        if (row.vin === "REPLACE-WITH-UNIQUE-CHASSIS")
          throw Error(
            "Replace the template example with your actual chassis number.",
          );
        for (const type of ["battery", "motor", "controller", "charger"])
          if (row[type]) {
            const key = type + ":" + row[type];
            if (seen.has(key))
              throw Error(`Duplicate ${type} number within this CSV.`);
            seen.add(key);
          }
        assertComponentsAvailable(db, "new-import", row);
        if (seen.has(row.vin))
          throw Error("Duplicate chassis/frame number within this CSV.");
        seen.add(row.vin);
        if (db.prepare("SELECT id FROM bikes WHERE vin=?").get(row.vin))
          throw Error("Chassis/frame number already exists in inventory.");
        rows.push(row);
      } catch (e) {
        errors.push({
          row: index + 2,
          chassis: String(b.vin || ""),
          message: e.message,
        });
      }
    });
    return { rows, errors, total: records.length, valid: rows.length };
  }
  app.get("/api/inventory/template", (_req, res) =>
    res
      .set({
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition":
          'attachment; filename="ride-for-you-inventory-template.csv"',
      })
      .send(csvTemplate),
  );
  app.post("/api/inventory/import/preview", (req, res) =>
    res.json(validate(req.body.csv)),
  );
  app.post("/api/inventory/import", (req, res) => {
    const key = text(req.body.requestKey, "import request key", 80),
      csv = req.body.csv;
    if (typeof csv !== "string")
      throw Object.assign(Error("Upload a CSV first."), { status: 400 });
    const hash = createHash("sha256").update(csv).digest("hex");
    const previous = db
      .prepare("SELECT * FROM inventory_imports WHERE request_key=?")
      .get(key);
    if (previous) {
      if (previous.hash !== hash)
        return res.status(409).json({
          error: "The file changed. Preview it again before importing.",
        });
      return res.json({ imported: previous.count });
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = validate(csv);
      if (result.errors.length) {
        db.exec("ROLLBACK");
        return res.status(400).json({
          error: "Nothing imported. Fix all row errors and preview again.",
          errors: result.errors,
        });
      }
      const insert = db.prepare(
        "INSERT INTO bikes(id,model,brand,color,vin,battery,motor,controller,charger,cost,price,notes,hsn,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      );
      for (const b of result.rows)
        insert.run(
          randomUUID(),
          b.model,
          b.brand,
          b.color,
          b.vin,
          b.battery,
          b.motor,
          b.controller,
          b.charger,
          b.cost,
          b.price,
          b.notes,
          b.hsn,
          new Date().toISOString(),
        );
      db.prepare("INSERT INTO inventory_imports VALUES(?,?,?,?)").run(
        key,
        hash,
        result.rows.length,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
      res.json({ imported: result.rows.length });
    } catch (e) {
      try {
        db.exec("ROLLBACK");
      } catch {}
      throw e;
    }
  });
}
