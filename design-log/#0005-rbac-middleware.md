# Design Log #0005: JWT Verification and RBAC Middleware Guards

**Ticket:** AG-104 [BE]
**Status:** Proposed → implemented (see §8)
**Depends on:** #0004 (register/login and signed JWT)
**Traceability:** FR01 (Auth & RBAC), NFR02 (secure, stateless authorization)

## 1. Background

AG-103 issues a signed access token from `POST /api/auth/register` and
`POST /api/auth/login`. The token already carries the claims needed for
authorization:

```json
{
  "sub": "<user id>",
  "role": "student | lecturer | admin",
  "iss": "aptis-go-api",
  "aud": "aptis-go-client",
  "iat": 1793032150,
  "exp": 1793035750
}
```

The ADS states that every protected endpoint expects:

```http
Authorization: Bearer <JWT_TOKEN>
```

Nothing currently reads that header or rejects a caller whose role is not
allowed. There are therefore no reusable guards for the student, lecturer, and
admin areas of the API.

AG-104 delivers only the guards. Protected domain routes and
`GET /api/auth/me` are wired in later tickets.

## 2. Problem

Without middleware guards:

1. **Unprotected endpoints.** Any caller can reach a handler that was meant to
   be authenticated.
2. **Token forgery.** A route that hand-parses the body or trusts a `role`
   field would accept an unverified or tampered token.
3. **Role escalation.** A valid `student` token could call lecturer/admin
   actions unless the role claim is checked server-side.
4. **Wrong status codes.** Missing credentials, invalid tokens, and valid users
   without permission are different failures and must map to `401` vs `403`.
5. **Repeated security logic.** Every route would otherwise re-implement header
   parsing and role checks, producing inconsistent behaviour.
6. **Stale identity data.** Loading the full user document on every request
   would add a database round-trip and couple stateless authorization to the
   primary database.

## 3. Questions and Answers

- **Q1: Where does the token come from?**
  - **A:** Only the `Authorization` request header, using the
    `Bearer <token>` scheme. Cookies, query strings, and request bodies are not
    accepted. The scheme comparison is case-insensitive (`bearer` is allowed),
    matching RFC 6750.

- **Q2: Stateless verification or a database lookup?**
  - **A:** Stateless. `verifyToken` validates the JWT signature, issuer,
    audience, algorithm, and expiry, then trusts the `sub` and `role` claims
    until the token expires. It does **not** query MongoDB. This satisfies
    NFR02 and keeps the guard cheap. Consequence: a role change takes effect
    only after the current token expires (default `1h`). A revocation list or
    short-lived tokens are future hardening work.

- **Q3: What is attached to the request?**
  - **A:** `request.user = { id: <sub>, role: <role> }`. The full MongoDB
    document is never attached. Handlers that need profile data can query by
    `request.user.id`.

- **Q4: Which HTTP status is returned?**
  - **A:**
    - Missing, malformed, or unparseable Authorization header → `401`.
    - Missing, invalid, expired, or wrongly signed token → `401`.
    - Valid token whose role is not in the allowed set → `403`.
    - `authorizeRoles` called without a preceding `verifyToken` → `401`
      (there is no authenticated identity to authorize).

- **Q5: What error body is returned?**
  - **A:** `{ "error": "Authentication required" }` for a missing credential,
    `{ "error": "Invalid or expired token" }` for a rejected token, and
    `{ "error": "Forbidden" }` for a valid token with the wrong role. No token
    contents, signature details, or user records are echoed. `401` responses
    also carry `WWW-Authenticate: Bearer`.

- **Q6: What claims are required?**
  - **A:** `sub` must be a non-empty string, and `role` must be one of the
    project roles: `student`, `lecturer`, or `admin`. A signed token with a
    missing `sub` or an unknown role is rejected with `401`, even if its
    signature is valid.

- **Q7: Where does the role list come from?**
  - **A:** `USER_ROLES` exported by `server/src/models/User.js`, which is the
    schema enum and therefore the single source of truth. No free-form role
    strings are introduced. `authorizeRoles` validates its arguments at route
    wiring time; a typo such as `authorizeRoles('superadmin')` throws instead of
    silently denying every request.

- **Q8: Is `authorizeRoles` variadic?**
  - **A:** Yes. `authorizeRoles('student', 'lecturer')` permits either role.
    `authorizeRoles('admin')` permits only admins. Calling it with no roles is a
    programmer error and throws.

- **Q9: How are unexpected errors handled?**
  - **A:** Only JSON Web Token failures (`JsonWebTokenError`,
    `TokenExpiredError`, `NotBeforeError`) become `401`. A server
    misconfiguration, such as a missing `JWT_SECRET`, is forwarded to the
    Express error handler as `500` rather than being disguised as an
    authentication failure.

