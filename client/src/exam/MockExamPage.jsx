import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import StudentShell from '../app/StudentShell.jsx';
import { useAuth } from '../auth/useAuth.js';
import ExamQuestionCard from './ExamQuestionCard.jsx';
import { fetchExamTest, submitAttempt } from './api.js';
import { clearExamProgress, readExamProgress, saveExamProgress } from './examProgressStorage.js';
import {
  EXAM_STATUS,
  EXAM_TICK_MS,
  buildSubmissionPayload,
  countAnsweredQuestions,
  countdownTone,
  createExamViewState,
  formatCountdown,
  hydrateExamViewState,
  moveSentence,
  remainingSeconds,
  withDropdownAnswer,
  withEssayText,
  withExamError,
  withExamSubmitted,
  withExamSubmitting,
  withExamTest,
  withOptionAnswer,
  withSubmissionError,
  withTextField,
} from './examViewState.js';

const PRIMARY_BUTTON =
  'rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';
const SECONDARY_BUTTON =
  'rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none';

const TONE_CLASSES = Object.freeze({
  normal: 'text-white',
  warning: 'text-amber-300',
  critical: 'text-rose-300',
});

const TONE_HINTS = Object.freeze({
  normal: null,
  warning: 'Less than five minutes remaining.',
  critical: 'Less than a minute remaining.',
});

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
            {test.questions?.length ?? 0} questions
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

