import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Nav, type NavItem } from "@/components/nav";
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
  { href: "/admin/electricity", label: "Electricity", icon: "electricity", roles: ACCESS.electricity },
  { href: "/admin/orders", label: "Orders & costing", icon: "orders", roles: ACCESS.orders },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "whatsapp", roles: ACCESS.whatsapp },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "client") redirect("/portal");
  const items = NAV.filter((n) => n.roles.includes(user.role)).map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-4 border-b bg-muted/30 p-3 md:border-r md:border-b-0">
        <div className="px-3 pt-1">
          <p className="font-semibold">TextileFlow</p>
          <p className="text-xs text-muted-foreground">Thari Thunaivan</p>
        </div>
        <Nav items={items} />
        <div className="mt-auto hidden px-3 md:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="mt-2 w-full">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 space-y-6 p-4 md:p-6">{children}</main>
    </div>
  );
}
