# MongoDB Database Schemas (Data Design & Specification)

## Architectural Strategy
Tests embed question sets as sub-documents to optimize read locality during high-concurrency exam sessions and keep API response latency < 500ms without relational JOIN overhead[cite: 1, 2]. Submissions link to Tests and Users by ObjectId reference and store granular answer evaluation arrays, supporting instant auto-grading for receptive modules and asynchronous lecturer rubric reviews for productive modules[cite: 1, 2].

---

## 1. User Schema (`models/User.js`)
```javascript
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }, // Hashed with bcryptjs (salt work factor >= 10)
  role: { type: String, enum: ['student', 'lecturer', 'admin'], default: 'student', index: true },
  studentId: { type: String, trim: true, sparse: true }, // e.g., GCS210884 for university identification
  currentLevel: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'UNTESTED'], default: 'UNTESTED' }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
```

---

## 2. Question Sub-Document Schema (`models/Question.js` or embedded inside Test)
Aligns 100% with official British Council Aptis examination standards across all 5 skill modules:
```javascript
const mongoose = require('mongoose');

const QuestionSubDocSchema = new mongoose.Schema({
  skill: {
    type: String,
    enum: ['core', 'listening', 'reading', 'writing', 'speaking'], // Note: 'grammar' is mapped to 'core'
    required: true
  },
  part: {
    type: Number,
    enum: [1, 2, 3, 4],
    required: true
  },
  questionType: {
    type: String,
    enum: [
      'mcq_single',     // Core Grammar, Listening Parts 1 & 4
      'dropdown_match', // Core Vocab sets of 5, Listening Parts 2 & 3, Reading Parts 3 & 4
      'dropdown_cloze', // Reading Part 1 (Short text gap-fill)
      'sentence_order', // Reading Part 2 (Scrambled sentence ordering / cohesion)
      'short_fields',   // Writing Part 1 (5 registration form fields)
      'essay_text',     // Writing Parts 2, 3, 4a, 4b
      'audio_record'    // Speaking Parts 1–4
    ],
    required: true
  },
  prompt: { type: String, required: true },
  contextPassage: { type: String, default: null }, // Long reading text or club noticeboard context
  mediaUrl: { type: String, default: null },       // Audio track for Listening or image prompt for Speaking
  
  // Specific constraints for Speaking examination
  prepTimeSeconds: { type: Number, default: 0 },    // 0 for Parts 1–3, 60 for Part 4
  recordTimeSeconds: { type: Number, default: 45 }, // 30 (Part 1), 45 (Parts 2 & 3), 120 (Part 4)
  
  // Specific constraints for Writing examination
  minWords: { type: Number, default: null }, // Part 1: 1, Part 2: 20, Part 3: 30, Part 4a: 40, Part 4b: 120
  maxWords: { type: Number, default: null }, // Part 1: 5, Part 2: 30, Part 3: 40, Part 4a: 60, Part 4b: 150

  // Interactive UI Data Structures
  options: [{ type: String }], // Used for mcq_single (3 options per Aptis standard)
  dropdownSets: [{
    prompt: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true, select: false } // Hidden from student fetch
  }],
  sentences: [{
    order: { type: Number, required: true },
    text: { type: String, required: true },
    isFixed: { type: Boolean, default: false } // Sentence 1 is fixed anchor per Aptis Part 2
  }],
  formFields: [{
    fieldId: { type: String, required: true },
    label: { type: String, required: true },
    minWords: { type: Number, default: 1 },
    maxWords: { type: Number, default: 5 }
  }],

  // Single-key answer validation
  correctAnswer: { type: mongoose.Schema.Types.Mixed, select: false } // Hidden during examination delivery
}, { _id: true });

module.exports = QuestionSubDocSchema;
```

---

## 3. Test Schema (`models/Test.js`)
```javascript
const mongoose = require('mongoose');
const QuestionSubDocSchema = require('./Question');

const TestSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { 
    type: String, 
    enum: ['diagnostic', 'mock', 'practice'], 
    required: true,
    index: true 
  },
  targetCefr: { 
    type: String, 
    enum: ['B1', 'B2', 'C1'], 
    default: 'B2' 
  },
  skillModules: [{
    type: String,
    enum: ['core', 'listening', 'reading', 'writing', 'speaking']
  }],
  durationMinutes: { type: Number, required: true }, // Core: 25, Reading: 35, Listening: 40, Writing: 50, Speaking: 12
  isPublished: { type: Boolean, default: true },
  questions: [QuestionSubDocSchema] // Embedded question sub-documents
}, { timestamps: true });

module.exports = mongoose.model('Test', TestSchema);
```

---