function ExamTimer({ remaining, answered, totalQuestions }) {
  const tone = countdownTone(remaining);
  const hint = TONE_HINTS[tone];

  return (
    <section
      aria-label="Exam status"
      className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-xl shadow-black/30 backdrop-blur"
    >
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
          Time remaining
        </p>
        <p
          role="timer"
          aria-label="Time remaining"
          className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${TONE_CLASSES[tone]}`}
        >
          {formatCountdown(remaining)}
        </p>
        {hint ? <p className="mt-1 text-xs text-amber-200">{hint}</p> : null}
        {remaining === 0 ? (
          <p className="mt-1 text-xs text-rose-200">The exam window is closed.</p>
        ) : null}
      </div>

      <div className="text-right">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
          Progress
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-200">
          {answered} of {totalQuestions} answered
        </p>
      </div>
    </section>
  );
}

function ResultPanel({ viewState, onNewAttempt }) {
  const result = viewState.result;

  if (!result) {
    return null;
  }

  const pending = result.status === 'pending_review';
  const skillScores = result.skillScores ?? {};
  const manualLabel = (score) => (typeof score === 'number' ? score : 'Awaiting review');

  return (
    <section className="space-y-5 rounded-[2rem] border border-emerald-400/30 bg-emerald-400/5 p-6">
      {viewState.autoSubmitted ? (
        <p
          role="status"
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          Time is up — your answers were submitted automatically.
        </p>
      ) : null}

      <div>
        <h2 className="text-2xl font-semibold text-white">Submission received</h2>
        <p className="mt-2 text-sm text-slate-300">
          {pending ? 'Awaiting lecturer review' : 'Auto-marked'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {pending
            ? 'Core, Reading, and Listening are marked. Writing and Speaking go to the lecturer queue.'
            : 'Every skill in this test was marked instantly.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Auto score
          </p>
          <p className="mt-1 text-3xl font-semibold text-white">{`${result.autoScore ?? 0} / 150`}</p>
          <p className="mt-1 text-xs text-slate-500">Core + Reading + Listening</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Total score
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {typeof result.totalScore === 'number'
              ? `${result.totalScore} / 200`
              : 'Pending lecturer review'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {`${result.answeredCount ?? 0} of ${result.questionCount ?? 0} answered`}
          </p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-5">
        {[
          ['Core', skillScores.core],
          ['Reading', skillScores.reading],
          ['Listening', skillScores.listening],
          ['Writing', manualLabel(skillScores.writing)],
          ['Speaking', manualLabel(skillScores.speaking)],
        ].map(([label, score]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <dt className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-200">{score ?? 0}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link to="/dashboard" className={PRIMARY_BUTTON}>
          Back to dashboard
        </Link>
        <button type="button" onClick={onNewAttempt} className={SECONDARY_BUTTON}>
          Start a new attempt
        </button>
      </div>
    </section>
  );
}

export default function MockExamPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [viewState, setViewState] = useState(createExamViewState);
  const [now, setNow] = useState(() => new Date());
  const [reloadKey, setReloadKey] = useState(0);
  const inFlight = useRef(false);
  const autoSubmitFired = useRef(false);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let active = true;

    autoSubmitFired.current = false;
    setViewState(createExamViewState());

    fetchExamTest(id)
      .then((test) => {
        if (!active) {
          return;
        }

        setNow(new Date());
        setViewState(hydrateExamViewState(readExamProgress(test?.id), test));
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setViewState(
          withExamError(createExamViewState(), {
            message: error?.message,
            details: error?.details ?? [],
          })
        );
      });

    return () => {
      active = false;
    };
  }, [user, id, reloadKey]);

  useEffect(() => {
    saveExamProgress(viewState);
  }, [viewState]);

  useEffect(() => {
    if (viewState.status !== EXAM_STATUS.READY) {
      return undefined;
    }

    const timer = setInterval(() => setNow(new Date()), EXAM_TICK_MS);

    return () => clearInterval(timer);
  }, [viewState.status]);

  const submit = useCallback(
    async (autoSubmitted) => {
      if (inFlight.current || viewState.status !== EXAM_STATUS.READY) {
        return;
      }

      const payload = buildSubmissionPayload(viewState);

      if (!payload) {
        return;
      }

      inFlight.current = true;
      setViewState(withExamSubmitting);

      try {
        const result = await submitAttempt(payload);

        setViewState((current) => withExamSubmitted(current, result, { autoSubmitted }));
      } catch (error) {
        setViewState((current) =>
          withSubmissionError(current, {
            message: error?.message,
            details: error?.details ?? [],
          })
        );
      } finally {
        inFlight.current = false;
      }
    },
    [viewState]
  );

  const remaining = remainingSeconds(viewState.expiresAt, now);
  const expired = viewState.status === EXAM_STATUS.READY && remaining === 0;

  useEffect(() => {
    if (!expired || autoSubmitFired.current) {
      return;
    }

    autoSubmitFired.current = true;

    void submit(true);
  }, [expired, submit]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const test = viewState.test;
  const totalQuestions = test?.questions?.length ?? 0;
  const answered = countAnsweredQuestions(viewState);
  const isReady = viewState.status === EXAM_STATUS.READY;

  function handleRetry() {
    setViewState(createExamViewState());
    setReloadKey((count) => count + 1);
  }

  function handleNewAttempt() {
    clearExamProgress(test?.id);
    inFlight.current = false;
    autoSubmitFired.current = false;
    setNow(new Date());
    setViewState(withExamTest(createExamViewState(), test));
  }

  return (
    <StudentShell>
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-teal-300 uppercase">
            Screen 4 · Timed mock exam
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Mock exam</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Answer the paper inside the time limit. Your answers are saved in this tab, and the
            attempt is submitted automatically when the countdown reaches zero.
          </p>
        </header>

        {viewState.status === EXAM_STATUS.LOADING ? (
          <p
            role="status"
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300"
          >
            Loading your mock exam…
          </p>
        ) : null}

        {viewState.status === EXAM_STATUS.ERROR ? (
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
              <button type="button" onClick={handleRetry} className={SECONDARY_BUTTON}>
                Try again
              </button>
              <Link
                to="/dashboard"
                className="rounded-xl px-2 py-2.5 text-sm font-semibold text-teal-300 underline-offset-4 hover:text-teal-200 hover:underline"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        ) : null}

        {test ? (
          <>
            <TestMeta test={test} />
            <ExamTimer remaining={remaining} answered={answered} totalQuestions={totalQuestions} />

            {viewState.status === EXAM_STATUS.SUBMITTED ? (
              <ResultPanel viewState={viewState} onNewAttempt={handleNewAttempt} />
            ) : (
              <>
                <div className="space-y-4">
                  {(test.questions ?? []).map((question, index) => (
                    <ExamQuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      answer={viewState.answers[question.id]}
                      disabled={!isReady}
                      onOption={(optionIndex) =>
                        setViewState((current) =>
                          withOptionAnswer(current, question.id, optionIndex)
                        )
                      }
                      onDropdown={(setId, optionIndex) =>
                        setViewState((current) =>
                          withDropdownAnswer(current, question.id, setId, optionIndex)
                        )
                      }
                      onSentenceMove={(position, direction) =>
                        setViewState((current) =>
                          moveSentence(current, question.id, position, direction)
                        )
                      }
                      onFieldChange={(fieldId, value) =>
                        setViewState((current) =>
                          withTextField(current, question.id, fieldId, value)
                        )
                      }
                      onEssayChange={(value) =>
                        setViewState((current) => withEssayText(current, question.id, value))
                      }
                    />
                  ))}
                </div>

                <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
                  {viewState.error ? (
                    <div
                      role="alert"
                      className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
                    >
                      <p className="font-semibold">{viewState.error.message}</p>
                      {viewState.error.details?.length ? (
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                          {viewState.error.details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="text-sm text-slate-400">
                    {answered} of {totalQuestions} answers captured. Answers cannot be changed after
                    you submit.
                  </p>

                  <button
                    type="button"
                    onClick={() => void submit(false)}
                    disabled={!isReady || totalQuestions === 0}
                    className={`mt-4 ${PRIMARY_BUTTON}`}
                  >
                    {viewState.status === EXAM_STATUS.SUBMITTING ? 'Submitting…' : 'Submit exam'}
                  </button>
                </section>
              </>
            )}
          </>
        ) : null}
      </div>
    </StudentShell>
  );
}
