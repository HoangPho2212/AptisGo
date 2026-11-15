import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import StudentShell from '../app/StudentShell.jsx';
import AuthAlert from '../auth/AuthAlert.jsx';
import FormField from '../auth/FormField.jsx';
import { useAuth } from '../auth/useAuth.js';
import { readPlacementProgress } from '../placement/placementProgressStorage.js';
import { createGoalRequest } from './api.js';
import { calculateRoadmapPreview, todayIsoDate } from './goalCadence.js';
import {
  GOAL_TARGETS,
  createGoalViewState,
  isGoalSubmitDisabled,
  validateGoalViewState,
  withDailyMinutes,
  withDeadline,
  withGoalError,
  withGoalSuccess,
  withGoalSubmitting,
  withTarget,
} from './goalViewState.js';

const TARGET_HINTS = Object.freeze({
  B1: 'Independent user · everyday fluency',
  B2: 'Upper intermediate · study and work',
});

const MINUTE_OPTIONS = Object.freeze([15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240]);

const INPUT_CLASS =
  'w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20';

function formatDeadline(value) {
  const deadline = new Date(value);

  if (Number.isNaN(deadline.getTime())) {
    return 'Unknown deadline';
  }

  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(deadline);
}

function BaselineCard({ level }) {
  const baseline = typeof level === 'string' && level !== 'UNTESTED' ? level : 'Not evaluated yet';

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Current baseline
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{baseline}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Baseline comes from the diagnostic. Until marking ships, the account level is used as-is.
      </p>
    </div>
  );
}

function DiagnosticCard({ progress }) {
  if (!progress) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-5 text-sm text-slate-400">
        <p className="font-medium text-slate-200">No diagnostic answers in this tab yet.</p>
        <p className="mt-1">You can still set a goal now.</p>
        <Link
          to="/placement"
          className="mt-3 inline-block text-sm font-semibold text-teal-300 underline-offset-4 hover:text-teal-200 hover:underline"
        >
          Take the diagnostic
        </Link>
      </div>
    );
  }

  const answered = Object.keys(progress.answers).length;
  const answerable = progress.test.answerableCount;
  const finished = Boolean(progress.completedAt);

  return (
    <div className="rounded-2xl border border-teal-400/25 bg-teal-400/10 p-5 text-sm text-teal-50">
      <p className="font-semibold text-teal-100">Diagnostic answers captured</p>
      <p className="mt-1">
        {answered} of {answerable} answers captured · {finished ? 'finished' : 'in progress'}
      </p>
      <p className="mt-1 text-xs text-teal-100/80">
        Marking arrives with the submissions ticket (FR04). No CEFR baseline is stored yet.
      </p>
      <Link
        to="/placement"
        className="mt-3 inline-block text-sm font-semibold text-teal-200 underline-offset-4 hover:text-teal-100 hover:underline"
      >
        Review the diagnostic
      </Link>
    </div>
  );
}

function CadencePreview({ preview }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Cadence preview
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Days remaining</dt>
          <dd className="text-lg font-semibold text-white">{preview.remainingDays} days</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Study load</dt>
          <dd className="text-lg font-semibold text-white">{preview.tasksPerDay} tasks per day</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Total tasks</dt>
          <dd className="text-lg font-semibold text-white">{preview.totalTasks} tasks in total</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        Preview only. The server recalculates the roadmap from the saved deadline.
      </p>
    </div>
  );
}

