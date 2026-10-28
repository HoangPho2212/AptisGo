export default function AuthAlert({ tone = 'error', title, details = [] }) {
  const isError = tone === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-rose-400/30 bg-rose-400/10 text-rose-100'
          : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
      }`}
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            isError ? 'bg-rose-400/20 text-rose-200' : 'bg-emerald-400/20 text-emerald-200'
          }`}
        >
          {isError ? '!' : '✓'}
        </span>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          {details.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-xs opacity-90">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
