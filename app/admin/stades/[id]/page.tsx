import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { stadiums } from "@/lib/db/schema";
import { updateStadium } from "../actions";
import { StadiumForm } from "../StadiumForm";

export const metadata: Metadata = { title: "Stade — FECOFOOT" };

export default async function StadiumPage({ params }: PageProps<"/admin/stades/[id]">) {
  await requirePermission("competitions.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [s] = await db.select().from(stadiums).where(eq(stadiums.id, id)).limit(1);
  if (!s) notFound();
  return (
    <>
      <PageHeader eyebrow="Administration · Stades" title={s.name} description={s.city} />
      <StadiumForm action={updateStadium.bind(null, s.id)} initial={s} submitLabel="Enregistrer les modifications" />
      <Link href="/admin/stades" className="mt-6 inline-block text-sm underline">
        Retour aux stades
      </Link>
    </>
  );
}
