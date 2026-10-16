import { deleteDocument, uploadDocument } from "@/app/admin/documents/actions";
import { Button } from "@/components/ui/button";
import type { Document } from "@/lib/db/schema";
import { DOCUMENT_TYPES, documentTypesFor, type DocumentOwner, type DocumentType } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";
import { UploadForm } from "./upload-form";

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);

/** Pièces d'un joueur ou d'un club : dernière version de chaque type, remplacement, suppression. */
export function DocumentsPanel({
  ownerType,
  ownerId,
  latest,
  canManage,
}: {
  ownerType: DocumentOwner;
  ownerId: number;
  latest: Partial<Record<DocumentType, Document>>;
  canManage: boolean;
}) {
  const upload = uploadDocument.bind(null, ownerType, ownerId);
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {documentTypesFor(ownerType).map((type) => {
        const doc = latest[type];
        const accept = DOCUMENT_TYPES[type].accept.map((k) => (k === "pdf" ? "application/pdf" : `image/${k}`)).join(",");
        return (
          <li key={type} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {doc && doc.contentType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par une route authentifiée
                <img src={`/admin/documents/${doc.id}`} alt="" className="size-12 rounded border object-cover" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded border text-[0.6rem] text-muted-foreground">
                  {doc ? "PDF" : "—"}
                </div>
              )}
              <div className="text-sm">
                <p className="font-medium">{DOCUMENT_TYPES[type].label}</p>
                {doc ? (
                  <p className="text-muted-foreground">
                    <a href={`/admin/documents/${doc.id}`} target="_blank" rel="noopener" className="underline">
                      Consulter
                    </a>{" "}
                    · {kb(doc.size)} · {formatDateTime(doc.createdAt)}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Aucune pièce</p>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <UploadForm action={upload} type={type} accept={accept} label={doc ? "Remplacer" : "Ajouter"} />
                {doc && (
                  <form action={deleteDocument.bind(null, doc.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Supprimer
                    </Button>
                  </form>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
