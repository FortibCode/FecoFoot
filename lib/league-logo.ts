/** Adresse publique du logo d'une ligue ; la clé de version change avec le fichier (cache long sans logo périmé). */
export const leagueLogoUrl = (l: { id: number; logoKey: string | null }) => (l.logoKey ? `/media/ligues/${l.id}?v=${l.logoKey.slice(-12, -5)}` : null);
