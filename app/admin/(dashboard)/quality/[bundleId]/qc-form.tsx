"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { qualityScore, scoreBand } from "@/lib/quality-score";
import type { Bundle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveQualityCheck } from "../actions";

const RESULTS = [
  { value: "pass", label: "Pass – good to dispatch" },
  { value: "rework", label: "Rework – fix and check again" },
  { value: "fail", label: "Fail – reject" },
] as const;

export function QcForm({ bundle }: { bundle: Bundle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Tracked only to show the score as the values are typed; the server works it out again on save.
  const [length, setLength] = useState(String(bundle.lengthMeters ?? ""));
  const [defects, setDefects] = useState(String(bundle.defects ?? 0));
  const [grade, setGrade] = useState<"A" | "B" | "C">(bundle.grade ?? "A");
  const score = Number(length) > 0 ? qualityScore(Number(length), Number(defects) || 0, grade) : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const num = (key: string) => Number(f.get(key));
    startTransition(async () => {
      const result = await saveQualityCheck({
        bundleId: bundle.id,
        lengthMeters: num("lengthMeters"),
        widthInches: num("widthInches"),
        gsm: f.get("gsm") === "" ? null : num("gsm"),
        defects: num("defects"),
        grade: String(f.get("grade")) as "A" | "B" | "C",
        result: String(f.get("result")) as "pass" | "rework" | "fail",
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
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="lengthMeters">Bundle length (meters)</Label>
          <Input id="lengthMeters" name="lengthMeters" type="number" required min={0.1} step="0.1" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="widthInches">Bundle width / breadth (inches)</Label>
          <Input id="widthInches" name="widthInches" type="number" required min={1} step="0.1" inputMode="decimal" defaultValue={bundle.widthInches ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gsm">Weight – GSM (optional)</Label>
          <Input id="gsm" name="gsm" type="number" min={1} step="0.1" inputMode="decimal" defaultValue={bundle.gsm ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defects">Defects found</Label>
          <Input id="defects" name="defects" type="number" required min={0} step="1" inputMode="numeric" value={defects} onChange={(e) => setDefects(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="grade">Grade</Label>
          <NativeSelect id="grade" name="grade" required value={grade} onChange={(e) => setGrade(e.target.value as "A" | "B" | "C")}>
            <option value="A">A – first quality</option>
            <option value="B">B – minor defects</option>
            <option value="C">C – seconds</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="result">Test result</Label>
          <NativeSelect id="result" name="result" required defaultValue={bundle.status === "pending" ? "pass" : bundle.status}>
            {RESULTS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/40 p-4" aria-live="polite">
        <div
          className={cn(
            "grid size-20 shrink-0 place-items-center rounded-full border-4 text-2xl font-bold tabular-nums",
            score === null
              ? "border-border text-muted-foreground"
              : score >= 90
                ? "border-emerald-600 text-emerald-700"
                : score >= 75
                  ? "border-teal text-teal"
                  : score >= 60
                    ? "border-amber-500 text-amber-700"
                    : "border-red-600 text-red-700",
          )}
        >
          {score ?? "—"}
        </div>
        <div className="text-sm">
          <p className="font-semibold">Quality score{score !== null && `: ${score} / 100 · ${scoreBand(score)}`}</p>
          <p className="text-muted-foreground">
            Worked out automatically: 100, minus 5 points for each defect per 100 m, minus 10 for grade B or 25 for grade C.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="remarks">Remarks (needed for rework or fail)</Label>
        <Textarea id="remarks" name="remarks" rows={3} maxLength={500} defaultValue={bundle.remarks} placeholder="Weave faults, stains, shade variation, selvedge…" />
      </div>
      <Button type="submit" size="lg" className="btn-shine justify-self-start" disabled={pending}>
        {pending ? "Saving…" : "Save quality check"}
      </Button>
    </form>
  );
}
