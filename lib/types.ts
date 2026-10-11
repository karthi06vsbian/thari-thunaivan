import type { IsoDate, Machine, PlanInputs } from "@/lib/planning/types";

export type StaffRole = "owner" | "manager" | "production" | "accounts" | "transport";
/** Clients sign in with Google and only ever see their own orders in /portal. */
export type Role = StaffRole | "client";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: Role;
  /** WhatsApp number in international format without "+", e.g. 919876543210. */
  phone?: string | null;
  company?: string | null;
  /** A client's last delivery address, offered again on their next order. */
  address?: string | null;
}

export interface MachineDoc extends Machine {
  currentBatchId: string | null;
  lastMaintenanceAt: IsoDate | null;
  energyMeterId: string | null;
  /** kWh per meter over the last 30 days of logs. */
  energyPerMeter30d?: number;
}

export type OrderStatus = "requested" | "rejected" | "confirmed" | "in_production" | "completed";

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  fabricType: string;
  widthInches: number;
  meters: number;
  deadline: IsoDate;
  status: OrderStatus;
  ratePerMeterPaise: number;
  /** Set on orders placed by a client through the portal. */
  clientUid?: string | null;
  clientPhone?: string | null;
  notes?: string;
  requestedAt?: string;
  /** Where the fabric is to be delivered. */
  deliveryAddress?: string | null;
  /** How the client chose to confirm: pay an advance online, or visit the mill and pay cash. */
  confirmMode?: "prepaid" | "cash";
  paymentStatus?: "pending" | "paid";
  /** Advance asked for online, in paise. */
  advancePaise?: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paidAt?: string | null;
  /** Visit booked by a cash-on-confirmation client. */
  appointment?: { date: IsoDate; slot: string } | null;
}

export type BatchStatus = "pending" | "planned" | "in_progress" | "completed";

export interface Batch {
  id: string;
  batchNo: string;
  orderId: string;
  orderNo: string;
  fabricType: string;
  widthInches: number;
  meters: number;
  producedMeters: number;
  status: BatchStatus;
  machineIds: string[];
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  hoursPerDay: number | null;
  planId: string | null;
  materialCostPaise: number;
  labourCostPaise: number;
  overheadCostPaise: number;
  powerCostPaise: number;
}

export interface MachineLog {
  id: string;
  machineId: string;
  batchId: string | null;
  date: IsoDate;
  shift: string;
  runningHours: number;
  idleHours: number;
  breakdownHours: number;
  outputMeters: number;
  operatorWorkerId: string | null;
  notes: string;
  /** Share of the machine's energy for the day, set when the day is recomputed. */
  units?: number;
  powerCostPaise?: number;
}

export interface ElectricityReading {
  date: IsoDate;
  mainMeterStartKwh: number;
  mainMeterEndKwh: number;
  unitsConsumed: number;
  ratePerUnitPaise: number;
  peakUnits: number | null;
  offPeakUnits: number | null;
  peakRatePaise: number;
  offPeakRatePaise: number;
  fixedChargesPaise: number;
  totalCostPaise: number;
  commonLoadUnits: number;
  commonLoadCostPaise: number;
  enteredBy: string;
}

export interface ElectricitySettings {
  ratePerUnitPaise: number;
  peakRatePaise: number;
  offPeakRatePaise: number;
  peakHours: string;
  fixedChargePerDayPaise: number;
  effectiveFrom: IsoDate;
}

export interface RateHistoryEntry extends ElectricitySettings {
  id: string;
  changedAt: string;
  changedBy: string;
}

export interface MachineEnergy {
  machineId: string;
  date: IsoDate;
  units: number;
  costPaise: number;
  estimated: boolean;
}

export interface DailyStats {
  date: IsoDate;
  totalMachines: number;
  machinesRunning: number;
  utilizationPercent: number;
  outputMeters: number;
  runningHours: number;
  breakdownHours: number;
  units: number;
  costPaise: number;
  costPerMeterPaise: number;
  peakUnits: number | null;
  offPeakUnits: number | null;
  /** True when no main meter reading exists and units come from machine estimates. */
  estimated: boolean;
}

