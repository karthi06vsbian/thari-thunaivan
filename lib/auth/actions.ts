"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, db } from "@/lib/firebase/admin";
import { getSessionUser, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";
import type { Role, StaffRole } from "@/lib/types";

type SessionResult = { ok: true; home: string } | { ok: false; error: string };

/**
 * `displayName` is only used when a brand-new client registers with email and password.
 * `expectedRole` comes from the admin login, where the person picks Owner, Manager or
 * Supervisor: the ID must really hold that role or no session is started.
 */
export async function createSession(
  idToken: string,
  displayName?: string,
  expectedRole?: StaffRole,
): Promise<SessionResult> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const ref = db().collection("users").doc(decoded.uid);
    const snap = await ref.get();
    let role = snap.exists ? (snap.data()!.role as Role) : null;

    if (expectedRole && role !== expectedRole) {
      return { ok: false, error: "This ID does not have that access. Pick the icon that matches your account and try again." };
    }

    if (!role) {
      // Anyone who registers or signs in for the first time becomes a client. Staff roles
      // are only ever granted by "npm run create-user", never here.
      role = "client";
      const name = displayName?.trim().slice(0, 80) || (decoded.name as string | undefined) || decoded.email || "Customer";
      await ref.set({
        email: decoded.email ?? "",
        name,
        role,
        phone: null,
        company: null,
        createdAt: new Date().toISOString(),
      });
    }

    const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    (await cookies()).set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return { ok: true, home: role === "client" ? "/portal" : "/admin" };
  } catch (err) {
    console.error("createSession error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not start a session (${msg}). Try signing in again.` };
  }
}

/** Signs out and returns to the matching login page: staff to the admin login, clients to the client login. */
export async function signOut(): Promise<void> {
  const user = await getSessionUser();
  // If the session has already expired, fall back to the page the button was pressed on.
  const fromAdmin = ((await headers()).get("referer") ?? "").includes("/admin");
  const staff = user ? user.role !== "client" : fromAdmin;
  (await cookies()).delete(SESSION_COOKIE);
  redirect(staff ? "/admin/login" : "/login");
}
