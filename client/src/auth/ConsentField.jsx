export default function ConsentField({ checked, onChange, error }) {
  const errorId = error ? 'gdpr-consent-error' : undefined;

  return (
    <div>
      <label
        htmlFor="gdpr-consent"
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
          error
            ? 'border-rose-400/50 bg-rose-400/5'
            : 'border-white/10 bg-white/[0.03] hover:border-white/20'
        }`}
      >
        <input
          id="gdpr-consent"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-slate-950 accent-teal-400"
        />
        <span className="text-sm leading-6 text-slate-300">
          <strong className="font-semibold text-white">
            I consent to the processing of my student profile, coursework, and assessment responses
          </strong>{' '}
          for academic evaluation under UK/EU GDPR Article 6(1)(b) and Greenwich LSEPI policy.
        </span>
      </label>

      <details className="mt-2 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-300 focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none">
          What we collect and why
        </summary>
        <p className="mt-2 leading-5">
          We store your name, email address, student ID, practice responses, and assessment results.
          Data is restricted to exam administration, diagnostic modelling, and rubric evaluation.
          You can request access, correction, or deletion through the university privacy process.
        </p>
      </details>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
