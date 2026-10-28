function Brand() {
  return (
    <div className="flex flex-col gap-1">
      <img src="/aptis-logo-full.svg" alt="APTIS GO" className="h-10 w-auto" />
      <p className="text-xs text-slate-400">Greenwich English preparation</p>
    </div>
  );
}

function CheckItem({ children }) {
  return (
    <li className="flex items-start gap-3 text-sm text-slate-300">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-[11px] font-bold text-teal-300"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  asideLabel = 'Screen 1 · Access gateway',
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06111f] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(20,184,166,0.18),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(37,99,235,0.14),transparent_40%)]"
      />

      <div className="relative mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.02fr_0.98fr]">
        <aside className="hidden flex-col justify-between px-12 py-12 lg:flex xl:px-16">
          <Brand />

          <div className="max-w-lg">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-teal-300 uppercase">
              <span className="size-1.5 rounded-full bg-teal-300" />
              {asideLabel}
            </p>
            <h2 className="text-5xl leading-[1.05] font-semibold tracking-tight text-white">
              Practice with purpose.
              <span className="block text-teal-300">Prove your English.</span>
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-400">
              Adaptive placement, lecturer-reviewed productive skills, and a CEFR roadmap built
              around the official Aptis 0–200 scale.
            </p>

            <ul className="mt-8 space-y-4">
              <CheckItem>Adaptive diagnostic placement across all four skills</CheckItem>
              <CheckItem>Writing and speaking reviewed against the Aptis rubric</CheckItem>
              <CheckItem>Progress tied to your target CEFR and deadline</CheckItem>
            </ul>
          </div>

          <div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['0–200', 'Aptis scale'],
                ['4', 'Core skills'],
                ['1', 'Clear goal'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-xl font-semibold text-white">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-slate-500">
              LSEPI-aligned · GDPR-aware · Secure JWT sessions
            </p>
          </div>
        </aside>

        <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-xl">
            <div className="mb-8 lg:hidden">
              <Brand />
            </div>

            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
              <p className="text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>

              <div className="mt-8">{children}</div>
            </section>

            {footer ? (
              <div className="mt-5 text-center text-xs text-slate-500">{footer}</div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