function GoalResult({ result }) {
  return (
    <section
      role="region"
      aria-labelledby="goal-result-heading"
      className="rounded-[2rem] border border-emerald-400/30 bg-emerald-400/10 p-6"
    >
      <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300 uppercase">
        Goal saved
      </p>
      <h2 id="goal-result-heading" className="mt-2 text-2xl font-semibold text-white">
        Your study plan is ready
      </h2>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-emerald-200/80">Target</dt>
          <dd className="text-lg font-semibold text-white">
            Aptis {result.goal.targetCertificate}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-emerald-200/80">Deadline</dt>
          <dd className="text-lg font-semibold text-white">
            {formatDeadline(result.goal.deadline)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-emerald-200/80">Roadmap</dt>
          <dd className="text-lg font-semibold text-white">{result.roadmap.totalDays} days</dd>
        </div>
        <div>
          <dt className="text-xs text-emerald-200/80">Daily load</dt>
          <dd className="text-lg font-semibold text-white">
            {result.roadmap.tasksPerDay} tasks per day
          </dd>
        </div>
        <div>
          <dt className="text-xs text-emerald-200/80">Total tasks</dt>
          <dd className="text-lg font-semibold text-white">{result.roadmap.totalTasks} tasks</dd>
        </div>
      </dl>

      <Link
        to="/student"
        className="mt-5 inline-block rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
      >
        Open my workspace
      </Link>
    </section>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const [viewState, setViewState] = useState(createGoalViewState);
  const [captured] = useState(readPlacementProgress);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const preview = calculateRoadmapPreview({
    deadline: viewState.deadline,
    dailyMinutesTarget: viewState.dailyMinutesTarget,
  });

  async function handleSubmit(event) {
    event.preventDefault();

    const validation = validateGoalViewState(viewState, new Date());

    setViewState((current) => ({ ...current, fieldErrors: validation.errors }));

    if (!validation.value) {
      return;
    }

    setViewState(withGoalSubmitting);

    try {
      const result = await createGoalRequest(validation.value);
      setViewState((current) => withGoalSuccess(current, result));
    } catch (error) {
      setViewState((current) =>
        withGoalError(current, {
          message: error?.message ?? 'Something went wrong. Please try again.',
          details: error?.details ?? [],
        })
      );
    }
  }

  return (
    <StudentShell active="goals">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">
            Screen 2 · Goal setting
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Set your study goal
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Choose the Aptis certificate you are preparing for and the date of your official test.
            The roadmap is generated from both.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <BaselineCard level={user.currentLevel} />
          <DiagnosticCard progress={captured} />
        </div>

        {viewState.result ? <GoalResult result={viewState.result} /> : null}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30"
        >
          <fieldset>
            <legend className="mb-3 block text-sm font-medium text-slate-200">
              Target certificate
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {GOAL_TARGETS.map((target) => (
                <label
                  key={target}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                    viewState.targetCertificate === target
                      ? 'border-teal-400/60 bg-teal-400/10'
                      : 'border-white/10 bg-slate-950/40 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetCertificate"
                    value={target}
                    checked={viewState.targetCertificate === target}
                    onChange={() => setViewState((current) => withTarget(current, target))}
                    className="mt-1 size-4 accent-teal-400"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">Aptis {target}</span>
                    <span className="block text-xs text-slate-400">{TARGET_HINTS[target]}</span>
                  </span>
                </label>
              ))}
            </div>
            {viewState.fieldErrors.targetCertificate ? (
              <p role="alert" className="mt-2 text-xs text-rose-300">
                {viewState.fieldErrors.targetCertificate}
              </p>
            ) : null}
          </fieldset>

          <FormField
            id="goal-deadline"
            label="Official test deadline"
            type="date"
            min={todayIsoDate()}
            value={viewState.deadline}
            onChange={(event) =>
              setViewState((current) => withDeadline(current, event.target.value))
            }
            error={viewState.fieldErrors.deadline}
            hint="A date-only deadline covers the end of that UTC day."
            required
          />

          <div>
            <label
              htmlFor="goal-daily-minutes"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Daily study time
            </label>
            <select
              id="goal-daily-minutes"
              value={viewState.dailyMinutesTarget}
              onChange={(event) =>
                setViewState((current) => withDailyMinutes(current, Number(event.target.value)))
              }
              className={INPUT_CLASS}
            >
              {MINUTE_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes per day
                </option>
              ))}
            </select>
            {viewState.fieldErrors.dailyMinutesTarget ? (
              <p role="alert" className="mt-1.5 text-xs text-rose-300">
                {viewState.fieldErrors.dailyMinutesTarget}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Each 15 minutes adds one daily task, up to eight tasks per day.
              </p>
            )}
          </div>

          {viewState.deadline && preview ? <CadencePreview preview={preview} /> : null}

          <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
            Saving a new goal replaces your roadmap and resets completed tasks.
          </p>

          {viewState.error ? (
            <AuthAlert title={viewState.error.message} details={viewState.error.details} />
          ) : null}

          <button
            type="submit"
            disabled={isGoalSubmitDisabled(viewState)}
            aria-busy={viewState.status === 'submitting'}
            className="w-full rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {viewState.status === 'submitting' ? 'Generating your plan…' : 'Generate my study plan'}
          </button>
        </form>
      </div>
    </StudentShell>
  );
}
