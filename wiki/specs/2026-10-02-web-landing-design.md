# Web: home page redesign and FAQ per tool

_2 October 2026. Status: shipped in `apps/web/`._

Mockups: not published. The full proposal shows the monastery and the lower sections; the chosen top is the option "Hero I · the fill-in-the-blank sentence".

## Decisions

- The monastery does not change: cards, search, categories, switch, compact view.
- The top and the bottom change. The drop zone of the home page goes away "for now". For the top, the fill-in-the-blank sentence is chosen.
- The compact view keeps one row per category, which scrolls sideways.
- The intro video goes to two places: a "Watch Holy PDF in 30 seconds" button under the top sentence, with a round preview, which opens the video in a window; and the first question of the FAQ, "How does it work?", whose answer is the video in a bubble. Each language has its own video, in French and in English.
- The 404 page follows option A: Brother Lens searched everywhere, then the sentence "I want to [verb] my PDFs." to go back to a tool. It exists in French and in English.
- The FAQ of the home page takes the form of a conversation, like iMessage, with bubbles that appear on scroll.
- The privacy section talks to someone who does not know the developer tools: one promise and four guarantees, no Network tab.

## Home page

Order of the page:

1. **Top I, the fill-in-the-blank sentence.** The title of the site in small type, and right below it "Free · no file uploaded · no account". Then "I want to [merge ▾] my PDFs.": a menu of twelve verbs, custom-made because the native menu took the giant size of the sentence. Its list is at text size, with the monk and the monk's name for each verb; it follows the "combobox" pattern of choice lists (arrows, Enter, Escape, Home, End, first letters). Under the sentence, the monk of the chosen verb, "takes care of it, in your browser", and the "Let's go →" button that leads to its tool. Below, alone and centered, the video button. The guarantees were next to this button; on 4 October, they moved up under the title, and options A to D for this line are rejected. Without JavaScript, the button leads to Merge. On a 1280 × 800 screen, the first row of cards stays visible on arrival. Options D, E, C, F, G and H were rejected.
2. **The monastery**, unchanged. The "And N monks in meditation" card becomes a "Show them" button, which turns on the switch.
3. **Three moves, and it's done**: pick a monk, drop your files, get the result. As a frieze, without cards, so that two rows of cards do not follow each other with the use cases (option A, chosen on 3 October): each move has its monk in a tinted disc, its number as a stamp, and a dotted line links the three discs. On phones, the moves stack and the line disappears.
4. **For your everyday paperwork**: four cases, each with its monks and a link. The "Paperwork to hand in" case leads to the guide; the other three lead to Sign, Compress and Protect.
5. **Your PDFs never leave your device.** A lined sheet, "The monastery's promise", signed by Brother Quill, who stands next to it (above it on phones): the title and one sentence, "Many PDF sites send your file to their computers. Here it's the other way round". Just below, a dark band: the four guarantees and the link to the article that explains how to check them. Chosen on 3 October (option F, then the band); the "elsewhere or here" drawing and options A to E are rejected.
6. **Why monks?** The copyists, and "Here, the monastery is your browser". The monk with the book wears the halo (`halo` of `Monk`), since 4 October.
7. **Frequently asked questions**, as a conversation. Six short questions, then a link to the FAQ page.
8. **A monk is waiting for you**: a blue band with rays that start from the head of Brother Staple, with a halo, on the right. Under the title, six shortcuts with their monk: Merge, Compress, Edit, Sign, Organize and Create (which leads to JPG to PDF), in 3, 2 or 1 columns depending on the space; then "See all the monks →", which leads back to the monastery. Chosen on 4 October (option E, the sun of D and the shortcuts of B); the monk moves under the shortcuts on phones.

"At the monastery, soon" and the old guarantees panel disappear.

The home page no longer hydrates any island. `HomeDrop`, the orientation of the files (`orient.ts`) and their handoff to the board (`handoff.ts`) are deleted: a file dropped on the home page is no longer handled. To bring back the drop zone, start from the commit that deletes them.

The FAQ bubbles appear with a CSS animation tied to scrolling (`animation-timeline: view()`). Chrome, Edge and Safari 26 play it. Firefox shows the bubbles without animation. It does not play when the system asks for reduced motion.

## FAQ per tool

- Each question on a tool page has an anchor, made from its text without accents or punctuation (`questionId`, `src/faq.ts`). An address with `#anchor` opens the question.
- The FAQ page keeps its general questions in Markdown. Below them, it lists the questions of each tool, grouped by tool, each one linked to its answer on the tool page. The questions come from the `faq` field of the `src/content/tools/<lang>/*.md` files: they are never copied.
- JSON-LD `FAQPage` on each tool page, and on the FAQ page for its general questions, read from its Markdown (`faqFromMarkdown`). The home page has none: its questions repeat those of the FAQ page.

## Video and 404 page

- `src/films.ts` lists the videos per language: `public/videos/holy-pdf-fr.mp4` and `holy-pdf-en.mp4` (30 s, 4.8 MB each), with their `.webp` posters (13 KB). A language without a video shows no button and no bubble. The video loads on click (`preload="none"`); the poster is also the round preview.
- The window is a native `<dialog>`: Escape, the button or a click outside it closes it, and the video stops.
- The top sentence is a component, `src/home/Pick.astro`, that the 404 page reuses in a compact version, without the monk badge.
- Cloudflare serves the `404.html` that is closest to the address: the build moves `fr/404/index.html` and `en/404/index.html` to `fr/404.html` and `en/404.html`, and copies the English one to the root. The old grid of all the tools on the 404 page disappears.

## Out of scope

- The comparison table with the other PDF sites. It stays as an option on the canvas: its claims about the other sites would need to be verifiable.
- The drop zone, which may come back later.
