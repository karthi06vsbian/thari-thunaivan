"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { getBatches, getMachines, getShiftSettings } from "@/lib/data";
import { isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { commitInChunks, recomputeAll } from "@/lib/services/recompute";

const rowSchema = z.object({
  machineId: z.string().min(1),
  batchId: z.string().nullable(),
  runningHours: z.number().min(0),
  breakdownHours: z.number().min(0),
  outputMeters: z.number().min(0),
  notes: z.string().max(300),
});

export type LogRowInput = z.infer<typeof rowSchema>;

export async function saveLogs(date: string, shiftName: string, rows: LogRowInput[]) {
  return run(async () => {
    const user = await assertRole(ACCESS.productionLogs);
    const today = todayIso();
    if (!isIsoDate(date) || date > today) throw new Error("Logs can only be entered for today or earlier");
    const [settings, machines, batches] = await Promise.all([getShiftSettings(), getMachines(), getBatches()]);
    const shift = settings.shifts.find((s) => s.name === shiftName);
    if (!shift) throw new Error("Unknown shift");
    const machineIds = new Set(machines.map((m) => m.id));
    const batchIds = new Set(batches.map((b) => b.id));

    const parsed = z.array(rowSchema).max(200).parse(rows);
    for (const r of parsed) {
      if (!machineIds.has(r.machineId)) throw new Error(`Unknown machine ${r.machineId}`);
      if (r.batchId && !batchIds.has(r.batchId)) throw new Error(`Unknown batch ${r.batchId}`);
      if (r.runningHours + r.breakdownHours > shift.hours + 1e-9) {
        throw new Error(`${r.machineId}: running + breakdown hours exceed the ${shift.hours}-hour shift`);
      }
      if (r.runningHours === 0 && r.outputMeters > 0) {
        throw new Error(`${r.machineId}: output entered with zero running hours`);
      }
    }

    await commitInChunks(
      parsed.map((r) => (batch) => {
        const ref = db().collection("machineLogs").doc(`${date}_${shift.name}_${r.machineId}`);
        batch.set(
          ref,
          {
            machineId: r.machineId,
            batchId: r.batchId || null,
            date,
            shift: shift.name,
            runningHours: r.runningHours,
            breakdownHours: r.breakdownHours,
            idleHours: Math.round((shift.hours - r.runningHours - r.breakdownHours) * 100) / 100,
            outputMeters: r.outputMeters,
            operatorWorkerId: null,
            notes: r.notes,
            enteredBy: user.name,
          },
          { merge: true },
        );
      }),
    );
    await recomputeAll(date, today);
    await writeAudit(user, "save-logs", "machineLogs", `${date} ${shift.name}`, `${parsed.length} machines`);
    revalidatePath("/admin", "layout");
    return { message: `Saved ${parsed.length} machine logs for ${shift.name} shift` };
  });
}
