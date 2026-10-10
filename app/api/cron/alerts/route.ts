import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { todayIso } from "@/lib/dates";
import { sendNewAlerts } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ sent: await sendNewAlerts(todayIso()) });
}
