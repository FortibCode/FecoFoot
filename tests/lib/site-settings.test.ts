import { describe, expect, it } from "vitest";
import { foundedYearError, socialUrlError } from "@/lib/site-settings";

describe("socialUrlError", () => {
  it("accepte un compte du bon réseau, ou rien", () => {
    expect(socialUrlError("facebook", "https://www.facebook.com/fecofootcg")).toBeNull();
    expect(socialUrlError("x", "https://twitter.com/fecofoot_cg")).toBeNull();
    expect(socialUrlError("youtube", "https://www.youtube.com/channel/UCmOWGzjrFxOh36xvlYGmWIg")).toBeNull();
    expect(socialUrlError("instagram", "")).toBeNull();
  });
  it("refuse un autre réseau, http, la page d'accueil ou une adresse invalide", () => {
    expect(socialUrlError("facebook", "https://www.instagram.com/fecofoot_rc")).toMatch(/Facebook/);
    expect(socialUrlError("facebook", "https://facebook.com.evil.example/fecofoot")).toMatch(/Facebook/);
    expect(socialUrlError("youtube", "http://www.youtube.com/@fecofoot")).toMatch(/https/);
    expect(socialUrlError("x", "https://x.com/")).toMatch(/compte/);
    expect(socialUrlError("instagram", "fecofoot_rc")).toMatch(/invalide/);
  });
});

describe("foundedYearError", () => {
  it("accepte une année passée plausible, ou rien", () => {
    expect(foundedYearError("1962", 2026)).toBeNull();
    expect(foundedYearError("", 2026)).toBeNull();
  });
  it("refuse une année future, trop ancienne ou non entière", () => {
    expect(foundedYearError("2030", 2026)).not.toBeNull();
    expect(foundedYearError("1700", 2026)).not.toBeNull();
    expect(foundedYearError("19a2", 2026)).not.toBeNull();
  });
});
