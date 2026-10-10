"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { computePlan } from "@/lib/services/planning";
import { planDocFrom } from "@/lib/services/plans";

const schema = z.object({
  batchId: z.string().min(1),
  startDate: z.string().refine(isIsoDate, "Invalid start date"),
  shiftsPerDay: z.number().int().min(1).max(3),
  allowOvertime: z.boolean(),
  planKey: z.enum(["recommended", "min-machines", "fastest", "overtime"]),
  apply: z.boolean(),
});

/**
 * Saves the chosen plan as a draft or applies it. The plan is recomputed on the server
 * from current data, so a stale browser tab can never assign machines that got booked
 * in the meantime.
 */
export async function savePlan(input: z.infer<typeof schema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.planning);
    const form = schema.parse(input);
    const today = todayIso();
    if (form.startDate < today) throw new Error("Start date cannot be in the past");

    const { batch, order, machines, inputs, result } = await computePlan(form);
    const chosen = [result.recommended, ...result.alternatives].find((o) => o.key === form.planKey);
    if (!chosen) throw new Error("That plan option is no longer available. Reload the page.");
    if (form.apply && (chosen.machineIds.length === 0 || !chosen.estimatedFinishDate)) {
      throw new Error("This plan has no machines to assign");
    }

    const planRef = db().collection("allocationPlans").doc();
    const write = db().batch();
    write.set(planRef, planDocFrom(result, chosen, inputs, batch, user.name, form.apply ? "applied" : "draft"));

    if (form.apply) {
      const starts = form.startDate <= today;
      write.update(db().collection("batches").doc(batch.id), {
        machineIds: chosen.machineIds,
        startDate: form.startDate,
        endDate: chosen.estimatedFinishDate,
        hoursPerDay: chosen.hoursPerDay,
        planId: planRef.id,
        status: starts ? "in_progress" : "planned",
      });
      write.update(db().collection("orders").doc(order.id), { status: "in_production" });
      const chosenIds = new Set(chosen.machineIds);
      for (const m of machines) {
        const ref = db().collection("machines").doc(m.id);
        if (chosenIds.has(m.id) && starts) {
          write.update(ref, { currentBatchId: batch.id, status: "running" });
        } else if (!chosenIds.has(m.id) && m.currentBatchId === batch.id) {
          // Released by the new plan.
          write.update(ref, { currentBatchId: null, status: m.status === "running" ? "idle" : m.status });
        }
      }
    }
    await write.commit();
    await writeAudit(
      user,
      form.apply ? "apply-plan" : "save-draft-plan",
      "batch",
      batch.batchNo,
      `${chosen.label}: ${chosen.machinesNeeded} machines, finish ${chosen.estimatedFinishDate ?? "n/a"}`,
    );
    revalidatePath("/admin", "layout");
    return {
      message: form.apply
        ? `Plan applied: ${chosen.machinesNeeded} machines assigned to ${batch.batchNo}`
        : "Draft plan saved",
    };
  });
}
