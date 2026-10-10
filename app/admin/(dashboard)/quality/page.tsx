import Link from "next/link";
import { Kpi, PageHeader } from "@/components/kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getBatches } from "@/lib/data";
import { formatNumber } from "@/lib/money";
import { getRecentBundles, QC_LABEL } from "@/lib/quality";
import type { Bundle } from "@/lib/types";
import { CreateBundles, ScanBundle } from "./quality-tools";

// Status colour is always shown next to the status word.
const STATUS_DOT: Record<Bundle["status"], string> = {
  pending: "bg-zinc-400",
  pass: "bg-emerald-600",
  rework: "bg-amber-500",
  fail: "bg-red-600",
};

export default async function QualityPage() {
  await requireRole(ACCESS.quality);
  const [bundles, batches] = await Promise.all([getRecentBundles(), getBatches()]);
  const count = (s: Bundle["status"]) => bundles.filter((b) => b.status === s).length;
  const scored = bundles.filter((b) => typeof b.qualityScore === "number");
  const avgScore = scored.length ? Math.round(scored.reduce((sum, b) => sum + b.qualityScore!, 0) / scored.length) : null;
  const checkedMeters = bundles.reduce((sum, b) => sum + (b.status === "pass" ? (b.lengthMeters ?? 0) : 0), 0);
  // Bundles are made from batches that are running or finished.
  const producing = batches.filter((b) => b.status === "in_progress" || b.status === "completed");

  return (
    <>
      <PageHeader title="Quality check" description="Scan a bundle's QR label, enter its length, width and test results, and save." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Waiting for check" value={String(count("pending"))} />
        <Kpi label="Passed" value={String(count("pass"))} hint={`${formatNumber(Math.round(checkedMeters))} m approved`} />
        <Kpi label="Rework / failed" value={`${count("rework")} / ${count("fail")}`} />
        <Kpi label="Average quality score" value={avgScore === null ? "—" : `${avgScore} / 100`} hint={`${scored.length} bundle(s) checked`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Check a bundle</CardTitle>
            <CardDescription>
              Point the camera at the QR code on the bundle. A phone&apos;s own camera app also works: it opens the bundle&apos;s page directly.
            </CardDescription>
          </CardHeader>
          <CardContent><ScanBundle /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New bundles after production</CardTitle>
            <CardDescription>Creates a QR label for each bundle of a batch, ready to print and stick on.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateBundles batches={producing.map((b) => ({ id: b.id, label: `${b.batchNo} · ${b.orderNo} · ${b.fabricType}` }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Bundles</CardTitle></CardHeader>
        <CardContent>
          {bundles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bundles yet. Create QR labels for a batch to start.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Fabric</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Length (m)</TableHead>
                  <TableHead className="text-right">Width (in)</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Defects</TableHead>
                  <TableHead>Checked by</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      <Link className="underline-offset-4 hover:underline" href={`/admin/quality/${b.id}`}>{b.bundleNo}</Link>
                    </TableCell>
                    <TableCell>{b.orderNo}</TableCell>
                    <TableCell className="capitalize">{b.fabricType}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${STATUS_DOT[b.status]}`} />
                        {QC_LABEL[b.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.lengthMeters ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.widthInches ?? "—"}</TableCell>
                    <TableCell>{b.grade ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{b.qualityScore ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.defects ?? "—"}</TableCell>
                    <TableCell>{b.checkedBy ?? "—"}</TableCell>
                    <TableCell>
                      <Link className="text-sm underline" href={`/admin/quality/labels/${b.batchId}`}>Labels</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
