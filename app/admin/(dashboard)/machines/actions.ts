"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import type { MachineDoc } from "@/lib/types";
import { sendToOwners } from "@/lib/whatsapp/send";

const statusSchema = z.enum(["running", "idle", "maintenance", "breakdown"]);

export async function updateMachineStatus(machineId: string, status: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.machines);
    const next = statusSchema.parse(status);
    const ref = db().collection("machines").doc(machineId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Machine not found");
    const machine = snap.data() as MachineDoc;
    if (machine.status === next) return;

    await ref.update({
      status: next,
      // Coming back from maintenance counts as the service being done today.
      ...(machine.status === "maintenance" ? { lastMaintenanceAt: todayIso() } : {}),
    });
    await writeAudit(user, "status-change", "machine", machineId, `${machine.status} → ${next}`);
    if (next === "breakdown") {
      await sendToOwners(
        `⚠ Breakdown: ${machine.machineNo} ${machine.name}${machine.currentBatchId ? ` (batch ${machine.currentBatchId})` : ""}. Reported by ${user.name}.`,
        "alert-breakdown",
      );
    }
    revalidatePath("/admin", "layout");
    return { message: `${machine.machineNo} set to ${next}` };
  });
}

export async function scheduleMaintenance(machineId: string, dueDate: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.machines);
    if (!isIsoDate(dueDate)) throw new Error("Pick a maintenance date");
    const ref = db().collection("machines").doc(machineId);
    if (!(await ref.get()).exists) throw new Error("Machine not found");
    await ref.update({ maintenanceDueAt: dueDate });
    await writeAudit(user, "schedule-maintenance", "machine", machineId, `due ${dueDate}`);
    revalidatePath("/admin", "layout");
    return { message: `Maintenance for ${machineId} scheduled on ${dueDate}` };
  });
}
