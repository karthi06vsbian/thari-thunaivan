import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { PageHeader } from "@/components/kpi";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getBundlesForBatch, QC_LABEL } from "@/lib/quality";
import { SITE } from "@/lib/site";
import { PrintButton } from "../../quality-tools";

/** Printable QR labels for every bundle of a batch. */
export default async function LabelsPage({ params }: { params: Promise<{ batchId: string }> }) {
  await requireRole(ACCESS.quality);
  const { batchId } = await params;
  const bundles = await getBundlesForBatch(batchId);

  // Each code holds the address of the bundle's check page on this site.
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const labels = await Promise.all(
    bundles.map(async (b) => ({
      bundle: b,
      svg: await QRCode.toString(`${origin}/admin/quality/${b.id}`, { type: "svg", margin: 1, width: 160 }),
    })),
  );

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={`QR labels – ${batchId}`} description="Print, cut and stick one label on each bundle.">
          <div className="flex items-center gap-3">
            <Link href="/admin/quality" className="text-sm underline">← Quality check</Link>
            <PrintButton />
          </div>
        </PageHeader>
        {origin.includes("localhost") && (
          <p className="mt-4 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
            These codes point at <span className="font-medium">{origin}</span>, which only this computer can open. Print labels from the
            live site so phones on the floor can scan them.
          </p>
        )}
      </div>
      {labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bundles for this batch yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-3">
          {labels.map(({ bundle, svg }) => (
            <div key={bundle.id} className="grid break-inside-avoid justify-items-center gap-1 rounded-xl border bg-white p-3 text-center text-black">
              <p className="text-xs font-semibold">{SITE.name}</p>
              <div className="size-40" dangerouslySetInnerHTML={{ __html: svg }} />
              <p className="text-base font-bold tracking-wide">{bundle.bundleNo}</p>
              <p className="text-xs capitalize">{bundle.orderNo} · {bundle.fabricType}</p>
              <p className="text-[11px] text-zinc-600 print:hidden">{QC_LABEL[bundle.status]}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
