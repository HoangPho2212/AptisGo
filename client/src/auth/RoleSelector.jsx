import { ROLE_OPTIONS, USER_ROLES } from './authValidation.js';

export default function RoleSelector({
  value,
  onChange,
  allowedRoles = USER_ROLES,
  disabled = false,
  legend = 'Sign in as',
  note,
  name = 'auth-role',
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 block text-sm font-medium text-slate-200">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {ROLE_OPTIONS.map((option) => {
          const isAllowed = allowedRoles.includes(option.value);
          const isSelected = value === option.value;

          return (
            <label
              key={option.value}
              className={`group relative flex cursor-pointer flex-col rounded-xl border p-3 text-left transition focus-within:ring-2 focus-within:ring-teal-400/60 ${
                isSelected
                  ? 'border-teal-400/60 bg-teal-400/10 shadow-[0_0_0_1px_rgba(45,212,191,0.2)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
              } ${!isAllowed || disabled ? 'cursor-not-allowed opacity-50 hover:border-white/10' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                disabled={!isAllowed || disabled}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{option.label}</span>
                <span
                  aria-hidden="true"
                  className={`flex size-4 items-center justify-center rounded-full border text-[10px] ${
                    isSelected
                      ? 'border-teal-300 bg-teal-300 text-slate-950'
                      : 'border-white/20 text-transparent'
                  }`}
                >
                  ✓
                </span>
              </span>
              <span className="mt-1 text-[11px] leading-4 text-slate-400">
                {isAllowed ? option.description : 'Invitation only'}
              </span>
            </label>
          );
        })}
      </div>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </fieldset>
  );
}
