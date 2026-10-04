import type { Title, TitleRule } from "./fr";

export function titleFor(rules: TitleRule[], count: number, files: number): Title {
  const rule = rules.find((candidate) => (candidate.count === undefined || candidate.count === count) && (candidate.files === undefined || candidate.files === files)) ?? rules.at(-1);
  const fill = (text: string) => text.replaceAll("{count}", String(count));
  return rule ? { before: fill(rule.title.before), highlight: fill(rule.title.highlight), after: fill(rule.title.after) } : { before: "", highlight: "", after: "" };
}
