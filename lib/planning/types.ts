/** ISO calendar date, "YYYY-MM-DD". All planning maths is done on whole days in UTC. */
export type IsoDate = string;

export type MachineType = "loom" | "knitting" | "spinning" | "dyeing" | "other";
export type MachineStatus = "running" | "idle" | "maintenance" | "breakdown";

export interface Machine {
  id: string;
  machineNo: string;
  name: string;
  type: MachineType;
  supportedFabricTypes: string[];
  maxWidthInches: number;
  /** Rated output in meters per hour. */
  ratedOutputPerHour: number;
  /** Rolling 30-day average, 0-100. */
  efficiencyPercent: number;
  powerKw: number;
  loadFactor: number;
  status: MachineStatus;
  maintenanceDueAt?: IsoDate | null;
  active: boolean;
  /** Breakdown hours over the last 30 days, from machineLogs. */
  recentBreakdownHours?: number;
}

/** A machine already committed to another batch. Both dates inclusive. */
export interface ExistingAllocation {
  machineId: string;
  batchId: string;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface Shift {
  name: string;
  start: string;
  end: string;
  hours: number;
}

export interface ShiftSettings {
  shifts: Shift[];
  /** Weekdays the mill runs, 0 = Sunday ... 6 = Saturday. */
  workingDays: number[];
  holidays: IsoDate[];
}

export interface PlanInputs {
  meters: number;
  fabricType: string;
  widthInches: number;
  startDate: IsoDate;
  deadline: IsoDate;
  shiftsPerDay: number;
  allowOvertime: boolean;
  /** Extra hours per day when overtime is used. Defaults to 4. */
  overtimeHoursPerDay?: number;
}

export interface PlanContext {
  machines: Machine[];
  allocations: ExistingAllocation[];
  shiftSettings: ShiftSettings;
  /** Current tariff, paise per kWh. */
  ratePerUnitPaise: number;
}

export interface MachinePlan {
  machineId: string;
  machineNo: string;
  metersPerDay: number;
  plannedMeters: number;
  runningHours: number;
  units: number;
}

export interface DayPlan {
  date: IsoDate;
  machinesRunning: number;
  meters: number;
  units: number;
  costPaise: number;
}

export type PlanKey = "recommended" | "min-machines" | "fastest" | "overtime";

export interface PlanOption {
  key: PlanKey;
  label: string;
  /** True when the full order finishes on or before the deadline. */
  feasible: boolean;
  hoursPerDay: number;
  machineIds: string[];
  machinesNeeded: number;
  perMachine: MachinePlan[];
  daily: DayPlan[];
  estimatedFinishDate: IsoDate | null;
  estimatedUnits: number;
  estimatedPowerCostPaise: number;
  powerCostPerMeterPaise: number;
}

export interface AllocationResult {
  totalMachines: number;
  eligibleCount: number;
  recommended: PlanOption;
  alternatives: PlanOption[];
  /** Eligible machines that are not in any other plan. */
  freeCount: number;
  /**
   * Eligible machines kept by other planned or running batches. They cannot be chosen
   * until those batches are completed.
   */
  held: { batchId: string; machines: number; endDate: IsoDate }[];
  /** Meters that cannot be made by the deadline even with every eligible machine. 0 when feasible. */
  shortfallMeters: number;
  /** Set only when the deadline is impossible. */
  earliestPossibleDate: IsoDate | null;
  warnings: string[];
}
