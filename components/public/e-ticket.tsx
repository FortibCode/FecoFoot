import { formatDateTime, formatFcfa } from "@/lib/format";

/** E-billet nominatif avec QR code (EF-SUP-02). */
export function ETicket({
  qr,
  t,
}: {
  qr: string;
  t: { number: string; holderName: string; category: string; gate: string; price: number; status: string; event: string; kickoffAt: Date; venue: string };
}) {
  const label = t.status === "VALID" ? "Valide" : t.status === "USED" ? "Utilisé" : t.status === "RESERVED" ? "Paiement en attente" : "Annulé";
  return (
    <article aria-label={`Billet ${t.number}`} className="flex overflow-hidden rounded-xl border bg-white text-black">
      <div className="flex flex-1 flex-col gap-1 p-4 text-sm">
        <p className="text-xs uppercase tracking-widest text-gray-500">
          E-billet · {t.number} · <span className={t.status === "VALID" ? "text-[var(--flag-green)]" : "text-red-600"}>{label}</span>
        </p>
        <p className="text-lg font-extrabold leading-tight">{t.event}</p>
        <p>
          {formatDateTime(t.kickoffAt)} · {t.venue}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
          <div><dt className="text-gray-500">Porteur</dt><dd className="font-semibold">{t.holderName}</dd></div>
          <div><dt className="text-gray-500">Tribune</dt><dd className="font-semibold">{t.category}</dd></div>
          <div><dt className="text-gray-500">Accès</dt><dd className="font-semibold">{t.gate}</dd></div>
          <div><dt className="text-gray-500">Prix</dt><dd className="font-semibold">{formatFcfa(t.price)}</dd></div>
        </dl>
      </div>
      {t.status === "VALID" && <div className="flex w-32 items-center border-l border-dashed p-3 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />}
    </article>
  );
}
