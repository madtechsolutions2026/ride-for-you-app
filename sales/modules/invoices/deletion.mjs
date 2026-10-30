import { fail, text } from "../../core/validation.mjs";
import { fingerprint } from "../../core/documents.mjs";
import { transaction } from "../../core/transactions.mjs";
import { batteryEvent } from "../batteries/stock.mjs";

export const invoiceDeletion = (db, id) =>
  db
    .prepare(
      "SELECT invoice_id,deleted_at,reason FROM invoice_deletions WHERE invoice_id=?",
    )
    .get(id);

function review(db, id) {
  const row = db.prepare("SELECT * FROM invoices WHERE id=?").get(id);
  if (!row) fail("Invoice not found.", 404);
  if (invoiceDeletion(db, id))
    fail(
      "This invoice is already deleted. Its record is retained under Deleted invoices.",
      409,
    );
  const body = JSON.parse(row.body);
  const bikes = db
    .prepare(
      "SELECT b.* FROM bikes b JOIN invoice_bikes ib ON ib.bike_id=b.id WHERE ib.invoice_id=? ORDER BY b.id",
    )
    .all(id);
  const batteries = db
    .prepare(
      "SELECT b.* FROM batteries b JOIN invoice_batteries ib ON ib.battery_id=b.id WHERE ib.invoice_id=? ORDER BY b.id",
    )
    .all(id);
  const serviceCount = db
    .prepare(
      "SELECT COUNT(*) n FROM service_jobs WHERE invoice_id=? OR bike_id IN (SELECT bike_id FROM invoice_bikes WHERE invoice_id=?)",
    )
    .get(id, id).n;
  const installedCount = db
    .prepare(
      "SELECT COUNT(*) n FROM batteries WHERE installed_bike_id IN (SELECT bike_id FROM invoice_bikes WHERE invoice_id=?)",
    )
    .get(id).n;
  const blockers = [];
  if (serviceCount)
    blockers.push(
      "This invoice has service history. Keep the invoice so the bike, complaint and repair records remain linked.",
    );
  if (installedCount)
    blockers.push(
      "A stock battery is installed on a linked bike. Review its service and component history first.",
    );
  if (body.irn || body.eInvoice?.irn)
    blockers.push(
      "IRN-linked invoices require the appropriate e-invoice cancellation workflow.",
    );
  if (
    !body.lines?.length ||
    bikes.length + batteries.length !== body.lines.length ||
    [...bikes, ...batteries].some((b) => b.status !== "sold") ||
    batteries.some((b) => b.installed_bike_id)
  )
    blockers.push(
      "The sold-stock links do not match this invoice. Stock must be reviewed before deletion.",
    );
  const stock = [
    ...bikes.map((b) => ({
      id: b.id,
      type: "bike",
      name: b.brand + " " + b.model,
      serial: b.vin,
    })),
    ...batteries.map((b) => ({
      id: b.id,
      type: "battery",
      name: b.brand + " " + b.model,
      serial: b.serial,
    })),
  ];
  return {
    row,
    bikes,
    batteries,
    stock,
    blockers,
    reviewHash: fingerprint({
      row,
      bikes,
      batteries,
      serviceCount,
      installedCount,
    }),
  };
}

export function invoiceDeletionRoutes(db, app) {
  app.get("/api/invoices/:id/delete-review", (req, res) => {
    const r = review(db, req.params.id);
    res.json({
      number: r.row.number,
      customer: JSON.parse(r.row.body).customer,
      total: r.row.total,
      paid: r.row.paid,
      stock: r.stock,
      blockers: r.blockers,
      canDelete: r.blockers.length === 0,
      reviewHash: r.reviewHash,
    });
  });
  app.delete("/api/invoices/:id", (req, res) =>
    res.json(
      transaction(db, () => {
        const body = req.body || {};
        const key = text(body.requestKey, "deletion request key", 80);
        const digest = fingerprint({ id: req.params.id, body });
        const existing = db
          .prepare(
            "SELECT invoice_id,request_key,request_hash FROM invoice_deletions WHERE invoice_id=? OR request_key=?",
          )
          .get(req.params.id, key);
        if (existing) {
          if (
            existing.invoice_id !== req.params.id ||
            existing.request_key !== key ||
            existing.request_hash !== digest
          )
            fail(
              "This invoice was already deleted or the deletion request changed. Reload the invoice list.",
              409,
            );
          return { ok: true, id: req.params.id, alreadyDeleted: true };
        }
        const r = review(db, req.params.id);
        if (r.blockers.length) fail(r.blockers[0], 409);
        if (body.reviewHash !== r.reviewHash)
          fail(
            "Invoice or stock details changed. Reload and review the deletion again.",
            409,
          );
        if (body.invoiceNumber !== r.row.number)
          fail("Type the exact invoice number to confirm deletion.");
        if (
          body.deleteConfirmed !== true ||
          body.stockConfirmed !== true ||
          body.correctionsConfirmed !== true
        )
          fail(
            "Confirm the deletion, physical stock and any required payment or tax corrections.",
          );
        const reason = text(body.reason, "deletion reason", 500);
        if (reason.length < 10)
          fail("Enter a deletion reason of at least 10 characters.");
        const now = new Date().toISOString();
        db.prepare("INSERT INTO invoice_deletions VALUES(?,?,?,?,?,?,?)").run(
          req.params.id,
          now,
          reason,
          fingerprint(req.sessionToken),
          key,
          digest,
          JSON.stringify(r.stock),
        );
        db.prepare("DELETE FROM invoice_bikes WHERE invoice_id=?").run(
          req.params.id,
        );
        db.prepare("DELETE FROM invoice_batteries WHERE invoice_id=?").run(
          req.params.id,
        );
        for (const b of r.bikes) {
          if (
            db
              .prepare(
                "UPDATE bikes SET status='available' WHERE id=? AND status='sold'",
              )
              .run(b.id).changes !== 1
          )
            fail("Bike stock changed. Nothing was deleted.", 409);
        }
        for (const b of r.batteries) {
          if (
            db
              .prepare(
                "UPDATE batteries SET status='available',version=version+1,updated=? WHERE id=? AND status='sold' AND installed_bike_id IS NULL",
              )
              .run(now, b.id).changes !== 1
          )
            fail("Battery stock changed. Nothing was deleted.", 409);
          batteryEvent(db, b.id, "invoice_deleted", {
            invoiceId: req.params.id,
            number: r.row.number,
            reason,
          });
        }
        return { ok: true, id: req.params.id, released: r.stock.length };
      }),
    ),
  );
}