- **Q10: How is the guard tested without MongoDB?**
  - **A:** Unit tests call the middleware with fake `request`/`response`/`next`
    objects and real signed tokens. No database is involved. The tests cover
    valid tokens for all roles, malformed headers, bad signatures, expiry,
    invalid claims, allowed/denied roles, middleware ordering, and invalid
    configuration.

## 4. Design

### 4.1 Verification and authorization flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Protected route
    participant V as verifyToken
    participant A as authorizeRoles
    participant H as Handler

    C->>R: GET /protected<br/>Authorization: Bearer <token>
    R->>V: request
    alt header missing or malformed
        V-->>C: 401 Authentication required
    else signature/expiry/claims invalid
        V-->>C: 401 Invalid or expired token
    else valid
        V->>V: request.user = { id, role }
        V->>A: next()
        alt role not allowed
            A-->>C: 403 Forbidden
        else role allowed
            A->>H: next()
            H-->>C: 200 response
        end
    end
```

### 4.2 File and Contracts

#### File: `server/src/middleware/authMiddleware.js`

```javascript
/**
 * Validate a Bearer access token and attach the caller identity.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function verifyToken(request, response, next) {}

/**
 * Build a guard that permits only the supplied roles.
 * Must be mounted after verifyToken.
 *
 * @param {...('student'|'lecturer'|'admin')} allowedRoles
 * @returns {(request: import('express').Request, response: import('express').Response, next: import('express').NextFunction) => void}
 * @throws {TypeError} when no roles are supplied
 * @throws {RangeError} when a role is not in USER_ROLES
 */
function authorizeRoles(...allowedRoles) {}

module.exports = { verifyToken, authorizeRoles };
```

### 4.3 Role matrix

| Caller | `verifyToken` only | `authorizeRoles('student')` | `authorizeRoles('student', 'lecturer')` | `authorizeRoles('admin')` |
| --- | --- | --- | --- | --- |
| No/invalid token | `401` | `401` | `401` | `401` |
| Student token | next | next | next | `403` |
| Lecturer token | next | `403` | next | `403` |
| Admin token | next | `403` | `403` | next |

### 4.4 Header validation rules

| Header value | Result |
| --- | --- |
| `Authorization: Bearer <valid>` | Accepted |
| `Authorization: bearer <valid>` | Accepted (scheme is case-insensitive) |
| Missing header | `401 Authentication required` |
| `Authorization: <token>` (no scheme) | `401 Authentication required` |
| `Authorization: Basic <token>` | `401 Authentication required` |
| `Authorization: Bearer` | `401 Authentication required` |
| `Authorization: Bearer <token> extra` | `401 Authentication required` |
| Expired / tampered / wrong-secret token | `401 Invalid or expired token` |
| Valid token, unknown `role` | `401 Invalid or expired token` |
| Valid token, allowed role | `next()` with `request.user` |

## 5. Implementation Plan (TDD Approach)

1. **Write failing tests** in `tests/auth-middleware.test.js`:
   - valid student/lecturer/admin tokens attach `{ id, role }` and call
     `next()`;
   - missing, malformed, and non-Bearer headers return `401`;
   - tampered, expired, wrong-secret, unknown-role, and missing-`sub` tokens
     return `401`;
   - misconfiguration is forwarded as an error, not `401`;
   - `authorizeRoles` allows the listed roles, returns `403` for others, and
     `401` when no identity is attached;
   - empty/unknown role configuration throws;
   - a chained `verifyToken → authorizeRoles` flow succeeds for an admin token.
2. **Run red:** `node --test "tests/*.test.js"`; the new suite must fail because
   `authMiddleware` does not exist, while the existing 48 tests stay green.
3. **Implement** `server/src/middleware/authMiddleware.js` using the existing
   `verifyAccessToken`, `USER_ROLES`, and the error Contract above.
4. **Run green:** full suite, lint, and formatting.
5. **Document** the guard usage in `README.md` and append §8.

## 6. Examples

### ✅ Correct route wiring

```javascript
const router = require('express').Router();
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/profile', verifyToken, (request, response) => {
  response.json({ user: request.user });
});

router.post(
  '/questions',
  verifyToken,
  authorizeRoles('lecturer', 'admin'),
  createQuestion
);
```

```http
GET /api/protected/profile HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```json
HTTP/1.1 200 OK
{ "user": { "id": "6710...", "role": "student" } }
```

### ❌ Incorrect route wiring

```javascript
// ❌ No verification: anyone can spoof the header/body
router.get('/admin', (req, res) => res.json({ user: req.body.user }));

// ❌ Role check before authentication
router.get('/admin', authorizeRoles('admin'), verifyToken, handler);

// ❌ Trusting a body role instead of the signed claim
if (req.body.role === 'admin') next();
```

