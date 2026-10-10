"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Categorical slots 1 and 2 of the chart palette (validated together for colour-blind safety).
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const GRID = "#e7e6e1";
const INK_MUTED = "#6b6a66";

const axis = { stroke: GRID, tick: { fill: INK_MUTED, fontSize: 11 }, tickLine: false } as const;
const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: `1px solid ${GRID}`, fontSize: 12, color: "#0b0b0b" },
  itemStyle: { color: "#0b0b0b" },
  cursor: { fill: "rgba(0,0,0,0.04)" },
} as const;

const whole = (n: number) => Math.round(n).toLocaleString("en-IN");

export interface DayPoint {
  date: string;
  label: string;
  units: number;
  costRupees: number;
  costPerMeter: number | null;
  peak: number | null;
  offPeak: number | null;
}

function Frame({ title, note, children }: { title: string; note?: string; children: React.ReactElement }) {
  return (
    <figure className="grid gap-2 rounded-xl border bg-card p-4">
      <figcaption>
        <p className="text-sm font-medium">{title}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </figcaption>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ElectricityCharts({
  days,
  machines,
}: {
  days: DayPoint[];
  machines: { machineNo: string; energyPerMeter: number; flagged: boolean }[];
}) {
  const withProduction = days.filter((d) => d.costPerMeter !== null);
  const withSplit = days.filter((d) => d.peak !== null);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Frame title="Daily units (kWh), last 30 days">
        <BarChart data={days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axis} axisLine={false} width={44} tickFormatter={whole} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${whole(Number(v))} kWh`, "Units"]} />
          <Bar isAnimationActive={false} dataKey="units" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </Frame>
      <Frame title="Daily electricity cost (₹), last 30 days">
        <BarChart data={days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axis} axisLine={false} width={52} tickFormatter={whole} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`₹${whole(Number(v))}`, "Cost"]} />
          <Bar isAnimationActive={false} dataKey="costRupees" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </Frame>
      <Frame title="Power cost per meter produced (₹)" note="Production days only.">
        <LineChart data={withProduction} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axis} axisLine={false} width={44} domain={[0, "auto"]} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`₹${Number(v).toFixed(2)}`, "Per meter"]} />
          <Line isAnimationActive={false} dataKey="costPerMeter" stroke={SERIES_1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </Frame>
      <Frame title="Peak vs off-peak units" note="Days where the split was entered.">
        <BarChart data={withSplit} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axis} axisLine={false} width={44} tickFormatter={whole} />
          <Tooltip {...tooltipStyle} formatter={(v, name) => [`${whole(Number(v))} kWh`, name]} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => <span style={{ color: "#0b0b0b" }}>{value}</span>}
          />
          <Bar isAnimationActive={false} dataKey="offPeak" name="Off-peak" stackId="u" fill={SERIES_1} stroke="#fff" strokeWidth={1} maxBarSize={18} />
          <Bar isAnimationActive={false} dataKey="peak" name="Peak" stackId="u" fill={SERIES_2} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </Frame>
      <div className="xl:col-span-2">
        <Frame
          title="Top 10 machines by energy per meter (kWh/m, last 30 days)"
          note="⚠ marks machines using over 25% more energy per meter than the mill median."
        >
          <BarChart data={machines} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" {...axis} axisLine={false} />
            <YAxis
              type="category"
              dataKey="machineNo"
              {...axis}
              width={64}
              interval={0}
              tickFormatter={(v: string) => (machines.find((m) => m.machineNo === v)?.flagged ? `⚠ ${v}` : v)}
            />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v).toFixed(3)} kWh/m`, "Energy per meter"]} />
            <Bar isAnimationActive={false}
              dataKey="energyPerMeter"
              fill={SERIES_1}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              label={{ position: "right", fill: "#0b0b0b", fontSize: 11, formatter: (v: unknown) => Number(v).toFixed(2) }}
            />
          </BarChart>
        </Frame>
      </div>
    </div>
  );
}
