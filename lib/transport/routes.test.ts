import { describe, expect, it } from "vitest";
import { positionAt, routeById, routeKm, tripProgress } from "./routes";

describe("transport routes", () => {
  const chennai = routeById("chennai")!;

  it("has plausible distances", () => {
    expect(routeKm(routeById("coimbatore")!)).toBeGreaterThan(80);
    expect(routeKm(routeById("coimbatore")!)).toBeLessThan(130);
    expect(routeKm(chennai)).toBeGreaterThan(330);
    expect(routeKm(chennai)).toBeLessThan(450);
  });

  it("starts at the mill and ends at the destination", () => {
    const start = positionAt(chennai, 0);
    const end = positionAt(chennai, 1);
    expect(start.lastPlace).toBe("Mill, Erode");
    expect(start.kmDone).toBe(0);
    expect(end.lat).toBeCloseTo(13.0827, 3);
    expect(end.nextPlace).toBe("Chennai");
  });

  it("reports the towns behind and ahead part-way through", () => {
    const mid = positionAt(chennai, 0.5);
    expect(mid.kmDone).toBeCloseTo(mid.kmTotal / 2, 5);
    expect(mid.lastPlace).not.toBe(mid.nextPlace);
    expect(mid.lng).toBeGreaterThan(78.1);
    expect(mid.lng).toBeLessThan(79.7);
  });

  it("estimates progress from time since dispatch", () => {
    const dispatchedAt = "2026-10-10T00:00:00.000Z";
    const t0 = new Date(dispatchedAt).getTime();
    expect(tripProgress({ dispatchedAt }, chennai, t0 + 4.5 * 3_600_000)).toBeCloseTo(0.5, 5);
    expect(tripProgress({ dispatchedAt }, chennai, t0 + 20 * 3_600_000)).toBe(1);
    // sample trips loop
    expect(tripProgress({ dispatchedAt, demoCycleSeconds: 200 }, chennai, t0 + 250_000)).toBeCloseTo(0.25, 5);
  });
});
