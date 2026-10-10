import {
  allocationsFromBatches,
  getBatch,
  getBatches,
  getElectricitySettings,
  getMachines,
  getOrder,
  getShiftSettings,
} from "@/lib/data";
import { recommendAllocation } from "@/lib/planning/allocate";
import type { IsoDate, PlanInputs } from "@/lib/planning/types";

export interface PlanForm {
  batchId: string;
  startDate: IsoDate;
  shiftsPerDay: number;
  allowOvertime: boolean;
}

/** Loads the batch and current floor state and runs the recommendation for it. */
export async function computePlan(form: PlanForm) {
  const batch = await getBatch(form.batchId);
  if (!batch) throw new Error("Batch not found");
  if (batch.status === "completed") throw new Error("This batch is already completed");
  const [order, machines, batches, shiftSettings, tariff] = await Promise.all([
    getOrder(batch.orderId),
    getMachines(),
    getBatches(),
    getShiftSettings(),
    getElectricitySettings(),
  ]);
  if (!order) throw new Error("Order not found");

  const inputs: PlanInputs = {
    meters: Math.max(0, Math.round((batch.meters - batch.producedMeters) * 100) / 100),
    fabricType: batch.fabricType,
    widthInches: batch.widthInches,
    startDate: form.startDate,
    deadline: order.deadline,
    shiftsPerDay: Math.min(Math.max(1, form.shiftsPerDay), shiftSettings.shifts.length),
    allowOvertime: form.allowOvertime,
  };
  const result = recommendAllocation(inputs, {
    machines,
    // The batch's own current machines are free to be re-planned.
    allocations: allocationsFromBatches(batches, batch.id),
    shiftSettings,
    ratePerUnitPaise: tariff.ratePerUnitPaise,
  });
  return { batch, order, machines, batches, shiftSettings, inputs, result };
}
