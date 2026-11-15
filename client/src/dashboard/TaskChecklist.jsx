const SKILL_LABELS = Object.freeze({
  core: 'Core',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
});

/**
 * @param {string} skill
 * @returns {string}
 */
function skillLabel(skill) {
  return SKILL_LABELS[skill] ?? 'Practice';
}

/**
 * @param {{
 *   tasks: Array<object>,
 *   isDisabled: (taskId: string) => boolean,
 *   onToggle: (task: object) => void
 * }} props
 */
export default function TaskChecklist({ tasks, isDisabled, onToggle }) {
  return (
    <ul className="space-y-3">
      {tasks.map((task) => {
        const disabled = isDisabled(task.id);

        return (
          <li key={task.id}>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                task.isCompleted
                  ? 'border-emerald-400/25 bg-emerald-400/[0.06]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20'
              } ${disabled ? 'cursor-wait opacity-70' : ''}`}
            >
              <input
                type="checkbox"
                checked={task.isCompleted}
                disabled={disabled}
                onChange={() => {
                  onToggle(task);
                }}
                className="mt-1 size-4 accent-teal-400"
              />

              <span className="flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    task.isCompleted ? 'text-slate-400 line-through' : 'text-white'
                  }`}
                >
                  {task.title}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {skillLabel(task.skill)} · Part {task.partNumber} · {task.points} points
                </span>
              </span>

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  task.isCompleted
                    ? 'bg-emerald-400/15 text-emerald-200'
                    : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {task.isCompleted ? 'Done' : 'To do'}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
