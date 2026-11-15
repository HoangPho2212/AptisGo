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
