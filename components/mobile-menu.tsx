"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

/** Section links for phones and small tablets, where the header has no room for them. */
export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-lg border text-brand transition-colors hover:bg-brand-soft"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Sections" className="rise absolute inset-x-0 top-full grid border-b bg-background p-2 shadow-lg">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-base font-medium hover:bg-brand-soft hover:text-brand"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
