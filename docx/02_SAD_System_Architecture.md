# System Architecture & Design (C4 Model)

## 1. Architectural Style
Decoupled Layered RESTful Architecture.
- **Frontend**: Single Page Application (SPA) built with React.js, styled with TailwindCSS, and state-managed via Context API / React Query[cite: 1, 2].
- **Backend**: Node.js runtime executing an Express.js application following modular separation (routes, controllers, models, middlewares, config) without automated scaffolding to guarantee full code control and security sanitization[cite: 1].
- **Database**: MongoDB instance managed through Mongoose ODM, utilizing embedded document locality for questions to eliminate relational JOIN overhead on exam retrieval[cite: 1].
- **Storage Strategy**: Local file streaming / multipart form uploads using `multer` with strict client-side compression caps (max 10MB per MP3/WebM audio container) to mitigate server storage exhaustion risks[cite: 1, 2].

## 2. C4 Context Diagram (Level 1)
- **Users**: Student, Lecturer, Administrator[cite: 1, 2].
- **System**: APTIS GO Web Application[cite: 1, 2].
- **External Dependencies**: Local/Cloud File Storage (Audio assets), Email Notification Service.

## 3. C4 Container Diagram (Level 2)
1. **Web Frontend Container**:
   - Tech: React.js, TailwindCSS, Axios, MediaRecorder API[cite: 1, 2].
   - Protocol: HTTPS / REST.
2. **API Backend Container**:
   - Tech: Node.js, Express.js, JWT, bcryptjs, Multer[cite: 1, 2].
   - Responsibilities: JWT authentication, RBAC middleware, auto-marking computation, submission queue orchestration[cite: 1, 2].
3. **Database Container**:
   - Tech: MongoDB (Mongoose ODM)[cite: 1, 2].
   - Responsibilities: Persistence of users, goals, tests with embedded questions, submissions, and study plan roadmaps[cite: 1].