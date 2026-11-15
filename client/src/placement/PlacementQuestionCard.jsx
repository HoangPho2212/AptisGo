import { isQuestionAnswerable } from './placementViewState.js';

const DROPDOWN_TYPES = Object.freeze(['dropdown_match', 'dropdown_cloze']);

function QuestionMeta({ question, index }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded-full border border-teal-400/25 bg-teal-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-teal-200 uppercase">
        Item {index + 1} · {question.skill} part {question.part}
      </span>
      <span className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">
        {question.questionType}
      </span>
    </div>
  );
}

function ChoiceOptions({ question, answer, onOption }) {
  return (
    <fieldset className="mt-5">
      <legend className="sr-only">{question.prompt}</legend>
      <div className="space-y-2.5">
        {question.options.map((option, index) => {
          const optionId = `option-${question.id}-${index}`;

          return (
            <label
              key={optionId}
              htmlFor={optionId}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                answer?.optionIndex === index
                  ? 'border-teal-400/60 bg-teal-400/10 text-white'
                  : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'
              }`}
            >
              <input
                id={optionId}
                type="radio"
                name={`question-${question.id}`}
                value={index}
                checked={answer?.optionIndex === index}
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

function DropdownSets({ question, answer, onDropdown }) {
  const selections = answer?.kind === 'dropdowns' ? answer.selections : {};

  return (
    <div className="mt-5 space-y-4">
      {question.dropdownSets.map((set) => {
        const selectId = `dropdown-${question.id}-${set.id}`;
        const selected = selections[set.id];

        return (
          <div key={set.id}>
            <label htmlFor={selectId} className="mb-2 block text-sm font-medium text-slate-200">
              {set.prompt}
            </label>
            <select
              id={selectId}
              value={Number.isInteger(selected) ? set.options[selected] : ''}
              onChange={(event) => {
                const optionIndex = set.options.indexOf(event.target.value);

                if (optionIndex >= 0) {
                  onDropdown(set.id, optionIndex);
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
            >
              <option value="">Choose an option</option>
              {set.options.map((option) => (
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

export default function PlacementQuestionCard({ question, answer, index, onOption, onDropdown }) {
  if (!question) {
    return null;
  }

  return (
    <section
      aria-labelledby={`question-${question.id}-prompt`}
      className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
    >
      <QuestionMeta question={question} index={index} />

      {question.contextPassage ? (
        <p className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm leading-6 text-slate-400">
          {question.contextPassage}
        </p>
      ) : null}

      <p
        id={`question-${question.id}-prompt`}
        className="mt-4 text-base leading-7 font-medium text-white"
      >
        {question.prompt}
      </p>

      {question.questionType === 'mcq_single' && isQuestionAnswerable(question) ? (
        <ChoiceOptions question={question} answer={answer} onOption={onOption} />
      ) : null}

      {DROPDOWN_TYPES.includes(question.questionType) && isQuestionAnswerable(question) ? (
        <DropdownSets question={question} answer={answer} onDropdown={onDropdown} />
      ) : null}

      {!isQuestionAnswerable(question) ? (
        <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
          This question type is not part of this runner yet. Answer it in the exam screen once audio
          and long-text support arrives (FR05).
        </p>
      ) : null}
    </section>
  );
}
