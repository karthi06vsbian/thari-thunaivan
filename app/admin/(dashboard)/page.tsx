import Link from "next/link";
import { Kpi, PageHeader } from "@/components/kpi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCESS, requireRole } from "@/lib/auth/session";
import { getAuditLogs, getBatches, getDailyStats, getMachines } from "@/lib/data";
import { formatDate, todayIso } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { db } from "@/lib/firebase/admin";
import { getRecentChecks, QC_LABEL } from "@/lib/quality";
import { buildAlerts, countStatuses } from "@/lib/reports";

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  company: string;
  fabric: string;
  meters: number | null;
  message: string;
  at: string;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireRole(ACCESS.overview);
  const { denied } = await searchParams;
  const today = todayIso();
  const [machines, stats, batches, alerts, audit] = await Promise.all([
    getMachines(),
    getDailyStats(today),
    getBatches(),
    buildAlerts(today),
    getAuditLogs(8),
  ]);
  const counts = countStatuses(machines);
  // Customer contact details: owner and manager only.
  // Owner and manager see every quality check as soon as it is saved.
  const qualityChecks = ACCESS.planning.includes(user.role) ? await getRecentChecks() : null;
  const enquiries = ACCESS.planning.includes(user.role)
    ? (await db().collection("enquiries").orderBy("at", "desc").limit(5).get()).docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Enquiry,
      )
    : null;
  const activeBatches = batches.filter((b) => b.status === "in_progress" || b.status === "planned");

  return (
    <>
      <PageHeader title="Overview" description={`${formatDate(today, true)} · signed in as ${user.name}`} />
      {denied && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          Your role does not have access to that page.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Machines running today"
          value={stats ? `${stats.machinesRunning} / ${stats.totalMachines}` : `${counts.running} / ${counts.total}`}
          hint={`Now: ${counts.running} running, ${counts.idle} idle, ${counts.maintenance} maintenance, ${counts.breakdown} breakdown`}
        />
        <Kpi
          label="Utilization"
          value={stats ? `${stats.utilizationPercent}%` : "—"}
          hint={stats ? `${formatNumber(Math.round(stats.outputMeters))} m produced today` : "No logs entered today"}
        />
        <Kpi
          label="Today's electricity cost"
          value={stats ? formatINR(stats.costPaise, { whole: true }) : "—"}
          hint={
            stats
              ? `${formatNumber(stats.units)} kWh · ${formatINR(stats.costPerMeterPaise)} per meter${stats.estimated ? " · estimated" : ""}`
              : "No reading or logs yet"
          }
        />
        <Kpi label="Batches in production" value={String(activeBatches.length)} hint={`${batches.filter((b) => b.status === "pending").length} waiting for a plan`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing needs attention.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {alerts.map((a) => (
                  <li key={a} className="rounded-lg border px-3 py-2">{a}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-x-4">
                    <span>
                      <span className="font-medium">{a.actorName}</span> · {a.action} {a.entity} {a.entityId}
                      {a.details && <span className="text-muted-foreground"> — {a.details}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {qualityChecks && (
        <Card>
          <CardHeader><CardTitle>Latest quality checks</CardTitle></CardHeader>
          <CardContent>
            {qualityChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bundles have been checked yet.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {qualityChecks.map((b) => (
                  <li key={b.id} className="flex flex-wrap justify-between gap-x-4 rounded-lg border px-3 py-2">
                    <span>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/quality/${b.id}`}>{b.bundleNo}</Link>
                      {" · "}{QC_LABEL[b.status]}{typeof b.qualityScore === "number" && ` · score ${b.qualityScore}`} · grade {b.grade} · {b.lengthMeters} m × {b.widthInches}&quot; · {b.defects} defect(s)
                      {b.remarks && <span className="text-muted-foreground"> — {b.remarks}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {b.checkedBy} ·{" "}
                      {new Date(b.checkedAt!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      {enquiries && (
        <Card>
          <CardHeader><CardTitle>Website enquiries</CardTitle></CardHeader>
          <CardContent>
            {enquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No enquiries from the website yet.</p>
            ) : (
              <ul className="grid gap-3 text-sm">
                {enquiries.map((e) => (
                  <li key={e.id} className="rounded-lg border px-3 py-2">
                    <p>
                      <span className="font-medium">{e.name}</span>
                      {e.company && ` · ${e.company}`} · <a className="underline" href={`tel:${e.phone}`}>{e.phone}</a>
                      {e.fabric && ` · ${e.fabric}`}
                      {e.meters ? ` · ${formatNumber(e.meters)} m` : ""}
                    </p>
                    {e.message && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{e.message}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(e.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      {ACCESS.planning.includes(user.role) && (
        <p className="text-sm text-muted-foreground">
          Need to schedule an order? Go to <Link className="underline" href="/admin/planning">Planning</Link>.
        </p>
      )}
    </>
  );
}