## 4. Submission Schema (`models/Submission.js`)
```javascript
const mongoose = require('mongoose');

const AnswerItemSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  skill: { type: String, enum: ['core', 'listening', 'reading', 'writing', 'speaking'], required: true },
  part: { type: Number, required: true },
  questionType: { type: String, required: true },
  
  // Student submitted values
  submittedAnswer: { type: mongoose.Schema.Types.Mixed, default: null }, // String, Array, or Object
  mediaUrl: { type: String, default: null },                             // Uploaded audio recording path
  wordCount: { type: Number, default: 0 },
  
  // Auto-evaluation fields
  isCorrect: { type: Boolean, default: null },
  autoScore: { type: Number, default: 0 },
  
  // Lecturer qualitative evaluation fields
  lecturerScore: { type: Number, default: null },
  lecturerFeedback: { type: String, default: null }
}, { _id: false });

const SubmissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
  status: { 
    type: String, 
    enum: ['in_progress', 'pending_review', 'completed'], 
    default: 'completed',
    index: true 
  },
  
  // Official Aptis Granular Skill Scores (0–50 scale per module)
  skillScores: {
    core: { type: Number, min: 0, max: 50, default: 0 }, // Grammar (0-25) + Vocabulary (0-25)
    reading: { type: Number, min: 0, max: 50, default: 0 },
    listening: { type: Number, min: 0, max: 50, default: 0 },
    writing: { type: Number, min: 0, max: 50, default: null },
    speaking: { type: Number, min: 0, max: 50, default: null }
  },
  
  // Scaled 4-skill total: 0–200 points (Excludes Core from sum)
  scaledTotalScore: { type: Number, min: 0, max: 200, default: null },
  
  // CEFR Borderline Modifier
  cefrBorderlineApplied: { type: Boolean, default: false },
  finalCefr: { 
    type: String, 
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'PENDING'], 
    default: 'PENDING' 
  },

  // Granular Item Answers
  answers: [AnswerItemSchema],

  // Lecturer Review Assignment
  assignedLecturer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lecturerComment: { type: String, default: null },
  evaluatedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Submission', SubmissionSchema);
```

---

## 5. Goal & Study Plan Schemas (`models/Goal.js`, `models/StudyPlan.js`)
```javascript
const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  targetCefr: { type: String, enum: ['B1', 'B2', 'C1'], default: 'B2', required: true },
  deadline: { type: Date, required: true },
  dailyMinutesTarget: { type: Number, default: 45 }
}, { timestamps: true });

const StudyPlanTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  skill: { type: String, enum: ['core', 'listening', 'reading', 'writing', 'speaking'], required: true },
  partNumber: { type: Number, required: true },
  points: { type: Number, default: 10 },
  isCompleted: { type: Boolean, default: false }
}, { _id: true });

const StudyPlanSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dayNumber: { type: Number, required: true },
  tasks: [StudyPlanTaskSchema]
}, { timestamps: true });

module.exports = {
  Goal: mongoose.model('Goal', GoalSchema),
  StudyPlan: mongoose.model('StudyPlan', StudyPlanSchema)
};
```

---

## 6. Official Module & Schema Mapping Reference (Table 4.8.4)

| Module (`skill` enum) | Official Exam Duration & Count | Sub-Parts (`part: 1..4`) | Question Type in DB (`questionType`) | Granular Scaling & Rules |
| :--- | :--- | :--- | :--- | :--- |
| **`core`** | 50 Qs / 25 mins | Part 1: Grammar (25 Qs)<br>Part 2: Vocabulary (25 Qs) | `mcq_single` (Grammar)<br>`dropdown_match` (Vocab sets of 5) | **0–50 scale** (25 + 25). Acts as **CEFR Borderline Modifier** (score >= 35 elevates borderline B1/B2 skills). |
| **`listening`** | 25 Qs / 40 mins | Parts 1–4 | `mcq_single` (Parts 1 & 4)<br>`dropdown_match` (Parts 2 & 3) | **0–50 scale**. Strict **maximum 2 audio plays** per track enforced client & server side. |
| **`reading`** | 4 Parts / 35 mins | Part 1: Short gap-fill<br>Part 2: Sentence ordering<br>Part 3: Opinion matching<br>Part 4: Paragraph headings | `dropdown_cloze` (Part 1)<br>`sentence_order` (Part 2)<br>`dropdown_match` (Parts 3 & 4) | **0–50 scale**. Interactive cohesion and heading matching mechanics. |
| **`writing`** | 4 Parts / 50 mins | Part 1: 5 form fields (1–5w)<br>Part 2: Short text (20–30w)<br>Part 3: 3 chat replies (30–40w)<br>Part 4: Dual Email (4a: 50w, 4b: 120–150w) | `short_fields` (Part 1)<br>`essay_text` (Parts 2, 3, 4a, 4b) | **0–50 scale**. Single unified club scenario across all 4 parts. Routed to Lecturer Review Pool. |
| **`speaking`** | 4 Parts / ~12 mins | Part 1: 3 Qs (30s each)<br>Part 2: Picture + 2 Qs (45s each)<br>Part 3: 2 Pictures + 2 Qs (45s each)<br>Part 4: 60s prep + 120s talk | `audio_record` | **0–50 scale**. Per-prompt auto-countdown; no pause; linear forward progression only. Routed to Lecturer Review Pool. |
