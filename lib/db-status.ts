"use server";

import { db } from "@/lib/firebase/admin";

export type DbStatus = "ok" | "quota" | "error";

/** Whether the database answers, for the error pages: tells a used-up daily allowance apart from other faults. */
export async function databaseStatus(): Promise<DbStatus> {
  try {
    await db().collection("settings").doc("shifts").get();
    return "ok";
  } catch (e) {
    const { code, message } = e as { code?: number | string; message?: string };
    // gRPC status 8 is RESOURCE_EXHAUSTED.
    return code === 8 || code === "resource-exhausted" || /quota/i.test(message ?? "") ? "quota" : "error";
  }
}
