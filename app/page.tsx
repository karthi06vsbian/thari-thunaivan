import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Gauge, Ruler, Zap } from "lucide-react";
import { CountUp, Reveal } from "@/components/reveal";
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

const TICKER = ["Cotton", "Polyester", "Poly-cotton blends", "Silk", "Made to width", "Loom-by-loom planning", "Tracked every shift"];

export default function HomePage() {
  const whatsappUrl = SITE.whatsapp ? `https://wa.me/${SITE.whatsapp}` : null;
  const contacts = [
    SITE.phone && { label: "Phone", value: SITE.phone, href: `tel:${SITE.phone.replace(/\s/g, "")}` },
    SITE.email && { label: "Email", value: SITE.email, href: `mailto:${SITE.email}` },
    SITE.address && { label: "Address", value: SITE.address, href: null },
  ].filter((c): c is { label: string; value: string; href: string | null } => !!c);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-xl font-bold tracking-tight text-brand">{SITE.name}</Link>
          <nav className="flex items-center gap-1 text-sm">
            {[
              ["#about", "About", "md:block"],
              ["#fabrics", "Products", "sm:block"],
              ["#process", "How we work", "sm:block"],
              ["#faq", "FAQ", "md:block"],
            ].map(([href, label, show]) => (
              <a key={href} href={href} className={cn("hidden rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand", show)}>
                {label}
              </a>
            ))}
            <Link href="/portal" className={cn(buttonVariants({ size: "lg" }), "btn-shine ml-2")}>Client login</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-weave relative overflow-hidden text-white">
          <div aria-hidden="true" className="blob absolute -top-24 right-[-6rem] size-96 rounded-full bg-teal/30 blur-3xl" />
          <div aria-hidden="true" className="blob absolute bottom-[-8rem] left-[-4rem] size-80 rounded-full bg-white/10 blur-3xl [animation-delay:-4s]" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
            <p className="rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-widest uppercase ring-1 ring-white/20">
              <span className="pulse-dot size-2 rounded-full bg-teal-soft" /> Weaving mill · 50 looms
            </p>
            <h1 className="rise mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance [animation-delay:120ms] sm:text-6xl">{SITE.tagline}</h1>
            <p className="rise mt-6 max-w-2xl text-lg text-white/80 [animation-delay:240ms]">{SITE.intro}</p>
            <div className="rise mt-8 flex flex-wrap gap-3 [animation-delay:360ms]">
              <Link href="/portal" className="btn-shine group inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-brand shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5">
                Place an order <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#enquiry" className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-sm font-semibold transition-colors hover:bg-white/10">
                Send an enquiry
              </a>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-lg bg-teal px-6 text-sm font-semibold transition-colors hover:bg-teal/85">
                  Chat on WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="relative overflow-hidden border-t border-white/15 bg-black/15 py-3" aria-hidden="true">
            <div className="marquee flex w-max gap-10 whitespace-nowrap text-sm font-medium text-white/80">
              {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-10">{t}<span className="size-1.5 rounded-full bg-teal-soft/70" /></span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {STRENGTHS.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 90}>
              <div className="lift grid h-full content-start gap-3 rounded-2xl border bg-card p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </Reveal>
          ))}
        </section>

        <section id="about" className="scroll-mt-16 border-t bg-brand-soft/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
            <Reveal>
              <p className="text-sm font-semibold tracking-widest text-teal uppercase">About the mill</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Run on numbers, not guesswork</h2>
              <p className="mt-4 text-muted-foreground">
                {SITE.name} is a weaving mill with 50 looms on one floor. We weave fabric to order for garment makers,
                traders and exporters, from a single lot to regular repeat orders.
              </p>
              <p className="mt-4 text-muted-foreground">
                Every loom&apos;s output, running hours and power use are recorded each shift. That is how we know what
                we can promise before we promise it.
              </p>
            </Reveal>
            <dl className="grid grid-cols-2 gap-4 self-start">
              {[
                { value: <CountUp value={50} />, label: "looms on the floor" },
                { value: "Every shift", label: "output recorded per loom" },
                { value: "Loom by loom", label: "planning for each order" },
                { value: "Per meter", label: "cost and power tracked" },
              ].map(({ value, label }, i) => (
                <Reveal key={label} delay={i * 90}>
                  <div className="lift h-full rounded-2xl border bg-card p-5">
                    <dt className="text-2xl font-bold tracking-tight text-brand">{value}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground">{label}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        <section id="fabrics" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Reveal>
              <p className="text-sm font-semibold tracking-widest text-teal uppercase">Our products</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">What we weave</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">Made to your width and quantity. If you do not see your fabric here, ask us.</p>
            </Reveal>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SITE.fabrics.map((f, i) => (
                <Reveal key={f.name} delay={i * 90}>
                  <article className="lift group h-full overflow-hidden rounded-2xl border bg-card">
                    <div className="relative aspect-[8/5] overflow-hidden">
                      <Image
                        src={f.image}
                        alt={`${f.name} fabric`}
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm">{f.name}</span>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold">{f.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
                      <Link href="/portal" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                        Order this <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="scroll-mt-16 border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Reveal>
              <p className="text-sm font-semibold tracking-widest text-teal uppercase">How we work</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">From enquiry to delivery</h2>
            </Reveal>
            <ol className="relative mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <span aria-hidden="true" className="absolute top-4 right-[12.5%] left-[12.5%] hidden h-0.5 bg-brand/30 lg:block" />
              {STEPS.map(([title, text], i) => (
                <li key={title}>
                  <Reveal delay={i * 120} className="grid justify-items-start gap-2 lg:justify-items-center lg:text-center">
                    <span className="relative grid size-8 place-items-center rounded-full bg-brand text-sm font-bold text-white ring-4 ring-background">
                      {i + 1}
                    </span>
                    <h3 className="mt-1 font-semibold text-brand">{title}</h3>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="faq" className="scroll-mt-16 border-t">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-tight">Questions buyers ask</h2>
            </Reveal>
            <Reveal delay={100}>
              <div className="mt-6 divide-y overflow-hidden rounded-2xl border bg-card">
                {FAQS.map(([question, answer]) => (
                  <details key={question} className="group px-5 py-4 transition-colors open:bg-brand-soft/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                      {question}
                      <span aria-hidden="true" className="text-xl text-brand transition-transform duration-300 group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="enquiry" className="scroll-mt-16 border-t bg-brand-soft/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.4fr]">
            <Reveal>
              <p className="text-sm font-semibold tracking-widest text-teal uppercase">Get a quote</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Tell us what you need</h2>
              <p className="mt-2 text-muted-foreground">We will call you back with a price and a delivery date.</p>
              <p className="mt-4 rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 text-sm">
                Ready to order? <Link href="/portal" className="font-semibold text-teal underline-offset-4 hover:underline">Create a customer account</Link> to place it and follow its progress.
              </p>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-11 items-center rounded-lg bg-teal px-5 text-sm font-semibold text-white transition-colors hover:bg-teal/85">
                  Chat on WhatsApp
                </a>
              )}
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
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-brand/10">
                <EnquiryForm fabrics={SITE.fabrics.map((f) => f.name)} />
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-brand-dark text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
          <div>
            <p className="text-lg font-bold">{SITE.name}</p>
            <p className="mt-1 text-white/70">Weaving mill · 50 looms</p>
          </div>
          <nav className="grid content-start gap-1 text-white/70" aria-label="Footer">
            <a href="#about" className="hover:text-white">About</a>
            <a href="#fabrics" className="hover:text-white">Products</a>
            <a href="#process" className="hover:text-white">How we work</a>
            <a href="#enquiry" className="hover:text-white">Get a quote</a>
          </nav>
          <div className="grid content-start gap-1 text-white/70 sm:justify-items-end">
            {contacts.map((c) => (
              <p key={c.label}>{c.value}</p>
            ))}
            <Link href="/portal" className="underline-offset-4 hover:text-white hover:underline">Client login</Link>
            <Link href="/admin" className="underline-offset-4 hover:text-white hover:underline">Staff login</Link>
          </div>
        </div>
        <p className="border-t border-white/15 px-4 py-4 text-center text-xs text-white/60">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
