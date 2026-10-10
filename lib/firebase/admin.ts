import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const projectId =
  process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "thari-thunaivan";

function parseServiceAccountKey(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  let str = raw.trim();
  // Strip outer single or double quotes (e.g. from env files)
  if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
    str = str.slice(1, -1).trim();
  }
  try {
    return JSON.parse(str);
  } catch {
    try {
      return JSON.parse(str.replace(/\\n/g, "\n"));
    } catch (err) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY parse error:", err);
      return undefined;
    }
  }
}

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const parsedKey = parseServiceAccountKey(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  return initializeApp(parsedKey ? { credential: cert(parsedKey), projectId } : { projectId });
}

let firestore: Firestore | undefined;

export function db(): Firestore {
  if (!firestore) {
    firestore = getFirestore(app());
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Settings were already applied by an earlier module instance (dev hot reload).
    }
  }
  return firestore;
}

export function adminAuth() {
  return getAuth(app());
}
