import type { ReactNode } from "react";
import { BallIcon, GroupIcon, ShieldIcon, TrophyIcon, WomanIcon } from "@/components/public/icons";
import type { MatchFamily } from "@/lib/competitions";

/** Pictogramme de chaque catégorie de matchs (onglets et pastilles). */
export const FAMILY_ICONS: Record<MatchFamily, ReactNode> = {
  selections: <TrophyIcon />,
  "ligue-1": <BallIcon />,
  "ligue-2": <BallIcon />,
  departementales: <ShieldIcon />,
  coupes: <TrophyIcon />,
  feminin: <WomanIcon />,
  jeunes: <GroupIcon />,
  autres: <BallIcon />,
};
