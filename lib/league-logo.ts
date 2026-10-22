/** Adresse publique du logo d'une ligue ; la clé de version change avec le fichier (cache long sans logo périmé). */
export const leagueLogoUrl = (l: { id: number; logoKey: string | null }) => (l.logoKey ? `/media/ligues/${l.id}?v=${l.logoKey.slice(-12, -5)}` : null);

/** Adresse publique du logo d'un championnat national (même principe de version). */
export const championshipLogoUrl = (c: { id: number; logoKey: string | null }) => (c.logoKey ? `/media/championnats/${c.id}?v=${c.logoKey.slice(-12, -5)}` : null);
