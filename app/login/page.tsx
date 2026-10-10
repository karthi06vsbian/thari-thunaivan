"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignIn } from "@/lib/auth/use-sign-in";
import { clientAuth } from "@/lib/firebase/client";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

const ROLES = [
  {
    id: "owner",
    label: "Owner",
    icon: "👑",
    title: "Mill Owner Login",
    description: "Full oversight: 50 looms, electricity billing, planning & WhatsApp reports.",
    demoEmail: "owner@tharithunaivan.com",
    demoPassword: "password123",
  },
  {
    id: "manager",
    label: "Manager",
    icon: "👔",
    title: "Production Manager Login",
    description: "Loom capacity allocation, order batching & floor scheduling.",
    demoEmail: "manager@tharithunaivan.com",
    demoPassword: "password123",
  },
  {
    id: "staff",
    label: "Staff",
    icon: "🛠️",
    title: "Floor Supervisor Login",
    description: "Shift production logs, running/idle hours & meters woven.",
    demoEmail: "staff@tharithunaivan.com",
    demoPassword: "password123",
  },
  {
    id: "transport",
    label: "Transport",
    icon: "🚚",
    title: "Transport & Logistics Login",
    description: "Orders ready for dispatch, delivery tracking & customer details.",
    demoEmail: "transport@tharithunaivan.com",
    demoPassword: "password123",
  },
  {
    id: "customer",
    label: "Customer",
    icon: "🛒",
    title: "Customer & Buyer Portal",
    description: "Place custom fabric orders and track weaving progress.",
    demoEmail: "client@tharithunaivan.com",
    demoPassword: "password123",
  },
];

type RoleId = "owner" | "manager" | "staff" | "transport" | "customer";
type Mode = "login" | "register";

export default function LoginPage() {
  const { busy, error, setError, finish } = useSignIn();
  const [selectedRole, setSelectedRole] = useState<RoleId>("owner");
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("owner@tharithunaivan.com");
  const [password, setPassword] = useState("password123");
  const [notice, setNotice] = useState("");

  const activeRole = ROLES.find((r) => r.id === selectedRole) ?? ROLES[0]!;

  function pickRole(roleId: RoleId) {
    setSelectedRole(roleId);
    const r = ROLES.find((item) => item.id === roleId);
    if (r) {
      setEmail(r.demoEmail);
      setPassword(r.demoPassword);
    }
    setMode("login");
    setError("");
    setNotice("");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (mode === "login") {
      void finish(() => signInWithEmailAndPassword(clientAuth(), email, password));
      return;
    }
    void finish(async () => {
      const credential = await createUserWithEmailAndPassword(clientAuth(), email, password);
      await updateProfile(credential.user, { displayName: name.trim() });
      return credential;
    }, name);
  }

  function oneClickLogin() {
    setEmail(activeRole.demoEmail);
    setPassword(activeRole.demoPassword);
    void finish(() => signInWithEmailAndPassword(clientAuth(), activeRole.demoEmail, activeRole.demoPassword));
  }

  async function forgotPassword() {
    setError("");
    setNotice("");
    if (!email) {
      setError("Type your email above first, then click “Forgot password?”.");
      return;
    }
    try {
      await sendPasswordResetEmail(clientAuth(), email);
    } catch {
      // Ignored for security
    }
    setNotice("If that email has an account, a password reset link is on its way.");
  }

  return (
    <main className="hero-weave relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div aria-hidden="true" className="blob absolute -top-24 right-[-6rem] size-96 rounded-full bg-teal/30 blur-3xl" />
      <div aria-hidden="true" className="blob absolute bottom-[-8rem] left-[-4rem] size-80 rounded-full bg-white/10 blur-3xl [animation-delay:-4s]" />
      <div className="rise relative grid w-full max-w-md gap-4">
        <Card className="shadow-2xl shadow-black/30">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-brand">{SITE.name}</CardTitle>
            <p className="text-xs text-muted-foreground font-medium">தறி துணைவன் · Weaving Mill Management System</p>
          </CardHeader>

          <CardContent className="grid gap-4">
            {/* Role Switcher Tabs */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Select Role to Sign In</Label>
              <div className="grid grid-cols-5 gap-1 rounded-xl bg-muted p-1">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickRole(r.id as RoleId)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg py-1.5 px-1 text-xs font-medium transition-all duration-200",
                      selectedRole === r.id
                        ? "scale-105 bg-brand font-semibold text-white shadow-md"
                        : "text-muted-foreground hover:bg-brand-soft hover:text-brand",
                    )}
                  >
                    <span className="text-base">{r.icon}</span>
                    <span className="truncate text-[11px] leading-tight mt-0.5">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Role Description Banner */}
            <div key={selectedRole} className="rise rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <span>{activeRole.icon}</span>
                <span>{activeRole.title}</span>
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">{activeRole.description}</p>
            </div>

            {/* Quick 1-Click Login Button */}
            <Button
              type="button"
              variant="default"
              size="lg"
              disabled={busy}
              onClick={oneClickLogin}
              className="btn-shine w-full font-semibold shadow"
            >
              ⚡ 1-Click Sign In as {activeRole.label}
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or sign in with credentials</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* Customer Register Toggle (Only shown for Customer role) */}
            {selectedRole === "customer" && (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setError("");
                      setNotice("");
                    }}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium",
                      mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {m === "login" ? "Sign In" : "Register New Account"}
                  </button>
                ))}
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="grid gap-3">
              {mode === "register" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="name" className="text-xs">Your Name</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                  />
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => void forgotPassword()}
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
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

              {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
              {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}

              <Button type="submit" variant="secondary" size="sm" disabled={busy} className="w-full">
                {busy ? "Signing in…" : mode === "login" ? `Sign In (${activeRole.label})` : "Create Customer Account"}
              </Button>
            </form>

            {/* Google Login Option */}
            <div className="space-y-2 border-t pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void finish(() => signInWithPopup(clientAuth(), new GoogleAuthProvider()))}
                className="w-full text-xs"
              >
                <GoogleMark /> Continue with Google
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/80">
          <Link href="/" className="underline-offset-4 hover:underline">
            ← Back to Mill Website
          </Link>
        </p>
      </div>
    </main>
  );
}
