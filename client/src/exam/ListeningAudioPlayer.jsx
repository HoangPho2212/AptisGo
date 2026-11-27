import { useRef, useState } from 'react';

import { LISTENING_PLAY_LIMIT, formatPlayClock } from './examViewState.js';

const PLAYBACK_ERROR = 'Audio could not start. Check your connection and try again.';

export default function ListeningAudioPlayer({
  questionId,
  src,
  playsUsed = 0,
  limit = LISTENING_PLAY_LIMIT,
  disabled = false,
  onPlayStarted,
}) {
  const audioRef = useRef(null);
  const sessionStarted = useRef(false);
  const trackEnded = useRef(false);
  const pendingPlay = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });

  const exhausted = playsUsed >= limit;
  const remaining = Math.max(0, limit - playsUsed);
  const percent =
    progress.duration > 0
      ? Math.min(100, Math.round((progress.current / progress.duration) * 100))
      : 0;

  const controlLabel = isPlaying
    ? 'Pause'
    : exhausted
      ? 'No plays remaining'
      : playsUsed > 0
        ? 'Play again'
        : 'Play audio';

  async function handlePlay() {
    const audio = audioRef.current;

    if (!audio || disabled || pendingPlay.current) {
      return;
    }

    const resuming = sessionStarted.current && !trackEnded.current;

    if (!resuming && exhausted) {
      return;
    }

    pendingPlay.current = true;

    try {
      await audio.play();

      if (!resuming) {
        sessionStarted.current = true;
        trackEnded.current = false;
        onPlayStarted?.();
      }

      setIsPlaying(true);
      setError(null);
    } catch {
      setIsPlaying(false);
      setError(PLAYBACK_ERROR);
    } finally {
      pendingPlay.current = false;
    }
  }

  function handlePause() {
    audioRef.current?.pause();
    setIsPlaying(false);
  }

  function handleEnded() {
    setIsPlaying(false);
    trackEnded.current = true;
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setProgress({
      current: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
  }

  return (
    <div
      data-question-id={questionId}
      className="mt-5 rounded-xl border border-white/10 bg-slate-950/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled || (!isPlaying && exhausted)}
            onClick={isPlaying ? handlePause : handlePlay}
            className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden="true">{isPlaying ? '❚❚' : '▶'}</span>
            {controlLabel}
          </button>
          <p className="text-xs text-slate-400">{`${playsUsed} of ${limit} plays used`}</p>
        </div>
        <p
          role="status"
          className={`text-xs font-semibold ${exhausted ? 'text-rose-300' : 'text-amber-200'}`}
        >
          {remaining === 0
            ? 'No plays remaining'
            : remaining === 1
              ? '1 play remaining'
              : `${remaining} plays remaining`}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Audio progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-teal-400 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {`${formatPlayClock(progress.current)} / ${formatPlayClock(progress.duration)}`}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
      />
    </div>
  );
}
