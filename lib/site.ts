export interface GalleryItem {
  title: string;
  caption: string;
  photo: string | null;
  art?: "floor" | "yarn" | "inspect" | "rolls" | "truck";
  /** Required by the licence of photos that are not your own. */
  credit?: { author: string; license: string; url: string };
}

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
   * Gallery tiles on the website. `photo` is a file in public/gallery; a tile without a
   * photo shows the illustration named in `art`. The photos here are freely licensed
   * industry pictures from Wikimedia Commons, not pictures of this mill: replace them with
   * your own (and drop the `credit`) when you have them.
   */
  gallery: [
    { title: "Power looms at work", caption: "Shuttle looms weaving checked fabric.", photo: "/gallery/looms-3.jpg", credit: { author: "Tarunsamanta", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Power_loom_Weaving_in_Hooghly_District_08.jpg" } },
    { title: "Warp on the beam", caption: "Thousands of warp threads feeding the loom.", photo: "/gallery/looms-1.jpg", credit: { author: "Apurv013", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Power_loom_industry.jpg" } },
    { title: "Loom close-up", caption: "Take-up roller and gears of a power loom.", photo: "/gallery/looms-2.jpg", credit: { author: "Apurv013", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Power_loom_industry_at_Kalinarayanpur.jpg" } },
    { title: "Weaving in progress", caption: "Cloth forming on the loom, pick by pick.", photo: "/gallery/looms-4.jpg", credit: { author: "Tarunsamanta", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Power_loom_Weaving_in_Hooghly_District_09.jpg" } },
    { title: "Yarn cones", caption: "Polyester yarn and zari ready for weaving.", photo: "/gallery/yarn.jpg", credit: { author: "Surya Prakash.S.A.", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Polyester_cones_and_Zaari.jpg" } },
    { title: "Cloth inspection and folding", caption: "Woven cloth is looked over and folded before packing.", photo: "/gallery/inspection.jpg", credit: { author: "Clem Rutter, Rochester, Kent", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Masson_Mills_WTM_10_Cloth_looking_%26_Folding_5882.JPG" } },
    { title: "Finished fabric", caption: "Cloth in many colours, ready for buyers.", photo: "/gallery/rolls.jpg", credit: { author: "Daniel Aufgang", license: "CC BY 3.0", url: "https://commons.wikimedia.org/wiki/File:Rolls_of_fabric_of_multiple_colors_(181099191).jpg" } },
    { title: "Dispatch", caption: "Orders leave by truck and are tracked to your door.", art: "truck", photo: null },
  ] as GalleryItem[],
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
