import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, db } from "@/lib/firebase/admin";
import type { AppUser, Role } from "@/lib/types";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export const getSessionUser = cache(async (): Promise<AppUser | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie);
    const snap = await db().collection("users").doc(decoded.uid).get();
    if (!snap.exists) return null;
    return { uid: decoded.uid, ...(snap.data() as Omit<AppUser, "uid">) };
  } catch {
    return null;
  }
});

/** For pages: sends signed-out users to a login page and users without the role to their home. */
export async function requireRole(roles: Role[]): Promise<AppUser> {
  const user = await getSessionUser();
  // Staff pages send signed-out visitors to the staff login, the portal to the customer login.
  if (!user) redirect(roles.includes("client") ? "/login" : "/admin/login");
  if (!roles.includes(user.role)) redirect(user.role === "client" ? "/portal" : "/admin?denied=1");
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function assertRole(roles: Role[]): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");
  if (!roles.includes(user.role)) throw new Error("You do not have access to this action");
  return user;
}

type Area = "overview" | "machines" | "planning" | "productionLogs" | "quality" | "electricity" | "orders" | "whatsapp";

export const ACCESS: Record<Area, Role[]> = {
  overview: ["owner", "manager", "production", "accounts", "transport"],
  machines: ["owner", "manager"],
  planning: ["owner", "manager"],
  productionLogs: ["owner", "manager", "production"],
  quality: ["owner", "manager", "production"],
  electricity: ["owner", "manager", "accounts"],
  orders: ["owner", "manager", "accounts", "transport"],
  whatsapp: ["owner"],
};
