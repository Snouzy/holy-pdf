import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { pageIds, sections } from "./sitePages";
import { languages, toolIds } from "./tools";

const tools = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/tools" }),
  schema: z.object({
    tool: z.enum(toolIds),
    lang: z.enum(languages),
    title: z.string().max(60),
    description: z.string().min(70).max(160),
    h1: z.string(),
    steps: z.array(z.string()).length(3),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).min(5).max(8),
  }),
});

const meta = {
  lang: z.enum(languages),
  title: z.string().max(60),
  description: z.string().min(70).max(160),
  h1: z.string(),
  lead: z.string(),
  updated: z.coerce.date().optional(),
};

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({ page: z.enum(pageIds), ...meta }),
});

const articles = defineCollection({
  // The default id would be the frontmatter slug; "<lang>/<file name>" pairs the two languages of an article.
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles", generateId: ({ entry }) => entry.replace(/\.md$/, "") }),
  schema: z.object({ section: z.enum(sections), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), published: z.coerce.date(), ...meta }),
});

export const collections = { tools, pages, articles };
