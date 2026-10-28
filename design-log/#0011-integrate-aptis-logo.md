# Design Log #0011: Integrate the Aptis Logo Assets

**Status:** Proposed → implemented (see §8)
**Type:** Chore, not a ticket
**Related:** #0007 authentication portal, #0010 email validation

## 1. Background

The repository now contains two supplied brand assets:

- `aptis_logo/AptisLogo-svg.svg` — a 512×512 square app mark on a deep-navy
  rounded square.
- `aptis_logo/AptisSymi-svg (1).svg` — a 760×220 horizontal lockup containing
  the abstract mark plus the `APTIS GO` wordmark.

The authentication shell currently renders a generic three-layer icon and a
separate text label. The supplied assets are not part of the client build, so
the UI does not use the real brand mark and the browser tab has no icon.

## 2. Problem

- The real logo is not visible in the app.
- The generic placeholder icon and text duplicate branding work that the
  supplied lockup already provides.
- The favicon is missing.
- The supplied files sit outside `client/`, so Vite cannot serve them directly.

This is a presentation-only chore. It must not change authentication, routing,
API contracts, or session behavior.

## 3. Questions and Answers

- **Q1: Is this a ticket?**
  - **A:** No. It is a chore requested after using the app. The branch is
    `chore/update-aptis-logo`, not an `AP-*` feature branch.

- **Q2: Which asset belongs where?**
  - **A:** The square mark becomes the favicon and app icon
    (`client/public/aptis-logo.svg`). The horizontal lockup becomes the brand
    image in the auth shell (`client/public/aptis-logo-full.svg`).

- **Q3: Should the existing “Aptis Go” text remain?**
  - **A:** No. The horizontal lockup already contains the wordmark. Keeping the
    separate text would duplicate the brand name. The supporting line
    “Greenwich English preparation” remains.

- **Q4: How should the logo be exposed to Vite?**
  - **A:** Put both files in `client/public/` and reference them with root-relative
    URLs (`/aptis-logo.svg`, `/aptis-logo-full.svg`). This works in dev and in
    the production build without importing binary assets through JS.

- **Q5: What accessibility text is needed?**
  - **A:** The visible brand image uses `alt="APTIS GO"`. It is not marked
    decorative because it is the only visible brand name in that block.

- **Q6: Does the logo change layout or tests?**
  - **A:** The brand block becomes a single image plus the supporting subtitle.
    A UI test asserts that the auth shell renders the logo with the expected
    source, so a future regression is caught.

## 4. Design

### 4.1 Asset layout

```text
client/public/
├── aptis-logo.svg        # 512×512 square mark, favicon/app icon
└── aptis-logo-full.svg   # 760×220 horizontal lockup
```

The source files are moved into `client/public/` rather than copied, so the
repository has one canonical location for each asset.

### 4.2 Auth shell

`client/src/auth/AuthLayout.jsx`:

- Remove the generic `BrandMark` SVG.
- Render the horizontal lockup:
  ```jsx
  <img src="/aptis-logo-full.svg" alt="APTIS GO" className="h-12 w-auto" />
  ```
- Keep the subtitle `Greenwich English preparation`.
- Keep the existing responsive placement: desktop aside and mobile header.

### 4.3 Document head

`client/index.html` gains:

```html
<link rel="icon" type="image/svg+xml" href="/aptis-logo.svg" />
```

### 4.4 Failure behavior

- If the asset is missing, the browser shows a broken image and the UI test
  fails because the `src` is wrong.
- No authentication or API behavior changes.

## 5. Implementation Plan (TDD)

1. Write a failing UI test that expects an `APTIS GO` image with
   `src="/aptis-logo-full.svg"` in the login shell.
2. Run `npm run test:ui` and confirm the test fails.
3. Move the supplied assets into `client/public/`.
4. Update `AuthLayout.jsx` to render the horizontal lockup.
5. Add the favicon link to `client/index.html`.
6. Run UI tests, full tests, lint, format, and build.
7. Append §8 with results.

## 6. Examples

### ✅ Correct asset reference

```jsx
<img src="/aptis-logo-full.svg" alt="APTIS GO" className="h-12 w-auto" />
```

The file is served from `client/public/` and works in dev and production.

### ❌ Incorrect import from the repository root

```jsx
import logo from '../../../aptis_logo/AptisLogo-svg.svg';
```

Vite’s client root is `client/`; reaching outside it couples the app to the
repository layout and is not needed.

### ✅ Correct favicon

```html
<link rel="icon" type="image/svg+xml" href="/aptis-logo.svg" />
```

### ❌ Incorrect duplicate branding

```jsx
<img src="/aptis-logo-full.svg" alt="APTIS GO" />
<p>APTIS GO</p>
```

The lockup already contains the wordmark.

## 7. Trade-offs

- **Single canonical asset location.** Moving the files into `client/public/`
  avoids duplicate copies, but the original `aptis_logo/` folder is no longer
  the source of truth.
