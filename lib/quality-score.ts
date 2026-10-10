const GRADE_PENALTY = { A: 0, B: 10, C: 25 } as const;
const POINTS_PER_DEFECT_PER_100M = 5;

/**
 * Quality score out of 100 for a bundle: starts at 100, loses 5 points for every defect
 * per 100 meters, and loses 10 points for grade B or 25 for grade C.
 */
export function qualityScore(lengthMeters: number, defects: number, grade: keyof typeof GRADE_PENALTY): number {
  if (!(lengthMeters > 0)) return 0;
  const defectsPer100m = (defects / lengthMeters) * 100;
  const score = 100 - defectsPer100m * POINTS_PER_DEFECT_PER_100M - GRADE_PENALTY[grade];
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreBand(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  return score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : "Poor";
}
