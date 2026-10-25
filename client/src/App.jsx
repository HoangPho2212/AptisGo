import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export default function App() {
  const [health, setHealth] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal });
        setHealth(response.ok ? 'online' : 'offline');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setHealth('offline');
        }
      }
    }

    checkHealth();
    return () => controller.abort();
  }, []);

  const isOnline = health === 'online';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-teal-400 uppercase">APTIS GO</p>
        <h1 className="mt-3 text-3xl font-bold">Client &amp; server scaffold</h1>
        <p className="mt-2 text-sm text-slate-400">
          React 19, TailwindCSS 4, and Express 5 are wired and ready for AG-101.
        </p>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
          <span
            className={`size-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}
          />
          <span className="text-sm">API status: {health}</span>
        </div>
      </section>
    </main>
  );
}
