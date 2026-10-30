import { formatDateTime, formatFcfa } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments-rules";
import type { VerifiedTicket } from "@/lib/queries/ticket-verify";
import { parseEventTitle } from "@/lib/ticketing";

/** Verdict d'un billet scanné : authentique et payé (valable), déjà utilisé, en attente de paiement ou annulé. */
function verdict(t: VerifiedTicket) {
  if (t.status === "VALID" && t.orderStatus === "PAID") return { ok: true, title: "Billet valable", text: "Billet authentique et payé : il n'a pas encore servi." };
  if (t.status === "USED") return { ok: false, title: "Billet déjà utilisé", text: `Entrée enregistrée le ${t.usedAt ? formatDateTime(t.usedAt) : "—"}${t.usedGate ? ` (${t.usedGate})` : ""}. Il ne permet plus d'entrer.` };
  if (t.status === "RESERVED") return { ok: false, title: "Paiement non confirmé", text: "Ce billet est réservé mais n'a pas été payé : il ne permet pas d'entrer." };
  return { ok: false, title: t.orderStatus === "REFUNDED" ? "Billet remboursé" : "Billet annulé", text: "Ce billet n'est plus valable." };
}

export function TicketCheck({ t }: { t: VerifiedTicket | null }) {
  if (!t) {
    return (
      <div role="alert" className="rounded-2xl border-2 border-destructive bg-destructive/10 p-6">
        <p className="font-heading text-2xl font-bold uppercase text-destructive">Billet inconnu</p>
        <p className="mt-1 text-sm">Ce QR code ne correspond à aucun billet émis par la FECOFOOT : billet faux ou mal recopié.</p>
      </div>
    );
  }
  const v = verdict(t);
  const { competition, detail, match } = parseEventTitle(t.event);
  const paid =
    t.channel === "INVITATION" || t.price === 0
      ? "Billet d'invitation (gratuit)"
      : t.payment
        ? `${formatFcfa(t.payment.amount)} payés par ${PAYMENT_METHOD_LABELS[t.payment.method]}${t.payment.confirmedAt ? ` le ${formatDateTime(t.payment.confirmedAt)}` : ""}`
        : t.paidAt
          ? `Payé le ${formatDateTime(t.paidAt)}${t.channel === "COUNTER" ? " au guichet" : ""}`
          : "Aucun paiement enregistré";
  const rows: [string, string][] = [
    ["Titulaire", t.holderName],
    ["Tribune", `${t.category} · ${t.gate}`],
    ["Rencontre", `${match}${competition ? ` — ${competition}` : ""}${detail ? ` (${detail})` : ""}`],
    ["Date et lieu", `${formatDateTime(t.kickoffAt)} · ${t.venue}`],
    ["Paiement", paid],
    ["N° de billet", t.number],
    ["Commande", t.orderRef + (t.payment ? ` · paiement ${t.payment.reference}` : "")],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div role="status" className={`flex items-center gap-4 rounded-2xl border-2 p-5 ${v.ok ? "border-[var(--flag-green)] bg-[color-mix(in_oklch,var(--flag-green)_10%,transparent)]" : "border-destructive bg-destructive/10"}`}>
        <span aria-hidden className={`grid size-14 shrink-0 place-items-center rounded-full text-3xl font-bold text-white ${v.ok ? "bg-[var(--flag-green)]" : "bg-destructive"}`}>
          {v.ok ? "✓" : "✕"}
        </span>
        <div>
          <p className={`font-heading text-2xl font-bold uppercase ${v.ok ? "text-[#00753a]" : "text-destructive"}`}>{v.title}</p>
          <p className="text-sm">{v.text}</p>
        </div>
      </div>
      <dl className="divide-y rounded-xl bg-muted/60 text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-4 py-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold break-words">{val}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Vérification en lecture seule : ce scan n&apos;enregistre pas d&apos;entrée. Au stade, l&apos;entrée est validée par le contrôle d&apos;accès de la
        porte, et la pièce d&apos;identité doit correspondre au titulaire.
      </p>
    </div>
  );
}
