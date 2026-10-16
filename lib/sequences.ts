import "server-only";
import { sql } from "drizzle-orm";
import type { PgSequence } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";

/** Prochaine valeur d'une séquence PostgreSQL : numéros jamais réutilisés, sans collision. */
export async function nextVal(seq: PgSequence): Promise<number> {
  const [{ n }] = await db.execute<{ n: string }>(sql`select nextval(${sql.raw(`'${seq.seqName}'`)}) as n`);
  return Number(n);
}
