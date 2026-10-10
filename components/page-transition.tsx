"use client";

import { usePathname } from "next/navigation";

/** Re-runs the rise-in animation each time the admin page changes. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="rise space-y-6">
      {children}
    </div>
  );
}
