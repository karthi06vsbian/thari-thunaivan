"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitEnquiry } from "./actions";

export function EnquiryForm({ fabrics }: { fabrics: string[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const text = (key: string) => String(f.get(key) ?? "");
    startTransition(async () => {
      const res = await submitEnquiry({
        name: text("name"),
        phone: text("phone"),
        company: text("company"),
        fabric: text("fabric"),
        meters: text("meters") === "" ? null : Number(text("meters")),
        message: text("message"),
        website: text("website"),
      });
      if (res.ok) {
        formEl.reset();
        setResult({ ok: true, text: res.message ?? "Thank you." });
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required maxLength={80} autoComplete="name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone / WhatsApp number</Label>
          <Input id="phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" name="company" maxLength={120} autoComplete="organization" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fabric">Fabric</Label>
            <select
              id="fabric"
              name="fabric"
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Not sure yet</option>
              {fabrics.map((fabric) => (
                <option key={fabric}>{fabric}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="meters">Meters</Label>
            <Input id="meters" name="meters" type="number" min={0} step="1" inputMode="numeric" />
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="message">What do you need?</Label>
        <Textarea id="message" name="message" rows={4} maxLength={1000} placeholder="Width, quality, delivery date…" />
      </div>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Send enquiry"}
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
