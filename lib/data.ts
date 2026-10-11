import { db } from "@/lib/firebase/admin";
import type { ExistingAllocation, IsoDate, ShiftSettings } from "@/lib/planning/types";
import type {
  AllocationPlanDoc,
  AppUser,
  AuditLog,
  Batch,
  DailyStats,
  ElectricityReading,
  ElectricitySettings,
  MachineDoc,
  MachineLog,
  Material,
  Order,
  RateHistoryEntry,
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

export async function getMachines(): Promise<MachineDoc[]> {
  const machines = await list<MachineDoc>(db().collection("machines"));
  return machines.sort((a, b) => a.machineNo.localeCompare(b.machineNo));
}

export function getLogsByDate(date: IsoDate): Promise<MachineLog[]> {
  return list<MachineLog>(db().collection("machineLogs").where("date", "==", date));
}

export function getLogsSince(date: IsoDate): Promise<MachineLog[]> {
  return list<MachineLog>(db().collection("machineLogs").where("date", ">=", date));
}

export function getLogsByBatch(batchId: string): Promise<MachineLog[]> {
  return list<MachineLog>(db().collection("machineLogs").where("batchId", "==", batchId));
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

export async function getDailyStatsSince(date: IsoDate): Promise<DailyStats[]> {
  const rows = await list<DailyStats>(db().collection("dailyStats").where("date", ">=", date));
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDailyStats(date: IsoDate): Promise<DailyStats | null> {
  const snap = await db().collection("dailyStats").doc(date).get();
  return snap.exists ? (snap.data() as DailyStats) : null;
}

export async function getOrders(): Promise<Order[]> {
  const orders = await list<Order>(db().collection("orders"));
  return orders.sort((a, b) => a.orderNo.localeCompare(b.orderNo));
}

export async function getBatches(): Promise<Batch[]> {
  const batches = await list<Batch>(db().collection("batches"));
  return batches.sort((a, b) => a.batchNo.localeCompare(b.batchNo));
}

export async function getBatch(id: string): Promise<Batch | null> {
  const snap = await db().collection("batches").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Batch) : null;
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await db().collection("orders").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Order) : null;
}

export async function getShiftSettings(): Promise<ShiftSettings> {
  const snap = await db().collection("settings").doc("shifts").get();
  return snap.exists ? (snap.data() as ShiftSettings) : DEFAULT_SHIFTS;
}

export async function getElectricitySettings(): Promise<ElectricitySettings> {
  const snap = await db().collection("settings").doc("electricity").get();
  return snap.exists ? (snap.data() as ElectricitySettings) : DEFAULT_ELECTRICITY;
}

export async function getRateHistory(): Promise<RateHistoryEntry[]> {
  const rows = await list<RateHistoryEntry>(db().collection("electricityRateHistory"));
  return rows.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

export async function getMaterials(): Promise<Material[]> {
  const materials = await list<Material>(db().collection("materials"));
  return materials.sort((a, b) => a.name.localeCompare(b.name));
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
