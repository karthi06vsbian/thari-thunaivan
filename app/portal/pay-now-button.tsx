"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resumePayment } from "./actions";
import { payForOrder } from "./pay";

export function PayNowButton({ orderId, companyName }: { orderId: string; companyName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function pay() {
    startTransition(async () => {
      setBusy(true);
      try {
        const started = await resumePayment(orderId);
        if (!started.ok || !started.data) {
          toast.error(started.ok ? "Could not start the payment" : started.error);
          return;
        }
        const result = await payForOrder(started.data.checkout, companyName);
        if (result.ok) toast.success(result.text);
        else toast.error(result.text);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Payment failed");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Button type="button" size="sm" className="btn-shine" disabled={pending || busy} onClick={pay}>
      Pay now
    </Button>
  );
}
