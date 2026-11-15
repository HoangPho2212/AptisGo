import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import ProgressBar from '../app/ProgressBar.jsx';
import StudentShell from '../app/StudentShell.jsx';
import AuthAlert from '../auth/AuthAlert.jsx';
import { useAuth } from '../auth/useAuth.js';
import { calculateRemainingDays } from '../goals/goalCadence.js';
import { fetchTodayPlan, updateTaskCompletion } from './api.js';
import TaskChecklist from './TaskChecklist.jsx';
import {
  GOAL_NOT_FOUND_MESSAGE,
  createDashboardViewState,
  isTaskToggleDisabled,
  summarizeToday,
  withDashboardEmpty,
  withDashboardError,
  withDashboardLoading,
  withTaskError,
  withTaskPending,
  withTaskUpdated,
  withTodayPlan,
} from './dashboardViewState.js';

/**
 * @param {string} value
 * @returns {string}
 */
function formatDeadline(value) {
  const deadline = new Date(value);

  if (Number.isNaN(deadline.getTime())) {
    return 'Unknown deadline';
  }

  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(deadline);
}

function ProgressCard({ label, progress }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <ProgressBar label={label} percent={progress.percent} valueText={`${progress.percent}%`} />
      <p className="mt-3 text-xs text-slate-400">
        {progress.completedTasks} of {progress.totalTasks} tasks · {progress.completedPoints} of{' '}
        {progress.totalPoints} points
      </p>
    </div>
  );
}

function GoalSummary({ goal, day }) {
  const remainingDays = calculateRemainingDays(goal.deadline);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Target</p>
        <p className="mt-1 text-lg font-semibold text-white">Aptis {goal.targetCertificate}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Today</p>
        <p className="mt-1 text-lg font-semibold text-white">
          Day {day.dayNumber} of {day.totalDays}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Deadline</p>
        <p className="mt-1 text-lg font-semibold text-white">{formatDeadline(goal.deadline)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {remainingDays === 0 ? 'Deadline reached' : `${remainingDays} days to deadline`}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [viewState, setViewState] = useState(createDashboardViewState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchTodayPlan();

        if (!cancelled) {
          setViewState((current) => withTodayPlan(current, data));
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setViewState((current) =>
          error?.status === 404 && error?.message === GOAL_NOT_FOUND_MESSAGE
            ? withDashboardEmpty(current)
            : withDashboardError(current, {
                message: error?.message,
                details: error?.details ?? [],
              })
        );
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const summary = summarizeToday(viewState.data);

  async function handleToggle(task) {
    if (isTaskToggleDisabled(viewState, task.id)) {
      return;
    }

    setViewState((current) => withTaskPending(current, task.id));

    try {
      const result = await updateTaskCompletion(task.id, !task.isCompleted);

      setViewState((current) =>
        withTaskUpdated(current, {
          taskId: task.id,
          isCompleted: !task.isCompleted,
          plan: result?.plan,
          roadmap: result?.roadmap,
        })
      );
    } catch (error) {
      setViewState((current) =>
        withTaskError(current, {
          message: error?.message,
          details: error?.details ?? [],
        })
      );
    }
  }

  function handleRetry() {
    setViewState(withDashboardLoading);
    setReloadKey((current) => current + 1);
  }

  return (
    <StudentShell active="dashboard">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">
            Screen 3 · Student dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Today&apos;s study roadmap
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Work through today&apos;s tasks, tick each one off, and watch your roadmap progress
            grow.
          </p>
        </header>

        {viewState.status === 'loading' ? (
          <p
            role="status"
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-400"
          >
            Loading today&apos;s roadmap…
          </p>
        ) : null}

        {viewState.status === 'empty' ? (
          <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/30 p-6">
            <h2 className="text-xl font-semibold text-white">You have not set a study goal yet</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Choose your target certificate and official test date. The roadmap starts on the day
              you save it, so today&apos;s tasks appear immediately.
            </p>
            <Link
              to="/goals"
              className="mt-4 inline-block rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
            >
              Set your study goal
            </Link>
          </section>
        ) : null}

        {viewState.status === 'error' ? (
          <div className="space-y-4">
            <AuthAlert
              title={viewState.error?.message ?? 'Something went wrong.'}
              details={viewState.error?.details ?? []}
            />
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none"
            >
              Try again
            </button>
          </div>
        ) : null}

        {viewState.status === 'ready' && viewState.data ? (
          <>
            <GoalSummary goal={viewState.data.goal} day={viewState.data.day} />

            <div className="grid gap-4 lg:grid-cols-2">
              <ProgressCard label="Today's plan" progress={viewState.data.progress} />
              <ProgressCard label="Roadmap" progress={viewState.data.roadmap} />
            </div>

            {viewState.error ? (
              <AuthAlert title={viewState.error.message} details={viewState.error.details} />
            ) : null}

            <section
              aria-labelledby="today-tasks-heading"
              className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="today-tasks-heading" className="text-lg font-semibold text-white">
                  Today&apos;s tasks
                </h2>
                <span className="text-xs font-semibold text-slate-500">
                  {summary.completedTasks} of {summary.totalTasks} done
                </span>
              </div>

              <div className="mt-4">
                <TaskChecklist
                  tasks={viewState.data.day.tasks}
                  isDisabled={(taskId) => isTaskToggleDisabled(viewState, taskId)}
                  onToggle={handleToggle}
                />
              </div>

              {summary.allComplete ? (
                <p
                  role="status"
                  className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
                >
                  Today&apos;s plan is complete. Nice work.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </StudentShell>
  );
}
