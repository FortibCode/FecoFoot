import * as z from "zod";
import { blankToNull } from "@/lib/action-state";
import { MATCH_STATS, statsError, type MatchStatValues } from "@/lib/competitions";

const count = z.preprocess(blankToNull, z.coerce.number().int().min(0).max(999).nullable());
export const STAT_PERIODS = ["ALL", "H1", "H2"] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];
export const STAT_PERIOD_LABELS: Record<StatPeriod, string> = { ALL: "Match", H1: "1re mi-temps", H2: "2e mi-temps" };

/** Lecture et contrôle du formulaire des statistiques d'un match (période, valeurs domicile / extérieur). */
export function parseStats(formData: FormData): { period: StatPeriod; values: MatchStatValues } | { error: string } {
  const shape: Record<string, typeof count> = { possessionHome: count };
  for (const s of MATCH_STATS) {
    shape[`${s.key}Home`] = count;
    shape[`${s.key}Away`] = count;
  }
  const parsed = z.object(shape).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Statistiques invalides : des nombres entiers positifs." };
  const values = parsed.data as MatchStatValues;
  const error = statsError(values);
  if (error) return { error };
  const period = STAT_PERIODS.find((p) => p === formData.get("period")) ?? "ALL";
  return { period, values };
}
