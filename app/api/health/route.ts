import { NextResponse } from "next/server";
import { parseServiceAccountKey } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  let parsed = false;
  let parseError = "";
  let projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "missing";

  if (saKey) {
    try {
      const obj = parseServiceAccountKey(saKey);
      if (obj && obj.project_id) {
        parsed = true;
        projectId = String(obj.project_id);
      } else {
        parseError = "parseServiceAccountKey returned undefined";
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    status: "ok",
    node_env: process.env.NODE_ENV,
    checks: {
      has_FIREBASE_SERVICE_ACCOUNT_KEY: !!saKey,
      sa_key_length: saKey ? saKey.length : 0,
      sa_parsed_successfully: parsed,
      parse_error: parseError || null,
      project_id: projectId,
      has_WHATSAPP_TOKEN: !!process.env.WHATSAPP_TOKEN,
      has_WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      has_NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      has_NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    },
  });
}
