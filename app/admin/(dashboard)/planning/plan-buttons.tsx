"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelPlan, completePlan, savePlan } from "./actions";

type Input = Omit<Parameters<typeof savePlan>[0], "apply">;

export function PlanButtons({ input, canApply }: { input: Input; canApply: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(apply: boolean) {
    if (apply && !window.confirm("Assign these machines to the batch?")) return;
    startTransition(async () => {
      const result = await savePlan({ ...input, apply });
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => submit(true)} disabled={pending || !canApply}>
        {pending ? "Working…" : "Apply plan"}
      </Button>
      <Button type="button" variant="outline" onClick={() => submit(false)} disabled={pending}>
        Save as draft
      </Button>
    </div>
  );
}

/** For a plan in progress: finish it, or take it off the batch. Both free its machines. */
export function ActivePlanButtons({
  batchId,
  batchNo,
  orderNo,
  machines,
  percent,
}: {
  batchId: string;
  batchNo: string;
  orderNo: string;
  machines: number;
  /** Share of the ordered meters produced so far. */
  percent: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  const frees = `Its ${machines} machine${machines === 1 ? "" : "s"} will be free for new plans`;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant={percent >= 100 ? "default" : "outline"}
        disabled={pending}
        onClick={() => {
          const warning = percent < 100 ? ` Only ${percent}% of the order is produced.` : "";
          if (window.confirm(`Mark ${batchNo} as completed?${warning} ${frees} and ${orderNo} will be ready to dispatch.`)) {
            act(() => completePlan(batchId));
          }
        }}
      >
        Mark completed
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Remove the plan from ${batchNo}? ${frees} and ${orderNo} will wait for a new plan.`)) {
            act(() => cancelPlan(batchId));
          }
        }}
      >
        Remove plan
      </Button>
    </div>
  );
}
