import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { DocumentsPanel } from "@/components/admin/documents-panel";
import { StatusBadge, transferTone } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { licenses, transfers } from "@/lib/db/schema";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import {
  CATEGORY_LABELS,
  CONSENT_STATUS_LABELS,
  effectiveStatus,
  GENDER_LABELS,
  isMinor,
  LICENSE_STATUS_LABELS,
  naturalCategory,
  POSITION_LABELS,
  seasonLabel,
  seasonOf,
  toIsoDate,
} from "@/lib/licenses";
import { latestDocuments } from "@/lib/queries/documents";
import { transferQuery } from "@/lib/queries/transfers";
import { TRANSFER_STATUS_LABELS, TRANSFER_TYPE_LABELS } from "@/lib/transfers";
import { latestConsent, loadPlayerFor } from "@/lib/queries/players";
import { scopedClubOptions } from "@/lib/queries/reference";
import { openPlayerAccess, requestConsent, requestLicense, setPublicationPrefs, updatePlayer } from "../actions";
import { PublicationForm } from "../../licences/LicenseForms";
import { ActionForm } from "@/components/admin/action-form";
import { ConsentRequestButton } from "../ConsentPanel";
import { LicenseRequestForm, PlayerForm } from "../PlayerForms";

export const metadata: Metadata = { title: "Fiche joueur — FECOFOOT" };

