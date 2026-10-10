import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { todayIso } from "@/lib/dates";
import { sendAtRiskAlert } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

/** Runs every 4 hours. Sends a WhatsApp alert if any order is projected to miss its deadline. */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const count = await sendAtRiskAlert(todayIso());
  return NextResponse.json({ alertsSent: count });
}