export interface AllocationPlanDoc {
  id: string;
  batchId: string;
  orderId: string;
  createdAt: string;
  createdBy: string;
  inputs: PlanInputs;
  planKey: string;
  recommendedMachineIds: string[];
  machinesNeeded: number;
  estimatedFinishDate: IsoDate | null;
  estimatedUnits: number;
  estimatedPowerCostPaise: number;
  alternatives: {
    key: string;
    label: string;
    machinesNeeded: number;
    estimatedFinishDate: IsoDate | null;
    estimatedUnits: number;
    estimatedPowerCostPaise: number;
  }[];
  status: "draft" | "applied";
}

export interface AuditLog {
  id: string;
  at: string;
  actorUid: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}

export type QcResult = "pass" | "rework" | "fail";

/** One roll or bundle of finished fabric, identified by the QR code on its label. */
export interface Bundle {
  id: string;
  bundleNo: string;
  batchId: string;
  orderNo: string;
  fabricType: string;
  createdAt: string;
  createdBy: string;
  status: "pending" | QcResult;
  /** Filled in by the quality check. */
  lengthMeters: number | null;
  widthInches: number | null;
  gsm: number | null;
  defects: number | null;
  grade: "A" | "B" | "C" | null;
  /** Overall quality percentage: the share of all checks, across the three inspections, that passed. */
  qualityScore: number | null;
  /** Value and pass tick for each check, keyed as in lib/quality-checks.ts. */
  checks?: Record<string, { value: number | null; pass: boolean }>;
  /** Percentage passed in each inspection. */
  sectionPercent?: { raw: number; yarn: number; fabric: number } | null;
  remarks: string;
  checkedBy: string | null;
  checkedAt: string | null;
}

export interface ShipmentUpdate {
  at: string;
  text: string;
  by: string;
}

/** A truck load going out to a customer. */
export interface Shipment {
  id: string;
  orderNo: string;
  customerName: string;
  clientPhone: string | null;
  meters: number;
  fabricType: string;
  deliveryAddress?: string | null;
  /** One of the routes in lib/transport/routes.ts. */
  routeId: string;
  vehicleNo: string;
  driverName: string;
  /** The driver's worker record, and what they are paid for this trip on top of salary. */
  driverId?: string | null;
  tripPayPaise?: number;
  status: "in_transit" | "delivered";
  dispatchedAt: string;
  deliveredAt: string | null;
  updates: ShipmentUpdate[];
  /** Demo data: the trip replays in a loop so there is always a moving truck to show. */
  sample?: boolean;
  demoCycleSeconds?: number | null;
}

export type JobRole = "driver" | "operator" | "supervisor" | "quality" | "mechanic" | "helper" | "office";

export interface Increment {
  on: IsoDate;
  fromPaise: number;
  toPaise: number;
  note: string;
  by: string;
}

/** Someone on the mill's payroll. Drivers are added from the Transport page. */
export interface Worker {
  id: string;
  workerNo: string;
  name: string;
  phone: string | null;
  jobRole: JobRole;
  joinedOn: IsoDate;
  /** Salary for a full month of standard hours. */
  monthlyPaise: number;
  active: boolean;
  increments: Increment[];
  /** Drivers only. */
  licenceNo?: string | null;
  vehicleNo?: string | null;
}

/** One worker's hours and adjustments for one month, stored as workerPay/{workerId}_{YYYY-MM}. */
export interface WorkerPay {
  workerId: string;
  /** YYYY-MM */
  month: string;
  hoursWorked: number;
  bonusPaise: number;
  bonusNote: string;
  deductionPaise: number;
  deductionNote: string;
  paidAt: string | null;
  paidBy: string | null;
  /** Net pay frozen when the month was marked paid. */
  paidNetPaise: number | null;
}

export interface PayRules {
  /** Standard hours in a month; hours beyond this are overtime. */
  hoursPerMonth: number;
  overtimeMultiplier: number;
  /** Service allowance: this % of base pay for every completed year, up to the maximum. */
  servicePercentPerYear: number;
  serviceMaxPercent: number;
  /** New joiners are paid the training % of their salary for this many months. */
  newJoinerMonths: number;
  newJoinerPayPercent: number;
  /** An increment is flagged as due this long after the last one. */
  incrementEveryMonths: number;
}
