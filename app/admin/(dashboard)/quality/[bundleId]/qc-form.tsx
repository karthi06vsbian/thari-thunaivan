"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MIN_PASS_PERCENT,
  meetsStandard,
  QC_SECTIONS,
  qualityPercentages,
  scoreBand,
  standardText,
  type CheckDef,
  type CheckEntries,
} from "@/lib/quality-checks";
import type { Bundle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveQualityCheck } from "../actions";

const RESULTS = [
  { value: "pass", label: "Pass – good to dispatch" },
  { value: "rework", label: "Rework – fix and check again" },
  { value: "fail", label: "Fail – reject" },
] as const;

const ALL_CHECKS = QC_SECTIONS.flatMap((s) => s.checks);
const tone = (p: number) =>
  p >= 90 ? "border-emerald-600 text-emerald-700" : p >= 75 ? "border-teal text-teal" : p >= 60 ? "border-amber-500 text-amber-700" : "border-red-600 text-red-700";
const bar = (p: number) => (p >= 90 ? "bg-emerald-600" : p >= 75 ? "bg-teal" : p >= 60 ? "bg-amber-500" : "bg-red-600");

interface Row {
  value: string;
  pass: boolean;
}

export function QcForm({ bundle, orderWidthInches }: { bundle: Bundle; orderWidthInches: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [length, setLength] = useState(String(bundle.lengthMeters ?? ""));
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      ALL_CHECKS.map((c) => {
        const saved = bundle.checks?.[c.key];
        // Bundles checked before the three inspections existed still carry their width, defects and GSM.
        const legacy = c.key === "fab_width" ? bundle.widthInches : c.key === "fab_defects" ? bundle.defects : c.key === "fab_gsm" ? bundle.gsm : null;
        const value = saved?.value ?? legacy ?? null;
        return [c.key, { value: value === null ? "" : String(value), pass: saved?.pass ?? false }];
      }),
    ),
  );

  const ctx = { orderWidthInches, lengthMeters: Number(length) || 0 };
  const entries: CheckEntries = Object.fromEntries(
    Object.entries(rows).map(([key, r]) => [key, { value: r.value === "" ? null : Number(r.value), pass: r.pass }]),
  );
  const pct = qualityPercentages(entries);
  const canPass = pct.overall >= MIN_PASS_PERCENT;
  // "Pass" is only offered at or above the minimum; below it the choice falls back to Rework.
  const [chosen, setChosen] = useState<"pass" | "rework" | "fail">(bundle.status === "pending" ? "pass" : bundle.status);
  const finalResult = chosen === "pass" && !canPass ? "rework" : chosen;

  /** Typing a value ticks or unticks the check by its standard; checks without one are ticked by hand. */
  function setValue(def: CheckDef, value: string) {
    setRows((current) => {
      const verdict = meetsStandard(def, value === "" ? null : Number(value), ctx);
      return { ...current, [def.key]: { value, pass: verdict ?? current[def.key]!.pass } };
    });
  }

  /** The defect allowance depends on the length, so checks with a value are judged again when it changes. */
  function changeLength(value: string) {
    setLength(value);
    const next = { orderWidthInches, lengthMeters: Number(value) || 0 };
    setRows((current) =>
      Object.fromEntries(
        ALL_CHECKS.map((def) => {
          const row = current[def.key]!;
          const verdict = row.value === "" ? null : meetsStandard(def, Number(row.value), next);
          return [def.key, { ...row, pass: verdict ?? row.pass }];
        }),
      ),
    );
  }

  const togglePass = (key: string) => setRows((current) => ({ ...current, [key]: { ...current[key]!, pass: !current[key]!.pass } }));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (Object.values(rows).some((r) => r.value !== "" && !Number.isFinite(Number(r.value)))) {
      toast.error("Values must be numbers");
      return;
    }
    startTransition(async () => {
      const result = await saveQualityCheck({
        bundleId: bundle.id,
        lengthMeters: Number(length),
        checks: entries,
        grade: String(f.get("grade")) as "A" | "B" | "C",
        result: finalResult,
        remarks: String(f.get("remarks") ?? ""),
      });
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        router.push("/admin/quality");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {/* Overall result, always in view while filling in the checks */}
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-md" aria-live="polite">
        <div className={cn("grid size-20 shrink-0 place-items-center rounded-full border-4 text-2xl font-bold tabular-nums", tone(pct.overall))}>
          {pct.overall}%
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Overall quality: {pct.overall}% · {scoreBand(pct.overall)}</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {QC_SECTIONS.map((s) => (
              <div key={s.key} className="text-xs">
                <div className="flex justify-between">
                  <span><span aria-hidden="true">{s.emoji} </span>{s.title.replace(/ (inspection|quality checks)$/, "")}</span>
                  <span className="font-semibold tabular-nums">{pct[s.key]}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-[width] duration-300", bar(pct[s.key]))} style={{ width: `${pct[s.key]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="lengthMeters">Bundle length (meters)</Label>
        <Input id="lengthMeters" type="number" required min={0.1} step="0.1" inputMode="decimal" value={length} onChange={(e) => changeLength(e.target.value)} />
      </div>

      {QC_SECTIONS.map((section, index) => {
        const passed = section.checks.filter((c) => rows[c.key]!.pass).length;
        return (
          <fieldset key={section.key} className="overflow-hidden rounded-2xl border">
            <legend className="sr-only">{section.title}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-soft px-4 py-3">
              <p className="font-semibold text-brand">
                <span aria-hidden="true">{section.emoji} </span>
                {index + 1}. {section.title}
              </p>
              <p className="text-sm">
                {passed} of {section.checks.length} passed ·{" "}
                <span className={cn("rounded-full border-2 px-2 py-0.5 font-bold tabular-nums", tone(pct[section.key]))}>{pct[section.key]}%</span>
              </p>
            </div>
            <ul className="divide-y">
              {section.checks.map((def) => {
                const row = rows[def.key]!;
                const auto = !!def.limits;
                return (
                  <li key={def.key} className={cn("grid grid-cols-[auto_1fr_7rem] items-center gap-3 px-4 py-2.5", row.pass && "bg-emerald-50/60")}>
                    <input
                      type="checkbox"
                      id={`pass_${def.key}`}
                      checked={row.pass}
                      onChange={() => togglePass(def.key)}
                      aria-label={`${def.label} passed`}
                      className="size-5 accent-emerald-600"
                    />
                    <label htmlFor={`pass_${def.key}`} className="min-w-0 cursor-pointer text-sm">
                      <span className="font-medium">{def.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        Standard: {standardText(def, ctx)}
                        {!auto && " – tick if acceptable"}
                      </span>
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`${def.label} value${def.unit ? ` in ${def.unit}` : ""}`}
                        placeholder={def.unit || "value"}
                        value={row.value}
                        onChange={(e) => setValue(def, e.target.value)}
                        className={cn("pr-7 text-right tabular-nums", row.value !== "" && auto && (row.pass ? "border-emerald-500" : "border-red-400"))}
                      />
                      {row.value !== "" && auto && (
                        <span aria-hidden="true" className={cn("absolute top-1/2 right-2 -translate-y-1/2 text-sm font-bold", row.pass ? "text-emerald-600" : "text-red-600")}>
                          {row.pass ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="grade">Grade</Label>
          <NativeSelect id="grade" name="grade" required defaultValue={bundle.grade ?? "A"}>
            <option value="A">A – first quality</option>
            <option value="B">B – minor defects</option>
            <option value="C">C – seconds</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="result">Final result</Label>
          <NativeSelect id="result" name="result" required value={finalResult} onChange={(e) => setChosen(e.target.value as "pass" | "rework" | "fail")}>
            {RESULTS.map((r) => (
              <option key={r.value} value={r.value} disabled={r.value === "pass" && !canPass}>{r.label}</option>
            ))}
          </NativeSelect>
          {!canPass && (
            <p className="text-xs text-amber-700">
              Quality is {pct.overall}%. A bundle needs {MIN_PASS_PERCENT}% or more to pass.
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="remarks">Remarks (needed for rework or fail)</Label>
        <Textarea id="remarks" name="remarks" rows={3} maxLength={500} defaultValue={bundle.remarks} placeholder="Weave faults, stains, shade variation, selvedge…" />
      </div>
      <Button type="submit" size="lg" className="btn-shine justify-self-start" disabled={pending}>
        {pending ? "Saving…" : `Save quality check (${pct.overall}%)`}
      </Button>
    </form>
  );
}
