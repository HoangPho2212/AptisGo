# Test Strategy & Requirements Traceability Matrix (RTM)

## 1. Test Strategy Overview
- **Scope**: Covers all Must-Have and Should-Have requirements (FR01–FR09).
- **Types**:
  - Unit Testing: Jest suites verifying token generation, bcrypt verification, and score tallying[cite: 3].
  - Integration/API Testing: Postman/Supertest validation of REST API contracts and role authorization boundaries[cite: 3].
  - System Testing: Black-box testing validating happy and negative execution paths[cite: 3].
  - User Acceptance Testing (UAT): 5 external participants assessing task completion and System Usability Scale (SUS >= 80)[cite: 2, 3].

## 2. Minimum Test Cases (Happy Path & Negative Edge Cases)

| TC ID | Scenario | Req | Preconditions | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC01** | Student registration with valid data (Happy Path) | FR01 | New university email | 1. Fill registration form<br>2. Submit | Account created, password hashed with bcrypt, JWT issued[cite: 1, 3]. |
| **TC02** | Registration with duplicate email (Negative) | FR01 | Existing user in DB | 1. Fill form with existing email<br>2. Submit | HTTP 400: "Email already in use"[cite: 3]. |
| **TC03** | Unauthorized access to Lecturer Workspace (Security) | FR01 | Logged in as `student` | 1. Access `/api/submissions/lecturer/pending` | HTTP 403: "Access forbidden: Requires lecturer role"[cite: 1]. |
| **TC04** | Goal creation with past deadline (Negative) | FR03 | Logged in as student | 1. Set deadline to yesterday<br>2. Submit | HTTP 400: "Deadline must be a future date". |
| **TC05** | Instant auto-grading of Reading/Listening (Happy Path) | FR04 | Test loaded | 1. Choose answers<br>2. Submit | Auto-score returned within < 500ms; `status: completed`[cite: 1, 2]. |
| **TC06** | Speaking upload exceeds 10MB cap (Edge Case) | FR05 | Test loaded | 1. Select 15MB MP3 file<br>2. Submit | Client blocks upload: "Audio file must not exceed 10MB"[cite: 2]. |
| **TC07** | Submitting exam with Speaking and Writing (Happy Path) | FR04, FR05 | Test loaded | 1. Upload audio & enter text<br>2. Submit | Auto-score tallied; manual scores set to `null`; `status: pending_review`[cite: 1]. |
| **TC08** | Lecturer grades subjective tasks (Happy Path) | FR06 | Submission pending review | 1. Open submission<br>2. Play audio<br>3. Input score & feedback<br>4. Submit | Submission updated to `status: completed`, `totalScore` calculated[cite: 1]. |
| **TC09** | Update daily task status (Happy Path) | FR07 | Active study plan | 1. Click task checkbox | `PATCH /api/study-plans/tasks/:id` sets `isCompleted: true`[cite: 1]. |
| **TC10** | Admin adds question without prompt (Negative) | FR08 | Logged in as admin | 1. Open test authoring<br>2. Leave prompt empty<br>3. Save | Mongoose validation error: "Prompt is required"[cite: 1]. |

## 3. Requirements Traceability Matrix (RTM)

| FR ID | Functional Requirement | Test Case ID | Target Sprint |
| :--- | :--- | :--- | :--- |
| **FR01** | Authentication & Role-Based Access Control | TC01, TC02, TC03 | Sprint 1[cite: 1, 3] |
| **FR02** | Placement Diagnostic & Level Calculation | TC05 | Sprint 1[cite: 1, 2] |
| **FR03** | Goal Setting & Deadline Tracking | TC04 | Sprint 1[cite: 1, 2] |
| **FR04** | Auto-Marking for Reading, Listening, and Grammar | TC05, TC07 | Sprint 2[cite: 1, 2] |
| **FR05** | Media Upload & Speaking Prompt Handling | TC06, TC07 | Sprint 2[cite: 1, 2] |
| **FR06** | Lecturer Evaluation Workspace & Feedback Loop | TC08 | Sprint 2[cite: 1, 2] |
| **FR07** | Adaptive Daily Study Plan Management | TC09 | Sprint 2[cite: 1, 2] |
| **FR08** | Admin Test Bank Management (Sub-documents) | TC10 | Sprint 3[cite: 1, 3] |