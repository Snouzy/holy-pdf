import type { Lang } from "../../web/src/tools";
import type { Platform } from "./shell";

const fr = {
  title: {
    mac: ["Vos PDF, ", "sur votre Mac"],
    windows: ["Vos PDF, ", "sur votre PC"],
    linux: ["Vos PDF, ", "sur votre ordinateur"],
  } satisfies Record<Platform, [string, string]>,
  trust: "Tout est traité ici : rien n'est envoyé.",
  monastery: "Monastère",
  tools: "Outils",
  soon: "Bientôt",
  ready: (count: number) => (count === 1 ? "1 fichier prêt. Choisissez un outil." : `${count} fichiers prêts. Choisissez un outil.`),
  changeFiles: "Changer de fichiers",
};

const en: typeof fr = {
  title: {
    mac: ["Your PDFs, ", "on your Mac"],
    windows: ["Your PDFs, ", "on your PC"],
    linux: ["Your PDFs, ", "on your computer"],
  },
  trust: "Everything happens here: nothing is sent.",
  monastery: "Monastery",
  tools: "Tools",
  soon: "Soon",
  ready: (count: number) => (count === 1 ? "1 file ready. Pick a tool." : `${count} files ready. Pick a tool.`),
  changeFiles: "Change files",
};

export const texts: Record<Lang, typeof fr> = { fr, en };
