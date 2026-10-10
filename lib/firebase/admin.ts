import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const projectId =
  process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-textileflow";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  // With the emulators (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST) no credentials are needed.
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  return initializeApp(key ? { credential: cert(JSON.parse(key)), projectId } : { projectId });
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
