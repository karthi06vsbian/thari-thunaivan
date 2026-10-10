"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { Crown, HardHat, ShieldCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignIn } from "@/lib/auth/use-sign-in";
import { clientAuth } from "@/lib/firebase/client";
import { SITE } from "@/lib/site";
import type { StaffRole } from "@/lib/types";
import { cn } from "@/lib/utils";

// Who is signing in. The ID must really hold the chosen access, or the sign-in is refused.
const ACCESS_LEVELS: { role: StaffRole; label: string; icon: typeof Crown; opens: string; demoId: string }[] = [
  { role: "owner", label: "Owner", icon: Crown, opens: "Full dashboard: every page, costs and WhatsApp", demoId: "owner@tharithunaivan.com" },
  { role: "manager", label: "Manager", icon: UserCog, opens: "Machines, planning, orders, quality and electricity", demoId: "manager@tharithunaivan.com" },
  { role: "production", label: "Supervisor", icon: HardHat, opens: "Production logs and quality check", demoId: "staff@tharithunaivan.com" },
];

/**
 * Demo mode: clicking an icon fills in that demo account's ID and password, so anyone
 * who can open this page can sign in. Set NEXT_PUBLIC_DEMO_LOGIN=off (and change the
 * passwords) before the system holds real data.
 */
const DEMO_FILL = process.env.NEXT_PUBLIC_DEMO_LOGIN !== "off";
const DEMO_PASSWORD = "password123";

/**
 * One sign-in for all mill staff. The account decides what opens: the owner, manager
 * and supervisor each land on the dashboard with their own level of access.
 */
export default function AdminLoginPage() {
  const { busy, error, setError, finish } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  // No icon picked: the form is empty and any staff ID signs in to its own access.
  const [role, setRole] = useState<StaffRole | null>(null);
  const [returnTo, setReturnTo] = useState<string | undefined>();

  // Arriving from a protected page (or a scanned QR label) returns there after sign-in.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/admin/") && !next.startsWith("/admin/login")) setReturnTo(next);
  }, []);
  const level = ACCESS_LEVELS.find((l) => l.role === role) ?? null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    void finish(() => signInWithEmailAndPassword(clientAuth(), email.trim(), password), undefined, returnTo, role ?? undefined);
  }

  async function forgotPassword() {
    setError("");
    setNotice("");
    if (!email) {
      setError("Type your admin ID above first, then click “Forgot password?”.");
      return;
    }
    try {
      await sendPasswordResetEmail(clientAuth(), email.trim());
    } catch {
      // Same message either way, so this cannot be used to check who has an account.
    }
    setNotice("If that ID has an account, a password reset link is on its way.");
  }

  return (
    <main className="hero-weave relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div aria-hidden="true" className="blob absolute -top-24 right-[-6rem] size-96 rounded-full bg-teal/30 blur-3xl" />
      <div aria-hidden="true" className="blob absolute bottom-[-8rem] left-[-4rem] size-80 rounded-full bg-white/10 blur-3xl [animation-delay:-4s]" />
      <div className="rise relative grid w-full max-w-sm gap-4">
        <Card className="shadow-2xl shadow-black/30">
          <CardHeader className="pb-2 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <CardTitle className="mt-2 text-2xl font-bold tracking-tight text-brand">{SITE.name}</CardTitle>
            <p className="text-xs font-medium text-muted-foreground">தறி துணைவன் · Admin access</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Sign in as</legend>
                <div className="flex justify-center gap-2">
                  {ACCESS_LEVELS.map(({ role: r, label, icon: Icon, demoId }) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={role === r}
                      onClick={() => {
                        // Clicking the picked icon again unpicks it and clears the form.
                        const picking = role !== r;
                        setRole(picking ? r : null);
                        setError("");
                        if (DEMO_FILL) {
                          setEmail(picking ? demoId : "");
                          setPassword(picking ? DEMO_PASSWORD : "");
                        }
                      }}
                      className={cn(
                        "grid w-20 justify-items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-all duration-200",
                        role === r
                          ? "scale-105 border-brand bg-brand text-white shadow-md"
                          : "text-muted-foreground hover:border-brand/40 hover:bg-brand-soft hover:text-brand",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
                {(level || returnTo) && (
                  <p key={role ?? "none"} className="rise rounded-lg bg-teal-soft px-3 py-2 text-xs">
                    {level && <><span className="font-semibold">{level.label} page:</span> {level.opens}.</>}
                    {returnTo && <> You will go back to <span className="font-semibold">{returnTo}</span>.</>}
                  </p>
                )}
              </fieldset>
              <div className="grid gap-2">
                <Label htmlFor="email">Admin ID</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={() => void forgotPassword()} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
              <Button type="submit" size="lg" disabled={busy} className="btn-shine w-full font-semibold">
                {busy ? "Signing in…" : level ? `Sign in as ${level.label}` : "Sign in"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {DEMO_FILL ? "Demo mode: click an icon to fill in its ID and password, click it again to clear." : "Use the ID and password given to you for that access."}
              </p>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-white/80">
          <Link href="/login" className="underline-offset-4 hover:underline">Customer? Go to the client login</Link>
          {" · "}
          <Link href="/" className="underline-offset-4 hover:underline">Back to Mill Website</Link>
        </p>
      </div>
    </main>
  );
}
