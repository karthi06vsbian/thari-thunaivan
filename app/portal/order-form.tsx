"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MIN_ORDER_METERS } from "@/lib/stock";
import { cn } from "@/lib/utils";
import { placeOrder } from "./actions";
import { payForOrder } from "./pay";

const inr = (rupees: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const daysFromToday = (iso: string, today: string) =>
  Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);

type ConfirmMode = "prepaid" | "cash";
const STEPS = [
  { label: "Fabric", emoji: "🧵" },
  { label: "Size & qty", emoji: "📐" },
  { label: "Delivery", emoji: "📅" },
  { label: "Confirm", emoji: "✅" },
];

export interface FabricChoice {
  name: string;
  value: string;
  ratePerMeter: number;
  image: string;
  detail: string;
  /** Most the mill has material for right now; null when there is no limit. */
  maxMeters: number | null;
}

export function OrderForm({
  fabrics,
  today,
  minDate,
  defaults,
  advancePercent,
  visitSlots,
  onlinePayment,
  companyName,
}: {
  fabrics: FabricChoice[];
  today: string;
  minDate: string;
  defaults: { company: string; phone: string; address: string };
  advancePercent: number;
  visitSlots: string[];
  /** False until the Razorpay secret is configured on the server. */
  onlinePayment: boolean;
  companyName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [fabricType, setFabricType] = useState("");
  const [width, setWidth] = useState("");
  const [meters, setMeters] = useState("");
  const [deadline, setDeadline] = useState("");
  const [company, setCompany] = useState(defaults.company);
  const [phone, setPhone] = useState(defaults.phone);
  const [address, setAddress] = useState(defaults.address);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<ConfirmMode>(onlinePayment ? "prepaid" : "cash");
  const [visitDate, setVisitDate] = useState("");
  const [visitSlot, setVisitSlot] = useState("");

  const fabric = fabrics.find((f) => f.value === fabricType);
  const total = fabric && Number(meters) > 0 ? Number(meters) * fabric.ratePerMeter : null;
  const advance = total !== null ? Math.max(1, Math.round((total * advancePercent) / 100)) : null;
  const daysLeft = deadline ? daysFromToday(deadline, today) : null;

  /** What is still missing on a step, or "" when it is complete. */
  function problem(s: number): string {
    if (s === 0 && !fabric) return "Choose a fabric to continue.";
    if (s === 1) {
      if (!(Number(width) >= 20 && Number(width) <= 140)) return "Enter a width between 20 and 140 inches.";
      if (!(Number(meters) >= MIN_ORDER_METERS)) return `The minimum order is ${MIN_ORDER_METERS} meters.`;
      if (fabric && fabric.maxMeters !== null && Number(meters) > fabric.maxMeters) {
        return `We have material for up to ${fabric.maxMeters.toLocaleString("en-IN")} m of ${fabric.name} right now. Reduce the quantity or call us.`;
      }
    }
    if (s === 2) {
      if (!deadline || deadline < minDate) return "Choose the date you need the fabric by.";
      if (company.trim().length < 2) return "Enter your name or company.";
      if (!/^[0-9+ ()-]{7,20}$/.test(phone.trim())) return "Enter a valid WhatsApp number.";
      if (address.trim().length < 10) return "Enter the full delivery address.";
      if (mode === "cash") {
        if (!visitDate || visitDate < minDate) return "Choose a date for your mill visit.";
        if (visitDate >= deadline) return "The visit must be before the date you need the fabric.";
        if (!visitSlot) return "Choose a time for your mill visit.";
      }
    }
    return "";
  }

  function next() {
    const issue = problem(step);
    setError(issue);
    if (!issue) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    setError("");
    setResult(null);
    startTransition(async () => {
      try {
        const res = await placeOrder({
          company,
          phone,
          fabricType,
          widthInches: Number(width),
          meters: Number(meters),
          deadline,
          notes,
          deliveryAddress: address,
          confirmMode: mode,
          appointmentDate: visitDate,
          appointmentSlot: visitSlot,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        // Prepaid: the order exists now; the payment window confirms it.
        setResult(
          res.data?.checkout ? await payForOrder(res.data.checkout, companyName) : { ok: true, text: res.message ?? "Order sent." },
        );
        // Straight to the new order's tracking page.
        if (res.data?.orderId) router.push(`/portal/orders/${res.data.orderId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const review: { label: string; value: string; tint: string; strong?: boolean }[] = [
    { label: "Fabric", value: fabric ? `${fabric.name} · ${inr(fabric.ratePerMeter)}/m` : "", tint: "bg-violet-200/80" },
    { label: "Width", value: `${width}"`, tint: "bg-indigo-200/80" },
    { label: "Quantity", value: `${Number(meters).toLocaleString("en-IN")} m`, tint: "bg-sky-200/80" },
    { label: "Deadline", value: deadline ? longDate(deadline) : "", tint: "bg-amber-200", strong: true },
    { label: "Deliver to", value: address, tint: "bg-orange-200/80" },
    { label: "Contact", value: `${company} · ${phone}`, tint: "bg-rose-200/80" },
    {
      label: "Confirmation",
      value: mode === "prepaid" ? `Pay ${advance !== null ? inr(advance) : ""} advance online` : `Mill visit ${visitDate ? longDate(visitDate) : ""}, ${visitSlot}`,
      tint: "bg-fuchsia-200/80",
    },
  ];

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      {/* Progress */}
      <ol className="grid grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.label} className="relative grid justify-items-center gap-1 text-center">
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className={cn("absolute top-4 left-1/2 h-0.5 w-full bg-border transition-colors duration-500", i < step && "bg-brand")} />
            )}
            <span
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full border-2 text-sm transition-all duration-300",
                i < step && "border-brand bg-brand text-white",
                i === step && "scale-110 border-brand bg-white shadow-md ring-4 ring-brand/15",
                i > step && "border-border bg-white opacity-60",
              )}
            >
              {i < step ? <Check className="size-4" aria-hidden="true" /> : <span aria-hidden="true">{s.emoji}</span>}
            </span>
            <span className={cn("text-xs", i === step ? "font-semibold text-brand" : "text-muted-foreground")}>
              {s.label}
              {i === step && <span className="sr-only"> (current step)</span>}
            </span>
          </li>
        ))}
      </ol>

      <div key={step} className="rise grid gap-5">
        {step === 0 && (
          <>
            <h2 className="text-xl font-bold">Step 1: What fabric do you need?</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4" role="radiogroup" aria-label="Fabric">
              {fabrics.map((f) => {
                const picked = f.value === fabricType;
                const outOfStock = f.maxMeters !== null && f.maxMeters < MIN_ORDER_METERS;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    disabled={outOfStock}
                    onClick={() => {
                      setFabricType(f.value);
                      setError("");
                    }}
                    className={cn(
                      "lift group relative overflow-hidden rounded-2xl border-2 bg-card p-2 text-left",
                      picked ? "border-brand bg-brand-soft shadow-lg shadow-brand/20" : "border-border",
                      outOfStock && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="relative block aspect-[16/9] overflow-hidden rounded-xl">
                      <Image src={f.image} alt="" fill sizes="(min-width: 640px) 300px, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    </span>
                    {picked && (
                      <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-brand text-white shadow">
                        <Check className="size-4" aria-hidden="true" />
                      </span>
                    )}
                    <span className="block px-1 pt-2 pb-1">
                      <span className="block font-semibold">{f.name}</span>
                      <span className="block text-sm font-medium text-brand">{inr(f.ratePerMeter)}/m</span>
                      {outOfStock && <span className="mt-1 inline-block rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Out of stock</span>}
                      <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{f.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 1 && fabric && (
          <>
            <h2 className="text-xl font-bold">Step 2: Width and quantity</h2>
            <p className="inline-flex items-center gap-2 justify-self-start rounded-lg border bg-muted/50 px-3 py-1.5 text-sm">
              <span aria-hidden="true">🧵</span>
              <span className="font-medium">{fabric.name}</span> · {inr(fabric.ratePerMeter)}/m
              <button type="button" onClick={() => setStep(0)} className="text-brand underline-offset-4 hover:underline">[change]</button>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="widthInches">Width (inches)</Label>
                <Input id="widthInches" type="number" min={20} max={140} step="0.5" inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} className="h-11 text-lg" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meters">Quantity (meters)</Label>
                <Input id="meters" type="number" min={MIN_ORDER_METERS} max={fabric.maxMeters ?? undefined} step="1" inputMode="numeric" value={meters} onChange={(e) => setMeters(e.target.value)} className="h-11 text-lg" />
                {fabric.maxMeters !== null && (
                  <p className={cn("text-xs", Number(meters) > fabric.maxMeters ? "font-medium text-red-700" : "text-muted-foreground")}>
                    Up to {fabric.maxMeters.toLocaleString("en-IN")} m in stock now.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl" aria-live="polite">
              <div className="bg-brand-soft p-4">
                <p className="text-sm text-muted-foreground">Estimated value</p>
                <p className="text-2xl font-bold text-brand tabular-nums sm:text-3xl">{total !== null ? inr(total) : "—"}</p>
              </div>
              <div className="bg-teal-soft p-4">
                <p className="text-sm text-teal">Advance ({advancePercent}%)</p>
                <p className="text-2xl font-bold text-teal tabular-nums sm:text-3xl">{advance !== null ? inr(advance) : "—"}</p>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-bold">Step 3: Delivery &amp; contact</h2>
            <div className="grid gap-2">
              <Label htmlFor="deadline">Deadline — when do you need it?</Label>
              <Input id="deadline" type="date" min={minDate} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-11 text-lg" />
              {daysLeft !== null && daysLeft > 0 && (
                <span className="justify-self-start rounded-full bg-teal px-3 py-1 text-xs font-medium text-white">{daysLeft} days from today</span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="company">Name / company</Label>
                <Input id="company" maxLength={120} autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">WhatsApp number</Label>
                <Input id="phone" type="tel" maxLength={20} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deliveryAddress"><span aria-hidden="true">📍</span> Delivery address</Label>
              <Textarea id="deliveryAddress" rows={2} maxLength={300} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop / godown name, street, area, city and PIN code" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Anything else? (optional)</Label>
              <Textarea id="notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Quality, yarn count, packing…" />
            </div>

            <fieldset className="grid gap-3">
              <legend className="mb-2 text-sm font-medium">How would you like to confirm the order?</legend>
              <label className={cn("flex items-center justify-between gap-3 rounded-xl border-2 p-4 transition-colors", mode === "prepaid" ? "border-brand bg-brand text-white" : "border-border", onlinePayment ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                <span>
                  <span className="block font-semibold"><span aria-hidden="true">💳</span> Pay advance online</span>
                  <span className={cn("block text-sm", mode === "prepaid" ? "text-white/85" : "text-muted-foreground")}>
                    {onlinePayment ? `Pay ${advance !== null ? inr(advance) : `${advancePercent}%`} now and your order is confirmed at once.` : "Online payment is not available yet."}
                  </span>
                </span>
                <input type="radio" name="confirmMode" className="size-5 accent-white" checked={mode === "prepaid"} disabled={!onlinePayment} onChange={() => setMode("prepaid")} />
              </label>
              <label className={cn("grid cursor-pointer gap-3 rounded-xl border-2 p-4 transition-colors", mode === "cash" ? "border-teal bg-teal-soft" : "border-border")}>
                <span className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-semibold"><span aria-hidden="true">🤝</span> Book a mill visit</span>
                    <span className="block text-sm text-muted-foreground">Cash on confirmation. Your order is confirmed when you visit and pay.</span>
                  </span>
                  <input type="radio" name="confirmMode" className="size-5 accent-[var(--teal)]" checked={mode === "cash"} onChange={() => setMode("cash")} />
                </span>
                {mode === "cash" && (
                  <span className="rise grid gap-3 sm:grid-cols-2">
                    <span className="grid gap-1">
                      <Label htmlFor="visitDate" className="text-xs">Visit date (Mon–Sat)</Label>
                      <Input id="visitDate" type="date" min={minDate} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="bg-background" />
                    </span>
                    <span className="grid gap-1">
                      <Label htmlFor="visitSlot" className="text-xs">Time slot</Label>
                      <NativeSelect id="visitSlot" value={visitSlot} onChange={(e) => setVisitSlot(e.target.value)}>
                        <option value="" disabled>Choose a time…</option>
                        {visitSlots.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </NativeSelect>
                    </span>
                  </span>
                )}
              </label>
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-bold">Step 4: Review your order</h2>
            <dl className="overflow-hidden rounded-2xl">
              {review.map((r) => (
                <div key={r.label} className={cn("grid grid-cols-[7.5rem_1fr] gap-3 px-4 py-2.5 text-sm", r.tint, r.strong && "font-bold")}>
                  <dt>{r.label}:</dt>
                  <dd className="break-words">{r.value}</dd>
                </div>
              ))}
            </dl>
            {notes && <p className="text-sm text-muted-foreground">Notes: {notes}</p>}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="rounded-xl bg-brand-soft px-4 py-3">
                <p className="text-xs text-muted-foreground">{mode === "prepaid" ? `Advance to pay now (${advancePercent}%)` : "Estimated value"}</p>
                <p className="text-2xl font-bold text-brand tabular-nums">{mode === "prepaid" ? (advance !== null ? inr(advance) : "—") : total !== null ? inr(total) : "—"}</p>
                {mode === "prepaid" && total !== null && <p className="text-xs text-muted-foreground">of {inr(total)} estimated</p>}
              </div>
              <Button type="button" size="lg" disabled={pending} onClick={submit} className="btn-shine h-12 bg-emerald-600 px-6 text-base hover:bg-emerald-700">
                {pending ? "Please wait…" : mode === "prepaid" ? "Pay & place order" : "Place order"} <ArrowRight />
              </Button>
            </div>
          </>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      {result && <p role="status" className={`text-sm ${result.ok ? "text-emerald-700" : "text-destructive"}`}>{result.text}</p>}

      <div className="flex items-center justify-between border-t pt-4">
        {step > 0 ? (
          <Button type="button" variant="outline" size="lg" onClick={back} disabled={pending}><ArrowLeft /> Back</Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 && (
          <Button type="button" size="lg" onClick={next} className="btn-shine">Next <ArrowRight /></Button>
        )}
      </div>
    </div>
  );
}
