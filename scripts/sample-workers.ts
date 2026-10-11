import { calcPay, DEFAULT_PAY_RULES, monthEnd } from "@/lib/payroll";
import type { Worker, WorkerPay } from "@/lib/types";
import { payDocId } from "@/lib/workers/data";

// Made-up workers: [name, job, months of service, monthly salary in rupees].
const WORKERS: [string, Worker["jobRole"], number, number][] = [
  ["Murugan", "driver", 74, 24_000],
  ["Selvam", "driver", 3, 21_000],
  ["Kumar", "supervisor", 122, 32_000],
  ["Lakshmi", "operator", 50, 18_500],
  ["Ramesh", "operator", 13, 17_000],
  ["Priya", "quality", 27, 19_000],
  ["Senthil", "mechanic", 96, 26_000],
  ["Anitha", "operator", 2, 16_000],
  ["Ravi", "helper", 5, 14_000],
  ["Meena", "office", 38, 22_000],
];
const DRIVER_EXTRAS: Record<string, { licenceNo: string; vehicleNo: string }> = {
  Murugan: { licenceNo: "TN33 20190004821", vehicleNo: "TN 33 AB 4821" },
  Selvam: { licenceNo: "TN37 20220001907", vehicleNo: "TN 37 CK 1907" },
};

function monthsAgo(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  // Day capped at 28 so every month has it.
  return new Date(Date.UTC(y!, m! - 1 - months, Math.min(d!, 28))).toISOString().slice(0, 10);
}

/** Ten sample workers, with last month paid and this month's hours so far. */
export function sampleWorkers(today: string): { workers: (Omit<Worker, "id"> & { id: string })[]; pay: { id: string; data: WorkerPay }[] } {
  const lastMonth = monthsAgo(today, 1).slice(0, 7);
  const workers: (Omit<Worker, "id"> & { id: string })[] = [];
  const pay: { id: string; data: WorkerPay }[] = [];
  for (const [i, [name, jobRole, months, rupees]] of WORKERS.entries()) {
    const id = `W-${String(i + 1).padStart(3, "0")}`;
    const monthlyPaise = rupees * 100;
    // Anyone with two years or more had a raise 14 or 5 months ago, so some are due for the next one.
    const raisedOn = months >= 24 ? monthsAgo(today, i % 2 ? 5 : 14) : null;
    const worker = {
      id, workerNo: id, name, phone: `98420${String(10_000 + i * 731).slice(0, 5)}`, jobRole,
      joinedOn: monthsAgo(today, months), monthlyPaise, active: true,
      increments: raisedOn
        ? [{ on: raisedOn, fromPaise: monthlyPaise - 150_000, toPaise: monthlyPaise, note: "Yearly increment", by: "Karthikeyan (Owner)" }]
        : [],
      licenceNo: DRIVER_EXTRAS[name]?.licenceNo ?? null, vehicleNo: DRIVER_EXTRAS[name]?.vehicleNo ?? null,
    };
    workers.push(worker);
    const entry = (month: string, hoursWorked: number, paid: boolean): WorkerPay => ({
      workerId: id, month, hoursWorked, bonusPaise: 0, bonusNote: "", deductionPaise: 0, deductionNote: "",
      paidAt: paid ? `${month}-28T12:30:00.000Z` : null, paidBy: paid ? "Karthikeyan (Owner)" : null, paidNetPaise: null,
    });
    if (months >= 1) {
      const last = entry(lastMonth, 200 + ((i * 7) % 24), true);
      const net = calcPay(worker, last, 0, DEFAULT_PAY_RULES, monthEnd(lastMonth)).netPaise;
      pay.push({ id: payDocId(id, lastMonth), data: { ...last, paidNetPaise: net } });
    }
    // Two workers are left without hours this month to show the "not entered" state.
    if (i < WORKERS.length - 2) {
      const now = { ...entry(today.slice(0, 7), 60 + ((i * 11) % 40), false), ...(i === 3 ? { bonusPaise: 200_000, bonusNote: "Attendance bonus" } : {}) };
      pay.push({ id: payDocId(id, now.month), data: now });
    }
  }
  return { workers, pay };
}
