/** Drapeaux des adversaires (public/flags/<code>.svg), d'après le nom saisi dans le calendrier. */
const FLAGS: Record<string, string> = {
  congo: "cg",
  namibie: "na",
  cameroun: "cm",
  comores: "km",
};

const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Adresse du drapeau d'un pays, ou null s'il n'est pas encore dans la collection. */
export function flagUrl(country: string): string | null {
  const code = FLAGS[normalize(country)];
  return code ? `/flags/${code}.svg` : null;
}
