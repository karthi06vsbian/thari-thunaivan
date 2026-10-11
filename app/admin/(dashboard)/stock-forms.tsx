"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STOCK_FABRICS } from "@/lib/stock";
import type { Material } from "@/lib/types";
import { removeMaterial, saveMaterial } from "./stock-actions";

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
