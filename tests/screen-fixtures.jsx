import { render } from '@testing-library/react';

import App from '../client/src/App.jsx';

export const STUDENT_SESSION = {
  token: 'signed.jwt.token',
  tokenType: 'Bearer',
  user: {
    id: 'user-1',
    name: 'Amina Rahman',
    email: 'amina@greenwich.edu.vn',
    role: 'student',
    currentLevel: 'B1',
  },
};

export const PLACEMENT_TEST = {
  id: 'test-placement-1',
  title: 'Placement Diagnostic (demo)',
  description: 'Adaptive baseline check.',
  targetCefr: 'B2',
  skillModules: ['core', 'reading', 'listening'],
  durationMinutes: 20,
  questionCount: 3,
  questions: [
    {
      id: 'q1',
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct option: She ____ to work every day.',
      contextPassage: null,
      options: ['go', 'goes', 'going'],
      dropdownSets: [],
      sentences: [],
      formFields: [],
    },
    {
      id: 'q2',
      skill: 'reading',
      part: 1,
      questionType: 'dropdown_cloze',
      prompt: 'Complete the summary.',
      contextPassage: 'The library opens at nine.',
      options: [],
      dropdownSets: [
        { id: 's1', prompt: 'Opening time', options: ['nine', 'ten'] },
        { id: 's2', prompt: 'Place', options: ['library', 'cafe'] },
      ],
      sentences: [],
      formFields: [],
    },
    {
      id: 'q3',
      skill: 'speaking',
      part: 1,
      questionType: 'audio_record',
      prompt: 'Describe your hometown.',
      options: [],
      dropdownSets: [],
      sentences: [],
      formFields: [],
    },
  ],
};

export const EXAM_TEST = {
  id: 'test-exam-1',
  title: 'Mock Exam 1',
  description: 'Full-length timed mock exam.',
  type: 'mock',
  targetCefr: 'B2',
  skillModules: ['core', 'reading', 'writing', 'speaking'],
  durationMinutes: 60,
  questionCount: 6,
  questions: [
    {
      id: 'e1',
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct option: She ____ to work every day.',
      contextPassage: null,
      options: ['go', 'goes', 'going'],
      dropdownSets: [],
      sentences: [],
      formFields: [],
    },
    {
      id: 'e2',
      skill: 'reading',
      part: 1,
      questionType: 'dropdown_cloze',
      prompt: 'Complete the notice.',
      contextPassage: 'The library opens at nine.',
      options: [],
      dropdownSets: [
        { id: 'd1', prompt: 'Opening time', options: ['nine', 'ten'] },
        { id: 'd2', prompt: 'Place', options: ['library', 'cafe'] },
      ],
      sentences: [],
      formFields: [],
    },
    {
      id: 'e3',
      skill: 'reading',
      part: 2,
      questionType: 'sentence_order',
      prompt: 'Put the sentences in the correct order.',
      contextPassage: null,
      options: [],
      dropdownSets: [],
      sentences: [
        { id: 's1', order: 1, text: 'The manager opened the meeting.', isFixed: true },
        { id: 's2', order: 2, text: 'The team reviewed the results.', isFixed: false },
        { id: 's3', order: 3, text: 'They agreed on the next steps.', isFixed: false },
      ],
      formFields: [],
    },
    {
      id: 'e4',
      skill: 'writing',
      part: 1,
      questionType: 'short_fields',
      prompt: 'Complete the course registration form.',
      contextPassage: null,
      options: [],
      dropdownSets: [],
      sentences: [],
      formFields: [
        { id: 'f1', fieldId: 'name', label: 'Full name', minWords: 1, maxWords: 5 },
        { id: 'f2', fieldId: 'city', label: 'City', minWords: 1, maxWords: 3 },
      ],
    },
    {
      id: 'e5',
      skill: 'writing',
      part: 4,
      questionType: 'essay_text',
      prompt: 'Write a short email to your manager requesting leave.',
      contextPassage: null,
      options: [],
      dropdownSets: [],
      sentences: [],
      formFields: [],
      minWords: 30,
      maxWords: 50,
    },
    {
      id: 'e6',
      skill: 'speaking',
      part: 1,
      questionType: 'audio_record',
      prompt: 'Describe your favourite place.',
      contextPassage: null,
      options: [],
      dropdownSets: [],
      sentences: [],
      formFields: [],
      prepTimeSeconds: 10,
      recordTimeSeconds: 45,
    },
  ],
};

export const LISTENING_TEST = {
  id: 'test-listening-1',
  title: 'Listening Mock 1',
  description: 'Two listening items with the official two-play limit.',
  type: 'mock',
  targetCefr: 'B2',
  skillModules: ['listening'],
  durationMinutes: 10,
  questionCount: 2,
  questions: [
    {
      id: 'l1',
      skill: 'listening',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Listen and choose where the conversation takes place.',
      contextPassage: null,
      mediaUrl: 'https://example.com/audio/track-1.mp3',
      options: ['At a bank', 'At a pharmacy'],
      dropdownSets: [],
      sentences: [],
      formFields: [],
    },
    {
      id: 'l2',
      skill: 'listening',
      part: 2,
      questionType: 'dropdown_match',
      prompt: 'Listen and complete the notes.',
      contextPassage: null,
      mediaUrl: null,
      options: [],
      dropdownSets: [{ id: 'n1', prompt: 'Opening time', options: ['nine', 'ten'] }],
      sentences: [],
      formFields: [],
    },
  ],
};

export const SUBMISSION_RESULT = {
  id: 'submission-1',
  test: { id: EXAM_TEST.id, title: EXAM_TEST.title, type: 'mock' },
  status: 'pending_review',
  autoScore: 50,
  manualScore: null,
  totalScore: null,
  skillScores: { core: 50, reading: 0, listening: 0, writing: null, speaking: null },
  questionCount: 6,
  answeredCount: 6,
  createdAt: '2026-11-23T09:30:00.000Z',
};

export function renderAt(path) {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

export function isoDateDaysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}
