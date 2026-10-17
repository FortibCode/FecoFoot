import { describe, expect, it } from "vitest";
import { renderRichText } from "@/lib/articles";
import { decodeEntities, htmlToRichText, mapCategory, summaryFrom } from "@/lib/wp-import";

describe("Reprise des articles de fecofoot.cg", () => {
  it("décode les entités HTML", () => {
    expect(decodeEntities("Note d&rsquo;information &#8211; FIFA&#x2122; &amp; CAF")).toBe("Note d’information – FIFA™ & CAF");
  });

  it("convertit paragraphes, gras, listes et intertitres ; retire images et figures", () => {
    const html = `<figure class="wp-block-image"><img src="x.jpg"/></figure>
<p class="wp-block-paragraph">La FECOFOOT informe les <strong>clubs concernés</strong>.</p>
<h3>Démarches</h3>
<ul class="wp-block-list"><li>vérifier leur situation ;</li>
<li>consulter la <a href="https://fifa.com/x">circulaire</a>.</li></ul>
<p class="wp-block-paragraph"></p>`;
    expect(htmlToRichText(html)).toBe(
      "La FECOFOOT informe les **clubs concernés**.\n\n## Démarches\n\n- vérifier leur situation ;\n- consulter la [circulaire](https://fifa.com/x).",
    );
  });

  it("le texte converti reste sûr à l'affichage (aucune balise ni script ne passe)", () => {
    const md = htmlToRichText(`<p>Texte <script>alert(1)</script><img src=x onerror=alert(1)> &lt;b&gt;</p>`);
    expect(renderRichText(md)).not.toMatch(/<script|onerror|<b>/);
  });

  it("choisit la rubrique la plus précise", () => {
    expect(mapCategory(["tout", "communiques"])).toBe("COMMUNIQUE");
    expect(mapCategory(["tout", "infos-dtn"])).toBe("TECHNICAL");
    expect(mapCategory(["tout", "corps-arbitrage", "communiques"])).toBe("REFEREEING");
    expect(mapCategory(["tout", "comite-executif"])).toBe("INSTITUTION");
    expect(mapCategory(["informations-sur-la-ligue-nationale-de-football-congolais"])).toBe("COMPETITIONS");
  });

  it("chapô en texte brut, sans « [...] » final", () => {
    expect(summaryFrom("<p>Retour en images sur la réception [&hellip;]</p>", "")).toBe("Retour en images sur la réception…");
    expect(summaryFrom("", "<p>Repli</p>")).toBe("Repli");
  });
});
