export type Question = { question: string; answer: string };

export function questionId(question: string): string {
  return question
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function faqPage(questions: Question[]): object {
  const mainEntity = questions.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } }));
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity };
}

/** Structured data takes plain text: links keep their words only. */
export function faqFromMarkdown(markdown: string): Question[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [question = "", ...lines] = block.split("\n");
      const answer = lines.join(" ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ");
      return { question: question.trim(), answer: answer.trim() };
    });
}
