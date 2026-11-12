> **Deployment and release:** Render configuration, access protection, extension/CLI packaging, and operational checks are documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The deployment is a protected single-instance team workspace, not public multi-tenant hosting. Browser sandbox support must be verified on the target host.

# Sarvya

A web accessibility auditing toolkit with a web workspace, a local npm CLI, and a Chrome/Edge extension. Sarvya scans public websites with Chromium and axe-core, groups findings by rule and affected element, and provides a workspace for inspecting findings, reviewing proposed fixes, and exporting reports.

> Automated findings help identify accessibility barriers. They do not establish complete WCAG conformance or replace manual testing with assistive technologies.

## Contents

- [Current capabilities](#current-capabilities)
- [Technology and architecture](#technology-and-architecture)
- [Local setup](#local-setup)
- [Using the workspace](#using-the-workspace)
- [npm CLI: installation and usage](#npm-cli-installation-and-usage)
- [Browser extension: installation and usage](#browser-extension-installation-and-usage)
- [Release packages](#release-packages)
- [Configuration](#configuration)
- [Scheduled monitoring](#scheduled-monitoring)
- [GitHub OAuth setup](#github-oauth-setup)
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
| History and comparison | Durable scan snapshots, finding-level baseline comparisons, and a server comparison endpoint at `GET /api/scans/:id/compare?baselineId=...`. |
| Reports | Browser-side CSV/JSON downloads and an executive report/print dialog for PDF output. |
| Reading and learning tools | A preview reader with play/pause/resume/stop, voice and speed controls, structural filters, a reading transcript, and current/proposed HTML reading. Includes a contrast calculator and color-vision learning tools. The reader uses browser speech and an approximate DOM outline, not NVDA/JAWS/VoiceOver output. |
| Appearance | Light/dark themes, optional colour-vision onboarding and saved preferences, labelled severity icons, stronger contrast, patterned indicators, responsive layouts, and reduced-motion support. |
| Monitoring | Real BullMQ daily/weekly schedules with local time/time zone, fixed or previous-run baselines, finding-level comparisons, history, and deduplicated in-app notifications. |
| GitHub | Real OAuth login, writable repository selection, explicit finding-to-source mapping, patch diffs, per-patch approval, and draft PR creation. Requires OAuth App configuration. |
| npm CLI | Local Playwright/axe-core audits, JSON/HTML/CSV reports, configurable CI thresholds, timeouts, explicit browser installation, and reliable exit codes. Source and installable tarball are available; npm publication is pending. |
| Browser extension | Manifest V3 Chrome/Edge extension with local active-tab audits, severity filtering, supported-element inspection, JSON export, and session-only results. Source and unpacked ZIP are available; store publication is pending. |

### Demo state

The workspace initially displays sample findings and a fictional Forma workspace-store preview (`forma.example`). Its illustrations are local SVG assets, and its accessibility problems are intentional demo fixtures. Use **Clear Demo Data** before starting a real audit, or submit a URL to replace the sample state. **Load Sample Data** restores the demo.

Monitoring starts empty. The previous seeded example monitor is excluded, and imported real configurations have their placeholder scores/run timestamps removed. GitHub data is fetched only after real OAuth authorization; an unconfigured connection displays Coming soon.

## Technology and architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React 18, Vite 6, JavaScript/JSX, Tailwind CSS 3, Lucide React, Axios |
| API | Node.js, Express 4, ES modules |
| Browser automation | Playwright with Chromium |
| Accessibility engine | `@axe-core/playwright` / axe-core |
| Crawling | Fetch, Cheerio, DNS/IP validation with `ipaddr.js` |
| Jobs | Redis + BullMQ; separate worker process |
| Storage | Atomic JSON run files shared by API/workers; legacy history remains readable |

```text
Browser: React + Vite (:5173)
         |
         | /api requests through the Vite development proxy
         v
Express API (:3000)
         |
         +-- Validate URL, persist run, enqueue ID -> Redis/BullMQ
         |                                        |
         |                                  Separate worker
         |                                        |
         |                            Crawl -> Chromium + axe-core
         |                                        |
         +-- Shared atomic run files <------------+
         +-- SSE status/results, existing preview and fix tools
```

**Current execution model:** the API validates targets, persists a queued run, and enqueues its ID in Redis/BullMQ. A separate worker discovers pages and runs Playwright/axe-core. The workspace follows persisted progress over SSE, with polling fallback, and fetches findings when complete. MySQL and external AI providers remain future work. A separate monitoring worker manages recurring triggers and durable result reconciliation. Existing JSON history remains readable.

### Repository layout

```text
Sarvya/
├── frontend/                 # React/Vite workspace and browser regression tests
├── backend/
│   ├── src/routes/           # Scan, monitoring, fix, preview, and GitHub APIs
│   ├── src/services/         # Persistence, comparison, browser safety, integrations
│   ├── src/queues/           # Redis/BullMQ queue connections
│   ├── src/workers/          # Separate scan and monitoring worker processes
│   ├── tests/                # API, browser, queue, and production-startup tests
│   └── .env.example          # Placeholder configuration; no private credentials
├── cli/                      # sarvya-cli npm package; provides the sarvya command
├── extension/                # Chrome/Edge Manifest V3 source and privacy disclosure
├── scripts/                  # Packaging, validation, and production supervision
├── docs/                     # Deployment guide and recorded validation results
├── .github/workflows/ci.yml  # Automated checks and release artifact preparation
├── Dockerfile                # Combined Render deployment image
├── docker-compose.yml        # Separate API/worker/monitor/Redis services
└── render.yaml               # Render service, private queue, and persistent disk
```

Generated folders such as `node_modules/`, `frontend/dist/`, `extension/dist/`, and `release/` are excluded from Git. Build them locally or retrieve the release artifact generated by CI. Runtime scan data and credentials are also excluded.

## Local setup

### Prerequisites

- Node.js 22.12 or newer and npm. This workspace has been built locally with Node.js 24.
- Network access for installing packages, downloading Chromium, and scanning public sites.
- Enough memory and disk space for Chromium.
- A writable `backend/data/` directory for saved scans and monitor configuration.

Redis 7+ is required for scans. MySQL and an AI API key are not required. GitHub OAuth credentials are required only for the GitHub integration. API and workers must share the same writable data directory.

### 1. Clone the repository

```bash
git clone https://github.com/alive7z/Sarvya.git Sarvya
cd Sarvya
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

The backend lockfile is synchronized; `npm ci` is supported. Install dependencies on the current operating system rather than copying `node_modules`.

### 3. Start Redis, the API, and workers

Start a local Redis installation, or use Docker for Redis alone:

```bash
docker run --name sarvya-redis -p 127.0.0.1:6379:6379 -v sarvya-redis:/data redis:7.4-alpine redis-server --appendonly yes --maxmemory-policy noeviction
```

Copy `backend/.env.example` to `backend/.env` if custom configuration is needed. Keep existing environment files intact.

In a separate terminal, from `backend/`, start the worker:

```bash
npm run worker
```

In another terminal from `backend/`, start the monitoring worker:

```bash
npm run monitor
```

It dispatches scheduled audits to the scan worker and reconciles history/comparisons/notifications. Both workers are required for scheduled audits. Then start the API:

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
- Only one Sarvya reader speaks at a time. Speech errors and unavailable/restricted preview documents show fallback messages; transcripts remain usable when speech is unsupported.
- Outlines are bounded to 500 items / 30,000 characters. Hidden content and decorative images are excluded where detectable. Form values are not read.
- The reading outline approximates DOM semantics. It does not implement the full accessible-name algorithm, native screen-reader behavior, braille, or a complete browser accessibility tree. CSS-dependent visibility can be inferred only for rendered preview documents; detached snippets have limited context.

Voice availability, audible output, and pause/resume behavior depend on the browser and operating system. Test with actual assistive technology before treating a page as accessible.

## npm CLI: installation and usage

The **`sarvya-cli`** package provides the **`sarvya`** terminal command. It runs a single-page audit on your own machine using Playwright Chromium and axe-core. The CLI works independently of the web application: Redis, the backend API, a GitHub connection, and an AI API key are not required.

**Distribution status:** npm publication is pending. Use the local package or source installation below. Uploading the repository to GitHub does not publish the package to npm.

### Option A — install the prepared package

From the repository root, after generating or obtaining the release files:

```bash
npm install --global ./release/sarvya-cli-0.1.0.tgz
sarvya --install-browser
sarvya --version
sarvya --help
```

The tarball is a locally built artifact, not a file committed to the repository. To create it from a fresh checkout:

```bash
npm ci --prefix cli
npm ci --prefix extension
npm run release:pack
```

Packaging requires the `zip` utility. It is available on macOS and installed in the project's Docker builder. On other systems, install it using your operating system's package manager.

### Option B — run from source

```bash
cd cli
npm ci
node bin/sarvya.js --install-browser
node bin/sarvya.js https://example.com
```

To expose the command while developing the package, run `npm link` inside `cli/`, then use `sarvya` from your terminal.

### Registry installation after publication

Once the owner has published the package and confirmed registry name ownership:

```bash
npm install --global sarvya-cli
sarvya --install-browser
```

Until publication, the registry command may return `E404`. Use Option A or B instead. Chromium installation is explicit; installing the npm package does not silently download a browser. Linux environments may additionally require Playwright's OS libraries; from `cli/`, use `npx playwright install --with-deps chromium` with appropriate system permissions.

### Audit and reporting examples

Run a public-site audit, or inspect a locally running development server:

```bash
sarvya https://example.com
sarvya http://localhost:3000
```

The CLI requires a complete `http://` or `https://` address. The web workspace separately accepts bare domains and adds HTTPS automatically.

Export the actual results in the format your workflow needs:

```bash
# Machine-readable findings, selectors, snippets, and manual-review information
sarvya https://example.com --format json --output audit.json

# Human-readable report; open audit.html in your browser
sarvya https://example.com --format html --output audit.html

# Spreadsheet-friendly report
sarvya https://example.com --format csv --output audit.csv

# Fail a CI job only for critical findings
sarvya https://example.com --fail-on critical

# Export evidence without failing because of detected findings
sarvya https://example.com --format json --output audit.json --fail-on none
```

| Option | Purpose | Default |
| --- | --- | --- |
| `--format json\|html\|csv` | Select the report format. | `json` |
| `--output <file>` | Write a report atomically to the chosen file. | Report to stdout |
| `--fail-on <impact>` | Set the threshold: `minor`, `moderate`, `serious`, `critical`, or `none`. | `serious` |
| `--timeout <milliseconds>` | Bound the audit after browser launch; accepts 1,000–300,000 ms. | `45000` |
| `--install-browser` | Install the matching Chromium browser and exit. | Explicit action |
| `--help` / `--version` | Display usage or package version. | — |

| Exit code | Meaning |
| --- | --- |
| `0` | No finding reached the chosen failure threshold. |
| `1` | One or more findings met or exceeded that threshold. |
| `2` | Invalid arguments, navigation failure, missing browser, or another runtime error. |
| `130` | The audit was interrupted. |

JSON stdout contains report data; diagnostic messages go to stderr. HTML reports escape untrusted markup, and CSV output protects against common spreadsheet formula prefixes. Reports can contain sensitive page evidence: store and share them appropriately.

Only audit pages you are authorised to test. Localhost is supported by the local CLI; the hosted scanner blocks private/internal destinations. This CLI does not provide multi-page crawling, monitoring, or automatic source changes. A successful automated check is not proof of WCAG conformance. See [the CLI README](cli/README.md) for package-specific details.

## Browser extension: installation and usage

The **Sarvya Accessibility Auditor** extension runs bundled axe-core on the active website in Chrome or Microsoft Edge. Audits start only when the user chooses **Scan current page**. A backend server, npm CLI installation, account, and API key are not required to use the built extension.

**Distribution status:** the extension is available as an unpacked build and ZIP. Chrome Web Store and Edge Add-ons publication are pending; there is no store listing to install from yet.

### Option A — load the extension ZIP

1. Obtain `release/sarvya-extension.zip` from a local release build or the repository's CI release artifact.
2. Extract the ZIP into a permanent folder. The extracted folder must contain `manifest.json`.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
6. Optionally pin Sarvya to the browser toolbar for convenient access.

Do not select the ZIP itself or a parent directory that does not contain the manifest. Keep the extracted folder in place while the unpacked extension is installed.

### Option B — build and load from source

From the repository root:

```bash
npm ci --prefix extension
npm run build:extension
```

Then follow the browser steps above, selecting **`extension/dist`** as the unpacked folder. The source directory `extension/` is not the complete loadable package: the build bundles axe-core and creates the required icons and assets.

After rebuilding an installed unpacked extension, click its **Reload** button on the browser's extensions page. Refresh the target website before scanning again so stale injected scripts and selectors are cleared.

### Audit workflow

1. Open an authorised HTTP(S) website and click the Sarvya extension icon.
2. Select **Scan current page** and wait for the actual audit to complete.
3. Review violation occurrence counts, rule details, impact labels, and the number of rules needing manual review.
4. Use **Filter by impact** to focus on critical, serious, moderate, or minor findings.
5. Select **Inspect element** to locate a supported target. The extension scrolls to it and shows a removable dashed black-and-white highlight.
6. Select **Download JSON report** to export the captured evidence, or **Clear results** to remove the stored results.

If the popup closes during an audit, reopen it to check its stored state. If the page navigated or changed, scan again before relying on selectors. Frame/shadow-root targets and missing elements show an explanation when automatic inspection is unavailable.

### Permissions, privacy, and limits

| Permission | Why it is used |
| --- | --- |
| `activeTab` | Temporary access to the current page after an explicit user action. |
| `scripting` | Run the locally bundled scanner and inspection overlay. |
| `storage` | Retain audit state and findings in browser session storage. |

The extension does not request blanket host permissions. It does not upload page data to Sarvya, an AI provider, or analytics services, and it does not download remotely hosted executable code. External rule-guidance links open only after the user selects them.

Results include page URLs, titles, selectors, and limited HTML snippets, which may contain sensitive content. They stay in session storage until tab navigation, tab closure, browser restart, or **Clear results**. Downloaded reports remain on your device until you delete them. Up to 100 targets per rule are retained; full occurrence counts and truncation indicators remain visible. The temporary highlight closes after 15 seconds, scrolling/resizing, or its Close button.

Browser settings pages, extension stores, some PDF viewers, protected content, and restricted frames cannot be audited. Automated findings and vision simulations do not certify accessibility. See [extension documentation](extension/README.md) and the [privacy disclosure](extension/PRIVACY.md).

## Release packages

Prepare both distributable packages from a fresh checkout:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix cli
npm ci --prefix extension
npm run release:check
npm run release:pack
npm --prefix frontend run build
```

| Generated file | Purpose |
| --- | --- |
| `release/sarvya-cli-0.1.0.tgz` | Installable npm CLI tarball. |
| `release/sarvya-extension.zip` | Extractable Chrome/Edge extension build. |
| `release/SHA256SUMS` | Integrity checksums for the generated archives. |
| `extension/dist/` | Unpacked extension directory for local browser installation. |
| `frontend/public/downloads/sarvya-extension.zip` | Extension download copied into the web application's production build. |

On systems with `shasum`, verify archive integrity from the `release/` directory:

```bash
cd release
shasum -a 256 -c SHA256SUMS
```

`npm run build` at the repository root packages the CLI and extension before building the frontend. The CI workflow also validates the project and prepares a downloadable `sarvya-release` artifact. CI artifacts are produced only after the workflow succeeds; generated archives are excluded from Git and are not automatically attached to a GitHub Release.

Package preparation does not publish to npm or either browser store. Publishing requires the owner's registry/developer account, ownership checks, accurate privacy/support declarations, and the relevant approval process. The project remains **UNLICENSED**. Deployment, backup, and hosting details are covered in [the deployment guide](docs/DEPLOYMENT.md).

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

`backend/src/config/env.js` loads environment configuration for both API and worker. `PORT` defaults to 3000, `REDIS_URL` to `redis://127.0.0.1:6379`, and `FRONTEND_ORIGIN` to `http://localhost:5173`. CORS uses that explicit frontend origin. See [backend/.env.example](backend/.env.example) for all worker settings.

Anything prefixed with `VITE_` is public browser configuration. Never put private tokens or provider credentials there.

## Scheduled monitoring

Start both backend processes, `npm run worker` and `npm run monitor`, with the same `REDIS_URL`, `SCAN_QUEUE_NAME`, and absolute `DATA_DIR`. The monitoring queue is named `<SCAN_QUEUE_NAME>-monitors`; scan jobs use the existing globally bounded scan queue. Docker Compose runs both workers as separate services. No new database or dependency is required for the current shared-filesystem deployment.

### Scheduling real audits

On the **Monitoring** page, add a public HTTP(S) URL, daily/weekly frequency, local `HH:mm` time, IANA time zone, optional weekday, crawl limits, baseline policy, and in-app alert preference. Weekly days use Sunday=0 through Saturday=6. The API defaults to 09:00 UTC on Monday for weekly schedules; the UI explicitly submits the browser's time zone. BullMQ's cron scheduler handles time-zone/DST rules; ambiguous or nonexistent local times follow its cron-parser behavior. The actual next timestamp is read from Redis, never fabricated from a timer.

The first scheduled audit occurs at the next matching time. Use **Run now** to request an audit immediately, including while a monitor is paused. At most one audit may be pending per monitor. Across monitors and manual scans, browser work shares `SCAN_WORKER_CONCURRENCY` and `SCAN_GLOBAL_CONCURRENCY` limits. Existing URL safety checks, bounded crawling, deadlines, cancellation, and transient scan retries remain in effect.

Monitor configuration is persisted before Redis synchronization. If Redis is unavailable, the API retains the configuration with `scheduleStatus: "pending"` and an explicit error. The monitoring worker reconciles missing/changed schedules, removes orphaned scheduler IDs, and completes pending result processing every 15 seconds. A real heartbeat reports worker availability; the page refreshes status/history/notifications every 10 seconds. A queue record does not mean that a browser audit has completed. Both workers must stay running for execution; outage/backlog can delay or skip historical intervals rather than replaying every missed audit.

Pausing gates old triggers and removes the scheduler; an already requested audit may finish. Changing schedule settings reuses one stable scheduler ID and fences stale jobs with a configuration version. Changing URL/crawl scope clears the current baseline and displayed result metrics. Deleting writes a tombstone, removes the schedule, and requests cancellation of pending work; scan snapshots and notification/history evidence remain available. Redis outages or a crash between steps are recovered from persisted intent. Enqueue submission is retried up to three times; a failure before browser processing is recorded explicitly rather than hanging forever. Duplicate trigger delivery uses a deterministic scan ID, and completion/history/notification updates are idempotent.

### Baselines and regression detection

The first completed audit without page/discovery failures establishes the baseline. **Fixed baseline** retains that snapshot; **Previous complete run** advances after each complete audit. A matching complete scan can be selected explicitly through `baselineScanId`; **Use as fixed baseline** is available in monitor history. Scans must have the same normalized start URL, page limit, and depth to be used as a baseline. Partial scans do not automatically replace it.

Comparisons use individual rule/page/selector fingerprints, not just score or total issue counts. URL fragments are removed and query parameters sorted; target selector chains are retained. Findings are classified as **new**, **resolved**, **persistent**, or **uncertain**. An increase in axe impact or matching affected-occurrence count is **worsened**. Summary counts represent distinct finding fingerprints; each entry includes its current/previous occurrence counts. Project score deltas are supplemental and are not a WCAG conformance measure.

Confirmed changes require successful page coverage in both snapshots. Missing/failed pages, missing selectors, and common generated/dynamic selector patterns remain uncertain; changing selectors or dynamic page content can still limit reliable matching. New pages absent from the baseline do not silently count as proven regressions. Historical evidence is preserved even when an issue is ignored in the workspace.

In-app regression notifications compare with the previous completed snapshot independently of the selected baseline, so a persistent deviation from a fixed baseline does not alert repeatedly. Newly reintroduced findings or increased severity/occurrences can alert again. Repeated scan failures notify once until a completed run recovers. Alerts can be disabled; read/unread decisions persist. No email or external messages are sent.

### Monitoring API and storage

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/monitors` | Monitor configurations and actual pending/result status |
| GET | `/api/monitors/status` | Redis availability and monitoring-worker heartbeat |
| POST | `/api/monitors` | Create schedule: `url`, `frequency`, `time`, `timeZone`, `weekday`, `maxPages`, `maxDepth`, `alerts`, `baselineMode`, optional `baselineScanId` |
| PATCH | `/api/monitors/:id` | Validated settings, `active` pause/resume, baseline selection |
| DELETE | `/api/monitors/:id` | Remove future scheduling and request pending cancellation |
| POST | `/api/monitors/:id/run` | Request immediate audit; HTTP 202 with real pending state |
| GET | `/api/monitors/:id/history?page=1` | Durable run metadata, 20 per page |
| GET | `/api/monitors/:id/history/:scanId/comparison` | Stored comparison entries, or null when no comparison exists |
| GET | `/api/monitors/notifications?page=1&unread=false` | In-app notifications, 50 per page, plus unread count |
| PATCH | `/api/monitors/:id/notifications/:notificationId` | Persist `{read: true}` or `{read: false}` |
| GET | `/api/scans/:scanId/compare?baselineId=...` | Compare two compatible completed snapshots |

The legacy GET/POST/PATCH/DELETE monitor routes remain, with validated fields and actual asynchronous scheduling. New records have no invented initial score or last-run timestamp. The exact old `mon-1`/example.com seed is excluded; real legacy configurations migrate without their fake run metadata. The old file is preserved.

Monitor records live under `DATA_DIR/monitor-records/`; scan snapshots and their stored comparison are under `scan-runs/`. Per-monitor filesystem locks and atomic writes serialize API/worker changes. Redis coordinates scheduling and jobs, not permanent history. Monitor/history/notification files have no automatic deletion policy: back them up and manage storage capacity. This remains a shared-filesystem, single-workspace deployment, not MySQL-backed or tenant-isolated storage. Keep these endpoints private until general application authorization/rate limits are added.

Run `REDIS_TEST_URL=redis://127.0.0.1:6379 BROWSER_TESTS=1 npm test` from `backend/` and `npm run test:monitoring` from `frontend/`. The recurring-job test uses real Redis/BullMQ with an isolated test namespace and controlled scan results; the scanner suite separately runs actual Chromium/axe. No test schedules ongoing audits against user monitors.

## GitHub OAuth setup

The **GitHub** navigation page contains a **Log in with GitHub** button. It remains disabled with a Coming soon message until the API is configured. No personal access token is entered into the browser, and no sample repository/PR response substitutes for a real connection.

1. In GitHub, open **Settings → Developer settings → OAuth Apps → New OAuth App** ([official registration guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)).
2. For local development, set **Homepage URL** to `http://localhost:5173` and **Authorization callback URL** to `http://localhost:5173/api/github/oauth/callback`.
3. Put the client ID and generated client secret in `backend/.env`. Generate a separate session encryption secret with `openssl rand -hex 32`. Keep existing `.env` values intact and never commit credentials.

```dotenv
FRONTEND_ORIGIN=http://localhost:5173
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
GITHUB_SESSION_SECRET=your_random_secret_at_least_32_bytes
GITHUB_CALLBACK_URL=http://localhost:5173/api/github/oauth/callback
GITHUB_OAUTH_SCOPE=public_repo
```

4. Run Redis, restart the API, and open **http://localhost:5173**. Use that same hostname throughout; do not switch to `127.0.0.1` for this flow. Vite proxies `/api/github` to the API. Click **Log in with GitHub**, authorize the app, and choose a writable repository.
5. `public_repo` is the default scope for public repositories. Set `GITHUB_OAUTH_SCOPE=repo` and reconnect if private repository access is required. Organizations may also require OAuth App approval/SSO authorization. Classic OAuth scopes can cover multiple repositories; Sarvya writes only to the repository selected in an approved review. A GitHub App is a future option for installation-scoped repository permissions.

For production, use HTTPS and a same-origin reverse proxy for `/api`, with `FRONTEND_ORIGIN` and `GITHUB_CALLBACK_URL` pointing to that HTTPS origin. Production cookies are Secure; HTTP production configuration intentionally leaves OAuth disabled. Do not set a different `VITE_API_BASE_URL` origin for this cookie-based OAuth flow. In Compose, inject OAuth variables into the **API** environment; workers do not need them. Compose's project-level environment interpolation is separate from `backend/.env`.

### Reviewing and creating pull requests

- Start a review for an authorized repository. It captures the default branch commit/tree SHA; the file picker and source reads use this exact snapshot.
- Choose a finding from a completed stored scan. Demo data cannot create patches. Select a source file, read its actual contents, enter an original block and replacement, and confirm the mapping. The original block must match once. DOM selectors do not automatically identify JSX/templates; mapping is a user decision.
- Review the generated diff and approve each desired file. One replacement block per file, at most ten files; include a larger contiguous block for multiple edits in one file. Safe UTF-8 source files are limited to 200 KiB, replacement inputs to 50 KiB combined per file, and review diffs to 250 KiB. Dotfiles/directories, workflows, symlinks, submodules, binaries, and generated/dependency folders are excluded.
- Check the final consent box, then click **Create draft pull request**. Until this action, GitHub receives read requests only. The server checks repository permissions, current default-branch SHA, source blob SHAs, review revision, and approved content digests before writing a tree, commit, and a uniquely named `sarvya/fix-...` branch. It never updates the default branch or force-updates/deletes an existing branch.
- The returned link comes from a confirmed GitHub PR response. If a response is lost, retry the same saved review; checkpoints and branch/PR reconciliation avoid duplicating the PR. A partially created branch/commit can remain after an upstream failure and is reported in the review. There is no automatic merge or claim that repository CI passed. These proposals remain **unverified** until tested in the repository and checked for accessibility.

### GitHub sessions, storage, and API

OAuth uses [GitHub's authorization-code flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), single-use cookie-bound state, and S256 PKCE. Tokens stay server-side in AES-GCM-encrypted Redis sessions with an eight-hour maximum lifetime (or the token's shorter lifetime). No refresh token is retained: reconnect after expiry. The browser receives only an opaque HttpOnly, SameSite=Lax session cookie and a CSRF token for authenticated write requests. Disconnect removes the local session; revoke the app in GitHub Settings to remove the GitHub authorization itself.

Reviews and source mappings live in `DATA_DIR/github-reviews/<github-user-id>/`, with restrictive file permissions and cross-process write locks. They are owner-scoped and persist after an API restart. They include private source proposals where applicable: protect/back up the data volume. Reviews expire for editing/publishing after 24 hours, but are not automatically deleted. The browser stores only a per-user review ID for restoration; final PR consent resets after revision changes or reload. GitHub session ownership does not turn the rest of the prototype into a multi-user application; scan history is still shared.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/github/session` | Configuration/authentication state, user, CSRF token; never access tokens |
| GET | `/api/github/oauth/start` | Redirect to GitHub authorization |
| GET | `/api/github/oauth/callback` | Validate state, exchange code, create session, return to GitHub page |
| DELETE | `/api/github/session` | Disconnect the current session |
| GET | `/api/github/repos?page=1` | Writable repositories with `nextPage` |
| POST | `/api/github/reviews` | Snapshot selected `{repository: "owner/name"}` |
| GET | `/api/github/reviews/:id` | Read own review/status |
| GET | `/api/github/reviews/:id/files` | Candidate source paths; explicit `truncated` flag |
| GET | `/api/github/reviews/:id/source?path=...` | Exact source from reviewed snapshot |
| POST | `/api/github/reviews/:id/patches` | Prepare a uniquely matching replacement and finding mapping |
| PATCH | `/api/github/reviews/:id/patches/:patchId` | Record approval/revocation for current `revision` |
| DELETE | `/api/github/reviews/:id/patches/:patchId` | Reject a proposal; retain its review record |
| POST | `/api/github/pull-requests` | Publish `{reviewId, revision, approvedPatchIds, approval: true}` |

Authenticated mutation requests require the configured frontend `Origin`, cookie credentials, and `X-CSRF-Token` from `/session`. GitHub errors are sanitized; revoked/expired credentials clear the local session. Redis and GitHub outages produce errors instead of successful-looking mock responses. API calls have time/response-size limits and never follow redirects with credentials.

Run `cd backend && node --test tests/github.test.js` and `cd frontend && npm run test:github` for the dedicated integration suites. They use controlled GitHub responses and test the real app contracts; they do not create external branches or PRs. Live OAuth/PR validation requires a registered OAuth App and an authorized test repository.

## API reference

Base URL for local development: `http://localhost:3000`.

Scan routes are mounted under both `/api/scans` and `/api/scan`; crawl routes under both `/api/crawls` and `/api/crawl`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | API health metadata. |
| POST | `/api/scans` | Queue an audit; accepts `url`, `maxPages`, and `maxDepth`. Returns HTTP 202 with run/job IDs and queued state. |
| POST | `/api/scans/run` | Alias for scan submission. |
| GET | `/api/scans` | List stored scans. |
| GET | `/api/scans/:scanId` | Retrieve one scan. |
| GET | `/api/scans/:scanId/issues` | Retrieve that scan's issues array; no server-side pagination/filter contract. |
| POST | `/api/scans/:scanId/rescan` | Queue a new scan preserving the stored target and crawl limits. |
| POST | `/api/crawls` | Queue page discovery and save a crawl record; discovery alone does not run axe-core. |
| GET | `/api/crawls/:crawlId` | Retrieve a saved crawl record. |
| POST | `/api/fixes/generate` | Generate a template proposal from `ruleId`, `snippet`, and optional `summary`. |
| POST | `/api/fixes/verify` | Check `ruleId` and `fix` in a constructed browser document. |
| GET | `/api/monitors` | List real monitor configuration, next scheduled time, last results, and pending runs. |
| POST | `/api/monitors` | Persist configuration and register a BullMQ Job Scheduler. |
| PATCH | `/api/monitors/:id` | Update schedule, scope, alerts, baseline policy, or pause/resume state. |
| DELETE | `/api/monitors/:id` | Stop future triggers, request cancellation, and preserve historical scan evidence. |
| GET | `/api/preview?url=...&scanId=...` | Return backend-served preview HTML; use URL encoding for query values. |
| GET | `/api/preview/scan-data/:scanId` | Return issue data used for preview overlays. |
| GET | `/api/github/repos?page=1` | Paginated writable repositories for the OAuth user. |
| POST | `/api/github/pull-requests` | Create/reconcile a draft PR from a saved review and explicitly approved patch IDs. |

### Single-page scan

```bash
curl --fail --max-time 180 http://localhost:3000/api/scans \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com","maxPages":1,"maxDepth":1}'
```

Submission returns `scanId`, `jobId`, and `status: "queued"` immediately after validation and enqueueing. Existing `/api/scan` and `/api/scans/run` aliases behave identically. Fetch `GET /api/scans/:scanId` until terminal, or subscribe to `GET /api/scans/:scanId/events` (SSE `status` events). Completed records retain the existing `pagesScanned`, `pagesFailed`, `severityCounts`, `score`, `issues`, `results`, and preview fields. Inspect page-level failures even when the overall run completes.

```bash
curl -N http://localhost:3000/api/scans/SCAN_ID/events
curl --fail http://localhost:3000/api/scans/SCAN_ID
curl --fail -X POST http://localhost:3000/api/scans/SCAN_ID/cancel
```

Replace `SCAN_ID` with the actual returned ID. Crawl-only jobs under `/api/crawls` and `/api/crawl` also return 202, with analogous status, events, and cancellation endpoints; their completed payload remains discovery metadata rather than axe findings. External clients that previously expected synchronous POST results must follow these status endpoints.

### Multi-page audit

```bash
curl --fail --max-time 300 http://localhost:3000/api/scans \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com","maxPages":5,"maxDepth":2}'
```

The crawler discovers HTML links on the permitted origin. Client-rendered navigation, login-protected pages, and anti-bot restrictions may limit coverage. The HTTP submission does not wait for the crawl/audit; worker time limits apply instead.

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

Runtime storage uses [runStore.js](backend/src/services/runStore.js) and [storageService.js](backend/src/services/storageService.js):

- New scan and crawl records live in `backend/data/scan-runs/` and `backend/data/crawl-runs/`, one atomic JSON file per run.
- Legacy `scans.json` and `crawls.json` remain readable and are never rewritten by the new scan pipeline.
- API and worker always read current run files; cross-process locks serialize writes. Revisions and per-attempt tokens prevent cancellation/result races and stale attempts overwriting newer results.
- `monitor-records/` holds locked atomic monitor configuration, run references, baseline choices, and notifications. Legacy `monitors.json` is read for migration and left untouched.

Set the same absolute `DATA_DIR` for API and workers, or use the shared Compose volume. A local shared filesystem is required; separate machines or unreliable network filesystems require a database migration. Run writes fail visibly rather than reporting a false completion. Back up this directory: Redis stores job coordination, not permanent findings. New run files have no automatic retention policy; manage artifact capacity and backups deliberately. Runtime artifacts are excluded from Git.

### Worker lifecycle and limits

`queued -> processing -> completed`, with `retrying`, `failed`, `cancelling`, and `cancelled` states. SSE snapshots include real stages, page counts, attempt number, timestamps, and safe errors. Progress counts completed page attempts, including failures; discovery has no invented percentage. Disconnecting the browser does not cancel a job. Reopen a pending run from History to follow it again.

Streaming media and WebSockets are blocked in scan browsers; service workers and downloads are disabled so they cannot bypass request interception.

Defaults (configure identically across API/worker instances):

| Setting | Default | Meaning |
| --- | --- | --- |
| `SCAN_WORKER_CONCURRENCY` | 1 | Active jobs per worker process |
| `SCAN_GLOBAL_CONCURRENCY` | 2 | Shared BullMQ cap across all workers |
| `SCAN_ATTEMPTS` | 3 | Maximum attempts, including the first |
| `SCAN_BACKOFF_MS` | 1000 | Initial exponential retry delay |
| `SCAN_JOB_TIMEOUT_MS` | 180000 | Deadline per attempt, including discovery |
| `SCAN_NAVIGATION_TIMEOUT_MS` | 20000 | Chromium launch/navigation timeout |
| `SCAN_QUEUE_NAME` | sarvya-scans | Shared queue namespace |

Transient network failures, HTTP 429/5xx, and timeouts retry with exponential backoff. Invalid/blocked targets and deterministic failures stop. Partial scans preserve successful findings and list failed pages; they do not silently discard useful results to retry the whole run. BullMQ recovers stalled jobs after a worker crash, allowing one repeated stall before terminal failure. Completed run redelivery is idempotent.

Cancellation removes queued/delayed work when possible. Active jobs observe a persisted cancellation flag, abort crawling/navigation, close browser resources in `finally`, and only then acknowledge `cancelled`. A cancellation request can remain `cancelling` while resources close or the worker is unavailable. Completed/failed runs reject cancellation with HTTP 409. Worker SIGINT/SIGTERM aborts active work as retryable shutdowns. Redis keeps at most 500 recent completed/failed job entries per retention category, with completed jobs aged out after a day and failures after seven days; durable run files remain.

Redis outages return HTTP 503 on submission instead of a simulated success. Never flush queue Redis independently of durable run storage: catastrophic Redis loss can orphan queued runs and requires operator reconciliation/resubmission. Keep Redis persistence enabled and back it up. Local/global limits apply to queued scans/crawls; existing snippet verification and preview endpoints remain separate paths.

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

The suite starts an isolated Vite server and reuses the backend's installed Playwright. It checks content extraction and reader interactions with a controlled speech service; it does not verify audible output from system voices. There are no dedicated lint/type-check scripts. Backend, frontend browser, CLI, and extension regression suites are available; see the commands below.

From the repository root, run the full suite after installing dependencies, Chromium, and a local Redis instance:

```bash
REDIS_TEST_URL=redis://127.0.0.1:6379 BROWSER_TESTS=1 npm test
```

To verify the distributable npm artifact in a clean temporary installation, first generate release packages, then run:

```bash
node scripts/smoke-package.mjs
```

Useful manual checks include:

- Health endpoint responds and real scans report meaningful page results.
- Search, severity/status filters, rule/element switching, and node navigation work.
- Inspect synchronizes with a supported preview; invalid selectors fail gracefully.
- Copy uses the selected node's fix; ignore/restore and verification controls remain usable.
- CSV/JSON exports download, and the print dialog opens.
- Light/dark modes, keyboard focus, reduced motion, and mobile layout remain usable.
- Saved scans can be reloaded after a backend restart.

## Docker status

Compose defines separate API, scan-worker, and monitoring-worker containers sharing a persistent scan-data volume, plus private Redis with AOF and no eviction. The API is published only on `127.0.0.1:3000`; Redis has no published port. The Debian/Node 22 image installs the lockfile-matched Chromium and dependencies and runs as a non-root user. Workers have CPU, memory, process, and shared-memory limits.

```bash
docker compose up --build -d
# Optional: multiple workers still respect SCAN_GLOBAL_CONCURRENCY.
docker compose up -d --scale worker=2
docker compose logs -f api worker monitoring
```

Run the frontend separately using Vite. Container scans have Chromium sandboxing enabled. [seccomp_profile.json](backend/seccomp_profile.json) is the Apache-2.0-licensed profile ([license](backend/seccomp_profile.LICENSE)) from [Playwright v1.65.0](https://github.com/microsoft/playwright/blob/v1.65.0/utils/docker/seccomp_profile.json), following [Playwright's non-root crawling guidance](https://playwright.dev/docs/docker). Host user-namespace support and outbound firewall/network policy are still required; this file does not isolate destinations. Do not disable the sandbox to work around a host configuration issue.

Compose configuration can be checked with `docker compose config --quiet`. The container image/runtime has not been validated on this workstation because the Docker daemon is unavailable. Existing local history is not automatically copied into Docker's named volume; migrate/back up data intentionally before switching runtimes.

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
| A large crawl times out | Reduce page/depth limits. Check worker logs and the per-attempt time limit. Reduce crawl scope or configure a suitable worker deadline. |
| Monitoring waits or has no upcoming time | Check `npm run monitor`, `npm run worker`, Redis, the monitoring worker status, schedule synchronization errors, and the selected time zone. |
| GitHub login is disabled | Register an OAuth App and configure the backend variables below. Restart the API and reload. |
| OAuth returns a failed sign-in | Check client credentials, callback URL, Redis, and exact frontend hostname. `localhost` and `127.0.0.1` are different cookie hosts. |
| Repository is absent or access is denied | Check push access, OAuth scope, organization OAuth/SSO restrictions, and repository pagination. |
| Source review is stale | Start a new review and reapprove changes against the latest default-branch commit. |

## Limitations and production work

This checkout is a development prototype. Do not expose its scan/preview endpoints as an unrestricted public service.

- **Browser/network isolation:** scan worker URLs, redirects, and browser subresources receive DNS/IP validation, and Chromium sandboxing is enabled for scans. DNS rebinding still requires container/firewall egress controls. Existing preview/snippet execution paths need further isolation and retain their previous browser settings. Application validation alone is not a sufficient SSRF defense.
- **Untrusted preview HTML:** remote HTML has an origin-isolating sandbox on the iframe and response CSP. PostMessage inspection remains available, but direct DOM reading is restricted; the reader uses inert stored scan HTML when available, or issue snippets when no capture exists. Stored outlines may differ from the live page and cannot highlight its DOM. The controlled sample retains DOM reader support. Preview fetching still needs hardened network isolation before public exposure.
- **Access control:** GitHub routes use OAuth sessions, owner-scoped reviews, CSRF validation, and request limits. General scan/history/monitor endpoints remain anonymous and need application-wide ownership and rate limits before multi-user deployment. CORS is restricted to the configured frontend origin.
- **Background operations:** scan/crawl execution and monitoring schedules are implemented. Unrelated report/AI queues remain future work.
- **Persistence:** replace local JSON with transactional durable storage and migrations before multi-user or multi-instance operation.
- **Fix review:** suggestions are proposals; snippet verification has limited context and some accessibility requirements require human judgment.
- **Monitoring delivery:** notifications are persisted in-app. Email, browser push, and external webhook integrations are not implemented. GitHub automatic source inference, repository CI execution, and installation-scoped permissions remain future improvements.
- **Extension/CLI:** real source packages now live under `extension/` and `cli/`. Build and validate release artifacts using the deployment guide; registry/store publication still requires the owner.

See [AGENTS.md](AGENTS.md) for the intended architecture, security requirements, and phased roadmap. That document describes goals; it is not evidence that those capabilities already exist.

## Contributing

1. Read [AGENTS.md](AGENTS.md) and inspect the current implementation before editing.
2. Keep frontend-only changes within `frontend/`; avoid unrelated refactors.
3. Keep sample data and mock integrations clearly separate from real results.
4. Preserve working controls, loading/error states, keyboard access, and responsive layouts.
5. Run the relevant available checks, review the diff, and report actual outcomes.
6. Keep credentials out of source files and all `VITE_` configuration.

The project and npm package are UNLICENSED, per the owner’s choice. No open-source redistribution rights are granted. Third-party dependencies retain their own licenses.

### Background scan regression tests

With Redis running and Chromium installed:

```bash
cd backend
REDIS_TEST_URL=redis://127.0.0.1:6379 BROWSER_TESTS=1 npm test
cd ../frontend
npm run test:scan
npm run test:reader
npm run build
```

Backend queue tests create unique test queues and temporary storage, and delete only those queues. Without `REDIS_TEST_URL`, queue integration tests are skipped; without `BROWSER_TESTS=1`, real browser tests are skipped. Unit tests still run. Frontend browser tests reuse backend Playwright and start temporary Vite servers. They test async lifecycle rendering with controlled API responses; backend tests independently exercise actual Redis/BullMQ and real axe/Chromium.
