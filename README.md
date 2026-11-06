# AccessLens · DevX

A web accessibility auditor and fix suggester. AccessLens scans public websites with Chromium and axe-core, groups findings by rule and affected element, and provides a workspace for inspecting findings, reviewing proposed fixes, and exporting reports.

> Automated findings help identify accessibility barriers. They do not establish complete WCAG conformance or replace manual testing with assistive technologies.

## Contents

- [Current capabilities](#current-capabilities)
- [Technology and architecture](#technology-and-architecture)
- [Local setup](#local-setup)
- [Using the workspace](#using-the-workspace)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Scoring](#scoring)
- [Storage](#storage)
- [Build and validation](#build-and-validation)
- [Docker status](#docker-status)
- [Troubleshooting](#troubleshooting)
- [Limitations and production work](#limitations-and-production-work)
- [Contributing](#contributing)

## Current capabilities

| Area | Current behavior |
| --- | --- |
| Website audits | Single-page scans with Playwright Chromium and axe-core; results include rules, severity, affected HTML, selectors, and page information. |
| Multi-page audits | Same-origin HTML link discovery followed by accessibility scans. Crawl limits are capped at 50 attempted pages and depth 3. |
| Findings workspace | Issues on the left and preview on the right on desktop; Issues/Preview tabs on mobile. Search, status/severity filters, rule/element views, and expandable details are available. |
| Preview and inspection | A demo document and backend-served preview HTML with injected overlays; inspection depends on the target, captured document, and selector validity. |
| Fix suggestions | Deterministic rule-based templates. No external AI provider is currently wired into fix generation. |
| Fix verification | Browser-based axe-core checks on a constructed document. This verifies a limited snippet context, not a deployed website. |
| History and comparison | Saved scan history and a frontend comparison workflow. No dedicated server-side comparison endpoint exists. |
| Reports | Browser-side CSV/JSON downloads and an executive report/print dialog for PDF output. |
| Reading and learning tools | A preview reader with play/pause/resume/stop, voice and speed controls, structural filters, a reading transcript, and current/proposed HTML reading. Includes a contrast calculator and color-vision learning tools. The reader uses browser speech and an approximate DOM outline, not NVDA/JAWS/VoiceOver output. |
| Appearance | Light/dark modes, shared page headers, section navigation, responsive layouts, and reduced-motion support. |
| Monitoring | Create, list, update, pause/resume, and delete monitor records through the API. Scheduled execution and notifications are not implemented. |
| GitHub | Review UI and mock API responses. Repository listing and PR creation do **not** connect to GitHub or create real pull requests. |
| Browser extension / CLI | UI/documentation references exist, but runnable extension and CLI source packages are absent from the current checkout. |

### Demo state

The workspace initially displays sample findings and a fictional Forma workspace-store preview (`forma.example`). Its illustrations are local SVG assets, and its accessibility problems are intentional demo fixtures. Use **Clear Demo Data** before starting a real audit, or submit a URL to replace the sample state. **Load Sample Data** restores the demo.

The monitoring storage service also supplies an example monitor when no monitor file exists. Monitor scores/timestamps may be initialized placeholder values, not completed scheduled scans. GitHub repository names and returned PR URLs are mocked even when a UI message appears to indicate connection or success.

## Technology and architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React 18, Vite 6, JavaScript/JSX, Tailwind CSS 3, Lucide React, Axios |
| API | Node.js, Express 4, ES modules |
| Browser automation | Playwright with Chromium |
| Accessibility engine | `@axe-core/playwright` / axe-core |
| Crawling | Fetch, Cheerio, DNS/IP validation with `ipaddr.js` |
| Storage | In-memory maps backed by local JSON files |

```text
Browser: React + Vite (:5173)
         |
         | /api requests through the Vite development proxy
         v
Express API (:3000)
         |
         +-- URL validation and same-origin crawl discovery
         +-- Playwright Chromium + axe-core
         +-- Rule-based fix proposals and snippet verification
         +-- Local JSON persistence in backend/data/
```

**Current execution model:** scan and crawl requests wait for the work to finish and return completed results. There is no separate worker, Redis job queue, or durable queued/processing lifecycle. MySQL, BullMQ, external AI providers, real GitHub integration, and production monitoring are intended future architecture described in [AGENTS.md](AGENTS.md).

### Repository layout

```text
DevX/
├── AGENTS.md                   # Repository guidance and intended architecture
├── README.md
├── frontend/
│   ├── src/
│   │   ├── components/         # Layout, scans, issues, preview, reports, tools
│   │   ├── hooks/              # Scan status hook
│   │   ├── pages/              # AuditDashboard and utility-page composition
│   │   ├── services/           # API client and service adapters
│   │   └── index.css           # Shared typography, themes, and layout styles
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── app.js              # Express entry point
│   │   ├── routes/             # Scan, crawl, fix, monitor, GitHub, preview routes
│   │   ├── services/           # Scanner, crawler, storage, verification, URL checks
│   │   └── config/             # Configuration scaffold
│   ├── data/                   # Runtime JSON storage; must be writable
│   ├── migrations/             # Placeholder; no active database migrations
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml         # Incomplete deployment scaffold
```

Some directories are placeholders. Their presence does not mean the associated service has been implemented.

## Local setup

### Prerequisites

- Node.js 22 or newer and npm. This workspace has been built locally with Node.js 24.
- Network access for installing packages, downloading Chromium, and scanning public sites.
- Enough memory and disk space for Chromium.
- A writable `backend/data/` directory for saved scans and monitor configuration.

MySQL, Redis, GitHub credentials, and an AI API key are not required for the current local implementation.

### 1. Clone the repository

```bash
git clone https://github.com/hifzan82/DevX.git
cd DevX
```

### 2. Install the backend and Chromium

```bash
cd backend
npm install
npx playwright install chromium
```

On Linux, Playwright may also require system libraries:

```bash
npx playwright install --with-deps chromium
```

The backend lockfile currently does not match all dependencies declared in its `package.json`. Use `npm install` to reconcile dependencies; `npm ci` may fail until the lockfile is updated and committed. Do not copy `node_modules` from another operating system.

### 3. Start the API

From `backend/`:

```bash
npm run dev
```

The API defaults to **http://localhost:3000**. Keep this terminal running.

Check its health from another terminal:

```bash
curl --fail http://localhost:3000/api/health
```

A healthy response includes `status: "ok"`, the service name, version, and a timestamp. A healthy API alone does not prove Chromium scans or storage writes work.

### 4. Install and start the frontend

In another terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to `http://localhost:3000`, so no frontend environment file is needed for the default setup. If a port is occupied, use the actual URL printed by Vite.

## Using the workspace

1. Enter a public `http` or `https` URL.
2. Choose **Scan website**, or **Scan all pages** to configure a multi-page audit.
3. Review the summary and detected issues. Rules and affected elements are different counts.
4. Search or filter findings, or switch between grouped rules and individual elements.
5. Expand an issue to read the explanation, inspect its selector, navigate affected nodes, and review its current/proposed HTML.
6. Use **Inspect** to synchronize with the preview where supported. On mobile, this opens the Preview tab.
7. Generate or copy a proposal, then use **Verify in Sandbox** to check the snippet in a constructed document. Review the output before applying any change to source code.
8. Use history to reload stored audits, compare findings, or export CSV/JSON and printable reports.

Ignoring/restoring an issue changes frontend state; there is no persisted issue-decision endpoint. Copying or generating a fix does not change the target website. The verification environment and target page can differ, so a passing snippet still needs integration and manual review.

### Browser screen reader

Use the speaker button in **Live preview** to open the reader. It reads the accessible names, roles, and visible text available in the preview document. Filter the outline by headings, links, form controls, landmarks, or images; select a transcript item or use previous/next to navigate.

- **Read aloud**, **Pause**, **Resume**, and **Stop** control playback. Closing the reader, leaving its page, reloading the outline, or changing source/voice/speed stops playback.
- Only Google voices exposed by the browser/device are listed. Google US English is the default when available; otherwise another Google voice is selected. If none are exposed, audio is disabled while the transcript stays available. Google voices may send text to their provider. Speed ranges from 0.5× to 2×.
- In an expanded issue, open **Screen reader simulator** to compare the actual current HTML with the proposed fix. The proposed wording is not a verification result.
- Only one AccessLens reader speaks at a time. Speech errors and unavailable/restricted preview documents show fallback messages; transcripts remain usable when speech is unsupported.
- Outlines are bounded to 500 items / 30,000 characters. Hidden content and decorative images are excluded where detectable. Form values are not read.
- The reading outline approximates DOM semantics. It does not implement the full accessible-name algorithm, native screen-reader behavior, braille, or a complete browser accessibility tree. CSS-dependent visibility can be inferred only for rendered preview documents; detached snippets have limited context.

Voice availability, audible output, and pause/resume behavior depend on the browser and operating system. Test with actual assistive technology before treating a page as accessible.

## Configuration

The application runs with defaults. If needed, create local environment files; do not commit secrets.

| Variable | Location | Actual use |
| --- | --- | --- |
| `PORT` | Backend process / `backend/.env` | API listen port; entry point defaults to `3000`. |
| `VITE_API_BASE_URL` | `frontend/.env.local` | Optional frontend API origin. Leave unset for the Vite proxy. Do not append `/api`: service paths already include it. |
| `NODE_ENV` | Backend process | Conventional runtime setting; not a substitute for production hardening. |

The backend entry point attempts to load `.env` from its working directory using Node's environment-file support. Launch it from `backend/` if using `backend/.env`.

Example backend file:

```dotenv
PORT=3000
NODE_ENV=development
```

Optional frontend override:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

Restart the relevant server after environment changes. If changing the backend port while using the proxy, also update its target in [frontend/vite.config.js](frontend/vite.config.js).

`backend/src/config/env.js` contains a separate configuration scaffold with a `5000` fallback and database/Redis fields. The running entry point does not import it. `FRONTEND_ORIGIN`, database credentials, and Redis settings do not currently enable those capabilities; CORS is presently configured with a wildcard origin.

Anything prefixed with `VITE_` is public browser configuration. Never put private tokens or provider credentials there.

## API reference

Base URL for local development: `http://localhost:3000`.

Scan routes are mounted under both `/api/scans` and `/api/scan`; crawl routes under both `/api/crawls` and `/api/crawl`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | API health metadata. |
| POST | `/api/scans` | Run an audit; accepts `url`, `maxPages`, and `maxDepth`. Returns a completed scan record. |
| POST | `/api/scans/run` | Alias for scan submission. |
| GET | `/api/scans` | List stored scans. |
| GET | `/api/scans/:scanId` | Retrieve one scan. |
| GET | `/api/scans/:scanId/issues` | Retrieve that scan's issues array; no server-side pagination/filter contract. |
| POST | `/api/scans/:scanId/rescan` | Create a new single-page scan for the stored target. |
| POST | `/api/crawls` | Discover pages and save a crawl record; discovery alone does not run axe-core. |
| GET | `/api/crawls/:crawlId` | Retrieve a saved crawl record. |
| POST | `/api/fixes/generate` | Generate a template proposal from `ruleId`, `snippet`, and optional `summary`. |
| POST | `/api/fixes/verify` | Check `ruleId` and `fix` in a constructed browser document. |
| GET | `/api/monitors` | List monitor configuration records. |
| POST | `/api/monitors` | Create a record using `url`, optional `frequency`, and `alerts`. Does not schedule scans. |
| PATCH | `/api/monitors/:id` | Update a monitor record. |
| DELETE | `/api/monitors/:id` | Delete a monitor record. |
| GET | `/api/preview?url=...&scanId=...` | Return backend-served preview HTML; use URL encoding for query values. |
| GET | `/api/preview/scan-data/:scanId` | Return issue data used for preview overlays. |
| GET | `/api/github/repos` | Mock repository list, not an authenticated GitHub lookup. |
| POST | `/api/github/pull-requests` | Mock PR response for a nonempty `patches` array; no real GitHub write. |

### Single-page scan

```bash
curl --fail --max-time 180 http://localhost:3000/api/scans \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com","maxPages":1,"maxDepth":1}'
```

The response includes `scanId`, `status`, `startUrl`, `createdAt`, `pagesScanned`, `pagesFailed`, `severityCounts`, `score`, `issues`, `results`, and preview metadata where available. Inspect page-level failures as well as the overall status; a returned scan record can include failed pages.

### Multi-page audit

```bash
curl --fail --max-time 300 http://localhost:3000/api/scans \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com","maxPages":5,"maxDepth":2}'
```

The crawler discovers HTML links on the permitted origin. Client-rendered navigation, login-protected pages, and anti-bot restrictions may limit coverage. The frontend API timeout is currently 120 seconds, so larger synchronous audits may outlast the browser request.

### Generate and verify a candidate fix

```bash
curl --fail http://localhost:3000/api/fixes/generate \
  -H 'Content-Type: application/json' \
  --data '{"ruleId":"image-alt","snippet":"<img src=\"logo.png\">"}'

curl --fail http://localhost:3000/api/fixes/verify \
  -H 'Content-Type: application/json' \
  --data '{"ruleId":"image-alt","fix":"<img src=\"logo.png\" alt=\"Company logo\">"}'
```

Template text must be reviewed for meaning. Verification reports whether the selected rule remains flagged in the constructed document. Some verification templates supply surrounding HTML or default attributes; this is not proof that the original source or live page has been corrected.

## Scoring

The backend uses this project-defined estimate:

```text
score = clamp(100 - 12 × critical - 6 × serious - 3 × moderate - 1 × minor, 0, 100)
```

These inputs count violation objects aggregated across scanned pages, not individual affected DOM nodes. The frontend has a separate fallback calculation using affected counts and different weights when a backend score is unavailable. Demo/fallback scores and backend scores are therefore not directly interchangeable.

A score of 100 means no deduction under this calculation. It is not an official WCAG rating, a certification, or evidence that every relevant accessibility check was performed.

## Storage

Runtime storage is implemented in [storageService.js](backend/src/services/storageService.js):

- `backend/data/scans.json`: up to the latest 50 saved scan records written to disk.
- `backend/data/crawls.json`: up to the latest 50 saved crawl records written to disk.
- `backend/data/monitors.json`: monitor configuration records.

Data is loaded into in-memory maps on startup. The in-memory collection can grow beyond the disk retention limit until restart. There is no database transaction layer, multi-process synchronization, per-user ownership, or persistent issue-decision history.

The directory must be writable. Storage write failures are logged and may not fail the API request, so verify files exist before relying on persistence. Treat captured HTML and reports as potentially sensitive website data; do not casually commit runtime artifacts.

## Build and validation

Frontend production build:

```bash
cd frontend
npm run build
```

Output is written to `frontend/dist/`. To inspect it locally:

```bash
npm run preview
```

Vite's development `/api` proxy is configured under `server`, not as a production API gateway. For built/preview deployments, use a suitable `VITE_API_BASE_URL` at build time or configure a reverse proxy for `/api`.

Backend entry-point syntax check:

```bash
cd backend
node --check src/app.js
```

This checks syntax only; it does not execute imports, launch Chromium, validate persistence, or test routes.

Run the screen-reader regression suite after installing backend dependencies and Chromium:

```bash
cd frontend
npm run test:reader
```

The suite starts an isolated Vite server and reuses the backend's installed Playwright. It checks content extraction and reader interactions with a controlled speech service; it does not verify audible output from system voices. There are no general lint/type-check scripts or comprehensive application-wide test suite yet.

Useful manual checks include:

- Health endpoint responds and real scans report meaningful page results.
- Search, severity/status filters, rule/element switching, and node navigation work.
- Inspect synchronizes with a supported preview; invalid selectors fail gracefully.
- Copy uses the selected node's fix; ignore/restore and verification controls remain usable.
- CSV/JSON exports download, and the print dialog opens.
- Light/dark modes, keyboard focus, reduced motion, and mobile layout remain usable.
- Saved scans can be reloaded after a backend restart.

## Docker status

The existing Docker assets are **an incomplete scaffold**, not a verified deployment recipe:

- Compose exposes API port `5000`; the default local Vite proxy targets `3000`.
- The backend Dockerfile uses `npm ci`, which needs a synchronized lockfile.
- The Alpine image does not install a supported Chromium runtime or its required browser dependencies.
- Compose starts Redis, but the application does not use it.
- There is no separate scan worker, frontend service, database, or persistent data volume.

Use the local setup above for now. Before deploying, reconcile dependencies, provide a supported Playwright/browser image, configure persistent storage and routing, and complete the security work below.

## Troubleshooting

| Symptom | Check / action |
| --- | --- |
| `Executable doesn't exist` during a scan | Run `npx playwright install chromium` from `backend/` under the same user that runs the API. |
| Chromium cannot start on Linux | Install Playwright's browser system dependencies and check host/container compatibility. |
| `npm ci` rejects the backend lockfile | Run `npm install` to reconcile it, then review the lockfile diff. |
| Missing `@rollup/rollup-darwin-arm64`, Windows binaries, or platform executable errors | Reinstall frontend dependencies on the current OS. Avoid reusing another machine's `node_modules`. |
| `Permission denied` for Vite or data files | Check file ownership and execute/write permissions. Reinstall dependencies normally; avoid `sudo npm install`. |
| UI loads but API calls fail | Check `http://localhost:3000/api/health`, the Vite proxy target, and `VITE_API_BASE_URL`. |
| Results disappear on restart | Check `backend/data/` permissions and backend storage-error logs. |
| Localhost/private target is rejected | Public-URL validation intentionally blocks local/internal destinations. The web scanner is not a local-dev-server audit tool. |
| Preview is incomplete or highlighting is missing | Check failed fetches, captured HTML, selector validity, dynamic content, and browser security restrictions. |
| A large crawl times out | Reduce page/depth limits. Scans are synchronous and the frontend has a finite request timeout. |
| Monitoring shows a schedule but never runs | The API stores configuration only; there is no active scheduler. |
| GitHub says connected or returns a PR URL | Those endpoints are mocked. Confirm real GitHub integration separately before relying on any UI status. |

## Limitations and production work

This checkout is a development prototype. Do not expose its scan/preview endpoints as an unrestricted public service.

- **Browser/network isolation:** initial URLs receive DNS/IP validation and crawler redirects are revalidated, but browser redirects, subresources, preview requests, DNS rebinding, and snippet execution do not have complete outbound isolation. Chromium is launched with sandbox-disabling flags. Application validation alone is not a sufficient SSRF defense.
- **Untrusted preview HTML:** preview handling is not a complete sanitizer or security boundary. Arbitrary third-party HTML/scripts require a hardened, isolated rendering strategy before public use.
- **Access control:** authentication, owner-scoped authorization, rate limits, and production CORS restrictions are not implemented.
- **Background work:** migrate scans/crawls out of HTTP handlers into bounded worker processes with durable status, retries, and cleanup policies.
- **Persistence:** replace local JSON with transactional durable storage and migrations before multi-user or multi-instance operation.
- **Fix review:** suggestions are proposals; snippet verification has limited context and some accessibility requirements require human judgment.
- **Monitoring/GitHub:** implement real schedules, regression comparisons, notifications, authorized repository access, source mapping, and approved-patch writes. Remove mocked success responses from production paths.
- **Extension/CLI:** recover and validate the actual source packages before documenting installation as available. Current UI references include a machine-specific extension path.

See [AGENTS.md](AGENTS.md) for the intended architecture, security requirements, and phased roadmap. That document describes goals; it is not evidence that those capabilities already exist.

## Contributing

1. Read [AGENTS.md](AGENTS.md) and inspect the current implementation before editing.
2. Keep frontend-only changes within `frontend/`; avoid unrelated refactors.
3. Keep sample data and mock integrations clearly separate from real results.
4. Preserve working controls, loading/error states, keyboard access, and responsive layouts.
5. Run the relevant available checks, review the diff, and report actual outcomes.
6. Keep credentials out of source files and all `VITE_` configuration.

No license file is currently present in the repository. Clarify licensing with the repository owner before redistribution.
