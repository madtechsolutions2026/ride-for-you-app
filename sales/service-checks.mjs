import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function serviceChecks(req, bikeId, invoiceId, bike) {
  const json = async (url, method = "GET", body, status = 200) => {
    const response = await req(url, method, body),
      data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  };
  const original = (await json("/state")).invoices.find(
    (i) => i.id === invoiceId,
  );
  const technician = await json("/technicians", "POST", {
    name: "Test technician",
    phone: "0000000000",
    speciality: "EV electrical repairs",
  });
  const unsold = (await json("/state")).bikes.find(
    (b) => b.status === "available",
  );
  await json("/bikes", "POST", { ...bike, vin: "DUPLICATE-COMPONENT" }, 409);
  await json("/bikes/" + unsold.id, "PUT", { ...bike, vin: unsold.vin }, 409);
  const csv =
    "brand,model,vin,cost,price,motor\nRFY,Test,CLONE-1,100,200,MOTOR-001";
  assert.equal(
    (await json("/inventory/import/preview", "POST", { csv })).errors.length,
    1,
  );
  const csv2 =
    "brand,model,vin,cost,price,charger\nRFY,Test,CLONE-2,100,200,REPEAT\nRFY,Test,CLONE-3,100,200,REPEAT";
  assert.equal(
    (await json("/inventory/import/preview", "POST", { csv: csv2 })).errors
      .length,
    1,
  );
  const intake = {
    requestKey: randomUUID(),
    bikeId,
    complaint: "Battery range reduced",
    odometer: "3250",
    dueDate: "2026-11-01",
    chargeType: "paid",
    labourCost: "0",
    labourCharge: "0",
    parts: [],
  };
  await json("/services", "POST", { ...intake, bikeId: unsold.id }, 400);
  await json(
    "/services",
    "POST",
    { ...intake, intakeComponents: { motor: "SILENT-CHANGE" } },
    400,
  );
  await json("/services", "POST", { ...intake, dueDate: "2026-02-30" }, 400);
  await json(
    "/services",
    "POST",
    { ...intake, workPerformed: "Premature repair entry" },
    400,
  );
  await json("/services", "POST", { ...intake, labourCharge: "250" }, 400);
  const created = await json("/services", "POST", intake),
    url = "/services/" + created.id;
  assert.equal((await json("/services", "POST", intake)).id, created.id);
  await json(
    "/services",
    "POST",
    { ...intake, complaint: "Changed retry" },
    409,
  );
  await json("/services", "POST", { ...intake, requestKey: randomUUID() }, 409);
  let job = await json(url);
  assert.equal(job.status, "received");
  assert.equal(job.body.totalCost, 0);
  assert.equal(job.balance, 0);
  const edit = (status, extra = {}) => ({
    ...intake,
    status,
    version: job.version,
    technicianId: technician.id,
    ...extra,
  });
  await json(url, "PUT", edit("ready"), 400);
  await json(
    url,
    "PUT",
    edit("received", { workPerformed: "Not started" }),
    400,
  );
  await json(url, "PUT", edit("diagnosing", { technicianId: "" }), 400);
  await json(url, "PUT", edit("diagnosing", { version: 0 }), 409);
  await json(url, "PUT", edit("diagnosing"));
  job = await json(url);
  await json(url, "PUT", edit("in_progress"));
  job = await json(url);
  await json(url, "PUT", edit("waiting_parts"));
  job = await json(url);
  await json(url, "PUT", edit("in_progress"));
  job = await json(url);
  await json(url, "PUT", edit("ready"), 400);
  const repair = {
    labourCost: "100",
    labourCharge: "250",
    diagnosis: "Battery failed load test",
    workPerformed: "Replaced battery and tested charging",
    parts: [
      {
        description: "Replacement battery",
        quantity: 1,
        unitCost: "1000",
        unitCharge: "1500",
        componentType: "battery",
        newSerial: "BAT-REPLACEMENT-001",
      },
    ],
  };
  await json(url, "PUT", edit("ready", repair));
  job = await json(url);
  assert(job.body.completedAt);
  assert.equal(job.body.completedByTechnician, "Test technician");
  await json(
    url,
    "PUT",
    edit("ready", { ...repair, complaint: "Rewrite the original complaint" }),
    400,
  );
  assert.equal(job.body.totalCharge, 175000);
  assert.equal(job.body.totalCost, 110000);
  assert.equal((await json("/vehicles/" + bikeId)).bike.battery, "BAT-001");
  await json(url, "PUT", edit("delivered", repair), 400);
  const payment = {
    requestKey: randomUUID(),
    version: job.version,
    amount: "500",
    method: "UPI",
    reference: "TEST-REFERENCE",
  };
  const receipt = await json(url + "/payments", "POST", payment);
  assert.equal((await json(url + "/payments", "POST", payment)).id, receipt.id);
  await json(url + "/payments", "POST", { ...payment, amount: "499" }, 409);
  job = await json(url);
  assert.equal(job.balance, 125000);
  await json(
    url + "/payments",
    "POST",
    {
      ...payment,
      requestKey: randomUUID(),
      version: job.version,
      amount: "1250.01",
    },
    400,
  );
  await json(
    url,
    "PUT",
    edit("in_progress", { labourCharge: "0", labourCost: "0" }),
    400,
  );
  await json(
    url,
    "PUT",
    edit("in_progress", {
      ...repair,
      parts: [{ ...repair.parts[0], quantity: 2 }],
    }),
    400,
  );
  await json(
    url,
    "PUT",
    edit("delivered", { ...repair, allowOutstandingDelivery: true }),
  );
  job = await json(url);
  assert.equal(job.status, "delivered");
  assert.equal(job.body.deliveredByTechnician, "Test technician");
  assert.equal(job.body.outstandingDeliveryApproved, true);
  assert.equal(job.body.deliveryBalance, 125000);
  const vehicle = await json("/vehicles/" + bikeId);
  assert.equal(vehicle.bike.battery, "BAT-REPLACEMENT-001");
  assert.equal(vehicle.bike.status, "sold");
  assert.equal(
    vehicle.components.find((c) => c.serial === "BAT-001").state,
    "removed",
  );
  assert.equal(
    vehicle.components.find((c) => c.serial === "BAT-REPLACEMENT-001").state,
    "current",
  );
  assert.deepEqual(vehicle.jobs[0].body.replacements, [
    { type: "battery", oldSerial: "BAT-001", newSerial: "BAT-REPLACEMENT-001" },
  ]);
  assert.equal(job.events.filter((e) => e.kind === "payment").length, 1);
  await json(url, "PUT", edit("delivered", repair), 400);
  await json(
    "/bikes",
    "POST",
    {
      ...bike,
      vin: "RECYCLED-SERIAL",
      battery: "BAT-001",
      motor: "OTHER-MOTOR",
      controller: "OTHER-CTRL",
      charger: "OTHER-CHG",
    },
    409,
  );
  await json(url + "/payments", "POST", {
    requestKey: randomUUID(),
    version: job.version,
    amount: "1250",
    method: "Cash",
  });
  job = await json(url);
  assert.equal(job.balance, 0);
  assert.equal(job.payments.length, 2);
  await json(
    url + "/payments",
    "POST",
    {
      requestKey: randomUUID(),
      version: job.version,
      amount: "1",
      method: "Cash",
    },
    400,
  );
  await json("/technicians/" + technician.id, "PUT", {
    name: "Test technician",
    active: false,
  });
  await json(
    "/services",
    "POST",
    { ...intake, requestKey: randomUUID(), technicianId: technician.id },
    400,
  );
  const covered = {
    ...intake,
    requestKey: randomUUID(),
    chargeType: "warranty",
    labourCharge: "0",
    labourCost: "0",
  };
  await json("/services", "POST", { ...covered, labourCharge: "1" }, 400);
  const repeat = await json("/services", "POST", covered),
    secondUrl = "/services/" + repeat.id;
  let second = await json(secondUrl);
  assert.equal(second.body.totalCharge, 0);
  assert.equal(second.body.totalCost, 0);
  assert.equal(second.body.bike.battery, "BAT-REPLACEMENT-001");
  await json(secondUrl, "PUT", {
    ...covered,
    status: "cancelled",
    version: second.version,
  });
  second = await json(secondUrl);
  await json(
    secondUrl + "/payments",
    "POST",
    {
      requestKey: randomUUID(),
      version: second.version,
      amount: "1",
      method: "Cash",
    },
    400,
  );
  assert.equal((await json("/vehicles/" + bikeId)).jobs.length, 2);
  await json("/technicians/" + technician.id, "PUT", {
    name: "Test technician",
    active: true,
  });
  const routine = {
    ...intake,
    requestKey: randomUUID(),
    complaint: "Rear brake loose; charging socket needs cleaning",
    technicianId: technician.id,
  };
  const routineId = (await json("/services", "POST", routine)).id,
    routineUrl = "/services/" + routineId;
  let routineJob = await json(routineUrl);
  await json(routineUrl, "PUT", {
    ...routine,
    status: "in_progress",
    version: routineJob.version,
  });
  routineJob = await json(routineUrl);
  await json(
    routineUrl,
    "PUT",
    { ...routine, status: "ready", version: routineJob.version },
    400,
  );
  const completed = {
    ...routine,
    workPerformed:
      "Adjusted rear brake cable.\nCleaned charging socket and road-tested bike.",
    diagnosis: "",
    labourCost: "100",
    labourCharge: "300",
  };
  await json(routineUrl, "PUT", {
    ...completed,
    status: "ready",
    version: routineJob.version,
  });
  routineJob = await json(routineUrl);
  assert.equal(routineJob.body.diagnosis, "");
  assert.equal(routineJob.body.workPerformed, completed.workPerformed);
  await json(
    routineUrl,
    "PUT",
    { ...completed, status: "delivered", version: routineJob.version },
    400,
  );
  await json(routineUrl + "/payments", "POST", {
    requestKey: randomUUID(),
    version: routineJob.version,
    amount: "300",
    method: "Cash",
  });
  routineJob = await json(routineUrl);
  await json(routineUrl, "PUT", {
    ...completed,
    status: "delivered",
    version: routineJob.version,
  });
  const visits = (await json("/vehicles/" + bikeId)).jobs;
  assert.equal(visits.length, 3);
  assert.equal(
    visits.find((j) => j.id === routineId).body.complaint,
    routine.complaint,
  );
  assert.equal(
    visits.find((j) => j.id === created.id).body.complaint,
    intake.complaint,
  );
  assert.equal(visits.find((j) => j.id === routineId).status, "delivered");
  assert.deepEqual(
    (await json("/state")).invoices.find((i) => i.id === invoiceId),
    original,
  );
  console.log(
    "PASS: owner-managed service intake, assignments, strict transitions, concurrency, idempotent receipts, balances, warranty jobs, replacement history and immutable original invoice.",
  );
}
