# AI Coding Standards & Architectural Directives

When writing code or generating components for APTIS GO, adhere strictly to these engineering constraints:

## 1. General Principles
- **Clean Architecture**: Strictly modularize code into `controllers`, `models`, `routes`, `middlewares`, and `config`[cite: 1].
- **No Relational Emulation**: Utilize MongoDB embedded documents where read locality is prioritized (questions inside tests)[cite: 1].
- **Fail-Safe Async Handlers**: All Express controllers must use `try/catch` or an async wrapper middleware to catch unhandled rejections.

## 2. Security & LSEPI Standards
- **Password Security**: Never store plaintext passwords; hash with `bcryptjs` using a salt work factor >= 10[cite: 1, 3].
- **Authorization Guard**: Always guard administrative or lecturer routes using a dedicated `requireRole(['lecturer', 'admin'])` middleware[cite: 1].
- **NoSQL Injection Prevention**: Sanitize request parameters and never pass unfiltered `req.body` directly to raw Mongo queries (`$where`, `$regex`)[cite: 1].
- **Data Protection (GDPR)**: Exclude sensitive fields (`password`, hidden answer keys) from API responses using `.select('-password')`[cite: 2, 3].

## 3. Marking Logic Guardrail
- Reading, Listening, and Grammar MUST be auto-graded synchronously inside `submissionController.js`[cite: 1].
- Speaking and Writing scores MUST remain `null` upon initial submission; status MUST default to `pending_review` whenever subjective questions exist[cite: 1].
- Final `totalScore` must be computed and updated only after all skills have a valid non-null numerical score[cite: 1].

## 4. Frontend Component Rules
- Use functional React components with modern hooks (`useState`, `useEffect`, `useCallback`)[cite: 2].
- Apply responsive design with TailwindCSS matching WCAG 2.1 AA accessibility standards (contrast ratios >= 4.5:1)[cite: 2, 3].
- Implement clear visual status indicators for submissions: `Pending Review` (Amber badge) vs `Completed` (Emerald badge)[cite: 1, 2].