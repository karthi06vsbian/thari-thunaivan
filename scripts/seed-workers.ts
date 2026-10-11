/**
 * Adds the ten sample workers (and links the sample shipments to the two drivers) to a
 * database that was seeded before the Workers & salary page existed.
 *
 *   npm run seed:workers                       # emulators
 *   npm run seed:workers:firebase -- --target=<projectId>
 */
import { db, projectId } from "@/lib/firebase/admin";
import { todayIso } from "@/lib/dates";
import { sampleShipments } from "@/lib/transport/data";
import { sampleWorkers } from "./sample-workers";

const onEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const target = process.argv.find((a) => a.startsWith("--target="))?.slice("--target=".length);
if (!onEmulator && target !== projectId) {
  console.error(`Refusing to write to the real Firebase project "${projectId}".`);
  console.error(`To add the sample workers to it, run: npm run seed:workers:firebase -- --target=${projectId}`);
  process.exit(1);
}

async function main() {
  if (!(await db().collection("workers").limit(1).get()).empty) {
    console.log("Skipped: this database already has workers.");
    return;
  }
  const { workers, pay } = sampleWorkers(todayIso());
  const batch = db().batch();
  for (const { id, ...data } of workers) batch.set(db().collection("workers").doc(id), data);
  for (const p of pay) batch.set(db().collection("workerPay").doc(p.id), p.data);

  // Only the demo shipments are touched, and only to say who drove them.
  let linked = 0;
  for (const s of sampleShipments(Date.now())) {
    const snap = await db().collection("shipments").doc(s.id).get();
    if (!snap.exists || !snap.get("sample") || snap.get("driverId")) continue;
    batch.update(snap.ref, { driverId: s.driverId, tripPayPaise: s.tripPayPaise });
    linked++;
  }
  await batch.commit();
  console.log(`Added ${workers.length} workers and ${pay.length} monthly pay entries to ${projectId}; linked ${linked} sample shipments to drivers.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
