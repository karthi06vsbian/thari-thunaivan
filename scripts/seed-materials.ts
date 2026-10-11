/**
 * Adds the six sample materials to a database that was seeded before the stock box existed.
 *
 *   npm run seed:materials                       # emulators
 *   npm run seed:materials:firebase -- --target=<projectId>
 */
import { db, projectId } from "@/lib/firebase/admin";
import { sampleMaterials } from "./sample-materials";

const onEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const target = process.argv.find((a) => a.startsWith("--target="))?.slice("--target=".length);
if (!onEmulator && target !== projectId) {
  console.error(`Refusing to write to the real Firebase project "${projectId}".`);
  console.error(`To add the sample materials to it, run: npm run seed:materials:firebase -- --target=${projectId}`);
  process.exit(1);
}

async function main() {
  if (!(await db().collection("materials").limit(1).get()).empty) {
    console.log("Skipped: this database already has materials.");
    return;
  }
  const materials = sampleMaterials("Seed script");
  const batch = db().batch();
  for (const { id, ...data } of materials) batch.set(db().collection("materials").doc(id), data);
  await batch.commit();
  console.log(`Added ${materials.length} materials to ${projectId}.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
