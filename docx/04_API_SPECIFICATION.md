# RESTful API Specification

All protected endpoints require the HTTP Authorization Header:
`Authorization: Bearer <JWT_TOKEN>`

## 1. Authentication & Users (`/api/auth`)
- `POST /api/auth/register` - Create student/lecturer account (hashes password via bcrypt)[cite: 1].
- `POST /api/auth/login` - Authenticate user, return JWT signed with user id and role[cite: 1].
- `GET /api/auth/me` - Retrieve authenticated user profile and `currentLevel`[cite: 1].

## 2. Goals & Roadmaps (`/api/goals`, `/api/study-plans`)
- `POST /api/goals` - Set student target certificate (B1/B2) and completion deadline[cite: 1].
- `GET /api/goals/current` - Retrieve active goal and time-remaining metrics[cite: 1].
- `GET /api/study-plans` - Retrieve breakdown of daily learning tasks[cite: 1].
- `PATCH /api/study-plans/tasks/:id` - Update `isCompleted` task status[cite: 1].

## 3. Tests & Question Banks (`/api/tests`)
- `GET /api/tests` - List available exams filtered by `type` (placement, mock, practice)[cite: 1].
- `GET /api/tests/:id` - Fetch single test with embedded questions (omitting `correctAnswer` for students)[cite: 1].
- `POST /api/tests` - [Admin Only] Create new exam with sub-document question array[cite: 1].
- `PUT /api/tests/:id` - [Admin Only] Update test or nested questions[cite: 1].
- `DELETE /api/tests/:id` - [Admin Only] Delete test[cite: 1].

## 4. Submissions & Hybrid Evaluation (`/api/submissions`)
- `POST /api/submissions` - Submit exam payload. Computes `autoScore` instantly for Reading, Listening, and Grammar. If Speaking or Writing are present, sets status to `pending_review`[cite: 1].
- `POST /api/submissions/upload-audio` - Upload student audio recording via `multer` (MP3/WebM, max 10MB), returns `mediaUrl`[cite: 1, 2].
- `GET /api/submissions/student/history` - Retrieve student's past submissions and skill score history[cite: 1].
- `GET /api/submissions/lecturer/pending` - [Lecturer Only] Fetch list of submissions pending review[cite: 1].
- `PATCH /api/submissions/:id/grade` - [Lecturer Only] Post scores for Speaking/Writing, append qualitative feedback, compute final `totalScore`, and update status to `completed`[cite: 1].