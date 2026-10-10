/**
 * Seeds the Firebase emulators with a 50-machine mill: users, machines, 6 orders with
 * plans, 30 days of shift logs and daily electricity readings.
 *
 *   npm run seed            # only if the database is empty
 *   npm run seed -- --force # wipe the emulator data and seed again
 */
import { adminAuth, db, projectId } from "@/lib/firebase/admin";
import { DEFAULT_ELECTRICITY, DEFAULT_SHIFTS } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { recommendAllocation } from "@/lib/planning/allocate";
import { addDays, isWorkingDay } from "@/lib/planning/calendar";
import { dailyElectricityCost, estimateUnits } from "@/lib/planning/energy";
import type { ExistingAllocation, PlanInputs, ShiftSettings } from "@/lib/planning/types";
import { planDocFrom } from "@/lib/services/plans";
import { sampleShipments } from "@/lib/transport/data";
import {
  commitInChunks,
  recomputeBatchPower,
  recomputeDay,
  recomputeRolling,
} from "@/lib/services/recompute";
import type { Batch, ElectricityReading, MachineDoc, MachineLog, Order, StaffRole as Role } from "@/lib/types";

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const onEmulator = !!firestoreHost && !!authHost;
// Writing demo data into a real project must be asked for by name:
//   npm run seed:firebase -- --target=<projectId>
const target = process.argv.find((a) => a.startsWith("--target="))?.slice("--target=".length);
if (!onEmulator && target !== projectId) {
  console.error(`Refusing to seed the real Firebase project "${projectId}".`);
  console.error(`To load the demo mill into it, run: npm run seed:firebase -- --target=${projectId}`);
  process.exit(1);
}

// Deterministic so every seed produces the same mill.
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const round2 = (n: number) => Math.round(n * 100) / 100;

const today = todayIso();
const DAYS_OF_HISTORY = 30;
const SHIFTS_PER_DAY = 2;

const shiftSettings: ShiftSettings = {
  ...DEFAULT_SHIFTS,
  holidays: [addDays(today, -12), addDays(today, 4)],
};

const USERS: { uid: string; name: string; role: Role; phone?: string }[] = [
  { uid: "owner", name: "Karthikeyan (Owner)", role: "owner", phone: "919800000001" },
  { uid: "manager", name: "Production Manager", role: "manager" },
  { uid: "production", name: "Shift Supervisor", role: "production" },
  { uid: "accounts", name: "Accounts", role: "accounts" },
];

const KINDS = ["Rapier Loom", "Air-jet Loom", "Power Loom", "Water-jet Loom"];
const FABRICS = [
  ["cotton", "polyester", "blend"],
  ["cotton", "blend"],
  ["cotton", "silk"],
  ["polyester", "blend", "cotton"],
];
const WIDTHS = [63, 72, 48, 63, 72];

function buildMachines(): MachineDoc[] {
  return Array.from({ length: 50 }, (_, i) => {
    const machineNo = `M-${String(i + 1).padStart(2, "0")}`;
    return {
      id: machineNo,
      machineNo,
      name: `${KINDS[i % 4]} ${i + 1}`,
      type: "loom",
      supportedFabricTypes: FABRICS[i % 4]!,
      maxWidthInches: WIDTHS[i % 5]!,
      ratedOutputPerHour: 8 + ((i * 3) % 8),
      efficiencyPercent: 76,
      powerKw: 3 + ((i * 7) % 10) * 0.5,
      loadFactor: 0.75,
      status: i >= 48 ? "breakdown" : i >= 46 ? "maintenance" : "idle",
      currentBatchId: null,
      lastMaintenanceAt: addDays(today, -(30 + i)),
      maintenanceDueAt: addDays(today, i % 13 === 5 ? 5 : 20 + ((i * 11) % 60)),
      energyMeterId: null,
      active: true,
      recentBreakdownHours: 0,
    };
  });
}

const ORDERS: (Omit<Order, "id" | "status"> & { startOffset: number; state: "completed" | "running" | "new" })[] = [
  { orderNo: "ORD-1001", customerName: "Sri Lakshmi Textiles", fabricType: "cotton", widthInches: 60, meters: 38_000, deadline: addDays(today, -9), ratePerMeterPaise: 9_200, startOffset: -28, state: "completed" },
  { orderNo: "ORD-1002", customerName: "Kovai Fabrics", fabricType: "polyester", widthInches: 60, meters: 26_000, deadline: addDays(today, -6), ratePerMeterPaise: 8_400, startOffset: -24, state: "completed" },
  { orderNo: "ORD-1003", customerName: "Erode Weavers Co-op", fabricType: "cotton", widthInches: 60, meters: 30_000, deadline: addDays(today, 9), ratePerMeterPaise: 9_800, startOffset: -6, state: "running" },
  { orderNo: "ORD-1004", customerName: "Tiruppur Garments", fabricType: "blend", widthInches: 60, meters: 16_000, deadline: addDays(today, 6), ratePerMeterPaise: 8_900, startOffset: -4, state: "running" },
  { orderNo: "ORD-1005", customerName: "Salem Silks", fabricType: "silk", widthInches: 46, meters: 6_000, deadline: addDays(today, 10), ratePerMeterPaise: 21_500, startOffset: 0, state: "new" },
  { orderNo: "ORD-1006", customerName: "Madurai Mills Export", fabricType: "cotton", widthInches: 60, meters: 30_000, deadline: addDays(today, 7), ratePerMeterPaise: 9_500, startOffset: 0, state: "new" },
];

