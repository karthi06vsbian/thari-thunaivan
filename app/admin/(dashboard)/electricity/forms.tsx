"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRateSettings, saveReading } from "./actions";

function Field({
  label,
  name,
  defaultValue,
  type = "number",
  required = true,
  step = "0.01",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? step : undefined}
      />
    </label>
  );
}

function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submit = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  return { pending, submit };
}

const num = (form: FormData, key: string) => Number(form.get(key));
const optional = (form: FormData, key: string) => (form.get(key) === "" ? null : Number(form.get(key)));

export interface ReadingDefaults {
  date: string;
  start: number | "";
  end: number | "";
  peakUnits: number | "";
  offPeakUnits: number | "";
  ratePerUnit: number;
  peakRate: number;
  offPeakRate: number;
  fixedCharges: number;
}

export function ReadingForm({ defaults }: { defaults: ReadingDefaults }) {
  const { pending, submit } = useSubmit();
  return (
    <form
      key={defaults.date}
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit(() =>
          saveReading({
            date: defaults.date,
            mainMeterStartKwh: num(f, "start"),
            mainMeterEndKwh: num(f, "end"),
            peakUnits: optional(f, "peakUnits"),
            offPeakUnits: optional(f, "offPeakUnits"),
            ratePerUnit: num(f, "ratePerUnit"),
            peakRate: num(f, "peakRate"),
            offPeakRate: num(f, "offPeakRate"),
            fixedCharges: num(f, "fixedCharges"),
          }),
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Main meter start (kWh)" name="start" defaultValue={defaults.start} />
        <Field label="Main meter end (kWh)" name="end" defaultValue={defaults.end} />
        <Field label="Peak units (optional)" name="peakUnits" defaultValue={defaults.peakUnits} required={false} />
        <Field label="Off-peak units (optional)" name="offPeakUnits" defaultValue={defaults.offPeakUnits} required={false} />
        <Field label="Rate per unit (₹)" name="ratePerUnit" defaultValue={defaults.ratePerUnit} />
        <Field label="Fixed charges for the day (₹)" name="fixedCharges" defaultValue={defaults.fixedCharges} />
        <Field label="Peak rate (₹)" name="peakRate" defaultValue={defaults.peakRate} />
        <Field label="Off-peak rate (₹)" name="offPeakRate" defaultValue={defaults.offPeakRate} />
      </div>
      <p className="text-xs text-muted-foreground">
        With peak and off-peak units the cost uses those two rates; without them it uses the flat rate.
      </p>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : "Save reading"}
      </Button>
    </form>
  );
}

export interface RateDefaults {
  ratePerUnit: number;
  peakRate: number;
  offPeakRate: number;
  fixedChargePerDay: number;
  peakHours: string;
  effectiveFrom: string;
}

export function RateForm({ defaults }: { defaults: RateDefaults }) {
  const { pending, submit } = useSubmit();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit(() =>
          saveRateSettings({
            ratePerUnit: num(f, "ratePerUnit"),
            peakRate: num(f, "peakRate"),
            offPeakRate: num(f, "offPeakRate"),
            fixedChargePerDay: num(f, "fixedChargePerDay"),
            peakHours: String(f.get("peakHours")),
            effectiveFrom: String(f.get("effectiveFrom")),
          }),
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rate per unit (₹)" name="ratePerUnit" defaultValue={defaults.ratePerUnit} />
        <Field label="Fixed charge per day (₹)" name="fixedChargePerDay" defaultValue={defaults.fixedChargePerDay} />
        <Field label="Peak rate (₹)" name="peakRate" defaultValue={defaults.peakRate} />
        <Field label="Off-peak rate (₹)" name="offPeakRate" defaultValue={defaults.offPeakRate} />
        <Field label="Peak hours" name="peakHours" type="text" defaultValue={defaults.peakHours} />
        <Field label="Effective from" name="effectiveFrom" type="date" defaultValue={defaults.effectiveFrom} />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : "Update rates"}
      </Button>
    </form>
  );
}
