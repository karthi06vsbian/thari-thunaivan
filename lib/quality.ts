import { db } from "@/lib/firebase/admin";
import type { Bundle, QcResult } from "@/lib/types";

export const QC_LABEL: Record<Bundle["status"], string> = {
  pending: "Waiting for check",
  pass: "Passed",
  rework: "Rework",
  fail: "Failed",
};

export const QC_RESULTS: QcResult[] = ["pass", "rework", "fail"];

export async function getBundle(id: string): Promise<Bundle | null> {
  const snap = await db().collection("bundles").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Bundle) : null;
}

export async function getBundlesForBatch(batchId: string): Promise<Bundle[]> {
  const snap = await db().collection("bundles").where("batchId", "==", batchId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Bundle)
    .sort((a, b) => a.bundleNo.localeCompare(b.bundleNo));
}

export async function getRecentBundles(limit = 200): Promise<Bundle[]> {
  const snap = await db().collection("bundles").orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bundle);
}

/** Latest completed checks, newest first, for the owner. */
export async function getRecentChecks(limit = 6): Promise<Bundle[]> {
  const snap = await db().collection("bundles").orderBy("checkedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bundle).filter((b) => b.checkedAt);
}

/** Bundle numbers look like B-2003-001: the batch number plus a running count. */
export function bundleNoFor(batchNo: string, sequence: number): string {
  return `${batchNo}-${String(sequence).padStart(3, "0")}`;
}
