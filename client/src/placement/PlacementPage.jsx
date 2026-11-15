import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import StudentShell from '../app/StudentShell.jsx';
import { useAuth } from '../auth/useAuth.js';
import PlacementQuestionCard from './PlacementQuestionCard.jsx';
import { fetchPlacementTest } from './api.js';
import { readPlacementProgress, savePlacementProgress } from './placementProgressStorage.js';
import {
  canFinishPlacement,
  countAnswerableQuestions,
  countAnsweredQuestions,
  createPlacementViewState,
  finishPlacement,
  getCurrentQuestion,
  hydratePlacementViewState,
  nextQuestion,
  previousQuestion,
  withDropdownAnswer,
  withOptionAnswer,
  withPlacementError,
} from './placementViewState.js';

const SECONDARY_BUTTON =
  'rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY_BUTTON =
  'rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

function TestMeta({ test }) {
  const skills = Array.isArray(test.skillModules) ? test.skillModules : [];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{test.title}</h2>
          {test.description ? (
            <p className="mt-1 text-sm leading-6 text-slate-400">{test.description}</p>
          ) : null}
        </div>
        <div className="flex gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 px-3 py-1">
            {test.durationMinutes} minutes
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            {test.questionCount ?? test.questions?.length ?? 0} questions
          </span>
        </div>
      </div>

      {skills.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              key={skill}
              className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase"
            >
              {skill}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PlacementSummary({ viewState, onReview }) {
  const answerable = countAnswerableQuestions(viewState.test);
  const answered = countAnsweredQuestions(viewState);

  return (
    <section className="rounded-[2rem] border border-emerald-400/30 bg-emerald-400/10 p-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300 uppercase">
        Diagnostic captured
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Answers captured</h2>
      <p className="mt-2 text-sm text-emerald-50">
        {answered} of {answerable} answers captured. Your answers stay in this browser tab.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
        Server-side marking arrives with the submissions ticket (FR04), so no CEFR baseline is shown
        yet. You can set your target and deadline now.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/goals" className={PRIMARY_BUTTON}>
          Set your goal
        </Link>
        <button type="button" onClick={onReview} className={SECONDARY_BUTTON}>
          Review answers
        </button>
      </div>
    </section>
  );
}

export default function PlacementPage() {
  const { user } = useAuth();
  const [viewState, setViewState] = useState(createPlacementViewState);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let active = true;

    setViewState(createPlacementViewState());

    fetchPlacementTest()
      .then((test) => {
        if (!active) {
          return;
        }

        setViewState(hydratePlacementViewState(readPlacementProgress(), test));
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setViewState((current) =>
          withPlacementError(current, {
            message: error?.message ?? 'Unable to load the diagnostic.',
            details: error?.details ?? [],
          })
        );
      });

    return () => {
      active = false;
    };
  }, [user, reloadCount]);

  useEffect(() => {
    savePlacementProgress(viewState);
  }, [viewState]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const question = getCurrentQuestion(viewState);
  const totalQuestions = viewState.test?.questions?.length ?? 0;
  const answerable = countAnswerableQuestions(viewState.test);
  const answered = countAnsweredQuestions(viewState);

  return (
    <StudentShell active="placement">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">
            Screen 2 · Diagnostic placement
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Diagnostic placement
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Calibrate your Aptis baseline one question at a time. Answers are captured in this tab
            so you can continue to goal setting without losing work.
          </p>
        </header>

        {viewState.status === 'loading' ? (
          <div
            role="status"
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300"
          >
            Loading your diagnostic…
          </div>
        ) : null}

        {viewState.status === 'error' ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6 text-sm text-rose-100"
          >
            <p className="text-base font-semibold">{viewState.error?.message}</p>
            {viewState.error?.details?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-100/90">
                {viewState.error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setReloadCount((count) => count + 1)}
                className={SECONDARY_BUTTON}
              >
                Try again
              </button>
              <Link
                to="/goals"
                className="rounded-xl px-2 py-2.5 text-sm font-semibold text-teal-300 underline-offset-4 hover:text-teal-200 hover:underline"
              >
                Set your goal instead
              </Link>
            </div>
          </div>
        ) : null}

        {viewState.status === 'ready' || viewState.status === 'finished' ? (
          <>
            <TestMeta test={viewState.test} />

            {viewState.status === 'finished' ? (
              <PlacementSummary
                viewState={viewState}
                onReview={() =>
                  setViewState((current) => ({ ...current, status: 'ready', completedAt: null }))
                }
              />
            ) : (
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    Question {viewState.currentIndex + 1} of {totalQuestions}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300">
                    {answered} of {answerable} answers captured
                  </span>
                </div>

                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-teal-400 transition-all"
                    style={{
                      width: `${totalQuestions === 0 ? 0 : ((viewState.currentIndex + 1) / totalQuestions) * 100}%`,
                    }}
                  />
                </div>

                <div className="mt-6">
                  <PlacementQuestionCard
                    question={question}
                    answer={question ? viewState.answers[question.id] : undefined}
                    index={viewState.currentIndex}
                    onOption={(optionIndex) =>
                      setViewState((current) => withOptionAnswer(current, question.id, optionIndex))
                    }
                    onDropdown={(setId, optionIndex) =>
                      setViewState((current) =>
                        withDropdownAnswer(current, question.id, setId, optionIndex)
                      )
                    }
                  />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                  <button
                    type="button"
                    onClick={() => setViewState(previousQuestion)}
                    disabled={viewState.currentIndex === 0}
                    className={SECONDARY_BUTTON}
                  >
                    Previous question
                  </button>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setViewState(nextQuestion)}
                      disabled={viewState.currentIndex >= totalQuestions - 1}
                      className={SECONDARY_BUTTON}
                    >
                      Next question
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewState((current) => finishPlacement(current))}
                      disabled={!canFinishPlacement(viewState)}
                      className={PRIMARY_BUTTON}
                    >
                      Finish diagnostic
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </StudentShell>
  );
}
