import { useEffect, useRef } from 'react';

export default function SubmitExamDialog({
  open = false,
  answered = 0,
  total = 0,
  flagged = 0,
  onCancel,
  onConfirm,
}) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;

    cancelRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = panelRef.current
        ? Array.from(panelRef.current.querySelectorAll('button:not([disabled])'))
        : [];

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const unanswered = Math.max(0, total - answered);
  const warning =
    unanswered === 1
      ? '1 question is still unanswered. It will score zero.'
      : `${unanswered} questions are still unanswered. They will score zero.`;

  return (
    <div
      data-exam-dialog-backdrop=""
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-submit-title"
        aria-describedby="exam-submit-details"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/50"
      >
        <h2 id="exam-submit-title" className="text-xl font-semibold text-white">
          Submit exam?
        </h2>

        <div id="exam-submit-details" className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          <p>{`${answered} of ${total} answered · ${unanswered} unanswered · ${flagged} flagged`}</p>
          {unanswered > 0 ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-100">
              {warning}
            </p>
          ) : null}
          <p className="text-slate-400">You cannot change your answers after submitting.</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none"
          >
            Keep working
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
          >
            Submit exam
          </button>
        </div>
      </div>
    </div>
  );
}
