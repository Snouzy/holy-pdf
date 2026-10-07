import { en } from "../i18n/en";
import Board, { type BoardProps } from "./Board";

export { en as texts };

export default function BoardEn(props: Omit<BoardProps, "texts">) {
  return <Board {...props} texts={en} />;
}
