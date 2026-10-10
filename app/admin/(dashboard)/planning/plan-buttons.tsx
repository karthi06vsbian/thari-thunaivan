"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { savePlan } from "./actions";

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
