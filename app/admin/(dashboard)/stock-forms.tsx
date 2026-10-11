"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STOCK_FABRICS } from "@/lib/stock";
import type { Material } from "@/lib/types";
import { addStockOrderNote, advanceStockOrder, cancelStockOrder, placeStockOrder, removeMaterial, saveMaterial } from "./stock-actions";

const field = "grid gap-1 text-xs text-muted-foreground";

/** Adds a material, or with `material` updates its stock and settings. */
export function MaterialDialog({ material }: { material?: Material }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const act = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{material ? "Update" : "Add material"}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{material ? material.name : "Add a material"}</DialogTitle>
          <DialogDescription>
            {material ? "Change the stock in hand after a delivery or a stock count." : "Yarn, sizing chemical or anything else the mill must not run out of."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            act(() =>
              saveMaterial(material?.id ?? null, {
                name: String(f.get("name") ?? ""), unit: String(f.get("unit") ?? ""), fabricType: String(f.get("fabricType") ?? ""),
                stock: Number(f.get("stock") || 0), minStock: Number(f.get("minStock") || 0), usePerMeter: Number(f.get("usePerMeter") || 0),
              }),
            );
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={field}>Material<Input name="name" required maxLength={60} defaultValue={material?.name} placeholder="e.g. Cotton yarn 40s" /></label>
            <label className={field}>Unit<Input name="unit" required maxLength={12} defaultValue={material?.unit ?? "kg"} /></label>
            <label className={field}>Stock in hand<Input name="stock" type="number" required min={0} step="any" defaultValue={material?.stock} /></label>
            <label className={field}>Low-stock level<Input name="minStock" type="number" required min={0} step="any" defaultValue={material?.minStock} /></label>
            <label className={field}>
              Used for
              <NativeSelect name="fabricType" defaultValue={material?.fabricType ?? ""}>
                <option value="">Every fabric</option>
                {STOCK_FABRICS.map((f) => (
                  <option key={f} value={f} className="capitalize">{f[0]!.toUpperCase() + f.slice(1)} orders</option>
                ))}
              </NativeSelect>
            </label>
            <label className={field}>Used per meter of fabric<Input name="usePerMeter" type="number" required min={0} step="any" defaultValue={material?.usePerMeter} placeholder="e.g. 0.12" /></label>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            {material && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Remove ${material.name} from the stock list?`)) act(() => removeMaterial(material.id));
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Buys a material from a supplier. Once placed, the dialog shows the tracking ID to follow it by. */
export function OrderStockDialog({
  material,
  suggested,
  today,
  defaultExpected,
  last,
}: {
  material: Material;
  /** Quantity the stock box recommends; 0 when nothing is needed. */
  suggested: number;
  today: string;
  defaultExpected: string;
  /** Supplier and rate from the last order of this material, offered again. */
  last?: { supplier: string; rateRupees: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPlaced(null);
      }}
    >
      <DialogTrigger render={<Button variant={suggested > 0 ? "default" : "outline"} size="sm" />}>Order</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {placed ? (
          <>
            <DialogHeader>
              <DialogTitle>✅ Order placed</DialogTitle>
              <DialogDescription>Use this tracking ID to follow the {material.name} until it reaches the store.</DialogDescription>
            </DialogHeader>
            <p className="rounded-xl bg-brand-soft p-4 text-center font-mono text-2xl font-bold tracking-wider text-brand select-all">{placed}</p>
            <div className="flex flex-wrap justify-between gap-2">
              <Link href={`/admin/stock/${placed}`} className={buttonVariants()}>Track this order</Link>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Order {material.name}</DialogTitle>
              <DialogDescription>
                {material.stock.toLocaleString("en-IN")} {material.unit} in stock now.
                {suggested > 0 && ` Recommended: ${suggested.toLocaleString("en-IN")} ${material.unit}.`}
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                startTransition(async () => {
                  const result = await placeStockOrder({
                    materialId: material.id,
                    quantity: Number(f.get("quantity") || 0),
                    supplier: String(f.get("supplier") ?? ""),
                    rateRupees: Number(f.get("rateRupees") || 0),
                    expectedOn: String(f.get("expectedOn") ?? ""),
                  });
                  if (result.ok) {
                    setPlaced(result.data?.trackingId ?? null);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <label className={field}>Quantity ({material.unit})<Input name="quantity" type="number" required min={0} step="any" defaultValue={suggested || undefined} /></label>
                <label className={field}>Rate per {material.unit} (₹, optional)<Input name="rateRupees" type="number" min={0} step="any" defaultValue={last?.rateRupees || undefined} /></label>
                <label className={`${field} col-span-2`}>Supplier<Input name="supplier" required maxLength={80} defaultValue={last?.supplier} placeholder="Who you are buying from" /></label>
                <label className={`${field} col-span-2`}>Delivery expected on<Input name="expectedOn" type="date" required min={today} defaultValue={defaultExpected} /></label>
              </div>
              <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Placing…" : "Place order"}</Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** On the tracking page: move the order to its next stage, add a note, or cancel it. */
export function StockOrderControls({ trackingId, nextAction }: { trackingId: string; nextAction: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const act = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        setNote("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    });

  return (
    <div className="grid gap-3">
      <label className={field}>
        Note (optional)
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Lorry TN 33 BC 1024, driver called from Salem" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => act(() => advanceStockOrder(trackingId, note))}>{nextAction}</Button>
        <Button type="button" variant="outline" disabled={pending || note.trim().length < 3} onClick={() => act(() => addStockOrderNote(trackingId, note))}>Add note only</Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          className="ml-auto"
          onClick={() => {
            if (window.confirm(`Cancel stock order ${trackingId}?`)) act(() => cancelStockOrder(trackingId, note));
          }}
        >
          Cancel order
        </Button>
      </div>
    </div>
  );
}
