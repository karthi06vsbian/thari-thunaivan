"use server";

import { z } from "zod";
import { run } from "@/lib/action-result";
import { db } from "@/lib/firebase/admin";
import { sendToOwners } from "@/lib/whatsapp/send";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z.string().trim().regex(/^[0-9+ ()-]{7,20}$/, "Please enter a valid phone number"),
  company: z.string().trim().max(120),
  fabric: z.string().trim().max(60),
  meters: z.number().min(0).max(10_000_000).nullable(),
  message: z.string().trim().max(1000),
  /** Hidden field real visitors never fill in. */
  website: z.string().max(0),
});

/** Public enquiry form: stores the enquiry and tells the owner on WhatsApp. */
export async function submitEnquiry(input: z.infer<typeof schema>) {
  return run(async () => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const { name, phone, company, fabric, meters, message } = parsed.data;
    const enquiry = { name, phone, company, fabric, meters, message };
    await db().collection("enquiries").add({ ...enquiry, status: "new", at: new Date().toISOString() });
    await sendToOwners(
      [
        "*New website enquiry*",
        `${enquiry.name}${enquiry.company ? ` (${enquiry.company})` : ""} · ${enquiry.phone}`,
        [enquiry.fabric, enquiry.meters ? `${enquiry.meters.toLocaleString("en-IN")} m` : ""].filter(Boolean).join(" · "),
        enquiry.message,
      ]
        .filter(Boolean)
        .join("\n"),
      "enquiry",
    );
    return { message: "Thank you. We will call you back shortly." };
  });
}
