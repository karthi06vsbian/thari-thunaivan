import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const projectId =
  process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "thari-thunaivan";

export function parseServiceAccountKey(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  let str = raw.trim();
  // Strip outer single or double quotes (e.g. from env files)
  if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
    str = str.slice(1, -1).trim();
  }
  // Support Base64 encoded service account key
  if (!str.startsWith("{")) {
    try {
      const decoded = Buffer.from(str, "base64").toString("utf-8").trim();
      if (decoded.startsWith("{")) str = decoded;
    } catch {
      // not base64
    }
  }
  const attempts = [
    str,
    str.replace(/\\n/g, "\n"),
    str.replace(/\\"/g, '"'),
  ];
  for (const candidate of attempts) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === "object") {
        if (typeof obj.private_key === "string" && obj.private_key.includes("\\n")) {
          obj.private_key = obj.private_key.replace(/\\n/g, "\n");
        }
        return obj as Record<string, unknown>;
      }
    } catch {
      // continue
    }
  }
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY parse error: could not parse JSON.");
  return undefined;
}

export function getCredentials(): Record<string, unknown> | undefined {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY ?? process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  return parseServiceAccountKey(rawKey);
}

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const creds = getCredentials();
  return initializeApp(creds ? { credential: cert(creds), projectId } : { projectId });
}


let firestore: Firestore | undefined;

export function db(): Firestore {
  if (!firestore) {
    firestore = getFirestore(app());
    try {
      // REST instead of gRPC: serverless functions start much faster without opening a gRPC
      // channel. The local emulator only accepts unauthenticated calls over gRPC, so it keeps that.
      firestore.settings({ ignoreUndefinedProperties: true, preferRest: !process.env.FIRESTORE_EMULATOR_HOST });
    } catch {
      // Settings were already applied by an earlier module instance (dev hot reload).
    }
  }
  return firestore;
}

export function adminAuth() {
  return getAuth(app());
}
