/**
 * @param {{ label: string, percent: number, valueText: string }} props
 */
export default function ProgressBar({ label, percent, valueText }) {
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">
          {label}
        </span>
        <span className="text-sm font-semibold text-white">{valueText}</span>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-teal-400 transition-[width] duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