async function wipe() {
  await fetch(`http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: "DELETE",
  });
  await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
}

async function main() {
  const force = process.argv.includes("--force");
  const existing = await db().collection("machines").limit(1).get();
  if (!existing.empty && !force) {
    console.log("Seed skipped: data already exists (use --force to reseed).");
    return;
  }
  if (force && !onEmulator) throw new Error("--force (wipe) only works on the emulators");
  if (force) await wipe();

  // Test users with a shared demo password exist only on the emulators.
  // On a real project, add people with "npm run create-user".
  if (onEmulator) {
    const password = process.env.SEED_USER_PASSWORD;
    if (!password) throw new Error("SEED_USER_PASSWORD is not set (see .env.emulator)");
    for (const u of USERS) {
      const email = `${u.uid}@textileflow.test`;
      await adminAuth().createUser({ uid: u.uid, email, password, displayName: u.name }).catch(() => undefined);
      await db().collection("users").doc(u.uid).set({ email, name: u.name, role: u.role, phone: u.phone ?? null });
    }
  }

  // Settings
  await db().collection("settings").doc("shifts").set(shiftSettings);
  await db().collection("settings").doc("electricity").set(DEFAULT_ELECTRICITY);
  await db().collection("electricityRateHistory").add({
    ...DEFAULT_ELECTRICITY, ratePerUnitPaise: 760, peakRatePaise: 900, offPeakRatePaise: 690,
    effectiveFrom: "2025-04-01", changedAt: "2025-04-01T04:30:00.000Z", changedBy: "Karthikeyan (Owner)",
  });
  await db().collection("electricityRateHistory").add({
    ...DEFAULT_ELECTRICITY, changedAt: "2026-01-01T04:30:00.000Z", changedBy: "Karthikeyan (Owner)",
  });

  // Orders, batches and plans
  const machines = buildMachines();
  const allocations: ExistingAllocation[] = [];
  const batches: Batch[] = [];
  const writes: Parameters<typeof commitInChunks>[0] = [];

  for (const [i, o] of ORDERS.entries()) {
    const { startOffset, state, ...order } = o;
    const orderId = o.orderNo;
    const batchId = `B-${2001 + i}`;
    const inputs: PlanInputs = {
      meters: o.meters, fabricType: o.fabricType, widthInches: o.widthInches,
      startDate: addDays(today, startOffset), deadline: o.deadline,
      shiftsPerDay: SHIFTS_PER_DAY, allowOvertime: true,
    };
    const result = recommendAllocation(inputs, {
      machines, allocations, shiftSettings, ratePerUnitPaise: DEFAULT_ELECTRICITY.ratePerUnitPaise,
    });
    const plan = result.recommended;
    const applied = state !== "new";
    const batch: Batch = {
      id: batchId, batchNo: batchId, orderId, orderNo: o.orderNo,
      fabricType: o.fabricType, widthInches: o.widthInches, meters: o.meters, producedMeters: 0,
      status: state === "completed" ? "completed" : state === "running" ? "in_progress" : "pending",
      machineIds: applied ? plan.machineIds : [],
      startDate: applied ? inputs.startDate : null,
      endDate: applied ? plan.estimatedFinishDate : null,
      hoursPerDay: applied ? plan.hoursPerDay : null,
      planId: `PLAN-${batchId}`,
      materialCostPaise: o.meters * 4_800, labourCostPaise: o.meters * 900, overheadCostPaise: o.meters * 400,
      powerCostPaise: 0,
    };
    batches.push(batch);
    if (applied && batch.endDate) {
      for (const machineId of plan.machineIds) {
        allocations.push({ machineId, batchId, startDate: inputs.startDate, endDate: batch.endDate });
        if (state === "running") {
          const m = machines.find((x) => x.id === machineId)!;
          m.status = "running";
          m.currentBatchId = batchId;
        }
      }
    }
    const status: Order["status"] =
      state === "completed" ? "completed" : state === "running" ? "in_production" : "confirmed";
    writes.push((b) => b.set(db().collection("orders").doc(orderId), { ...order, status }));
    writes.push((b) => b.set(db().collection("batches").doc(batchId), batch));
    writes.push((b) =>
      b.set(
        db().collection("allocationPlans").doc(batch.planId!),
        planDocFrom(result, plan, inputs, batch, "Production Manager", applied ? "applied" : "draft"),
      ),
    );
    console.log(`${o.orderNo}: ${plan.machinesNeeded} machines, finish ${plan.estimatedFinishDate}${plan.feasible ? "" : " (misses deadline)"}`);
  }

  // Shift logs and electricity readings
  const skill = new Map(machines.map((m) => [m.id, 0.78 + rand() * 0.18]));
  let meter = 184_000;
  const shifts = shiftSettings.shifts.slice(0, SHIFTS_PER_DAY);
  const dates: string[] = [];

  for (let offset = -(DAYS_OF_HISTORY - 1); offset <= 0; offset++) {
    const date = addDays(today, offset);
    dates.push(date);
    let estimated = 0;
    if (isWorkingDay(date, shiftSettings)) {
      for (const m of machines) {
        const down = m.status === "maintenance" || m.status === "breakdown";
        if (down && offset >= -1) continue;
        const allocation = allocations.find(
          (a) => a.machineId === m.id && a.startDate <= date && date <= a.endDate,
        );
        for (const shift of shifts) {
          if (rand() > (allocation ? 0.95 : 0.3)) continue;
          const failing = (down && offset === -2) || rand() < 0.04;
          const breakdownHours = failing ? round2(1 + rand() * 2.5) : 0;
          const idleHours = round2(rand() * 0.8);
          const runningHours = round2(shift.hours - breakdownHours - idleHours);
          const efficiency = skill.get(m.id)! * (0.96 + rand() * 0.08);
          const log: MachineLog = {
            id: `${date}_${shift.name}_${m.id}`,
            machineId: m.id, batchId: allocation?.batchId ?? null, date, shift: shift.name,
            runningHours, idleHours, breakdownHours,
            outputMeters: round2(m.ratedOutputPerHour * runningHours * efficiency),
            operatorWorkerId: null,
            notes: failing ? "Warp break / stoppage" : "",
          };
          estimated += estimateUnits(m.powerKw, runningHours, m.loadFactor);
          const { id, ...data } = log;
          writes.push((b) => b.set(db().collection("machineLogs").doc(id), data));
        }
      }
    }
    // The main meter also carries lighting, compressors and humidification.
    const units = Math.round(estimated * (1.12 + rand() * 0.08) + 70 + rand() * 30);
    const peakUnits = Math.round(units * (0.22 + rand() * 0.06));
    const cost = dailyElectricityCost({
      mainMeterStartKwh: meter, mainMeterEndKwh: meter + units,
      ratePerUnitPaise: DEFAULT_ELECTRICITY.ratePerUnitPaise,
      peakUnits, offPeakUnits: units - peakUnits,
      peakRatePaise: DEFAULT_ELECTRICITY.peakRatePaise, offPeakRatePaise: DEFAULT_ELECTRICITY.offPeakRatePaise,
      fixedChargesPaise: DEFAULT_ELECTRICITY.fixedChargePerDayPaise,
    });
    const reading: ElectricityReading = {
      date, mainMeterStartKwh: meter, mainMeterEndKwh: meter + units, unitsConsumed: cost.unitsConsumed,
      ratePerUnitPaise: DEFAULT_ELECTRICITY.ratePerUnitPaise,
      peakUnits, offPeakUnits: units - peakUnits,
      peakRatePaise: DEFAULT_ELECTRICITY.peakRatePaise, offPeakRatePaise: DEFAULT_ELECTRICITY.offPeakRatePaise,
      fixedChargesPaise: DEFAULT_ELECTRICITY.fixedChargePerDayPaise,
      totalCostPaise: cost.totalCostPaise, commonLoadUnits: 0, commonLoadCostPaise: 0,
      enteredBy: "Accounts",
    };
    meter += units;
    writes.push((b) => b.set(db().collection("electricityReadings").doc(date), reading));
  }

  for (const m of machines) {
    const { id, ...data } = m;
    writes.push((b) => b.set(db().collection("machines").doc(id), data));
  }
  for (const shipment of sampleShipments(Date.now())) {
    const { id, ...data } = shipment;
    writes.push((b) => b.set(db().collection("shipments").doc(id), data));
  }
  await commitInChunks(writes);
  console.log(`Wrote ${writes.length} documents. Computing energy, efficiency and batch costs...`);

  for (const date of dates) await recomputeDay(date, machines);
  await recomputeRolling(today, machines);
  for (const b of batches) await recomputeBatchPower(b.id);

  await db().collection("auditLogs").add({
    at: new Date().toISOString(), actorUid: "system", actorName: "Seed script",
    action: "seed", entity: "database", entityId: projectId, details: "Seeded demo mill data",
  });
  console.log(
    onEmulator
      ? "Seed complete. Sign in with owner@textileflow.test (password: SEED_USER_PASSWORD in .env.emulator)."
      : `Seed complete on ${projectId}. Add a login with: npm run create-user`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
