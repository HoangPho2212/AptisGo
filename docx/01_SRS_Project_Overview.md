# Project Specification: APTIS GO

## 1. Project Overview & Context
APTIS GO is a goal-oriented e-learning web platform engineered to scaffold university students toward achieving the CEFR B1/B2 English proficiency certification required for major trimester entry or graduation[cite: 1, 2]. The platform addresses the critical problem where over 65% of students fail initial standardized proficiency attempts due to unguided self-study and a total absence of qualitative feedback on productive skills[cite: 2].

## 2. Core Technological Paradigm
- **Architecture**: Decoupled Client-Server (SPA communicating via RESTful API).
- **Marking Engine**: Hybrid Assessment Pipeline[cite: 1, 2].
  - **Auto-Marking**: Instant algorithmic validation for Reading, Listening, and Grammar questions (< 500ms)[cite: 1, 2].
  - **Manual Marking**: Qualitative rubric-based human grading with feedback loops for Speaking (audio submissions) and Writing (text prompts)[cite: 1, 2].

## 3. User Roles & Access Boundaries
- **Student**: Takes diagnostic placement test, sets certificate goal/deadline, follows daily task roadmaps, takes mock exams, submits audio/text responses, reviews qualitative instructor feedback[cite: 1, 2].
- **Lecturer**: Accesses Lecturer Workspace to view pending review queues, stream student audio files, evaluate writing essays, input rubric scores, and publish targeted qualitative feedback[cite: 1, 2].
- **Admin**: Manages user accounts, monitors system-wide analytics, and authors/updates Aptis test questions utilizing nested sub-document structures[cite: 1, 2].

## 4. Key Performance Indicators (Success Criteria)
- **Backend Latency**: < 500ms average API response time for test rendering and submission processing[cite: 2].
- **Usability Benchmark**: System Usability Scale (SUS) score >= 80 and an average rating >= 4.0/5.0 in UAT[cite: 2].
- **Functional Integrity**: 100% pass rate across core functional test suites (Authentication, Auto-grading, Manual grading pipeline)[cite: 2].
- **Queue Reliability**: 100% queue delivery for pending subjective submissions without data loss[cite: 2].