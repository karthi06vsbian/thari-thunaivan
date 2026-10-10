/**
 * Company details shown on the public website. Edit these to match the mill.
 * Anything left empty is simply not shown.
 */
export const SITE = {
  name: "Thari Thunaivan",
  tagline: "Woven fabric, made to order and delivered on time",
  intro:
    "We are a weaving mill running 50 looms. Tell us the fabric, width and quantity you need and we will plan the looms, give you a delivery date and keep to it.",
  /** `value` is the fabric type the looms are matched on. */
  fabrics: [
    { name: "Cotton", value: "cotton", detail: "Shirting, sheeting and grey fabric in standard and wide widths." },
    { name: "Polyester", value: "polyester", detail: "Durable polyester weaves for garments and furnishing." },
    { name: "Blends", value: "blend", detail: "Poly-cotton and other blended yarn fabrics." },
    { name: "Silk", value: "silk", detail: "Narrow-width silk woven on dedicated looms." },
  ],
  phone: "",
  email: "",
  address: "",
  /**
   * Company WhatsApp number (digits only, with country code).
   * Shown as the "Chat on WhatsApp" button on the public website.
   * Owner: 918778606059 — this is also the number used for the owner bot menu.
   * Override via NEXT_PUBLIC_COMPANY_WHATSAPP env var for production.
   */
  whatsapp: process.env.NEXT_PUBLIC_COMPANY_WHATSAPP ?? "918778606059",
};
