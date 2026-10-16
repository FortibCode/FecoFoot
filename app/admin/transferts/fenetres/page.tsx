import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { transferWindows } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { openWindow } from "@/lib/transfers";
import { createTransferWindow, deleteTransferWindow } from "../actions";
import { WindowForm } from "./WindowForm";

export const metadata: Metadata = { title: "Fenêtres de transfert — FECOFOOT" };

/** Fenêtres de transfert paramétrables (EF-TRF-04). */
export default async function TransferWindowsPage() {
  await requirePermission("transfers.approve");
  const season = seasonOf();
  const windows = await db.select().from(transferWindows).where(eq(transferWindows.season, season)).orderBy(asc(transferWindows.opensOn));
  const current = openWindow(windows);

  return (
    <>
      <PageHeader
        eyebrow="Licences · Transferts"
        title={`Fenêtres de transfert ${seasonLabel(season)}`}
        description={current ? `Fenêtre ouverte : ${current.name}.` : "Aucune fenêtre ouverte : seuls les transferts libres sont possibles."}
      />
      <ul className="mb-8 flex flex-col divide-y rounded-lg border">
        {windows.length === 0 && <li className="p-3 text-sm text-muted-foreground">Aucune fenêtre définie pour la saison.</li>}
        {windows.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span>
              <strong>{w.name}</strong> · du {formatDate(w.opensOn)} au {formatDate(w.closesOn)}
            </span>
            <form action={deleteTransferWindow.bind(null, w.id)}>
              <Button type="submit" variant="ghost" size="sm">
                Supprimer
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <WindowForm action={createTransferWindow} season={season} />
    </>
  );
}
