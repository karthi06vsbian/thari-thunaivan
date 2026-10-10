import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getBatch } from "@/lib/data";
import { getBundle, QC_LABEL } from "@/lib/quality";
import { QcForm } from "./qc-form";

/** The page a bundle's QR code opens. */
export default async function BundlePage({ params }: { params: Promise<{ bundleId: string }> }) {
  await requireRole(ACCESS.quality);
  const { bundleId } = await params;
  const bundle = await getBundle(bundleId.toUpperCase());
  if (!bundle) notFound();
  // The ordered width is the standard the measured width is checked against.
  const batch = await getBatch(bundle.batchId);

  return (
    <>
      <PageHeader title={`Bundle ${bundle.bundleNo}`} description={`${bundle.orderNo} · ${bundle.fabricType} · batch ${bundle.batchId}`}>
        <Link href="/admin/quality" className="text-sm underline">← All bundles</Link>
      </PageHeader>
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Quality check</CardTitle>
          <CardDescription>
            {bundle.checkedAt
              ? `${QC_LABEL[bundle.status]} · last checked by ${bundle.checkedBy} on ${new Date(bundle.checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}. Saving again replaces it.`
              : "Not checked yet. Tick each check and enter its value in the three inspections; the percentage is worked out for you."}
          </CardDescription>
        </CardHeader>
        <CardContent><QcForm bundle={bundle} orderWidthInches={batch?.widthInches ?? bundle.widthInches ?? 0} /></CardContent>
      </Card>
    </>
  );
}
