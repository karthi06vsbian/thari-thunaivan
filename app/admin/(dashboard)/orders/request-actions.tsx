"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptOrder, rejectOrder } from "./actions";

export function RequestActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [rate, setRate] = useState("");
  const [pending, startTransition] = useTransition();

  function act(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={`Price per meter in rupees for ${orderId}`}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        placeholder="₹ per meter"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        className="w-32"
      />
      <Button type="button" disabled={pending || rate === ""} onClick={() => act(() => acceptOrder(orderId, Number(rate)))}>
        Accept
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Decline ${orderId}?`)) act(() => rejectOrder(orderId));
        }}
      >
        Reject
      </Button>
    </div>
  );
}
