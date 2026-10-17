import { describe, expect, it } from "vitest";
import { plainText, renderRichText } from "@/lib/articles";

describe("Texte enrichi des actualités (EF-COM-02)", () => {
  it("intertitres, paragraphes, gras, italique, listes, liens", () => {
    const html = renderRichText("## Liste des convoqués\n\nLa **DTN** publie la liste *officielle*.\nDeuxième ligne.\n\n- Gardiens\n- Défenseurs\n\nVoir [le site](https://fecofoot.cg/selections).");
    expect(html).toBe(
      [
        "<h2>Liste des convoqués</h2>",
        "<p>La <strong>DTN</strong> publie la liste <em>officielle</em>.<br>Deuxième ligne.</p>",
        "<ul><li>Gardiens</li><li>Défenseurs</li></ul>",
        '<p>Voir <a href="https://fecofoot.cg/selections" rel="noopener nofollow" target="_blank">le site</a>.</p>',
      ].join("\n"),
    );
  });

  it("aucune balise ni script ne passe", () => {
    const html = renderRichText('<script>alert(1)</script> <img src=x onerror=alert(1)> "guillemets"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;guillemets&quot;");
  });

  it("liens javascript: refusés, attributs non injectables", () => {
    expect(renderRichText("[clic](javascript:alert(1))")).not.toContain("<a");
    const html = renderRichText('[x](https://a.cg/" onmouseover="alert(1))');
    expect(html).not.toMatch(/onmouseover="/);
  });

  it("extrait en texte brut", () => {
    expect(plainText("## Titre\n\nLa **DTN** publie [la liste](https://x.cg).")).toBe("Titre La DTN publie la liste.");
    expect(plainText("a".repeat(300), 10)).toHaveLength(10);
  });
});
