import type { StaffRole } from "@/lib/types";

/**
 * Demo staff logins. The sign-in page fills these in with one click, and the local seed
 * (npm run dev:local) creates them, so the same IDs work on the local database.
 */
export const DEMO_PASSWORD = "password123";

export const DEMO_LOGINS: Partial<Record<StaffRole, string>> = {
  owner: "owner@tharithunaivan.com",
  production: "staff@tharithunaivan.com",
  accounts: "accounts@tharithunaivan.com",
};
