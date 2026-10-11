import type { IsoDate } from "@/lib/planning/types";
import type { PayRules, Worker, WorkerPay } from "@/lib/types";

export const DEFAULT_PAY_RULES: PayRules = {
  hoursPerMonth: 208,
  overtimeMultiplier: 1.5,
  servicePercentPerYear: 2,
  serviceMaxPercent: 20,
  newJoinerMonths: 6,
  newJoinerPayPercent: 100,
  incrementEveryMonths: 12,
};

export const JOB_ROLES: Record<Worker["jobRole"], string> = {
  driver: "Driver",
  operator: "Loom operator",
  supervisor: "Supervisor",
  quality: "Quality checker",
  mechanic: "Mechanic",
  helper: "Helper",
  office: "Office staff",
};

/** Completed months from one date to another; 0 if `to` is earlier. */
export function monthsBetween(from: IsoDate, to: IsoDate): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const months = (ty! - fy!) * 12 + (tm! - fm!) - (td! < fd! ? 1 : 0);
  return Math.max(0, months);
}

export function serviceLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}

/** Last day of a YYYY-MM month. */
export function monthEnd(month: string): IsoDate {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The month (IST) a timestamp falls in. */
export function monthOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso)).slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, 1)));
}

export interface PaySlip {
  serviceMonths: number;
  isNewJoiner: boolean;
  /** Months since the last increment, or since joining if there has been none. */
  monthsSinceIncrement: number;
  incrementDue: boolean;
  hourlyPaise: number;
  regularHours: number;
  overtimeHours: number;
  basePaise: number;
  overtimePaise: number;
  servicePercent: number;
  servicePaise: number;
  tripPaise: number;
  bonusPaise: number;
  deductionPaise: number;
  netPaise: number;
}

/**
 * A worker's pay for one month: hours at the hourly rate (monthly salary ÷ standard hours),
 * overtime beyond the standard hours, a service allowance for completed years, trip pay for
 * drivers and any bonus, less deductions.
 */
export function calcPay(
  worker: Pick<Worker, "joinedOn" | "monthlyPaise" | "increments">,
  pay: Pick<WorkerPay, "hoursWorked" | "bonusPaise" | "deductionPaise"> | undefined,
  tripPaise: number,
  rules: PayRules,
  asOf: IsoDate,
): PaySlip {
  const serviceMonths = monthsBetween(worker.joinedOn, asOf);
  const isNewJoiner = serviceMonths < rules.newJoinerMonths;
  const lastIncrement = worker.increments.reduce((latest, i) => (i.on > latest ? i.on : latest), worker.joinedOn);
  const monthsSinceIncrement = monthsBetween(lastIncrement, asOf);

  const hours = pay?.hoursWorked ?? 0;
  const regularHours = Math.min(hours, rules.hoursPerMonth);
  const overtimeHours = Math.max(0, hours - rules.hoursPerMonth);
  const hourly = (worker.monthlyPaise / rules.hoursPerMonth) * (isNewJoiner ? rules.newJoinerPayPercent / 100 : 1);
  const basePaise = Math.round(regularHours * hourly);
  const overtimePaise = Math.round(overtimeHours * hourly * rules.overtimeMultiplier);
  const servicePercent = Math.min(Math.floor(serviceMonths / 12) * rules.servicePercentPerYear, rules.serviceMaxPercent);
  const servicePaise = Math.round((basePaise * servicePercent) / 100);
  const bonusPaise = pay?.bonusPaise ?? 0;
  const deductionPaise = pay?.deductionPaise ?? 0;

  return {
    serviceMonths, isNewJoiner, monthsSinceIncrement,
    incrementDue: monthsSinceIncrement >= rules.incrementEveryMonths,
    hourlyPaise: Math.round(hourly), regularHours, overtimeHours,
    basePaise, overtimePaise, servicePercent, servicePaise, tripPaise, bonusPaise, deductionPaise,
    netPaise: Math.max(0, basePaise + overtimePaise + servicePaise + tripPaise + bonusPaise - deductionPaise),
  };
}
