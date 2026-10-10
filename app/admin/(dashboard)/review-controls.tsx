"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setReviewApproved } from "./review-actions";

export function ReviewControls({ orderNo, approved: initial }: { orderNo: string; approved: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Kept here so the button and label change the moment the save succeeds.
  const [approved, setApproved] = useState(initial);
  return (
    <div className="grid justify-items-end gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs ${approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
        {approved ? "Approved for the website" : "Waiting for approval"}
      </span>
    <Button
      type="button"
      size="sm"
      variant={approved ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setReviewApproved(orderNo, !approved);
          if (result.ok) {
            setApproved(!approved);
            toast.success(result.message ?? "Saved");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      {approved ? "Hide from website" : "Approve for website"}
    </Button>
    </div>
  );
}
