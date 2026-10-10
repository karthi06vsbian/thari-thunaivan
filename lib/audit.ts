import { db } from "@/lib/firebase/admin";
import type { AppUser } from "@/lib/types";

export async function writeAudit(
  actor: Pick<AppUser, "uid" | "name">,
  action: string,
  entity: string,
  entityId: string,
  details = "",
): Promise<void> {
  await db().collection("auditLogs").add({
    at: new Date().toISOString(),
    actorUid: actor.uid,
    actorName: actor.name,
    action,
    entity,
    entityId,
    details,
  });
}
