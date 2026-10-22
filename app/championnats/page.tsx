import { redirect } from "next/navigation";

/** La rubrique « Compétitions nationales » s'ouvre sur la première division. */
export default function ChampionshipsIndex() {
  redirect("/championnats/ligue-1");
}
