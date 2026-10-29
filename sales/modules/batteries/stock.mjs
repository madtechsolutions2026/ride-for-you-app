import { randomUUID } from "node:crypto";
import { fail } from "../../core/validation.mjs";
export function batteryEvent(db, id, kind, body) {
  db.prepare("INSERT INTO battery_events VALUES(?,?,?,?,?)").run(
    randomUUID(),
    id,
    kind,
    JSON.stringify(body),
    new Date().toISOString(),
  );
}
export function serviceBattery(db, part) {
  if (!part.batteryId) return { batteryId: null };
  if (part.componentType !== "battery" || part.quantity !== 1)
    fail(
      "Battery stock can be selected only for a single tracked battery replacement.",
    );
  const pack = db
    .prepare("SELECT * FROM batteries WHERE id=?")
    .get(part.batteryId);
  if (!pack || pack.status !== "available")
    fail("The selected replacement battery is no longer available.", 409);
  if (part.newSerial !== pack.serial)
    fail("The replacement number must match the selected battery stock.");
  return { batteryId: pack.id };
}
export function consumeServiceBattery(db, part, bikeId, jobNumber) {
  if (!part.batteryId) return;
  serviceBattery(db, part);
  if (
    !db
      .prepare(
        "UPDATE batteries SET status='installed',installed_bike_id=?,version=version+1,updated=? WHERE id=? AND status='available'",
      )
      .run(bikeId, new Date().toISOString(), part.batteryId).changes
  )
    fail("The replacement battery is no longer available.", 409);
  batteryEvent(db, part.batteryId, "installed", {
    bikeId,
    jobNumber,
    serial: part.newSerial,
  });
}
