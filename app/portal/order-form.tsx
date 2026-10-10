"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { placeOrder } from "./actions";

export function OrderForm({
  fabrics,
  minDate,
  defaults,
}: {
  fabrics: { name: string; value: string }[];
  minDate: string;
  defaults: { company: string; phone: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const text = (key: string) => String(f.get(key) ?? "");
    startTransition(async () => {
      const res = await placeOrder({
        company: text("company"),
        phone: text("phone"),
        fabricType: text("fabricType"),
        widthInches: Number(text("widthInches")),
        meters: Number(text("meters")),
        deadline: text("deadline"),
        notes: text("notes"),
      });
      if (res.ok) {
        formEl.reset();
        setResult({ ok: true, text: res.message ?? "Order sent." });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="company">Name or company</Label>
          <Input id="company" name="company" required maxLength={120} defaultValue={defaults.company} autoComplete="organization" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone / WhatsApp number</Label>
          <Input id="phone" name="phone" type="tel" required maxLength={20} defaultValue={defaults.phone} autoComplete="tel" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fabricType">Fabric</Label>
          <NativeSelect id="fabricType" name="fabricType" required defaultValue="">
            <option value="" disabled>Choose a fabric…</option>
            {fabrics.map((f) => (
              <option key={f.value} value={f.value}>{f.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="widthInches">Width (inches)</Label>
          <Input id="widthInches" name="widthInches" type="number" required min={20} max={140} step="0.5" inputMode="decimal" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="meters">Quantity (meters)</Label>
          <Input id="meters" name="meters" type="number" required min={100} step="1" inputMode="numeric" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="deadline">Needed by</Label>
          <Input id="deadline" name="deadline" type="date" required min={minDate} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Anything else? (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} maxLength={1000} placeholder="Quality, yarn count, packing, delivery place…" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Place order"}
        </Button>
        {result && (
          <p role="status" className={`text-sm ${result.ok ? "text-emerald-700" : "text-destructive"}`}>
            {result.text}
          </p>
        )}
      </div>
    </form>
  );
}
