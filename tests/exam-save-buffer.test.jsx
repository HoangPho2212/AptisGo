import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXAM_SAVE_DEBOUNCE_MS, createExamSaveBuffer } from '../client/src/exam/examSaveBuffer.js';

const NOW = new Date('2026-11-27T09:00:00.000Z');

function createBuffer(overrides = {}) {
  const save = vi.fn();
  const buffer = createExamSaveBuffer({
    save,
    now: () => NOW,
    ...overrides,
  });

  return { buffer, save };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Exam save buffer', () => {
  it('uses a 400 ms debounce by default', () => {
    expect(EXAM_SAVE_DEBOUNCE_MS).toBe(400);
  });

  it('collapses several schedules into one write of the newest state', () => {
    const { buffer, save } = createBuffer();

    buffer.schedule({ answer: 'a' });
    buffer.schedule({ answer: 'ab' });
    buffer.schedule({ answer: 'abc' });

    vi.advanceTimersByTime(EXAM_SAVE_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({ answer: 'abc' });
    expect(save.mock.calls[0][1]).toEqual(NOW);
    expect(buffer.getSnapshot()).toEqual({
      status: 'saved',
      savedAt: '2026-11-27T09:00:00.000Z',
    });
  });

  it('flushes immediately and never writes a second time', () => {
    const { buffer, save } = createBuffer();

    buffer.schedule({ answer: 'draft' });

    expect(buffer.getSnapshot().status).toBe('pending');
    expect(buffer.flush()).toBe('2026-11-27T09:00:00.000Z');
    expect(save).toHaveBeenCalledTimes(1);
    expect(buffer.getSnapshot()).toEqual({
      status: 'saved',
      savedAt: '2026-11-27T09:00:00.000Z',
    });

    vi.advanceTimersByTime(EXAM_SAVE_DEBOUNCE_MS * 5);

    expect(save).toHaveBeenCalledTimes(1);
    expect(buffer.flush()).toBe('2026-11-27T09:00:00.000Z');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('writes a new draft after a completed save', () => {
    const { buffer, save } = createBuffer();

    buffer.schedule({ answer: 'one' });
    buffer.flush();
    buffer.schedule({ answer: 'two' });
    buffer.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual({ answer: 'two' });
  });

  it('does not call save when flushing an empty buffer', () => {
    const { buffer, save } = createBuffer();

    expect(buffer.flush()).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(buffer.getSnapshot()).toEqual({ status: 'idle', savedAt: null });
  });

  it('notifies subscribers on snapshot changes only', () => {
    const { buffer } = createBuffer();
    const listener = vi.fn();
    const unsubscribe = buffer.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({ status: 'idle', savedAt: null });

    buffer.schedule({ answer: 'a' });
    buffer.schedule({ answer: 'ab' });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith({ status: 'pending', savedAt: null });

    buffer.flush();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith({
      status: 'saved',
      savedAt: '2026-11-27T09:00:00.000Z',
    });

    unsubscribe();
    buffer.schedule({ answer: 'abc' });
    buffer.flush();

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('drops a pending write when disposed', () => {
    const { buffer, save } = createBuffer();

    buffer.schedule({ answer: 'gone' });
    buffer.dispose();
    vi.advanceTimersByTime(EXAM_SAVE_DEBOUNCE_MS * 2);

    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an unusable save function or delay', () => {
    expect(() => createExamSaveBuffer()).toThrow(TypeError);
    expect(() => createExamSaveBuffer({ save: 'nope' })).toThrow(TypeError);
    expect(() => createExamSaveBuffer({ save: vi.fn(), delay: -1 })).toThrow(RangeError);
    expect(() => createExamSaveBuffer({ save: vi.fn(), delay: Number.NaN })).toThrow(RangeError);
  });

  it('honours a custom delay', () => {
    const { buffer, save } = createBuffer({ delay: 50 });

    buffer.schedule({ answer: 'fast' });
    vi.advanceTimersByTime(49);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
