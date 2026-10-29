export const COMPONENTS = {
  battery: "Battery",
  motor: "Motor",
  controller: "Controller",
  charger: "Charger",
};
export const serial = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();
export function componentValues(input, fallback = {}) {
  const values = {};
  for (const key of Object.keys(COMPONENTS)) {
    const value = input[key] === undefined ? fallback[key] : input[key];
    if (value != null && typeof value !== "string")
      throw Object.assign(Error(`Check ${key} number.`), { status: 400 });
    values[key] = serial(value);
    if (values[key].length > 100)
      throw Object.assign(
        Error(`${COMPONENTS[key]} number must be at most 100 characters.`),
        { status: 400 },
      );
  }
  return values;
}
export function assertComponentsAvailable(db, bikeId, values) {
  for (const [type, value] of Object.entries(values)) {
    if (!Object.hasOwn(COMPONENTS, type) || !value) continue;
    const bike = db
      .prepare(`SELECT id FROM bikes WHERE UPPER(TRIM(${type}))=? AND id<>?`)
      .get(value, bikeId);
    const history = db
      .prepare(
        "SELECT bike_id FROM component_records WHERE type=? AND serial=?",
      )
      .get(type, value);
    if (
      type === "battery" &&
      db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='batteries'",
        )
        .get()
    ) {
      const stock = db
        .prepare(
          "SELECT id,status,installed_bike_id FROM batteries WHERE serial=?",
        )
        .get(value);
      if (
        stock &&
        !(stock.status === "installed" && stock.installed_bike_id === bikeId)
      )
        throw Object.assign(
          Error(
            `Battery ${value} is tracked in separate stock. Select it from battery inventory for a service replacement; sold batteries cannot be assigned as new stock.`,
          ),
          { status: 409 },
        );
    }
    if (bike || (history && history.bike_id !== bikeId))
      throw Object.assign(
        Error(
          `${COMPONENTS[type]} number ${value} is already linked to another bike.`,
        ),
        { status: 409 },
      );
  }
}
export function registerComponents(db, bikeId, values, source) {
  assertComponentsAvailable(db, bikeId, values);
  for (const [type, value] of Object.entries(values))
    if (value && Object.hasOwn(COMPONENTS, type))
      db.prepare(
        "INSERT INTO component_records(type,serial,bike_id,state,source,created) VALUES(?,?,?,'current',?,?) ON CONFLICT(type,serial) DO UPDATE SET state='current'",
      ).run(type, value, bikeId, source, new Date().toISOString());
}
