import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { governanceBodies, governanceMembers } from "@/lib/db/schema";
import { sortMembers } from "@/lib/governance";

/** Instances publiées et leurs membres en fonction (page publique « La Fédération »). */
export async function publishedBodies() {
  const bodies = await db
    .select()
    .from(governanceBodies)
    .where(eq(governanceBodies.published, true))
    .orderBy(asc(governanceBodies.sortOrder), asc(governanceBodies.name));
  if (bodies.length === 0) return [];
  const members = await db
    .select()
    .from(governanceMembers)
    .where(and(eq(governanceMembers.status, "ACTIVE"), inArray(governanceMembers.bodyId, bodies.map((b) => b.id))));
  return bodies.map((b) => ({ ...b, members: sortMembers(members.filter((m) => m.bodyId === b.id)) }));
}
