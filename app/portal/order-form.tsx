"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { placeOrder } from "./actions";
import { payForOrder } from "./pay";

const inr = (rupees: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);

type ConfirmMode = "prepaid" | "cash";

export function OrderForm({
  fabrics,
  minDate,
  defaults,
  advancePercent,
  visitSlots,
  onlinePayment,
  companyName,
}: {
  fabrics: { name: string; value: string; ratePerMeter: number }[];
  minDate: string;
  defaults: { company: string; phone: string };
  advancePercent: number;
  visitSlots: string[];
  /** False until the Razorpay secret is configured on the server. */
  onlinePayment: boolean;
  companyName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [fabricType, setFabricType] = useState("");
  const [meters, setMeters] = useState("");
  const [mode, setMode] = useState<ConfirmMode>(onlinePayment ? "prepaid" : "cash");

  const fabric = fabrics.find((f) => f.value === fabricType);
  const total = fabric && Number(meters) > 0 ? Number(meters) * fabric.ratePerMeter : null;
  const advance = total !== null ? Math.max(1, Math.round((total * advancePercent) / 100)) : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const text = (key: string) => String(f.get(key) ?? "");
    setResult(null);
    startTransition(async () => {
      try {
        const res = await placeOrder({
          company: text("company"),
          phone: text("phone"),
          fabricType,
          widthInches: Number(text("widthInches")),
          meters: Number(meters),
          deadline: text("deadline"),
          notes: text("notes"),
          confirmMode: mode,
          appointmentDate: text("appointmentDate"),
          appointmentSlot: text("appointmentSlot"),
        });
        if (!res.ok) {
          setResult({ ok: false, text: res.error });
          return;
        }
        formEl.reset();
        setFabricType("");
        setMeters("");
        // Prepaid: the order exists now; the payment window confirms it.
        setResult(
          res.data?.checkout
            ? await payForOrder(res.data.checkout, companyName)
            : { ok: true, text: res.message ?? "Order sent." },
        );
        router.refresh();
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "Something went wrong" });
        router.refresh();
      }
    });
  }

  const options: { id: ConfirmMode; title: string; text: string; disabled?: boolean }[] = [
    {
      id: "prepaid",
      title: "Prepaid – pay advance online",
      text: onlinePayment
        ? `Pay ${advancePercent}% now by UPI, card or net banking. Your order is confirmed immediately.`
        : "Online payment is not available yet.",
      disabled: !onlinePayment,
    },
    {
      id: "cash",
      title: "Cash on confirmation – book a visit",
      text: "Book an appointment at the mill. Your order is confirmed when you visit and pay.",
    },
  ];

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="company">Name / company</Label>
          <Input id="company" name="company" required maxLength={120} defaultValue={defaults.company} autoComplete="organization" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone / WhatsApp number</Label>
          <Input id="phone" name="phone" type="tel" required maxLength={20} defaultValue={defaults.phone} autoComplete="tel" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fabricType">Fabric</Label>
          <NativeSelect id="fabricType" name="fabricType" required value={fabricType} onChange={(e) => setFabricType(e.target.value)}>
            <option value="" disabled>Choose a fabric…</option>
            {fabrics.map((f) => (
              <option key={f.value} value={f.value}>
                {f.name} – {inr(f.ratePerMeter)} / m
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="widthInches">Width (inches)</Label>
          <Input id="widthInches" name="widthInches" type="number" required min={20} max={140} step="0.5" inputMode="decimal" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="meters">Quantity (meters)</Label>
          <Input id="meters" name="meters" type="number" required min={100} step="1" inputMode="numeric" value={meters} onChange={(e) => setMeters(e.target.value)} />
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

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">How would you like to confirm the order?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <label
              key={o.id}
              className={cn(
                "lift flex cursor-pointer gap-3 rounded-xl border p-4 text-sm",
                mode === o.id && "border-brand bg-brand-soft ring-1 ring-brand",
                o.disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="confirmMode"
                value={o.id}
                checked={mode === o.id}
                disabled={o.disabled}
                onChange={() => setMode(o.id)}
                className="mt-1 size-4 accent-[var(--brand)]"
              />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="mt-1 block text-muted-foreground">{o.text}</span>
              </span>
            </label>
          ))}
        </div>

        {mode === "cash" && (
          <div className="rise grid gap-4 rounded-xl border border-teal/30 bg-teal-soft p-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="appointmentDate">Visit date</Label>
              <Input id="appointmentDate" name="appointmentDate" type="date" required min={minDate} className="bg-background" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appointmentSlot">Visit time</Label>
              <NativeSelect id="appointmentSlot" name="appointmentSlot" required defaultValue="">
                <option value="" disabled>Choose a time…</option>
                {visitSlots.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">The mill is open Monday to Saturday.</p>
          </div>
        )}
      </fieldset>

      {total !== null && advance !== null && (
        <dl className="rise grid gap-1 rounded-xl border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estimated order value ({fabric!.name}, {Number(meters).toLocaleString("en-IN")} m)</dt>
            <dd className="font-medium tabular-nums">{inr(total)}</dd>
          </div>
          {mode === "prepaid" ? (
            <div className="flex justify-between">
              <dt className="font-semibold">Advance to pay now ({advancePercent}%)</dt>
              <dd className="font-bold text-brand tabular-nums">{inr(advance)}</dd>
            </div>
          ) : (
            <p className="text-muted-foreground">Nothing to pay now. The final price is confirmed at your visit.</p>
          )}
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" className="btn-shine" disabled={pending}>
          {pending ? "Please wait…" : mode === "prepaid" ? (advance !== null ? `Pay ${inr(advance)} & confirm order` : "Pay advance & confirm order") : "Book visit & place order"}
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
