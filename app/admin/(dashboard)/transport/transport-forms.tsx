"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addShipmentUpdate, dispatchOrder, markDelivered } from "./actions";

function useAct() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        after?.();
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  return { pending, act };
}

export function DispatchForm({ orderId, routes }: { orderId: string; routes: { id: string; label: string }[] }) {
  const { pending, act } = useAct();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        act(() =>
          dispatchOrder({
            orderId,
            routeId: String(f.get("routeId") ?? ""),
            vehicleNo: String(f.get("vehicleNo") ?? ""),
            driverName: String(f.get("driverName") ?? ""),
          }),
        );
      }}
    >
      <NativeSelect name="routeId" required defaultValue="" aria-label={`Route for ${orderId}`}>
        <option value="" disabled>Route…</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </NativeSelect>
      <Input name="vehicleNo" required placeholder="Vehicle no." aria-label={`Vehicle number for ${orderId}`} className="w-36" />
      <Input name="driverName" required placeholder="Driver" aria-label={`Driver for ${orderId}`} className="w-32" />
      <Button type="submit" className="btn-shine" disabled={pending}>Dispatch</Button>
    </form>
  );
}

export function ShipmentControls({ shipmentId }: { shipmentId: string }) {
  const { pending, act } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="flex flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          act(() => addShipmentUpdate(shipmentId, String(new FormData(form).get("text") ?? "")), () => form.reset());
        }}
      >
        <Input name="text" required maxLength={300} placeholder="Add an update, e.g. Crossed Salem toll" aria-label={`Update for ${shipmentId}`} className="min-w-48 flex-1" />
        <Button type="submit" variant="outline" disabled={pending}>Add update</Button>
      </form>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Mark ${shipmentId} as delivered?`)) act(() => markDelivered(shipmentId));
        }}
      >
        Mark delivered
      </Button>
    </div>
  );
}
