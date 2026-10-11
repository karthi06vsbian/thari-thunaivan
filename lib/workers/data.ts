import { db } from "@/lib/firebase/admin";
import { DEFAULT_PAY_RULES, monthOf } from "@/lib/payroll";
import type { PayRules, Shipment, Worker, WorkerPay } from "@/lib/types";

export async function getWorkers(): Promise<Worker[]> {
  const snap = await db().collection("workers").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Worker)
    .sort((a, b) => a.workerNo.localeCompare(b.workerNo));
}

export async function getWorker(id: string): Promise<Worker | null> {
  const snap = await db().collection("workers").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Worker) : null;
}

export const payDocId = (workerId: string, month: string) => `${workerId}_${month}`;

/** Hours and adjustments entered for a month, by worker id. */
export async function getMonthPay(month: string): Promise<Map<string, WorkerPay>> {
  const snap = await db().collection("workerPay").where("month", "==", month).get();
  return new Map(snap.docs.map((d) => [(d.data() as WorkerPay).workerId, d.data() as WorkerPay]));
}

export async function getWorkerPay(workerId: string, month: string): Promise<WorkerPay | null> {
  const snap = await db().collection("workerPay").doc(payDocId(workerId, month)).get();
  return snap.exists ? (snap.data() as WorkerPay) : null;
}

export async function getPayRules(): Promise<PayRules> {
  const snap = await db().collection("settings").doc("payroll").get();
  return snap.exists ? { ...DEFAULT_PAY_RULES, ...(snap.data() as Partial<PayRules>) } : DEFAULT_PAY_RULES;
}

/** Trips and trip pay per driver for loads dispatched in a month. */
export function tripsByDriver(shipments: Shipment[], month: string): Map<string, { trips: number; paise: number }> {
  const totals = new Map<string, { trips: number; paise: number }>();
  for (const s of shipments) {
    if (!s.driverId || monthOf(s.dispatchedAt) !== month) continue;
    const t = totals.get(s.driverId) ?? { trips: 0, paise: 0 };
    totals.set(s.driverId, { trips: t.trips + 1, paise: t.paise + (s.tripPayPaise ?? 0) });
  }
  return totals;
}

export interface NewWorker {
  name: string;
  phone: string | null;
  jobRole: Worker["jobRole"];
  joinedOn: string;
  monthlyPaise: number;
  licenceNo?: string | null;
  vehicleNo?: string | null;
}

/** Adds a worker under the next free W-number. */
export async function createWorker(input: NewWorker): Promise<Worker> {
  const existing = await db().collection("workers").get();
  const highest = existing.docs.reduce((max, d) => Math.max(max, Number(d.id.replace(/\D/g, "")) || 0), 0);
  const workerNo = `W-${String(highest + 1).padStart(3, "0")}`;
  const data: Omit<Worker, "id"> = {
    workerNo, name: input.name, phone: input.phone, jobRole: input.jobRole, joinedOn: input.joinedOn,
    monthlyPaise: input.monthlyPaise, active: true, increments: [],
    licenceNo: input.licenceNo ?? null, vehicleNo: input.vehicleNo ?? null,
  };
  // create() fails rather than overwriting if two people add a worker at the same moment.
  await db().collection("workers").doc(workerNo).create(data);
  return { id: workerNo, ...data };
}
