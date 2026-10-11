"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { calcPay, isMonth, JOB_ROLES, monthEnd, monthLabel } from "@/lib/payroll";
import { getShipments } from "@/lib/transport/data";
import type { Increment, WorkerPay } from "@/lib/types";
import { createWorker, getPayRules, getWorker, getWorkerPay, payDocId, tripsByDriver } from "@/lib/workers/data";

const rupees = z.number().min(0).max(10_000_000);
const jobRole = z.enum(Object.keys(JOB_ROLES) as [keyof typeof JOB_ROLES, ...(keyof typeof JOB_ROLES)[]]);
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Please check the form";

const workerSchema = z.object({
  name: z.string().trim().min(2, "Enter the worker's name").max(60),
  phone: z.string().trim().max(20),
  jobRole,
  joinedOn: z.string().refine((d) => isIsoDate(d) && d <= todayIso(), "Pick the joining date"),
  monthlyRupees: rupees.min(1, "Enter the monthly salary"),
  licenceNo: z.string().trim().max(30).optional(),
  vehicleNo: z.string().trim().max(20).optional(),
});

export async function addWorker(input: z.infer<typeof workerSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.workers);
    const parsed = workerSchema.safeParse(input);
    if (!parsed.success) throw new Error(firstIssue(parsed.error));
    const d = parsed.data;
    const worker = await createWorker({
      name: d.name, phone: d.phone || null, jobRole: d.jobRole, joinedOn: d.joinedOn,
      monthlyPaise: rupeesToPaise(d.monthlyRupees),
      licenceNo: d.licenceNo || null, vehicleNo: d.vehicleNo?.toUpperCase() || null,
    });
    await writeAudit(user, "add-worker", "worker", worker.id, `${worker.name}, ${JOB_ROLES[worker.jobRole]}`);
    revalidatePath("/admin", "layout");
    return { message: `${worker.name} added as ${worker.workerNo}` };
  });
}

const detailsSchema = workerSchema.omit({ monthlyRupees: true }).extend({ active: z.boolean() });

/** Salary is not changed here: it only moves through an increment, so the history stays complete. */
export async function updateWorker(workerId: string, input: z.infer<typeof detailsSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.workers);
    const parsed = detailsSchema.safeParse(input);
    if (!parsed.success) throw new Error(firstIssue(parsed.error));
    if (!(await getWorker(workerId))) throw new Error("Worker not found");
    const d = parsed.data;
    await db().collection("workers").doc(workerId).update({
      name: d.name, phone: d.phone || null, jobRole: d.jobRole, joinedOn: d.joinedOn, active: d.active,
      licenceNo: d.licenceNo || null, vehicleNo: d.vehicleNo?.toUpperCase() || null,
    });
    await writeAudit(user, "update-worker", "worker", workerId, d.active ? d.name : `${d.name} (left)`);
    revalidatePath("/admin", "layout");
    return { message: `${d.name} updated` };
  });
}

const incrementSchema = z.object({
  monthlyRupees: rupees.min(1, "Enter the new monthly salary"),
  note: z.string().trim().max(120),
});

export async function giveIncrement(workerId: string, input: z.infer<typeof incrementSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.workers);
    const parsed = incrementSchema.safeParse(input);
    if (!parsed.success) throw new Error(firstIssue(parsed.error));
    const worker = await getWorker(workerId);
    if (!worker) throw new Error("Worker not found");
    const toPaise = rupeesToPaise(parsed.data.monthlyRupees);
    if (toPaise === worker.monthlyPaise) throw new Error("The new salary is the same as the current one");
    const increment: Increment = {
      on: todayIso(), fromPaise: worker.monthlyPaise, toPaise, note: parsed.data.note, by: user.name,
    };
    await db().collection("workers").doc(workerId).update({
      monthlyPaise: toPaise,
      increments: FieldValue.arrayUnion(increment),
    });
    await writeAudit(user, "increment", "worker", workerId, `${formatINR(worker.monthlyPaise, { whole: true })} → ${formatINR(toPaise, { whole: true })}`);
    revalidatePath("/admin", "layout");
    return { message: `${worker.name}'s salary is now ${formatINR(toPaise, { whole: true })} a month` };
  });
}

