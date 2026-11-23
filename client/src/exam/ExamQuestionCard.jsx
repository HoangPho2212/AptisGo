import { countWords, sentenceOrderFor } from './examViewState.js';

const DROPDOWN_TYPES = Object.freeze(['dropdown_match', 'dropdown_cloze']);

function QuestionMeta({ question, index, flagged, disabled, onToggleFlag }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded-full border border-teal-400/25 bg-teal-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-teal-200 uppercase">
        Item {index + 1} · {question.skill} part {question.part}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">
          {question.questionType}
        </span>
        <button
          type="button"
          aria-pressed={flagged}
          aria-label={`Flag question ${index + 1}`}
          disabled={disabled}
          onClick={onToggleFlag}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
            flagged
              ? 'border-amber-300/60 bg-amber-300/15 text-amber-100'
              : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
          }`}
        >
          <span aria-hidden="true">{flagged ? '⚑' : '⚐'}</span>
          {flagged ? 'Flagged' : 'Flag'}
        </button>
      </div>
    </div>
  );
}

function ChoiceOptions({ question, answer, disabled, onOption }) {
  return (
    <fieldset className="mt-5">
      <legend className="sr-only">{question.prompt}</legend>
      <div className="space-y-2.5">
        {(question.options ?? []).map((option, index) => {
          const optionId = `exam-${question.id}-option-${index}`;

          return (
            <label
              key={optionId}
              htmlFor={optionId}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                answer === index
                  ? 'border-teal-400/60 bg-teal-400/10 text-white'
                  : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                id={optionId}
                type="radio"
                name={`exam-${question.id}`}
                value={index}
                checked={answer === index}
                disabled={disabled}
                onChange={() => onOption(index)}
                className="size-4 accent-teal-400"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function DropdownSets({ question, answer, disabled, onDropdown }) {
  const selections = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};

  return (
    <div className="mt-5 space-y-4">
      {(question.dropdownSets ?? []).map((set) => {
        const selectId = `exam-${question.id}-dropdown-${set.id}`;
        const selected = selections[set.id];

        return (
          <div key={set.id}>
            <label htmlFor={selectId} className="mb-2 block text-sm font-medium text-slate-200">
              {set.prompt}
            </label>
            <select
              id={selectId}
              value={Number.isInteger(selected) ? (set.options?.[selected] ?? '') : ''}
              disabled={disabled}
              onChange={(event) => {
                const optionIndex = (set.options ?? []).indexOf(event.target.value);

                if (optionIndex >= 0) {
                  onDropdown(set.id, optionIndex);
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Choose an option</option>
              {(set.options ?? []).map((option) => (
                <option key={`${set.id}-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function SentenceOrder({ question, answer, disabled, onSentenceMove }) {
  const order = sentenceOrderFor(question, answer);
  const sentences = new Map((question.sentences ?? []).map((sentence) => [sentence.id, sentence]));
  const isFixed = (id) => sentences.get(id)?.isFixed === true;

  return (
    <ol className="mt-5 space-y-2.5">
      {order.map((id, position) => {
        const sentence = sentences.get(id);
        const movable = !isFixed(id) && !disabled;
        const canMoveUp = movable && position > 0 && !isFixed(order[position - 1]);
        const canMoveDown = movable && position < order.length - 1 && !isFixed(order[position + 1]);

        return (
          <li
            key={id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
          >
            <span className="text-xs font-semibold text-slate-500">{position + 1}</span>
            <span className="flex-1">{sentence?.text ?? id}</span>
            {isFixed(id) ? (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Fixed
              </span>
            ) : null}
            <span className="flex gap-1">
              <button
                type="button"
                aria-label={`Move up ${position + 1}`}
                disabled={!canMoveUp}
                onClick={() => onSentenceMove(position, 'up')}
                className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move down ${position + 1}`}
                disabled={!canMoveDown}
                onClick={() => onSentenceMove(position, 'down')}
                className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ShortFields({ question, answer, disabled, onFieldChange }) {
  const values = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {(question.formFields ?? []).map((field) => {
        const inputId = `exam-${question.id}-field-${field.fieldId}`;

        return (
          <div key={field.fieldId}>
            <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-slate-200">
              {field.label}
            </label>
            <input
              id={inputId}
              type="text"
              value={values[field.fieldId] ?? ''}
              disabled={disabled}
              onChange={(event) => onFieldChange(field.fieldId, event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        );
      })}
    </div>
  );
}

function EssayText({ question, answer, promptId, disabled, onEssayChange }) {
  const text = typeof answer === 'string' ? answer : '';
  const words = countWords(text);
  const limits =
    Number.isFinite(question.minWords) || Number.isFinite(question.maxWords)
      ? `Write ${question.minWords ?? 0}–${question.maxWords ?? '∞'} words. `
      : '';

  return (
    <div className="mt-5">
      <textarea
        aria-labelledby={promptId}
        value={text}
        disabled={disabled}
        maxLength={20000}
        rows={8}
        onChange={(event) => onEssayChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-slate-500">
        {limits}
        {words} {words === 1 ? 'word' : 'words'}
      </p>
    </div>
  );
}

function AudioNotice() {
  return (
    <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
      Recording arrives with FR05 (audio submission). This task is stored as unanswered so a
      lecturer reviews it.
    </p>
  );
}

export default function ExamQuestionCard({
  question,
  index,
  answer,
  anchorId,
  flagged = false,
  disabled = false,
  onOption,
  onDropdown,
  onSentenceMove,
  onFieldChange,
  onEssayChange,
  onToggleFlag,
}) {
  if (!question) {
    return null;
  }

  const promptId = `exam-${question.id}-prompt`;

  return (
    <section
      id={anchorId}
      tabIndex={-1}
      aria-labelledby={promptId}
      className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 transition focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/30 focus:outline-none"
    >
      <QuestionMeta
        question={question}
        index={index}
        flagged={flagged}
        disabled={disabled}
        onToggleFlag={onToggleFlag}
      />

      {question.contextPassage ? (
        <p className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm leading-6 text-slate-400">
          {question.contextPassage}
        </p>
      ) : null}

      <p id={promptId} className="mt-4 text-base leading-7 font-medium text-white">
        {question.prompt}
      </p>

      {question.questionType === 'mcq_single' ? (
        <ChoiceOptions
          question={question}
          answer={answer}
          disabled={disabled}
          onOption={onOption}
        />
      ) : null}

      {DROPDOWN_TYPES.includes(question.questionType) ? (
        <DropdownSets
          question={question}
          answer={answer}
          disabled={disabled}
          onDropdown={onDropdown}
        />
      ) : null}

      {question.questionType === 'sentence_order' ? (
        <SentenceOrder
          question={question}
          answer={answer}
          disabled={disabled}
          onSentenceMove={onSentenceMove}
        />
      ) : null}

      {question.questionType === 'short_fields' ? (
        <ShortFields
          question={question}
          answer={answer}
          disabled={disabled}
          onFieldChange={onFieldChange}
        />
      ) : null}

      {question.questionType === 'essay_text' ? (
        <EssayText
          question={question}
          answer={answer}
          promptId={promptId}
          disabled={disabled}
          onEssayChange={onEssayChange}
        />
      ) : null}

      {question.questionType === 'audio_record' ? <AudioNotice /> : null}
    </section>
  );
}
