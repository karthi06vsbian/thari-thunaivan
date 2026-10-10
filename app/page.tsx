import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Gauge, Ruler, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { EnquiryForm } from "./enquiry-form";

export const metadata: Metadata = {
  title: `${SITE.name} – Weaving mill`,
  description: SITE.intro,
};

const STRENGTHS = [
  {
    icon: CalendarCheck,
    title: "A delivery date you can trust",
    text: "Every order is planned loom by loom before we confirm it, so the date we give is the date we can meet.",
  },
  {
    icon: Ruler,
    title: "The right loom for your fabric",
    text: "Orders are matched to looms by fabric type and width, not just whichever machine is free.",
  },
  {
    icon: Gauge,
    title: "Production tracked every shift",
    text: "Output is logged shift by shift, so we know early if an order is slipping and can act on it.",
  },
  {
    icon: Zap,
    title: "Honest, steady pricing",
    text: "We measure power and running cost per meter, which keeps our quotes accurate and stable.",
  },
];

const STEPS = [
  ["Enquiry", "Send us the fabric, width, quantity and the date you need it."],
  ["Plan & quote", "We check loom availability and reply with a price and delivery date."],
  ["Weaving", "Your order runs on its assigned looms and is tracked every shift."],
  ["Delivery", "Fabric is inspected, packed and dispatched on the agreed date."],
];

const FAQS = [
  [
    "How do I get a price?",
    "Send the enquiry form with the fabric, width and quantity. We check loom availability and call you back with a price and a delivery date.",
  ],
  [
    "Can you weave to my width and quality?",
    "Most likely. Our looms cover a range of widths and fabric types; tell us what you need and we will confirm whether we can run it.",
  ],
  [
    "How do I know my order will be ready on time?",
    "Each order is assigned to specific looms before we confirm it, and output is recorded every shift, so we can tell you where your order stands at any point.",
  ],
  [
    "Do you take repeat and bulk orders?",
    "Yes. Repeat orders are planned onto the same kind of looms so the fabric stays consistent from one lot to the next.",
  ],
];

// A woven look without shipping an image: two crossed sets of fine stripes.
const WEAVE = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px)",
};

export default function HomePage() {
  const whatsappUrl = SITE.whatsapp ? `https://wa.me/${SITE.whatsapp}` : null;
  const contacts = [
    SITE.phone && { label: "Phone", value: SITE.phone, href: `tel:${SITE.phone.replace(/\s/g, "")}` },
    SITE.email && { label: "Email", value: SITE.email, href: `mailto:${SITE.email}` },
    SITE.address && { label: "Address", value: SITE.address, href: null },
  ].filter((c): c is { label: string; value: string; href: string | null } => !!c);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">{SITE.name}</Link>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#about" className="hidden rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground md:block">About</a>
            <a href="#fabrics" className="hidden rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground sm:block">Fabrics</a>
            <a href="#process" className="hidden rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground sm:block">How we work</a>
            <a href="#faq" className="hidden rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground md:block">FAQ</a>
            <Link href="/portal" className={cn(buttonVariants({ size: "lg" }), "ml-2")}>Client login</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-zinc-900 text-white" style={WEAVE}>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
            <p className="text-sm font-medium tracking-widest text-amber-300 uppercase">Weaving mill · 50 looms</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{SITE.tagline}</h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-300">{SITE.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/portal" className="inline-flex h-11 items-center rounded-lg bg-amber-400 px-5 text-sm font-semibold text-zinc-900 hover:bg-amber-300">
                Place an order
              </Link>
              <a href="#enquiry" className="inline-flex h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10">
                Send an enquiry
              </a>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10">
                  Chat on WhatsApp
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {STRENGTHS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="grid content-start gap-2">
              <Icon className="size-6 text-amber-600" aria-hidden="true" />
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <section id="about" className="scroll-mt-16 border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">About the mill</h2>
              <p className="mt-4 text-muted-foreground">
                {SITE.name} is a weaving mill with 50 looms on one floor. We weave fabric to order for garment makers,
                traders and exporters, from a single lot to regular repeat orders.
              </p>
              <p className="mt-4 text-muted-foreground">
                We run the mill on numbers, not guesswork: every loom&apos;s output, running hours and power use are
                recorded each shift. That is how we know what we can promise before we promise it.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 self-start">
              {[
                ["50", "looms on the floor"],
                ["Every shift", "output recorded per loom"],
                ["Loom by loom", "planning for each order"],
                ["Per meter", "cost and power tracked"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border bg-card p-5">
                  <dt className="text-2xl font-semibold tracking-tight">{value}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="fabrics" className="scroll-mt-16 border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl font-semibold tracking-tight">What we weave</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Made to your width and quantity. If you do not see your fabric here, ask us.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SITE.fabrics.map((f) => (
                <div key={f.name} className="rounded-xl border bg-card p-5">
                  <h3 className="text-lg font-semibold">{f.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">How we work</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="grid content-start gap-2 border-t-2 border-zinc-900 pt-4">
                <span className="text-sm font-medium text-muted-foreground tabular-nums">Step {i + 1}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="scroll-mt-16 border-t">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="text-3xl font-semibold tracking-tight">Questions buyers ask</h2>
            <div className="mt-6 divide-y rounded-xl border bg-card">
              {FAQS.map(([question, answer]) => (
                <details key={question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {question}
                    <span aria-hidden="true" className="text-xl text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="enquiry" className="scroll-mt-16 border-t bg-muted/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Get a quote</h2>
              <p className="mt-2 text-muted-foreground">Tell us what you need and we will call you back with a price and a delivery date.</p>
              {contacts.length > 0 && (
                <dl className="mt-6 grid gap-3 text-sm">
                  {contacts.map((c) => (
                    <div key={c.label}>
                      <dt className="text-muted-foreground">{c.label}</dt>
                      <dd className="font-medium">{c.href ? <a className="underline" href={c.href}>{c.value}</a> : c.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-6")}>
                  Chat on WhatsApp
                </a>
              )}
            </div>
            <div className="rounded-xl border bg-card p-6">
              <EnquiryForm fabrics={SITE.fabrics.map((f) => f.name)} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold">{SITE.name}</p>
            <p className="mt-1 text-muted-foreground">Weaving mill · 50 looms</p>
          </div>
          <nav className="grid content-start gap-1 text-muted-foreground" aria-label="Footer">
            <a href="#about" className="hover:text-foreground">About</a>
            <a href="#fabrics" className="hover:text-foreground">Fabrics</a>
            <a href="#process" className="hover:text-foreground">How we work</a>
            <a href="#enquiry" className="hover:text-foreground">Get a quote</a>
          </nav>
          <div className="grid content-start gap-1 text-muted-foreground sm:justify-items-end">
            {contacts.map((c) => (
              <p key={c.label}>{c.value}</p>
            ))}
            <Link href="/portal" className="underline-offset-4 hover:text-foreground hover:underline">Client login</Link>
            <Link href="/admin" className="underline-offset-4 hover:text-foreground hover:underline">Staff login</Link>
          </div>
        </div>
        <p className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
