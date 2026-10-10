/**
 * The three inspections done on every bundle: raw material, yarn and fabric.
 * Each has a list of checks; a check has a measured value and a pass tick, and the
 * quality percentage is simply the share of checks that passed.
 *
 * The limits are common textile norms used as defaults. Change them here to match
 * the mill's own standards.
 */
export type SectionKey = "raw" | "yarn" | "fabric";

export interface CheckContext {
  /** Width the customer ordered, in inches. */
  orderWidthInches: number;
  /** Measured bundle length in meters. */
  lengthMeters: number;
}

export interface CheckDef {
  key: string;
  label: string;
  unit: string;
  /** Acceptable range for the value. Without one, the inspector decides and ticks by hand. */
  limits?: (ctx: CheckContext) => { min?: number; max?: number };
}

export interface SectionDef {
  key: SectionKey;
  title: string;
  emoji: string;
  checks: CheckDef[];
}

const between = (min?: number, max?: number) => () => ({ min, max });

export const QC_SECTIONS: SectionDef[] = [
  {
    key: "raw",
    title: "Raw material inspection",
    emoji: "🌱",
    checks: [
      { key: "raw_moisture", label: "Moisture content", unit: "%", limits: between(undefined, 8.5) },
      { key: "raw_trash", label: "Trash content", unit: "%", limits: between(undefined, 4) },
      { key: "raw_staple", label: "Staple length", unit: "mm", limits: between(28) },
      { key: "raw_micronaire", label: "Micronaire (fineness)", unit: "", limits: between(3.5, 4.9) },
      { key: "raw_strength", label: "Fibre strength", unit: "g/tex", limits: between(28) },
    ],
  },
  {
    key: "yarn",
    title: "Yarn quality checks",
    emoji: "🧵",
    checks: [
      { key: "yarn_count_cv", label: "Count variation (CV)", unit: "%", limits: between(undefined, 2) },
      { key: "yarn_csp", label: "Strength (CSP)", unit: "", limits: between(2200) },
      { key: "yarn_uneven", label: "Unevenness (U)", unit: "%", limits: between(undefined, 10) },
      { key: "yarn_tpi", label: "Twist per inch", unit: "TPI", limits: between(16, 26) },
      { key: "yarn_hairiness", label: "Hairiness index", unit: "", limits: between(undefined, 5) },
    ],
  },
  {
    key: "fabric",
    title: "Fabric quality checks",
    emoji: "🧶",
    checks: [
      {
        key: "fab_width",
        label: "Width",
        unit: "in",
        // Within one inch of the width that was ordered.
        limits: (ctx) => ({ min: ctx.orderWidthInches - 1, max: ctx.orderWidthInches + 1 }),
      },
      {
        key: "fab_defects",
        label: "Defects found",
        unit: "",
        // Up to two defects per 100 m of cloth.
        limits: (ctx) => ({ max: Math.max(1, Math.floor((ctx.lengthMeters / 100) * 2)) }),
      },
      { key: "fab_gsm", label: "Weight (GSM)", unit: "g/m²" },
      { key: "fab_epi", label: "Ends per inch (EPI)", unit: "" },
      { key: "fab_ppi", label: "Picks per inch (PPI)", unit: "" },
      { key: "fab_shrinkage", label: "Shrinkage", unit: "%", limits: between(undefined, 3) },
      { key: "fab_fastness", label: "Colour fastness grade (1–5)", unit: "", limits: between(4, 5) },
    ],
  },
];

export interface CheckEntry {
  value: number | null;
  pass: boolean;
}
export type CheckEntries = Record<string, CheckEntry>;

/** "≤ 8.5 %", "28 mm or more", "3.5 – 4.9", or "Judged by inspector". */
export function standardText(def: CheckDef, ctx: CheckContext): string {
  const { min, max } = def.limits?.(ctx) ?? {};
  const unit = def.unit ? ` ${def.unit}` : "";
  if (min !== undefined && max !== undefined) return `${min} – ${max}${unit}`;
  if (max !== undefined) return `${max}${unit} or less`;
  if (min !== undefined) return `${min}${unit} or more`;
  return "Judged by inspector";
}

/** Whether a value meets the standard; null when there is no numeric standard to compare with. */
export function meetsStandard(def: CheckDef, value: number | null, ctx: CheckContext): boolean | null {
  if (!def.limits) return null;
  if (value === null || !Number.isFinite(value)) return false;
  const { min, max } = def.limits(ctx);
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

export interface QualityPercentages {
  raw: number;
  yarn: number;
  fabric: number;
  /** Share of all checks, across the three inspections, that passed. */
  overall: number;
}

const percent = (passed: number, total: number) => (total > 0 ? Math.round((passed / total) * 100) : 0);

/** Quality percentages from the ticks. A check that was not done counts as not passed. */
export function qualityPercentages(entries: CheckEntries): QualityPercentages {
  const passed = (s: SectionDef) => s.checks.filter((c) => entries[c.key]?.pass).length;
  const bySection = Object.fromEntries(QC_SECTIONS.map((s) => [s.key, percent(passed(s), s.checks.length)])) as Record<SectionKey, number>;
  const totalChecks = QC_SECTIONS.reduce((sum, s) => sum + s.checks.length, 0);
  const totalPassed = QC_SECTIONS.reduce((sum, s) => sum + passed(s), 0);
  return { ...bySection, overall: percent(totalPassed, totalChecks) };
}

/** A bundle needs at least this overall percentage to be passed for dispatch. */
export const MIN_PASS_PERCENT = 75;

export function scoreBand(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  return score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : "Poor";
}
