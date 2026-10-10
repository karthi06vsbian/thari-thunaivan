import type { NextRequest } from "next/server";

/** Cron routes require "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends this itself). */
export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}
