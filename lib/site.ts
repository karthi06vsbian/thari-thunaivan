/**
 * Company details shown on the public website. Edit these to match the mill.
 * Anything left empty is simply not shown.
 */
export const SITE = {
  name: "Thari Thunaivan",
  tagline: "Woven fabric, made to order and delivered on time",
  intro:
    "We are a weaving mill running 50 looms. Tell us the fabric, width and quantity you need and we will plan the looms, give you a delivery date and keep to it.",
  /**
   * `value` is the fabric type the looms are matched on. `ratePerMeter` is the indicative
   * price in rupees used for online advance payments. `image` is a file in
   * public/products; swap the illustrations for real photos by replacing those files.
   */
  fabrics: [
    { name: "Cotton", value: "cotton", ratePerMeter: 92, image: "/products/cotton.svg", detail: "Shirting, sheeting and grey fabric in standard and wide widths." },
    { name: "Polyester", value: "polyester", ratePerMeter: 84, image: "/products/polyester.svg", detail: "Durable polyester weaves for garments and furnishing." },
    { name: "Blends", value: "blend", ratePerMeter: 89, image: "/products/blend.svg", detail: "Poly-cotton and other blended yarn fabrics." },
    { name: "Silk", value: "silk", ratePerMeter: 215, image: "/products/silk.svg", detail: "Narrow-width silk woven on dedicated looms." },
  ],
  /**
   * Online advance a client pays to confirm a prepaid order, as a percentage of
   * meters x ratePerMeter (rupees, set per fabric above). Edit both to your real prices.
   */
  advancePercent: 10,
  /** Time slots offered when a client books a visit to confirm an order in person. */
  visitSlots: ["10:00 AM – 12:00 PM", "12:00 PM – 2:00 PM", "3:00 PM – 5:00 PM"],
  phone: "",
  email: "",
  address: "",
  /**
   * Company WhatsApp number (digits only, with country code).
   * Shown as the "Chat on WhatsApp" button on the public website.
   * Owner: 918778606059 — this is also the number used for the owner bot menu.
   * Override via NEXT_PUBLIC_COMPANY_WHATSAPP env var for production.
   */
  whatsapp: process.env.NEXT_PUBLIC_COMPANY_WHATSAPP ?? "916383263198",
};
