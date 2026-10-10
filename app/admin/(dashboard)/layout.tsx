import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Nav, type NavItem } from "@/components/nav";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { ACCESS, getSessionUser } from "@/lib/auth/session";
import type { Role } from "@/lib/types";
import { signOut } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

const NAV: (NavItem & { roles: Role[] })[] = [
  { href: "/admin", label: "Overview", icon: "overview", roles: ACCESS.overview },
  { href: "/admin/machines", label: "Machines", icon: "machines", roles: ACCESS.machines },
  { href: "/admin/planning", label: "Planning", icon: "planning", roles: ACCESS.planning },
  { href: "/admin/production-logs", label: "Production logs", icon: "logs", roles: ACCESS.productionLogs },
  { href: "/admin/quality", label: "Quality check", icon: "quality", roles: ACCESS.quality },
  { href: "/admin/electricity", label: "Electricity", icon: "electricity", roles: ACCESS.electricity },
  { href: "/admin/orders", label: "Orders & costing", icon: "orders", roles: ACCESS.orders },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "whatsapp", roles: ACCESS.whatsapp },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role === "client") redirect("/portal");
  const items = NAV.filter((n) => n.roles.includes(user.role)).map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <div className="min-h-screen bg-brand-soft/40 md:grid md:grid-cols-[230px_1fr]">
      <aside className="hero-weave flex flex-col gap-4 p-3 text-white md:sticky md:top-0 md:h-screen print:hidden">
        <div className="px-3 pt-2">
          <p className="text-lg font-bold tracking-tight">Thari Thunaivan</p>
          <p className="flex items-center gap-2 text-xs text-white/70">
            <span className="pulse-dot size-1.5 rounded-full bg-teal-soft" /> TextileFlow · mill console
          </p>
        </div>
        <Nav items={items} />
        <div className="mt-auto hidden px-3 md:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-white/70 capitalize">{user.role}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="mt-2 w-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-6">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
