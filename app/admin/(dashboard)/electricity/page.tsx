import { Kpi, PageHeader } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCESS, requireRole } from "@/lib/auth/session";
import {
  getDailyStatsSince,
  getElectricitySettings,
  getMachines,
  getRateHistory,
  getReading,
  getReadingsSince,
} from "@/lib/data";
import { addDays, formatDate, isIsoDate, todayIso } from "@/lib/dates";
import { formatINR, formatNumber } from "@/lib/money";
import { ElectricityCharts, type DayPoint } from "./charts";
import { RateForm, ReadingForm } from "./forms";

const INEFFICIENT_ABOVE_MEDIAN = 1.25;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export default async function ElectricityPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireRole(ACCESS.electricity);
  const params = await searchParams;
  const today = todayIso();
  const date = isIsoDate(params.date) && params.date <= today ? params.date : today;
  // Far enough back to cover the two previous calendar months for the bill comparison.
  const monthsFrom = `${addDays(`${today.slice(0, 7)}-01`, -40).slice(0, 7)}-01`;

  const [stats, readings, reading, previous, settings, history, machines] = await Promise.all([
    getDailyStatsSince(addDays(today, -29)),
    getReadingsSince(monthsFrom),
    getReading(date),
    getReading(addDays(date, -1)),
    getElectricitySettings(),
    getRateHistory(),
    getMachines(),
  ]);
  const day = stats.find((s) => s.date === date) ?? null;

  const days: DayPoint[] = stats.map((s) => ({
    date: s.date,
    label: formatDate(s.date),
    units: s.units,
    costRupees: s.costPaise / 100,
    costPerMeter: s.outputMeters > 0 ? s.costPerMeterPaise / 100 : null,
    peak: s.peakUnits,
    offPeak: s.offPeakUnits,
  }));

  const measured = machines.filter((m) => m.active && (m.energyPerMeter30d ?? 0) > 0);
  const mid = median(measured.map((m) => m.energyPerMeter30d!));
  const top = [...measured]
    .sort((a, b) => b.energyPerMeter30d! - a.energyPerMeter30d!)
    .slice(0, 10)
    .map((m) => ({
      machineNo: m.machineNo,
      energyPerMeter: m.energyPerMeter30d!,
      flagged: m.energyPerMeter30d! > mid * INEFFICIENT_ABOVE_MEDIAN,
    }));

  const months = new Map<string, { days: number; units: number; peak: number; offPeak: number; fixed: number; total: number; common: number }>();
  for (const r of readings) {
    const key = r.date.slice(0, 7);
    const m = months.get(key) ?? { days: 0, units: 0, peak: 0, offPeak: 0, fixed: 0, total: 0, common: 0 };
    m.days += 1;
    m.units += r.unitsConsumed;
    m.peak += r.peakUnits ?? 0;
    m.offPeak += r.offPeakUnits ?? 0;
    m.fixed += r.fixedChargesPaise;
    m.total += r.totalCostPaise;
    m.common += r.commonLoadUnits;
    months.set(key, m);
  }

  return (
    <>
      <PageHeader title="⚡ Electricity" description="Daily meter readings, rates and what the power costs per meter of fabric.">
        <form className="flex items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Date
            <Input type="date" name="date" defaultValue={date} max={today} className="w-40" />
          </label>
          <Button type="submit" variant="outline">Show</Button>
        </form>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label={date === today ? "Units today" : `Units on ${formatDate(date)}`}
          value={day ? `${formatNumber(day.units)} kWh` : "—"}
          hint={day?.estimated ? "Estimated from machine hours – no meter reading yet" : reading ? `Common load ${formatNumber(reading.commonLoadUnits)} kWh` : undefined}
        />
        <Kpi label="Cost" value={day ? formatINR(day.costPaise, { whole: true }) : "—"} hint={reading ? `incl. ${formatINR(reading.fixedChargesPaise, { whole: true })} fixed` : undefined} />
        <Kpi
          label="Machines used"
          value={day ? `${day.machinesRunning} / ${day.totalMachines} running` : "—"}
          hint={day ? `${day.totalMachines - day.machinesRunning} idle` : "No production logs"}
        />
        <Kpi label="Utilization" value={day ? `${day.utilizationPercent}%` : "—"} />
        <Kpi
          label="Power cost per meter"
          value={day && day.outputMeters > 0 ? formatINR(day.costPerMeterPaise) : "—"}
          hint={day ? `${formatNumber(Math.round(day.outputMeters))} m produced` : undefined}
        />
      </div>

      <ElectricityCharts days={days} machines={top} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Meter reading for {formatDate(date, true)}</CardTitle>
            <CardDescription>
              {reading ? `Entered by ${reading.enteredBy}. Saving again replaces it.` : "No reading entered for this day yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReadingForm
              defaults={{
                date,
                start: reading?.mainMeterStartKwh ?? previous?.mainMeterEndKwh ?? "",
                end: reading?.mainMeterEndKwh ?? "",
                peakUnits: reading?.peakUnits ?? "",
                offPeakUnits: reading?.offPeakUnits ?? "",
                ratePerUnit: (reading?.ratePerUnitPaise ?? settings.ratePerUnitPaise) / 100,
                peakRate: (reading?.peakRatePaise ?? settings.peakRatePaise) / 100,
                offPeakRate: (reading?.offPeakRatePaise ?? settings.offPeakRatePaise) / 100,
                fixedCharges: (reading?.fixedChargesPaise ?? settings.fixedChargePerDayPaise) / 100,
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rate settings</CardTitle>
            <CardDescription>Defaults for new readings. Each day&apos;s rate can still be edited on its reading.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RateForm
              defaults={{
                ratePerUnit: settings.ratePerUnitPaise / 100,
                peakRate: settings.peakRatePaise / 100,
                offPeakRate: settings.offPeakRatePaise / 100,
                fixedChargePerDay: settings.fixedChargePerDayPaise / 100,
                peakHours: settings.peakHours,
                effectiveFrom: settings.effectiveFrom,
              }}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective from</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Peak</TableHead>
                  <TableHead className="text-right">Off-peak</TableHead>
                  <TableHead>Changed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{formatDate(h.effectiveFrom, true)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(h.ratePerUnitPaise)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(h.peakRatePaise)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(h.offPeakRatePaise)}</TableCell>
                    <TableCell>{h.changedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly summary</CardTitle>
          <CardDescription>Totals from the daily readings, to check against the electricity bill.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Days entered</TableHead>
                <TableHead className="text-right">Units (kWh)</TableHead>
                <TableHead className="text-right">Peak</TableHead>
                <TableHead className="text-right">Off-peak</TableHead>
                <TableHead className="text-right">Common load</TableHead>
                <TableHead className="text-right">Fixed charges</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
                <TableHead className="text-right">Avg ₹ / unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, m]) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">
                    {new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.days}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.units))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.peak))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.offPeak))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Math.round(m.common))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(m.fixed, { whole: true })}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(m.total, { whole: true })}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.units > 0 ? formatINR(m.total / m.units) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