const monthSchema = z.object({
  month: z.string().refine(isMonth, "Pick a month"),
  hoursWorked: z.number().min(0).max(744, "A month has at most 744 hours"),
  bonusRupees: rupees,
  bonusNote: z.string().trim().max(120),
  deductionRupees: rupees,
  deductionNote: z.string().trim().max(120),
});

export async function saveMonthPay(workerId: string, input: z.infer<typeof monthSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.workers);
    const parsed = monthSchema.safeParse(input);
    if (!parsed.success) throw new Error(firstIssue(parsed.error));
    const d = parsed.data;
    const worker = await getWorker(workerId);
    if (!worker) throw new Error("Worker not found");
    if ((await getWorkerPay(workerId, d.month))?.paidAt) throw new Error("This month is already paid. Undo the payment to change it.");
    const pay: WorkerPay = {
      workerId, month: d.month, hoursWorked: d.hoursWorked,
      bonusPaise: rupeesToPaise(d.bonusRupees), bonusNote: d.bonusNote,
      deductionPaise: rupeesToPaise(d.deductionRupees), deductionNote: d.deductionNote,
      paidAt: null, paidBy: null, paidNetPaise: null,
    };
    await db().collection("workerPay").doc(payDocId(workerId, d.month)).set(pay);
    await writeAudit(user, "pay-entry", "worker", workerId, `${d.month}: ${d.hoursWorked} h, bonus ${formatINR(pay.bonusPaise, { whole: true })}`);
    revalidatePath("/admin/workers");
    return { message: `${monthLabel(d.month)} saved for ${worker.name}` };
  });
}

/** Marks a month's salary as paid and freezes the amount, or undoes that. */
export async function setPaid(workerId: string, month: string, paid: boolean) {
  return run(async () => {
    const user = await assertRole(ACCESS.workers);
    if (!isMonth(month)) throw new Error("Pick a month");
    const [worker, pay, rules, shipments] = await Promise.all([
      getWorker(workerId), getWorkerPay(workerId, month), getPayRules(), getShipments(),
    ]);
    if (!worker) throw new Error("Worker not found");
    if (!pay) throw new Error("Enter the hours for this month first");
    const ref = db().collection("workerPay").doc(payDocId(workerId, month));
    if (!paid) {
      await ref.update({ paidAt: null, paidBy: null, paidNetPaise: null });
      await writeAudit(user, "pay-undo", "worker", workerId, month);
      revalidatePath("/admin/workers");
      return { message: `${monthLabel(month)} payment undone for ${worker.name}` };
    }
    if (pay.paidAt) throw new Error("This month is already paid");
    const today = todayIso();
    const asOf = monthEnd(month) < today ? monthEnd(month) : today;
    const net = calcPay(worker, pay, tripsByDriver(shipments, month).get(workerId)?.paise ?? 0, rules, asOf).netPaise;
    await ref.update({ paidAt: new Date().toISOString(), paidBy: user.name, paidNetPaise: net });
    await writeAudit(user, "pay", "worker", workerId, `${month}: ${formatINR(net, { whole: true })}`);
    revalidatePath("/admin/workers");
    return { message: `${formatINR(net, { whole: true })} marked as paid to ${worker.name}` };
  });
}

const rulesSchema = z.object({
  hoursPerMonth: z.number().min(1).max(744),
  overtimeMultiplier: z.number().min(1).max(3),
  servicePercentPerYear: z.number().min(0).max(20),
  serviceMaxPercent: z.number().min(0).max(100),
  newJoinerMonths: z.number().int().min(0).max(24),
  newJoinerPayPercent: z.number().min(50).max(100),
  incrementEveryMonths: z.number().int().min(1).max(60),
});

export async function savePayRules(input: z.infer<typeof rulesSchema>) {
  return run(async () => {
    const user = await assertRole(["owner"]);
    const parsed = rulesSchema.safeParse(input);
    if (!parsed.success) throw new Error("Please check the pay rules");
    await db().collection("settings").doc("payroll").set(parsed.data);
    await writeAudit(user, "pay-rules", "settings", "payroll", JSON.stringify(parsed.data));
    revalidatePath("/admin/workers");
    return { message: "Pay rules updated" };
  });
}