```javascript
// ❌ Wrong status: authenticated but unauthorized is 403, not 401
if (user.role !== 'admin') return res.status(401).json({ error: 'Forbidden' });

// ❌ Leaking signature details
catch (error) { return res.status(401).json({ error: error.message }); }

// ❌ Storing the whole database document on the request
request.user = await User.findById(payload.sub);
```

## 7. Trade-offs

- **Stateless claims vs. live role lookup.**
  - *Gain:* no database round-trip per request; matches the decoupled,
    stateless API design.
  - *Cost:* a demotion or ban remains usable until token expiry (≤ 1 hour).
    Token revocation and refresh-token rotation belong to security hardening.
- **Strict Bearer-only transport vs. cookies.**
  - *Gain:* no CSRF surface and works for native/mobile clients.
  - *Cost:* the SPA must store the token safely against XSS.
- **Distinct `401`/`403` bodies vs. one generic denial.**
  - *Gain:* clients can distinguish “log in again” from “you lack permission”.
  - *Cost:* reveals that a token is valid but under-privileged. This is standard
    for RBAC APIs and does not expose account existence.
- **Fail-fast role configuration.**
  - *Gain:* a typo in `authorizeRoles('lecturr')` crashes at wiring time instead
    of silently creating an always-`403` route.
  - *Cost:* a dynamic role list would need a code change plus restart.
- **No database existence check.**
  - *Gain:* a deleted user’s token remains structurally valid only until its
    short expiry; the guard stays fast.
  - *Cost:* deleted accounts can call protected endpoints for at most one token
    lifetime. A deny-list is the future remedy.

## 8. Implementation Results

### 8.1 Results

- **TDD red phase:** `node --test tests/auth-middleware.test.js` failed with
  `MODULE_NOT_FOUND` for `server/src/middleware/authMiddleware.js` (0 passed, 1
  suite failed), confirming the guards were absent.
- **Focused green phase:** `node --test tests/auth-middleware.test.js` →
  **24 passed, 0 failed**. Coverage includes:
  - valid student, lecturer, and admin tokens (identity attached, `next()`
    called);
  - lowercase `bearer` scheme;
  - missing, empty, wrong-scheme, incomplete, and over-long headers;
  - tampered, wrong-secret, expired, unknown-role, and missing-`sub` tokens;
  - misconfiguration forwarded to `next(error)` instead of being hidden as
    `401`;
  - role allow/deny for single and multiple roles, `403` for a valid but
    unauthorized role, `401` when `verifyToken` has not run;
  - invalid `authorizeRoles` configuration throws;
  - the documented `verifyToken → authorizeRoles` chain.
- **Full suite without a database:** `node --test "tests/*.test.js"` →
  **70 passed, 2 skipped** (`tests 72`). The two skips are the opt-in Mongo
  round-trips.
- **Full suite with local MongoDB:**
  `MONGODB_TEST_URI=mongodb://127.0.0.1:27017/aptis-go-test node --test "tests/*.test.js"`
  → **72 passed, 0 failed, 0 skipped**. Atlas remains blocked by the machine's
  IP allowlist (carried over from AG-103), so local MongoDB was used for the
  database-backed checks; the middleware suite itself needs no database.
- **Lint:** `npm run lint` → exit 0 for root, `client/`, and `server/`.
- **Formatting:** `npm run format:check` → all files conform.
- **Files delivered:**
  - `server/src/middleware/authMiddleware.js` — `verifyToken` and
    `authorizeRoles`;
  - `tests/auth-middleware.test.js` — 24 tests;
  - updated `README.md` (route-guard usage, layout, test matrix, roadmap);
  - this design log.

### 8.2 Deviations from the Plan

- **No protected production route was added.** AG-104 scopes the reusable
  guards; wiring them into domain routes (and `GET /api/auth/me`) belongs to the
  route tickets. The middleware is exercised directly by the test suite.
- **Roles are sourced from `server/src/models/User.js`.** `USER_ROLES` already
  exists there as the schema enum, and `JayContract.js` has no user-role enum.
  Reusing the schema export avoids introducing a competing source of truth.
- **`WWW-Authenticate: Bearer` was added to every `401`.** The plan did not
  require it, but RFC 6750 recommends it and it gives clients a standard signal.
- **Configuration failures become `500`, not `401`.** Only known JWT errors are
  converted; an absent/weak `JWT_SECRET` is forwarded to the Express error
  handler. This prevents a deployment mistake from looking like a bad login.
- **`authorizeRoles` validates its role arguments at wiring time.** A typo
  throws `RangeError` during startup rather than producing a permanently
  forbidden route.
- **Tests are unit-level rather than HTTP-level.** A real protected route would
  require either adding production surface outside this ticket or mounting a
  test-only Express app. Fake `request`/`response`/`next` objects test the exact
  Contract without adding either.
