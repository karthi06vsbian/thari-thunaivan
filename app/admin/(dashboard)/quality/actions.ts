"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { getBatch } from "@/lib/data";
import { db } from "@/lib/firebase/admin";
import { bundleNoFor, getBundle, getBundlesForBatch, QC_LABEL } from "@/lib/quality";
import { qualityScore, scoreBand } from "@/lib/quality-score";
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

const qcSchema = z.object({
  bundleId: z.string().min(1),
  lengthMeters: z.number().positive("Enter the bundle length").max(100_000),
  widthInches: z.number().positive("Enter the bundle width").max(200),
  gsm: z.number().positive().max(2_000).nullable(),
  defects: z.number().int().min(0).max(10_000),
  grade: z.enum(["A", "B", "C"]),
  result: z.enum(["pass", "rework", "fail"]),
  remarks: z.string().trim().max(500),
});

/** Saves a bundle's quality check and tells the owner; the manager sees it on the dashboard. */
export async function saveQualityCheck(input: z.infer<typeof qcSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.quality);
    const parsed = qcSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const q = parsed.data;
    const bundle = await getBundle(q.bundleId);
    if (!bundle) throw new Error("Bundle not found");
    if (q.result !== "pass" && !q.remarks) throw new Error("Add a remark explaining the rework or failure");

    const recheck = bundle.status !== "pending";
    const score = qualityScore(q.lengthMeters, q.defects, q.grade);
    await db().collection("bundles").doc(bundle.id).update({
      status: q.result,
      lengthMeters: q.lengthMeters,
      widthInches: q.widthInches,
      gsm: q.gsm,
      defects: q.defects,
      grade: q.grade,
      qualityScore: score,
      remarks: q.remarks,
      checkedBy: user.name,
      checkedAt: new Date().toISOString(),
    });
    await writeAudit(
      user,
      recheck ? "quality-recheck" : "quality-check",
      "bundle",
      bundle.bundleNo,
      `${QC_LABEL[q.result]} · ${q.lengthMeters} m × ${q.widthInches}" · grade ${q.grade} · ${q.defects} defect(s) · score ${score}`,
    );
    await sendToOwners(
      [
        `*Quality check – ${bundle.bundleNo}* (${bundle.orderNo}, ${bundle.fabricType})`,
        `Result: ${QC_LABEL[q.result]} · Grade ${q.grade}`,
        `Quality score: ${score} / 100 (${scoreBand(score)})`,
        `Length ${q.lengthMeters} m · Width ${q.widthInches}"${q.gsm ? ` · ${q.gsm} GSM` : ""} · ${q.defects} defect(s)`,
        q.remarks && `Remarks: ${q.remarks}`,
        `Checked by ${user.name}`,
      ]
        .filter(Boolean)
        .join("\n"),
      "quality-check",
    );
    revalidatePath("/admin", "layout");
    return { message: `${bundle.bundleNo} saved as ${QC_LABEL[q.result]} with a quality score of ${score}. Owner and manager have been updated.` };
  });
}
