/**
 * Adds a staff login to the real Firebase project in .env.local.
 *
 *   npm run create-user -- --email=you@example.com --name="Your Name" --role=owner [--phone=919876543210]
 *
 * No password is set here: the script prints a one-time link where the person
 * chooses their own password.
 */
import { adminAuth, db, projectId } from "@/lib/firebase/admin";
import type { StaffRole as Role } from "@/lib/types";

const ROLES: Role[] = ["owner", "manager", "production", "accounts"];

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("This script is for the real project. The emulators already have test users.");
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing from .env.local");
  }
  const email = arg("email");
  const name = arg("name");
  const role = arg("role") as Role | undefined;
  const phone = arg("phone") ?? null;
  if (!email || !name || !role || !ROLES.includes(role)) {
    throw new Error(`Usage: npm run create-user -- --email=... --name="..." --role=${ROLES.join("|")} [--phone=91...]`);
  }

  const auth = adminAuth();
  const existing = await auth.getUserByEmail(email).catch(() => null);
  const user = existing ?? (await auth.createUser({ email, displayName: name }));
  await db().collection("users").doc(user.uid).set({ email, name, role, phone });
  // The Admin SDK leaves apiKey empty, and the password page will not load without it.
  const link = (await auth.generatePasswordResetLink(email)).replace(
    "apiKey=&",
    `apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? ""}&`,
  );

  console.log(`${existing ? "Updated" : "Created"} ${email} as ${role} on ${projectId}.`);
  console.log("Open this link once to choose a password:");
  console.log(link);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
