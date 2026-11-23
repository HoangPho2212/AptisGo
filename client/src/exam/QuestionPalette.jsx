const CHIP_BASE =
  'relative flex size-10 items-center justify-center rounded-xl border text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-teal-400/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

const CHIP_STATES = Object.freeze({
  answered: 'border-teal-400/50 bg-teal-400/15 text-teal-100 hover:bg-teal-400/25',
  unanswered: 'border-white/15 bg-slate-950/50 text-slate-300 hover:border-white/30',
});
const CHIP_FLAGGED = 'border-amber-300/60 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20';
const CHIP_ACTIVE = 'ring-2 ring-white/60 ring-offset-2 ring-offset-slate-900';

const LEGEND_DOT = 'inline-block size-2.5 rounded-full';

function paletteLabel(status) {
  const answered = status.answered ? 'answered' : 'unanswered';
  const suffix = status.flagged ? ', flagged' : '';

  return `Question ${status.number}, ${status.skill} part ${status.part}, ${answered}${suffix}`;
}

export default function QuestionPalette({
  statuses = [],
  activeQuestionId = null,
  onJump,
  disabled = false,
}) {
  const answered = statuses.filter((status) => status.answered).length;
  const flagged = statuses.filter((status) => status.flagged).length;
  const unanswered = statuses.length - answered;

  return (
    <nav
      aria-labelledby="exam-palette-title"
      className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="exam-palette-title" className="text-sm font-semibold text-white">
          Question palette
        </h2>
        <p className="text-xs text-slate-400">
          {answered} answered · {unanswered} unanswered · {flagged} flagged
        </p>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {statuses.map((status) => {
          const isActive = status.questionId === activeQuestionId;

          return (
            <li key={status.questionId}>
              <button
                type="button"
                aria-label={paletteLabel(status)}
                aria-current={isActive ? 'true' : undefined}
                disabled={disabled}
                onClick={() => onJump(status.questionId)}
                className={`${CHIP_BASE} ${
                  status.flagged
                    ? CHIP_FLAGGED
                    : CHIP_STATES[status.answered ? 'answered' : 'unanswered']
                } ${isActive ? CHIP_ACTIVE : ''}`}
              >
                <span aria-hidden="true">{status.number}</span>
                <span
                  aria-hidden="true"
                  className={`absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-300 transition ${
                    status.flagged ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <ul className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-400">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`${LEGEND_DOT} bg-teal-400`} />
          Answered
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`${LEGEND_DOT} border border-white/40`} />
          Unanswered
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`${LEGEND_DOT} bg-amber-300`} />
          Flagged for review
        </li>
      </ul>
    </nav>
  );
}
