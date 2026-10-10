import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { SITE } from "@/lib/site";
import type { AppUser } from "@/lib/types";

/** Header and page frame shared by every client page. */
export function PortalShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-soft/40">
      <header className="hero-weave text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/portal" className="text-lg font-semibold tracking-tight">{SITE.name}</Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/portal" className="rounded-lg px-3 py-1.5 text-white/85 hover:bg-white/10 hover:text-white">My orders</Link>
            <Link href="/portal/new" className="rounded-lg px-3 py-1.5 text-white/85 hover:bg-white/10 hover:text-white">New order</Link>
            <span className="hidden px-2 text-white/60 md:inline">{user.phone ? `+${user.phone}` : user.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <LogOut /> Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="rise mx-auto grid max-w-5xl gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
