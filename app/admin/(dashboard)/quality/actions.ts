"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { getBatch } from "@/lib/data";
import { db } from "@/lib/firebase/admin";
import { bundleNoFor, getBundle, getBundlesForBatch, QC_LABEL } from "@/lib/quality";
import { MIN_PASS_PERCENT, QC_SECTIONS, qualityPercentages, scoreBand } from "@/lib/quality-checks";
import type { Bundle } from "@/lib/types";
import { sendToOwners } from "@/lib/whatsapp/send";

/** Creates QR-labelled bundles for a batch, continuing its numbering. */
export async function createBundles(batchId: string, count: number) {
  return run(async () => {
    const user = await assertRole(ACCESS.quality);
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error("Enter between 1 and 50 bundles");
    const batch = await getBatch(batchId);
    if (!batch) throw new Error("Batch not found");
    const existing = await getBundlesForBatch(batch.id);
    const start = existing.reduce((max, b) => Math.max(max, Number(b.bundleNo.split("-").pop()) || 0), 0);

    const write = db().batch();
    for (let i = 1; i <= count; i++) {
      const bundleNo = bundleNoFor(batch.batchNo, start + i);
      const bundle: Omit<Bundle, "id"> = {
        bundleNo, batchId: batch.id, orderNo: batch.orderNo, fabricType: batch.fabricType,
        createdAt: new Date().toISOString(), createdBy: user.name, status: "pending",
        lengthMeters: null, widthInches: null, gsm: null, defects: null, grade: null, qualityScore: null,
        remarks: "", checkedBy: null, checkedAt: null,
      };
      write.set(db().collection("bundles").doc(bundleNo), bundle);
    }
    await write.commit();
    await writeAudit(user, "create-bundles", "batch", batch.batchNo, `${count} bundle label(s)`);
    revalidatePath("/admin/quality");
    return { message: `${count} bundle label(s) created for ${batch.batchNo}` };
  });
}

const checkKeys = new Set(QC_SECTIONS.flatMap((s) => s.checks.map((c) => c.key)));

const qcSchema = z.object({
  bundleId: z.string().min(1),
  lengthMeters: z.number().positive("Enter the bundle length").max(100_000),
  /** One entry per check: the measured value (if any) and whether it passed. */
  checks: z.record(z.string(), z.object({ value: z.number().min(0).max(1_000_000).nullable(), pass: z.boolean() })),
  grade: z.enum(["A", "B", "C"]),
  result: z.enum(["pass", "rework", "fail"]),
  remarks: z.string().trim().max(500),
});

/** Saves a bundle's quality check and tells the owner, who also sees it on the dashboard. */
export async function saveQualityCheck(input: z.infer<typeof qcSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.quality);
    const parsed = qcSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const q = parsed.data;
    const bundle = await getBundle(q.bundleId);
    if (!bundle) throw new Error("Bundle not found");
    if (q.result !== "pass" && !q.remarks) throw new Error("Add a remark explaining the rework or failure");

    // Only known checks are kept, and the percentages are worked out here, never taken from the browser.
    const checks = Object.fromEntries(Object.entries(q.checks).filter(([key]) => checkKeys.has(key)));
    const width = checks.fab_width?.value ?? null;
    if (width === null || width <= 0) throw new Error("Enter the measured width in the fabric checks");
    const pct = qualityPercentages(checks);
    if (q.result === "pass" && pct.overall < MIN_PASS_PERCENT) {
      throw new Error(`Quality is ${pct.overall}%. A bundle needs ${MIN_PASS_PERCENT}% or more to pass, so choose Rework or Fail.`);
    }

    const recheck = bundle.status !== "pending";
    await db().collection("bundles").doc(bundle.id).update({
      status: q.result,
      lengthMeters: q.lengthMeters,
      widthInches: width,
      gsm: checks.fab_gsm?.value ?? null,
      defects: checks.fab_defects?.value ?? 0,
      grade: q.grade,
      checks,
      sectionPercent: { raw: pct.raw, yarn: pct.yarn, fabric: pct.fabric },
      qualityScore: pct.overall,
      remarks: q.remarks,
      checkedBy: user.name,
      checkedAt: new Date().toISOString(),
    });
    await writeAudit(
      user,
      recheck ? "quality-recheck" : "quality-check",
      "bundle",
      bundle.bundleNo,
      `${QC_LABEL[q.result]} · quality ${pct.overall}% (raw ${pct.raw}%, yarn ${pct.yarn}%, fabric ${pct.fabric}%) · grade ${q.grade}`,
    );
    await sendToOwners(
      [
        `*Quality check – ${bundle.bundleNo}* (${bundle.orderNo}, ${bundle.fabricType})`,
        `Result: ${QC_LABEL[q.result]} · Grade ${q.grade}`,
        `Quality: ${pct.overall}% (${scoreBand(pct.overall)})`,
        `• Raw material ${pct.raw}%  • Yarn ${pct.yarn}%  • Fabric ${pct.fabric}%`,
        `Length ${q.lengthMeters} m · Width ${width}"`,
        q.remarks && `Remarks: ${q.remarks}`,
        `Checked by ${user.name}`,
      ]
        .filter(Boolean)
        .join("\n"),
      "quality-check",
    );
    revalidatePath("/admin", "layout");
    return { message: `${bundle.bundleNo} saved as ${QC_LABEL[q.result]} with ${pct.overall}% quality. The owner has been updated.` };
  });
}
