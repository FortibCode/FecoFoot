/** Adresse publique du portrait d'un membre d'instance (version tirée de la clé : le cache suit les changements). */
export const memberPhotoUrl = (m: { id: number; photoKey: string | null }) => (m.photoKey ? `/media/membres/${m.id}?v=${m.photoKey.split("/").pop()!.slice(0, 8)}` : null);
