"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { isIsoDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/firebase/admin";
import { rupeesToPaise } from "@/lib/money";
import { dailyElectricityCost } from "@/lib/planning/energy";
import { recomputeAll } from "@/lib/services/recompute";
import type { ElectricityReading, ElectricitySettings } from "@/lib/types";

const rupees = z.number().min(0).max(1_000_000);

const readingSchema = z.object({
  date: z.string().refine(isIsoDate, "Invalid date"),
  mainMeterStartKwh: z.number().min(0),
  mainMeterEndKwh: z.number().min(0),
  peakUnits: z.number().min(0).nullable(),
  offPeakUnits: z.number().min(0).nullable(),
  ratePerUnit: rupees,
  peakRate: rupees,
  offPeakRate: rupees,
  fixedCharges: rupees,
});

/** Rates arrive in rupees from the form and are stored as paise. */
export async function saveReading(input: z.infer<typeof readingSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.electricity);
    const r = readingSchema.parse(input);
    const today = todayIso();
    if (r.date > today) throw new Error("Readings cannot be entered for a future date");
    if (r.mainMeterEndKwh < r.mainMeterStartKwh) throw new Error("End reading is lower than the start reading");
    const hasSplit = r.peakUnits !== null || r.offPeakUnits !== null;
    const units = Math.round((r.mainMeterEndKwh - r.mainMeterStartKwh) * 100) / 100;
    if (hasSplit) {
      if (r.peakUnits === null || r.offPeakUnits === null) throw new Error("Enter both peak and off-peak units, or neither");
      if (Math.abs(r.peakUnits + r.offPeakUnits - units) > 0.5) {
        throw new Error(`Peak + off-peak units (${r.peakUnits + r.offPeakUnits}) must equal units consumed (${units})`);
      }
    }
    const paise = {
      ratePerUnitPaise: rupeesToPaise(r.ratePerUnit),
      peakRatePaise: rupeesToPaise(r.peakRate),
      offPeakRatePaise: rupeesToPaise(r.offPeakRate),
      fixedChargesPaise: rupeesToPaise(r.fixedCharges),
    };
    const cost = dailyElectricityCost({
      mainMeterStartKwh: r.mainMeterStartKwh,
      mainMeterEndKwh: r.mainMeterEndKwh,
      ...paise,
      peakUnits: hasSplit ? r.peakUnits! : undefined,
      offPeakUnits: hasSplit ? r.offPeakUnits! : undefined,
    });
    const reading: ElectricityReading = {
      date: r.date,
      mainMeterStartKwh: r.mainMeterStartKwh,
      mainMeterEndKwh: r.mainMeterEndKwh,
      unitsConsumed: cost.unitsConsumed,
      peakUnits: hasSplit ? r.peakUnits : null,
      offPeakUnits: hasSplit ? r.offPeakUnits : null,
      ...paise,
      totalCostPaise: cost.totalCostPaise,
      commonLoadUnits: 0,
      commonLoadCostPaise: 0,
      enteredBy: user.name,
    };
    await db().collection("electricityReadings").doc(r.date).set(reading);
    await recomputeAll(r.date, today);
    await writeAudit(user, "save-reading", "electricityReading", r.date, `${cost.unitsConsumed} kWh`);
    revalidatePath("/admin", "layout");
    return { message: `Reading saved: ${cost.unitsConsumed} kWh` };
  });
}

const rateSchema = z.object({
  ratePerUnit: rupees,
  peakRate: rupees,
  offPeakRate: rupees,
  fixedChargePerDay: rupees,
  peakHours: z.string().min(1).max(40),
  effectiveFrom: z.string().refine(isIsoDate, "Invalid date"),
});

export async function saveRateSettings(input: z.infer<typeof rateSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.electricity);
    const r = rateSchema.parse(input);
    const settings: ElectricitySettings = {
      ratePerUnitPaise: rupeesToPaise(r.ratePerUnit),
      peakRatePaise: rupeesToPaise(r.peakRate),
      offPeakRatePaise: rupeesToPaise(r.offPeakRate),
      fixedChargePerDayPaise: rupeesToPaise(r.fixedChargePerDay),
      peakHours: r.peakHours,
      effectiveFrom: r.effectiveFrom,
    };
    await db().collection("settings").doc("electricity").set(settings);
    await db().collection("electricityRateHistory").add({
      ...settings,
      changedAt: new Date().toISOString(),
      changedBy: user.name,
    });
    await writeAudit(user, "change-rate", "settings", "electricity", `₹${r.ratePerUnit}/unit from ${r.effectiveFrom}`);
    revalidatePath("/admin", "layout");
    return { message: "Rates updated. They apply to new readings; past days keep the rate they were entered with." };
  });
}
