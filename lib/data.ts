import { cache } from "react";
import { db } from "@/lib/firebase/admin";
import type { ExistingAllocation, IsoDate, ShiftSettings } from "@/lib/planning/types";
import type {
  AllocationPlanDoc,
  AppUser,
  AuditLog,
  Batch,
  DailyStats,
  DayLogTotals,
  ElectricityReading,
  ElectricitySettings,
  MachineDoc,
  MachineLog,
  Material,
  Order,
  RateHistoryEntry,
  StockOrder,
} from "@/lib/types";

export const DEFAULT_SHIFTS: ShiftSettings = {
  shifts: [
    { name: "Day", start: "06:00", end: "14:00", hours: 8 },
    { name: "Evening", start: "14:00", end: "22:00", hours: 8 },
    { name: "Night", start: "22:00", end: "06:00", hours: 8 },
  ],
  workingDays: [1, 2, 3, 4, 5, 6],
  holidays: [],
};

export const DEFAULT_ELECTRICITY: ElectricitySettings = {
  ratePerUnitPaise: 800,
  peakRatePaise: 950,
  offPeakRatePaise: 720,
  peakHours: "18:00-22:00",
  fixedChargePerDayPaise: 150_000,
  effectiveFrom: "2026-01-01",
};

type Query = FirebaseFirestore.Query;

async function list<T>(query: Query): Promise<T[]> {
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

// The getters wrapped in cache() read the database once per page view, however many parts of
// the page ask for the same thing. Every read counts against the database's daily allowance,
// and a page such as the Overview used to read all the machines three times over.
// Nothing is remembered between page views, so a page never shows data older than its own load.

export const getMachines = cache(async (): Promise<MachineDoc[]> => {
  const machines = await list<MachineDoc>(db().collection("machines"));
  return machines.sort((a, b) => a.machineNo.localeCompare(b.machineNo));
});

export const getLogsByDate = cache((date: IsoDate): Promise<MachineLog[]> => {
  return list<MachineLog>(db().collection("machineLogs").where("date", "==", date));
});

/** Day totals (see lib/costing/log-totals.ts) from a date onwards: one document per day. */
export function getLogTotalsSince(date: IsoDate): Promise<DayLogTotals[]> {
  return list<DayLogTotals>(db().collection("logTotals").where("date", ">=", date));
}

/** Day totals for every day a batch has logs on. */
export function getLogTotalsForBatch(batchId: string): Promise<DayLogTotals[]> {
  return list<DayLogTotals>(db().collection("logTotals").where("batchIds", "array-contains", batchId));
}

export async function getReading(date: IsoDate): Promise<ElectricityReading | null> {
  const snap = await db().collection("electricityReadings").doc(date).get();
  return snap.exists ? (snap.data() as ElectricityReading) : null;
}

export async function getReadingsSince(date: IsoDate): Promise<ElectricityReading[]> {
  const rows = await list<ElectricityReading>(
    db().collection("electricityReadings").where("date", ">=", date),
  );
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export const getDailyStatsSince = cache(async (date: IsoDate): Promise<DailyStats[]> => {
  const rows = await list<DailyStats>(db().collection("dailyStats").where("date", ">=", date));
  return rows.sort((a, b) => a.date.localeCompare(b.date));
});

export const getDailyStats = cache(async (date: IsoDate): Promise<DailyStats | null> => {
  const snap = await db().collection("dailyStats").doc(date).get();
  return snap.exists ? (snap.data() as DailyStats) : null;
});

export const getOrders = cache(async (): Promise<Order[]> => {
  const orders = await list<Order>(db().collection("orders"));
  return orders.sort((a, b) => a.orderNo.localeCompare(b.orderNo));
});

export const getBatches = cache(async (): Promise<Batch[]> => {
  const batches = await list<Batch>(db().collection("batches"));
  return batches.sort((a, b) => a.batchNo.localeCompare(b.batchNo));
});

export async function getBatch(id: string): Promise<Batch | null> {
  const snap = await db().collection("batches").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Batch) : null;
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await db().collection("orders").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Order) : null;
}

export const getShiftSettings = cache(async (): Promise<ShiftSettings> => {
  const snap = await db().collection("settings").doc("shifts").get();
  return snap.exists ? (snap.data() as ShiftSettings) : DEFAULT_SHIFTS;
});

export const getElectricitySettings = cache(async (): Promise<ElectricitySettings> => {
  const snap = await db().collection("settings").doc("electricity").get();
  return snap.exists ? (snap.data() as ElectricitySettings) : DEFAULT_ELECTRICITY;
});

export async function getRateHistory(): Promise<RateHistoryEntry[]> {
  const rows = await list<RateHistoryEntry>(db().collection("electricityRateHistory"));
  return rows.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

export async function getMaterials(): Promise<Material[]> {
  const materials = await list<Material>(db().collection("materials"));
  return materials.sort((a, b) => a.name.localeCompare(b.name));
}

/** Every stock order, newest first. */
export async function getStockOrders(): Promise<StockOrder[]> {
  const rows = await list<StockOrder>(db().collection("stockOrders"));
  return rows.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
}

export async function getStockOrder(trackingId: string): Promise<StockOrder | null> {
  const snap = await db().collection("stockOrders").doc(trackingId).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as StockOrder) : null;
}

export function getAuditLogs(limit = 20): Promise<AuditLog[]> {
  return list<AuditLog>(db().collection("auditLogs").orderBy("at", "desc").limit(limit));
}

export function getPlans(limit = 20): Promise<AllocationPlanDoc[]> {
  return list<AllocationPlanDoc>(
    db().collection("allocationPlans").orderBy("createdAt", "desc").limit(limit),
  );
}

export async function getOwners(): Promise<AppUser[]> {
  const snap = await db().collection("users").where("role", "==", "owner").get();
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, "uid">) }));
}

/** Machine bookings from every planned or running batch, optionally leaving one batch out. */
export function allocationsFromBatches(batches: Batch[], excludeBatchId?: string): ExistingAllocation[] {
  return batches
    .filter(
      (b) =>
        b.id !== excludeBatchId &&
        (b.status === "planned" || b.status === "in_progress") &&
        b.startDate &&
        b.endDate,
    )
    .flatMap((b) =>
      b.machineIds.map((machineId) => ({
        machineId,
        batchId: b.batchNo,
        startDate: b.startDate!,
        endDate: b.endDate!,
      })),
    );
}
