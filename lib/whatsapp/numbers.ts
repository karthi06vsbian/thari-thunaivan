/**
 * Registered phone numbers with country code (India = 91).
 * Owner gets full mill data. Clients get order status only.
 *
 * Add more clients by pushing to CLIENTS array.
 */

export const OWNER_PHONE = "918778606059";

export const CLIENTS: { phone: string; name: string }[] = [
  { phone: "917904348506", name: "Client" },
];

/** All phone numbers that are allowed to message the bot. */
export const ALL_KNOWN_PHONES = new Set([
  OWNER_PHONE,
  ...CLIENTS.map((c) => c.phone),
]);

export function isOwner(phone: string): boolean {
  return phone === OWNER_PHONE;
}

export function isClient(phone: string): boolean {
  return CLIENTS.some((c) => c.phone === phone);
}

export function clientName(phone: string): string {
  return CLIENTS.find((c) => c.phone === phone)?.name ?? "Customer";
}
