import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { todayIso } from "@/lib/dates";
import { sendDailySummary } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

/** Scheduled for 8 PM IST (see vercel.json). */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ recipients: await sendDailySummary(todayIso()) });
}
