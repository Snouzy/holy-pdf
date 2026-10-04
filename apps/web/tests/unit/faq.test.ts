import { describe, expect, it } from "vitest";
import { faqFromMarkdown, questionId } from "../../src/faq";

describe("question anchors", () => {
  it("turns a French question into a plain address fragment", () => {
    expect(questionId("Mes fichiers sont-ils envoyés sur un serveur ?")).toBe("mes-fichiers-sont-ils-envoyes-sur-un-serveur");
    expect(questionId("Ça marche sur téléphone ?")).toBe("ca-marche-sur-telephone");
    expect(questionId("Puis-je changer l'ordre des pages avant de fusionner ?")).toBe("puis-je-changer-l-ordre-des-pages-avant-de-fusionner");
  });
});

describe("questions of a Markdown page", () => {
  it("reads each second-level title as a question, and its paragraphs as the plain answer", () => {
    const markdown = [
      "## Is Holy PDF free?",
      "",
      "Yes. No hidden limit.",
      "",
      "## Are my files uploaded?",
      "",
      "No. [How to check it](/en/blog/check).",
      "",
      "They stay on your device.",
    ].join("\n");
    expect(faqFromMarkdown(markdown)).toEqual([
      { question: "Is Holy PDF free?", answer: "Yes. No hidden limit." },
      { question: "Are my files uploaded?", answer: "No. How to check it. They stay on your device." },
    ]);
  });
});
