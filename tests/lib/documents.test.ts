import { describe, expect, it } from "vitest";
import { checkUpload, documentTypesFor, MAX_FILE_SIZE, sniffKind } from "@/lib/documents";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const EXE = bytes(0x4d, 0x5a, 0x90, 0x00);

describe("Pièces téléversées (EF-LIC-01, EF-LIC-09, EF-CLB-05)", () => {
  it("reconnaît le type réel d'après le contenu", () => {
    expect(sniffKind(PNG)).toBe("png");
    expect(sniffKind(JPEG)).toBe("jpeg");
    expect(sniffKind(PDF)).toBe("pdf");
    expect(sniffKind(WEBP)).toBe("webp");
    expect(sniffKind(EXE)).toBeNull();
  });

  it("la photo d'identité n'accepte que des images", () => {
    expect(checkUpload("PLAYER_PHOTO", JPEG)).toEqual({ kind: "jpeg" });
    expect(checkUpload("PLAYER_PHOTO", PDF)).toHaveProperty("error");
  });

  it("les pièces justificatives acceptent PDF et images, pas un exécutable renommé", () => {
    expect(checkUpload("BIRTH_CERTIFICATE", PDF)).toEqual({ kind: "pdf" });
    expect(checkUpload("MEDICAL_CERTIFICATE", PNG)).toEqual({ kind: "png" });
    expect(checkUpload("BIRTH_CERTIFICATE", EXE)).toHaveProperty("error");
  });

  it("refuse les fichiers vides ou de plus de 5 Mo", () => {
    expect(checkUpload("BIRTH_CERTIFICATE", new Uint8Array())).toHaveProperty("error");
    const big = new Uint8Array(MAX_FILE_SIZE + 1);
    big.set(PDF);
    expect(checkUpload("BIRTH_CERTIFICATE", big)).toEqual({ error: "Le fichier dépasse 5 Mo." });
  });

  it("sépare les pièces du joueur et celles du club", () => {
    expect(documentTypesFor("player")).toEqual(["PLAYER_PHOTO", "BIRTH_CERTIFICATE", "MEDICAL_CERTIFICATE", "ID_DOCUMENT"]);
    expect(documentTypesFor("club")).toEqual(["CLUB_LOGO", "CLUB_STATUTES", "CLUB_AGM_MINUTES"]);
  });
});
