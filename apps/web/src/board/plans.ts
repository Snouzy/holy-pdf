import type { ExportPlan } from "../engine/types";
import type { Tool } from "../tools";
import type { Board, PageRef } from "./state";

export function exportPlans(board: Board, output: Tool["output"]): ExportPlan[] {
  switch (output) {
    case "images":
    case "compressed":
    case "signed":
    case "transformed":
      return [];
    case "one":
      return board.pages.length > 0 ? [toPlan(board.pages)] : [];
    case "selection": {
      const picked = board.pages.filter((page) => board.selected.includes(page.id));
      return picked.length > 0 ? [toPlan(picked)] : [];
    }
    case "split": {
      const groups: PageRef[][] = [[]];
      board.pages.forEach((page, i) => {
        groups.at(-1)?.push(page);
        if (board.cuts.includes(page.id) && i < board.pages.length - 1) groups.push([]);
      });
      return groups.length > 1 ? groups.map(toPlan) : [];
    }
  }
}

export function canExport(board: Board, output: Tool["output"]): boolean {
  return board.docs.every((doc) => doc.status.kind !== "opening") && exportPlans(board, output).length > 0;
}

/** A tool that works on whole files runs once nothing is still opening and one file at least is ready. */
export function canProduce(board: Board, tool: Tool): boolean {
  if (tool.workspace === "pages") return canExport(board, tool.output);
  return board.docs.every((doc) => doc.status.kind !== "opening") && board.docs.some((doc) => doc.status.kind === "ready");
}

function toPlan(pages: PageRef[]): ExportPlan {
  return pages.map(({ docId, index, rotation }) => ({ docId, index, rotation }));
}
