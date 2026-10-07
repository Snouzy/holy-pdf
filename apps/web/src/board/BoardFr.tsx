import { fr } from "../i18n/fr";
import Board, { type BoardProps } from "./Board";

export { fr as texts };

export default function BoardFr(props: Omit<BoardProps, "texts">) {
  return <Board {...props} texts={fr} />;
}
