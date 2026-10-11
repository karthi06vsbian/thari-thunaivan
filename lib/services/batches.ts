import { getBatch, getBatches, getMachines } from "@/lib/data";
import { db } from "@/lib/firebase/admin";
import type { IsoDate } from "@/lib/planning/types";
import type { Batch } from "@/lib/types";

/** Takes a batch's machines off it: each goes back to idle unless it is down for repair. */
async function releaseMachines(write: FirebaseFirestore.WriteBatch, batch: Batch): Promise<void> {
  for (const m of await getMachines()) {
    if (m.currentBatchId !== batch.id) continue;
    write.update(db().collection("machines").doc(m.id), {
      currentBatchId: null,
      status: m.status === "running" ? "idle" : m.status,
    });
  }
}

/**
 * Closes a planned or running batch. Its machines become free for new plans, and the order
 * is completed (ready to dispatch) once all of its batches are.
 */
export async function completeBatch(batchId: string, today: IsoDate): Promise<Batch> {
  const batch = await getBatch(batchId);
  if (!batch) throw new Error("Batch not found");
  if (batch.status === "completed") throw new Error("This batch is already completed");
  if (batch.status === "pending") throw new Error("This batch has no plan to complete");
  if (batch.producedMeters <= 0) {
    throw new Error("Nothing has been produced yet. Remove the plan instead to free its machines.");
  }
  const others = (await getBatches()).filter((b) => b.orderId === batch.orderId && b.id !== batch.id);

  const write = db().batch();
  write.update(db().collection("batches").doc(batch.id), { status: "completed", completedOn: today });
  if (others.every((b) => b.status === "completed")) {
    write.update(db().collection("orders").doc(batch.orderId), { status: "completed" });
  }
  await releaseMachines(write, batch);
  await write.commit();
  return batch;
}

/** Undoes a plan: the batch goes back to waiting for one and its machines are freed. */
export async function removePlan(batchId: string): Promise<Batch> {
  const batch = await getBatch(batchId);
  if (!batch) throw new Error("Batch not found");
  if (batch.status !== "planned" && batch.status !== "in_progress") throw new Error("This batch has no plan to remove");

  const write = db().batch();
  write.update(db().collection("batches").doc(batch.id), {
    status: "pending", machineIds: [], startDate: null, endDate: null, hoursPerDay: null, planId: null,
  });
  write.update(db().collection("orders").doc(batch.orderId), { status: "confirmed" });
  await releaseMachines(write, batch);
  await write.commit();
  return batch;
}