- **Public assets are unhashed.** A browser may cache `/aptis-logo.svg`; future
  logo changes may need a cache-busting filename or query string.
- **No visual regression test.** The UI test checks presence and source, not
  pixel rendering. A screenshot test would add tooling for a small chore.
- **Brand copy remains.** The “Greenwich English preparation” subtitle is
  unchanged because this chore is limited to the logo assets.

## 8. Implementation Results

Implemented on `chore/update-aptis-logo` (not an `AP-*` ticket branch).

### Changes

- Moved the supplied assets into the client public directory:
  - `aptis_logo/AptisLogo-svg.svg` → `client/public/aptis-logo.svg`
  - `aptis_logo/AptisSymi-svg (1).svg` → `client/public/aptis-logo-full.svg`
- Replaced the generic `BrandMark` SVG in
  `client/src/auth/AuthLayout.jsx` with the horizontal lockup:
  ```jsx
  <img src="/aptis-logo-full.svg" alt="APTIS GO" className="h-10 w-auto" />
  ```
- Kept the “Greenwich English preparation” subtitle below the lockup.
- Added the square mark as the favicon in `client/index.html`.
- Added a UI regression test in `tests/auth-portal.test.jsx` that requires an
  `APTIS GO` image with `src="/aptis-logo-full.svg"`.

### TDD evidence

1. Wrote the logo test first.
2. Ran `npm run test:ui` before implementation: failed because no image with
   the accessible name `APTIS GO` existed.
3. Moved the assets and updated the component/head.
4. Re-ran `npm run test:ui`: **43/43 passed**.

### Verification

- `npm run test:ui` — **43/43 passed**
- `MONGODB_TEST_URI="mongodb://127.0.0.1:27017/aptis-go-test"; npm test` —
  **85/85 passed**
- `npm run test:jest` — **7/7 passed**
- `npm run lint` — clean
- `npm run format:check` — clean
- `npm --prefix client run build` — successful

### Deviations from the plan

- None in behavior. The source `aptis_logo/` directory was moved rather than
  copied, so `client/public/` is the single canonical asset location.
- The build output is generated under `client/dist/` and is not part of this
  change.

## 9. Follow-up: Remove Logo Backgrounds

### Background

Both supplied SVGs included a full-canvas navy rectangle behind the artwork:

```svg
<rect width="512" height="512" rx="112" fill="#06111F" />
<rect width="760" height="220" rx="16" fill="#06111F" />
```

The app background is already `#06111f`, so the rectangle was invisible on the
auth shell. It still creates a dark tile wherever the asset is placed on a
different surface, and the favicon inherits a filled square background.

### Problem

The artwork should be transparent so the symbol and wordmark can sit on any
background without a baked-in tile.

### Design

- Remove the full-canvas `<rect>` from both files:
  - `client/public/aptis-logo.svg`
  - `client/public/aptis-logo-full.svg`
- Keep the viewBox, symbol paths, wordmark, colours, and dimensions unchanged.
- Keep the app’s dark background; transparency is an asset property, not a
  layout change.
- Add a Node test that rejects any full-canvas rectangle in either SVG.

### TDD plan

1. Add `tests/aptis-logo.test.js` that reads both SVGs and asserts no rectangle
   spans the full viewBox.
2. Run `npm test` and confirm it fails against the current assets.
3. Remove the background rectangles.
4. Re-run the tests, lint, format check, and build.

### Examples

#### ✅ Transparent symbol

```svg
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <g fill="#35E6D0">...</g>
</svg>
```

The symbol can be placed on the dark shell, a light card, or a transparent
favicon surface.

#### ❌ Full-canvas background rectangle

```svg
<rect width="512" height="512" rx="112" fill="#06111F" />
```

The rectangle creates a dark tile when the asset is used outside the navy
shell.

### Trade-offs

- On a light surface, the white `APTIS` wordmark in the horizontal lockup will
  have poor contrast. The current shell is dark, so this is acceptable; a
  future light theme would need a dark-on-light variant.
- The favicon becomes a transparent turquoise symbol rather than a filled app
  tile. That matches the request but may look lighter in some browser chrome.

### Implementation Results

Implemented on `chore/remove-logo-backgrounds`.

- Removed the full-canvas `<rect>` from both `client/public/aptis-logo.svg` and
  `client/public/aptis-logo-full.svg`.
- Kept the viewBox, symbol paths, wordmark, colours, and dimensions unchanged.
- Added `tests/aptis-logo.test.js`; it failed against the old assets and passes
  after the rectangles were removed.

Verification:

- `node --test tests/aptis-logo.test.js` — **2/2 passed**
- `MONGODB_TEST_URI="mongodb://127.0.0.1:27017/aptis-go-test"; npm test` —
  **87/87 passed**
- `npm run test:ui` — **43/43 passed**
- `npm run test:jest` — **7/7 passed**
- `npm run lint` — clean
- `npm run format:check` — clean
- `npm --prefix client run build` — successful

The only visual change is the transparent asset background; the auth shell
still supplies its own `#06111f` page background.
