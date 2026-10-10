"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setReviewApproved } from "./review-actions";

export function ReviewControls({ orderNo, approved }: { orderNo: string; approved: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={approved ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setReviewApproved(orderNo, !approved);
          if (result.ok) {
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
  );
}
