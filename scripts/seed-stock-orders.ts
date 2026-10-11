/**
 * Adds the five sample stock orders to a database that was seeded before stock ordering existed.
 * A sample order is skipped when its material is not on the stock list.
 *
 *   npm run seed:stock-orders                       # emulators
 *   npm run seed:stock-orders:firebase -- --target=<projectId>
 */
import { getMaterials } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { db, projectId } from "@/lib/firebase/admin";
import { sampleStockOrders } from "./sample-materials";

const onEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const target = process.argv.find((a) => a.startsWith("--target="))?.slice("--target=".length);
if (!onEmulator && target !== projectId) {
  console.error(`Refusing to write to the real Firebase project "${projectId}".`);
  console.error(`To add the sample stock orders to it, run: npm run seed:stock-orders:firebase -- --target=${projectId}`);
  process.exit(1);
}

async function main() {
  if (!(await db().collection("stockOrders").limit(1).get()).empty) {
    console.log("Skipped: this database already has stock orders.");
    return;
  }
  const materials = await getMaterials();
  const batch = db().batch();
  const added: string[] = [];
  const skipped: string[] = [];
  for (const { id, ...order } of sampleStockOrders(todayIso(), "Karthikeyan (Owner)")) {
    // The material may have been renamed or re-added in the app, so match on the name too.
    const material = materials.find((m) => m.id === order.materialId) ?? materials.find((m) => m.name === order.materialName);
    if (!material) {
      skipped.push(order.materialName);
      continue;
    }
    batch.set(db().collection("stockOrders").doc(id), { ...order, materialId: material.id, unit: material.unit });
    added.push(`${id} (${order.materialName}, ${order.status})`);
  }
  await batch.commit();
  console.log(`Added ${added.length} stock orders to ${projectId}:`);
  for (const line of added) console.log(`  ${line}`);
  if (skipped.length > 0) console.log(`Skipped, material not on the stock list: ${skipped.join(", ")}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
