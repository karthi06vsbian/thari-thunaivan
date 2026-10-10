"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Factory,
  LayoutDashboard,
  CalendarRange,
  MessageCircle,
  Package,
  ScanLine,
  Truck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  overview: LayoutDashboard,
  machines: Factory,
  planning: CalendarRange,
  logs: ClipboardList,
  quality: ScanLine,
  transport: Truck,
  electricity: Zap,
  orders: Package,
  whatsapp: MessageCircle,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-all duration-200 hover:translate-x-1 hover:bg-white/10 hover:text-white",
              active && "bg-white text-brand shadow-md hover:translate-x-0 hover:bg-white hover:text-brand",
            )}
          >
            <Icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