export default async function PlayerPage({ params }: PageProps<"/admin/joueurs/[id]">) {
  const user = await requirePermission("players.read");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const row = await loadPlayerFor(user, id);
  if (!row) notFound();
  const { player, club } = row;

  const canManage = can(user.role, "players.manage");
  const canRequestLicense = can(user.role, "licenses.request") || can(user.role, "licenses.validate");
  const season = seasonOf();
  const minor = isMinor(player.birthDate);

  const canTransfer = can(user.role, "transfers.review");
  const [history, consentInfo, clubChoices, docs, moves] = await Promise.all([
    db.select().from(licenses).where(eq(licenses.playerId, player.id)).orderBy(desc(licenses.season), desc(licenses.id)),
    player.clubId ? latestConsent(player.id, player.clubId) : Promise.resolve(null),
    canManage ? scopedClubOptions(user) : Promise.resolve([]),
    latestDocuments("player", player.id),
    can(user.role, "transfers.review") || can(user.role, "transfers.approve")
      ? transferQuery().where(eq(transfers.playerId, player.id)).orderBy(desc(transfers.createdAt))
      : Promise.resolve([]),
  ]);
  const hasCurrentLicense = history.some((l) => l.season === season && l.status !== "REJECTED" && l.status !== "TRANSFERRED");
  const consent = consentInfo?.consent;

  return (
    <>
      <PageHeader
        eyebrow={`Licences · ${player.federalId}`}
        title={`${player.lastName} ${player.firstName}`}
        description={`${club?.name ?? "Sans club"} · né(e) le ${formatDate(player.birthDate)}${minor ? " · mineur" : ""} · ${
          player.position ? POSITION_LABELS[player.position] : "poste non renseigné"
        }`}
      />

      <div className="flex flex-col gap-10">
        {/* Accord en ligne (M05) */}
        {player.clubId && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Accord en ligne {minor ? "du représentant légal" : "du joueur"}</h2>
            {!consent ? (
              <p className="text-sm text-muted-foreground">Aucune demande d’accord envoyée pour {club?.name}.</p>
            ) : (
              <p className="text-sm">
                <StatusBadge tone={consent.status === "ACCEPTED" && consentInfo?.valid ? "ok" : consent.status === "REFUSED" ? "bad" : "wait"}>
                  {CONSENT_STATUS_LABELS[consent.status]}
                </StatusBadge>{" "}
                <span className="text-muted-foreground">
                  Demande du {formatDateTime(consent.requestedAt)} à {consent.recipientName}
                  {consent.status === "PENDING" && ` · lien valable jusqu'au ${formatDateTime(consent.linkExpiresAt)}`}
                  {consent.status === "ACCEPTED" && ` · valable jusqu'au ${formatDate(consent.validUntil)}`}
                  {consent.status === "REFUSED" && consent.refusalReason && ` · motif : ${consent.refusalReason}`}
                </span>
              </p>
            )}
            {canManage && !consentInfo?.valid && (
              <ConsentRequestButton
                action={requestConsent.bind(null, player.id)}
                label={consent ? "Envoyer une nouvelle demande d'accord" : "Envoyer la demande d'accord"}
              />
            )}
          </section>
        )}

        {/* Licences */}
        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Licences</h2>
          {history.length === 0 ? (
            <EmptyState icon="shield" title="Aucune licence" compact>Ce joueur n’a encore aucune licence enregistrée.</EmptyState>
          ) : (
            <DataTable head={["N°", "Saison", "Catégorie", "Droits", "Statut"]}>
              {history.map((l) => {
                const status = effectiveStatus(l.status, l.expiresAt);
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/admin/licences/${l.id}`} className="underline-offset-2 hover:underline">
                        {l.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{seasonLabel(l.season)}</td>
                    <td className="px-3 py-2">{CATEGORY_LABELS[l.category]}</td>
                    <td className="px-3 py-2">{formatFcfa(l.feeAmount)}</td>
                    <td className="px-3 py-2">{LICENSE_STATUS_LABELS[status]}</td>
                  </tr>
                );
              })}
            </DataTable>
          )}
          {canRequestLicense && !hasCurrentLicense && player.clubId && (
            <div className="mt-2 rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-semibold">Demander la licence {seasonLabel(season)}</h3>
              {club?.status !== "AFFILIATED" ? (
                <p className="text-sm text-muted-foreground">Le club doit être affilié pour demander une licence.</p>
              ) : (
                <LicenseRequestForm
                  action={requestLicense.bind(null, player.id)}
                  suggested={naturalCategory(player.birthDate, season)}
                  seasonLabel={seasonLabel(season)}
                />
              )}
            </div>
          )}
        </section>

        {/* Transferts (M06) */}
        {(moves.length > 0 || canTransfer) && (
          <section className="flex flex-col gap-3 border-t pt-6">
            <h2 className="font-semibold">Transferts</h2>
            {moves.length === 0 ? (
              <EmptyState icon="transfer" title="Aucun transfert" compact />
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {moves.map(({ transfer: t, fromClub, toClub }) => (
                  <li key={t.id}>
                    <Link href={`/admin/transferts/${t.id}`} className="font-mono text-xs underline-offset-2 hover:underline">
                      {t.number}
                    </Link>{" "}
                    {TRANSFER_TYPE_LABELS[t.type]} · {fromClub?.name ?? "Sans club"} → {toClub.name}{" "}
                    <StatusBadge tone={transferTone(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
            {canTransfer && (
              <Link href={`/admin/transferts/nouveau?joueur=${player.federalId}`} className="w-fit rounded-md border px-3 py-2 text-sm hover:bg-muted">
                Demander un transfert
              </Link>
            )}
          </section>
        )}

        {/* Photo et pièces justificatives (EF-LIC-01, EF-LIC-09) */}
        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Photo et pièces justificatives</h2>
          <DocumentsPanel ownerType="player" ownerId={player.id} latest={docs} canManage={canManage} />
        </section>

        {/* Identité */}
        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Identité et publication</h2>
          <p className="text-sm">
            {player.identityVerifiedAt
              ? `Identité contrôlée ${player.identityMethod === "BIOMETRIC" ? "par biométrie" : "sur pièces"} le ${formatDate(player.identityVerifiedAt)}.`
              : "Identité pas encore contrôlée : l'agent la confirme au moment de valider la licence."}
          </p>
          {canManage && <PublicationForm action={setPublicationPrefs.bind(null, player.id)} initial={player} />}
        </section>

        {canManage && (
          <section className="flex flex-col gap-3 border-t pt-6">
            <h2 className="font-semibold">Espace personnel</h2>
            {player.userId ? (
              <p className="text-sm">Accès ouvert : le joueur consulte en ligne ses licences, ses transferts et ses matchs.</p>
            ) : minor ? (
              <p className="text-sm text-muted-foreground">Joueur mineur : l&apos;accès en ligne d&apos;un mineur n&apos;est pas encore ouvert.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Le joueur reçoit par e-mail un lien pour choisir son mot de passe ; il ne voit que ses propres données.</p>
                <ActionForm action={openPlayerAccess.bind(null, player.id)} label="Ouvrir l'accès à l'espace joueur" />
              </>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Identité</h2>
          {canManage ? (
            <div id="modifier">
            <PlayerForm
              action={updatePlayer.bind(null, player.id)}
              clubs={clubChoices}
              initial={{ ...player, birthDate: toIsoDate(player.birthDate) }}
              submitLabel="Enregistrer"
            />
            </div>
          ) : (
            <dl className="grid max-w-2xl gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {(
                [
                  ["Sexe", GENDER_LABELS[player.gender]],
                  ["Nationalité", player.nationality],
                  ["Lieu de naissance", player.birthPlace],
                  ["Catégorie d'âge", CATEGORY_LABELS[naturalCategory(player.birthDate, season)]],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </>
  );
}
