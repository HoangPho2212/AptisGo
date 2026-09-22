# Requirements Engineering: MoSCoW & User Stories

## 1. MoSCoW Prioritization Matrix

### Must Have (Sprint 1 & 2 Core)
- **FR01 (Auth & RBAC)**: User registration and login with bcrypt hashing and JWT authorization for Student, Lecturer, and Admin roles[cite: 1, 3].
- **FR02 (Placement Diagnostic)**: Automated diagnostic test computing student CEFR baseline (A1–C1)[cite: 1, 2].
- **FR03 (Goal Tracking)**: Target certificate selection (B1/B2) and deadline tracking[cite: 1, 2].
- **FR04 (Auto-Marking Engine)**: Instant scoring for Reading, Listening, and Grammar sections[cite: 1, 2].
- **FR05 (Audio Submission)**: Multipart form/audio recording upload for Speaking prompts[cite: 1, 2].
- **FR06 (Lecturer Review Workspace)**: Pending queue display, audio playback player, text reader, score input, and qualitative feedback logging[cite: 1, 2].

### Should Have (Sprint 2 & 3)
- **FR07 (Adaptive Study Plan)**: Daily structured task generator with dynamic completion toggle (`PATCH /study-plans/tasks/:id`)[cite: 1, 2].
- **FR08 (Admin Test Management)**: Centralized CRUD interface for managing tests and embedded question sub-documents[cite: 1].
- **FR09 (Analytics Dashboard)**: Skill-by-skill score charts and historical feedback progress[cite: 1, 2].

### Could Have
- **FR10 (In-Browser Audio Recording)**: Native browser audio capture via Web MediaRecorder API with inline waveform visualization[cite: 2].
- **FR11 (Task Due Reminders)**: Banner alerts for approaching target deadlines.

### Won't Have (Excluded for v1.0)
- **Real-Time AI Voice Scoring**: Deferred to future research scope[cite: 2].
- **Native iOS/Android Apps**: Mobile web responsiveness via TailwindCSS prioritized[cite: 2].
- **Payment Gateways**: Excluded from academic prototype[cite: 2].

## 2. Core User Stories & Acceptance Criteria

### US01: Student Auto-Graded Practice
- **Story**: As a student, I want to complete Reading and Listening tests with immediate results, so that I can validate my receptive comprehension instantly[cite: 1, 2].
- **Acceptance Criteria**:
  - *Given* I am an authenticated student on a practice test page[cite: 1].
  - *When* I submit my choices for Reading and Listening questions[cite: 1].
  - *Then* the system records my answers, calculates my score against `correctAnswer` in < 500ms, and updates my dashboard without requiring lecturer intervention[cite: 1, 2].

### US02: Lecturer Qualitative Evaluation
- **Story**: As a lecturer, I want to review pending student audio recordings and writing submissions in one workspace, so that I can provide actionable feedback and rubric-based scores[cite: 1, 2].
- **Acceptance Criteria**:
  - *Given* I am logged in with the `lecturer` role[cite: 1].
  - *When* I access the Lecturer Workspace, I see an updated queue of `pending_review` submissions[cite: 1].
  - *Then* I can play the student's audio recording, read the essay, submit scores and textual feedback, transitioning the submission status to `completed`[cite: 1].