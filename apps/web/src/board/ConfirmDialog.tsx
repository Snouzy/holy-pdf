import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Confirm } from "./deliver";

export type Question = { message: string; cancel: string; confirm: string };

export function ConfirmDialog({ question, onAnswer }: { question: Question | null; onAnswer: (yes: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  useEffect(() => {
    if (!question) return;
    confirmed.current = false;
    dialog.current?.showModal();
  }, [question]);
  return (
    <dialog ref={dialog} class="confirm" onClose={() => onAnswer(confirmed.current)}>
      {question && (
        <form method="dialog">
          <p>{question.message}</p>
          <div class="confirm-actions">
            <button type="submit">{question.cancel}</button>
            <button type="submit" class="primary" onClick={() => (confirmed.current = true)}>
              {question.confirm}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

export function useConfirm(): [Confirm, JSX.Element] {
  const [question, setQuestion] = useState<Question | null>(null);
  const answer = useRef<(yes: boolean) => void>(() => {});
  const ask: Confirm = (message, labels) =>
    new Promise((resolve) => {
      answer.current(false);
      answer.current = resolve;
      setQuestion({ message, ...labels });
    });
  const element = (
    <ConfirmDialog
      question={question}
      onAnswer={(yes) => {
        setQuestion(null);
        answer.current(yes);
      }}
    />
  );
  return [ask, element];
}
