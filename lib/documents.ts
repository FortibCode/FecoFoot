/**
 * Pièces et images téléversées — EF-LIC-01 (photo), EF-LIC-09 (pièces justificatives),
 * EF-CLB-05 (logo et pièces d'affiliation). Fichier pur, testé unitairement.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export type FileKind = "jpeg" | "png" | "webp" | "pdf";

export const MIME: Record<FileKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

const IMAGES: FileKind[] = ["jpeg", "png", "webp"];

export const DOCUMENT_TYPES = {
  PLAYER_PHOTO: { owner: "player", label: "Photo d'identité", accept: IMAGES },
  BIRTH_CERTIFICATE: { owner: "player", label: "Acte de naissance", accept: [...IMAGES, "pdf"] },
  MEDICAL_CERTIFICATE: { owner: "player", label: "Certificat médical", accept: [...IMAGES, "pdf"] },
  ID_DOCUMENT: { owner: "player", label: "Pièce d'identité", accept: [...IMAGES, "pdf"] },
  CLUB_LOGO: { owner: "club", label: "Logo du club", accept: ["png", "jpeg", "webp"] },
  CLUB_STATUTES: { owner: "club", label: "Statuts du club", accept: ["pdf", ...IMAGES] },
  CLUB_AGM_MINUTES: { owner: "club", label: "PV d'assemblée générale", accept: ["pdf", ...IMAGES] },
} as const satisfies Record<string, { owner: "player" | "club"; label: string; accept: FileKind[] }>;

export type DocumentType = keyof typeof DOCUMENT_TYPES;
export const DOCUMENT_TYPE_KEYS = Object.keys(DOCUMENT_TYPES) as DocumentType[];
export type DocumentOwner = "player" | "club";

export const documentTypesFor = (owner: DocumentOwner) => DOCUMENT_TYPE_KEYS.filter((t) => DOCUMENT_TYPES[t].owner === owner);

/** Pièces attendues pour instruire une licence (EF-LIC-09). */
export const LICENSE_REQUIRED_DOCUMENTS: DocumentType[] = ["PLAYER_PHOTO", "BIRTH_CERTIFICATE", "MEDICAL_CERTIFICATE"];

/**
 * Type réel d'un fichier d'après ses premiers octets (« nombre magique ») :
 * on ne se fie ni à l'extension ni au type annoncé par le navigateur.
 */
export function sniffKind(bytes: Uint8Array): FileKind | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50)
    return "webp";
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "pdf";
  return null;
}

/** Contrôle d'un fichier avant stockage : type réel autorisé pour la pièce, taille maximale. */
export function checkUpload(type: DocumentType, bytes: Uint8Array): { kind: FileKind } | { error: string } {
  if (bytes.length === 0) return { error: "Le fichier est vide." };
  if (bytes.length > MAX_FILE_SIZE) return { error: "Le fichier dépasse 5 Mo." };
  const kind = sniffKind(bytes);
  const accepted: readonly FileKind[] = DOCUMENT_TYPES[type].accept;
  if (!kind || !accepted.includes(kind)) {
    return { error: `Format non accepté pour « ${DOCUMENT_TYPES[type].label} » : ${accepted.map((k) => k.toUpperCase()).join(", ")}.` };
  }
  return { kind };
}
