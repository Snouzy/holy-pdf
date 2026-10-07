import { ptBR } from "../i18n/ptBR";
import Board, { type BoardProps } from "./Board";

export { ptBR as texts };

export default function BoardPtBr(props: Omit<BoardProps, "texts">) {
  return <Board {...props} texts={ptBR} />;
}
