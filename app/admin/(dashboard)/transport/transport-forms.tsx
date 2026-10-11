"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDriver, addShipmentUpdate, dispatchOrder, markDelivered } from "./actions";

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

export interface DriverOption {
  id: string;
  name: string;
  vehicleNo: string | null;
}

export function DispatchForm({ orderId, routes, drivers }: { orderId: string; routes: { id: string; label: string }[]; drivers: DriverOption[] }) {
  const { pending, act } = useAct();
  const [vehicleNo, setVehicleNo] = useState("");
  if (drivers.length === 0) return <p className="text-muted-foreground">Add a driver below before dispatching.</p>;
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
            vehicleNo,
            driverId: String(f.get("driverId") ?? ""),
            tripPayRupees: Number(f.get("tripPayRupees") || 0),
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
      <NativeSelect
        name="driverId"
        required
        defaultValue=""
        aria-label={`Driver for ${orderId}`}
        // Picking a driver fills in the truck they usually drive.
        onChange={(e) => setVehicleNo(drivers.find((d) => d.id === e.target.value)?.vehicleNo ?? "")}
      >
        <option value="" disabled>Driver…</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </NativeSelect>
      <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} required placeholder="Vehicle no." aria-label={`Vehicle number for ${orderId}`} className="w-36" />
      <Input name="tripPayRupees" type="number" required min={0} step="1" placeholder="Trip pay ₹" aria-label={`Driver's trip pay for ${orderId}`} className="w-28" />
      <Button type="submit" className="btn-shine" disabled={pending}>Dispatch</Button>
    </form>
  );
}

export function AddDriverForm({ today }: { today: string }) {
  const { pending, act } = useAct();
  const field = "grid gap-1 text-xs text-muted-foreground";
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        act(
          () =>
            addDriver({
              name: String(f.get("name") ?? ""),
              phone: String(f.get("phone") ?? ""),
              licenceNo: String(f.get("licenceNo") ?? ""),
              vehicleNo: String(f.get("vehicleNo") ?? ""),
              joinedOn: String(f.get("joinedOn") ?? ""),
              monthlyRupees: Number(f.get("monthlyRupees") || 0),
            }),
          () => form.reset(),
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <label className={field}>Driver name<Input name="name" required maxLength={60} /></label>
        <label className={field}>Phone<Input name="phone" type="tel" maxLength={20} /></label>
        <label className={field}>Licence no.<Input name="licenceNo" required maxLength={30} /></label>
        <label className={field}>Usual vehicle no.<Input name="vehicleNo" maxLength={20} /></label>
        <label className={field}>Joined on<Input name="joinedOn" type="date" required max={today} defaultValue={today} /></label>
        <label className={field}>Monthly salary (₹)<Input name="monthlyRupees" type="number" required min={1} step="1" /></label>
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">{pending ? "Adding…" : "Add driver"}</Button>
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
