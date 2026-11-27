export const EXAM_SAVE_DEBOUNCE_MS = 400;

/**
 * @param {Date} date
 * @returns {string}
 */
function toIsoString(date) {
  return date instanceof Date && Number.isFinite(date.getTime())
    ? date.toISOString()
    : new Date().toISOString();
}

/**
 * Holds the newest exam state in memory and writes it after a quiet period.
 * Flushing is explicit so submit, tab-hide, and unmount never lose the tail.
 *
 * @param {{
 *   save: (state: object, at: Date) => void,
 *   delay?: number,
 *   now?: () => Date,
 * }} options
 * @returns {{
 *   schedule: (state: object) => void,
 *   flush: () => string|null,
 *   getSnapshot: () => { status: 'idle'|'pending'|'saved', savedAt: string|null },
 *   subscribe: (listener: (snapshot: { status: 'idle'|'pending'|'saved', savedAt: string|null }) => void) => () => void,
 *   dispose: () => void,
 * }}
 */
export function createExamSaveBuffer({
  save,
  delay = EXAM_SAVE_DEBOUNCE_MS,
  now = () => new Date(),
} = {}) {
  if (typeof save !== 'function') {
    throw new TypeError('createExamSaveBuffer requires a save function');
  }

  if (!Number.isFinite(delay) || delay < 0) {
    throw new RangeError('createExamSaveBuffer requires a finite, non-negative delay');
  }

  let pending = null;
  let timer = null;
  let status = 'idle';
  let savedAt = null;
  let snapshotKey = 'idle|';
  const listeners = new Set();

  function getSnapshot() {
    return Object.freeze({ status, savedAt });
  }

  function publish() {
    const key = `${status}|${savedAt ?? ''}`;

    if (key === snapshotKey) {
      return;
    }

    snapshotKey = key;

    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function stopTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function flush() {
    stopTimer();

    if (pending === null) {
      return savedAt;
    }

    const state = pending;
    const at = now();

    pending = null;
    save(state, at);
    savedAt = toIsoString(at);
    status = 'saved';
    publish();

    return savedAt;
  }

  function schedule(state) {
    pending = state;
    status = 'pending';
    stopTimer();
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, delay);
    publish();
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(getSnapshot());

    return () => {
      listeners.delete(listener);
    };
  }

  function dispose() {
    stopTimer();
  }

  return { schedule, flush, getSnapshot, subscribe, dispose };
}
