const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** All money is stored as integer paise. */
export function formatINR(paise: number, opts: { whole?: boolean } = {}): string {
  return (opts.whole ? inrWhole : inr).format(paise / 100);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatNumber(n: number): string {
  return num.format(n);
}
