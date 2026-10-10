import type { AllocationResult, PlanInputs, PlanOption } from "@/lib/planning/types";
import type { AllocationPlanDoc, Batch } from "@/lib/types";

export function planDocFrom(
  result: AllocationResult,
  chosen: PlanOption,
  inputs: PlanInputs,
  batch: Pick<Batch, "id" | "orderId">,
  createdBy: string,
  status: AllocationPlanDoc["status"],
): Omit<AllocationPlanDoc, "id"> {
  return {
    batchId: batch.id,
    orderId: batch.orderId,
    createdAt: new Date().toISOString(),
    createdBy,
    inputs,
    planKey: chosen.key,
    recommendedMachineIds: chosen.machineIds,
    machinesNeeded: chosen.machinesNeeded,
    estimatedFinishDate: chosen.estimatedFinishDate,
    estimatedUnits: chosen.estimatedUnits,
    estimatedPowerCostPaise: chosen.estimatedPowerCostPaise,
    alternatives: [result.recommended, ...result.alternatives]
      .filter((o) => o.key !== chosen.key)
      .map((o) => ({
        key: o.key,
        label: o.label,
        machinesNeeded: o.machinesNeeded,
        estimatedFinishDate: o.estimatedFinishDate,
        estimatedUnits: o.estimatedUnits,
        estimatedPowerCostPaise: o.estimatedPowerCostPaise,
      })),
    status,
  };
}
