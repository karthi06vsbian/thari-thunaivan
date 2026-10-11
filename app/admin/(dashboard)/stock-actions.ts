"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { ACCESS, assertRole } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { STOCK_FABRICS } from "@/lib/stock";
import type { Material } from "@/lib/types";

const quantity = z.number().min(0).max(100_000_000);
const materialSchema = z.object({
  name: z.string().trim().min(2, "Enter the material's name").max(60),
  unit: z.string().trim().min(1, "Enter the unit, e.g. kg").max(12),
  fabricType: z.string().refine((f) => f === "" || STOCK_FABRICS.includes(f), "Choose a fabric"),
  stock: quantity,
  minStock: quantity,
  usePerMeter: z.number().min(0).max(1_000),
});

/** Adds a material, or updates one when its id is given. */
export async function saveMaterial(materialId: string | null, input: z.infer<typeof materialSchema>) {
  return run(async () => {
    const user = await assertRole(ACCESS.stock);
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the form");
    const d = parsed.data;
    const data: Omit<Material, "id"> = {
      name: d.name, unit: d.unit, fabricType: d.fabricType || null,
      stock: d.stock, minStock: d.minStock, usePerMeter: d.usePerMeter,
      updatedAt: new Date().toISOString(), updatedBy: user.name,
    };
    const materials = db().collection("materials");
    if (materialId) {
      if (!(await materials.doc(materialId).get()).exists) throw new Error("Material not found");
      await materials.doc(materialId).set(data);
    } else {
      materialId = (await materials.add(data)).id;
    }
    await writeAudit(user, "stock-update", "material", d.name, `${d.stock} ${d.unit} in stock`);
    revalidatePath("/admin");
    return { message: `${d.name}: ${d.stock} ${d.unit} in stock` };
  });
}

export async function removeMaterial(materialId: string) {
  return run(async () => {
    const user = await assertRole(ACCESS.stock);
    const ref = db().collection("materials").doc(materialId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Material not found");
    await ref.delete();
    await writeAudit(user, "stock-remove", "material", String(snap.get("name")));
    revalidatePath("/admin");
    return { message: `${snap.get("name")} removed from the stock list` };
  });
}
