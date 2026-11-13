# Sarvya

### Web accessibility auditing, from browser to CI.

**Sarvya** (formerly **AccessLens**) is a full-stack accessibility auditing toolkit that helps developers find, inspect, track, and review accessibility issues in websites. It brings together a React workspace, a Playwright/axe-core scanning service, a local command-line tool, and a Chrome/Edge extension.

Scan individual pages or crawl a website, explore findings in context, compare audits over time, review suggested fixes, and export reports—all from one project.

> **Project status:** The application is developed and can be run locally. It is **not currently a public hosted service**. The CLI and extension are available from source/build artifacts but have **not** been published to npm or browser stores.
>
> **Accessibility note:** Automated audits identify some accessibility barriers; they do **not** establish complete WCAG conformance or replace manual testing with assistive technologies.

## At a glance

| | |
| --- | --- |
| **Web application** | React 18, Vite 6, Tailwind CSS, Axios |
| **API** | Node.js, Express 4 |
| **Auditing** | Playwright (Chromium), axe-core |
| **Background jobs** | Redis, BullMQ, separate scan and monitoring workers |
| **Persistence** | Atomic JSON files on a shared filesystem |
| **Developer tools** | Local npm CLI, Manifest V3 Chrome/Edge extension |
| **Integrations** | GitHub OAuth and review-driven draft pull requests |
| **Deployment** | Docker/Render configurations provided; public deployment not yet completed |

**Repository:** https://github.com/alive7z/Sarvya

**Recognition:** Developed originally as AccessLens and awarded **1st Runner-Up at GRAPHITE’26**.

### Contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [Run locally](#run-locally)
- [Features in detail](#features-in-detail)
- [Command-line interface](#command-line-interface)
- [Chrome / Edge extension](#chrome--edge-extension)
- [GitHub integration](#github-integration)
- [API overview](#api-overview)
- [Accessibility score](#accessibility-score)
- [Configuration and persistence](#configuration-and-persistence)
- [Testing, builds, and release artifacts](#testing-builds-and-release-artifacts)
- [Deployment and security status](#deployment-and-security-status)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Highlights

- **Single-page and multi-page audits:** Discover same-origin links and scan pages with Chromium and axe-core. Audits are limited to **50 attempted pages** and **depth 3**.
- **Interactive issue workspace:** Browse findings by rule or affected element; filter by severity/status; inspect selectors, HTML, and preview overlays where supported.
- **Asynchronous scanning:** Redis/BullMQ queues, dedicated worker processes, persisted job state, retries, cancellation, and progress updates via Server-Sent Events (SSE) with polling fallback.
- **History and regression tracking:** Keep scan snapshots, compare finding-level results, and schedule daily or weekly monitoring with in-app notifications.
- **Fix review:** Generate deterministic, rule-based suggestions and verify candidate HTML in an isolated test document. Verification is **not** proof that the live website has been fixed.
- **Developer workflows:** Run local audits in a CLI with CI-friendly exit codes, or audit the active page using an unpacked Chrome/Edge extension.
- **GitHub integration:** Authenticate using OAuth, manually map findings to source code, review proposed patches, and create draft pull requests with explicit approval.
- **Accessibility-focused UI:** Responsive layout, light/dark themes, visible severity indicators, reduced-motion support, a contrast calculator, and reading/color-vision learning tools.

**Not an AI-powered fix generator:** Current suggestions use **deterministic templates**; no external AI provider is connected. The browser-based reader is an approximation of page semantics, **not** a replacement for NVDA, JAWS, or VoiceOver.

## How it works

```text
                         React + Vite workspace
                           http://localhost:5173
                                    |
                         /api via Vite dev proxy
                                    |
                                    v
                            Express API :3000
                                    |
                +-------------------+-------------------+
                |                   |                   |
        Validate & enqueue     Read stored runs     GitHub OAuth /
                |             and stream status    review workflows
                v                   ^
             Redis / BullMQ         |
                |                   |
      +---------+----------+        |
      |                    |        |
      v                    v        |
 Scan worker          Monitoring worker
      |                    |
      v                    |
 Crawl -> Chromium         |
        + axe-core         |
      |                    |
      +---------+----------+
                |
                v
      Shared atomic JSON run files
```

The **API** validates submissions and enqueues run IDs. The **scan worker** performs crawling and accessibility checks. The **monitoring worker** schedules recurring scans and reconciles results. API and workers must share the same absolute data directory.

Redis coordinates jobs and schedules; **stored audit history is currently file-based**, not MySQL- or MongoDB-backed. This architecture targets a protected, single-workspace setup—not public multi-tenant hosting.

### Project structure

```text
Sarvya/
├── frontend/                  # React workspace and browser tests
├── backend/
│   ├── src/routes/            # Scans, monitoring, fixes, previews, GitHub
│   ├── src/services/          # Persistence, comparison, security, integrations
│   ├── src/queues/            # Redis/BullMQ connections
│   ├── src/workers/           # Scan and monitoring workers
│   ├── tests/                 # API, queue, browser, integration tests
│   └── .env.example           # Backend configuration template
├── cli/                       # sarvya-cli source
├── extension/                 # Chrome/Edge Manifest V3 extension
├── scripts/                   # Packaging, validation, startup tooling
├── docs/                      # Deployment instructions and validation notes
├── .github/workflows/ci.yml   # Continuous integration
├── Dockerfile
├── docker-compose.yml
└── render.yaml
```

---

## Run locally

### Prerequisites

- **Node.js 22.12+** and npm (the project has been built locally with Node.js 24).
- **Redis 7+** for web scans and monitoring.
- Internet access to install dependencies and Chromium, and to audit public sites.
- Enough disk space and memory for Chromium; writable access to `backend/data/`.

> MySQL and an AI API key are **not** required. GitHub OAuth credentials are optional unless you want to test the GitHub integration.

### 1. Clone and install

```bash
git clone https://github.com/alive7z/Sarvya.git
cd Sarvya

npm ci --prefix backend
npm ci --prefix frontend

cd backend
npx playwright install chromium
cd ..
```

On Linux, additional system packages may be needed:

```bash
cd backend
npx playwright install --with-deps chromium
cd ..
```

### 2. Start Redis

Use your local Redis installation, or run Redis with Docker:

```bash
docker run --name sarvya-redis \
  -p 127.0.0.1:6379:6379 \
  -v sarvya-redis:/data \
  redis:7.4-alpine redis-server --appendonly yes --maxmemory-policy noeviction
```

If the container already exists and is stopped, start it with `docker start sarvya-redis`.

### 3. Start the backend processes

Open **three separate terminals** from the project root:

**Terminal 1 — scan worker**

```bash
cd backend
npm run worker
```

**Terminal 2 — monitoring worker**

```bash
cd backend
npm run monitor
```

**Terminal 3 — API**

```bash
cd backend
npm run dev
```

The API defaults to **http://localhost:3000**. Verify it is responding:

```bash
curl --fail http://localhost:3000/api/health
```

> The health endpoint checks API availability. It does not, on its own, prove that browser audits or storage writes are working.

### 4. Start the frontend

Open a **fourth terminal** from the repository root:

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**. The Vite development server proxies `/api` requests to the backend at `http://localhost:3000`.

### 5. Run your first audit

1. Open the workspace and enter a **public** HTTP(S) website URL.
2. Choose **Scan website** for one page or **Scan all pages** to configure a multi-page audit.
3. Explore results by rule or affected element, then inspect explanations, snippets, and selectors.
4. Review candidate fixes using **Verify in Sandbox**, and export results when needed.
5. Open **History** to return to saved audits or compare runs.

**Demo data:** On first load, the workspace contains intentional sample findings and a fictional `forma.example` preview. Choose **Clear Demo Data** or run a real scan before treating the dashboard as evidence of an audit. **Load Sample Data** restores the demo.

**Safety:** The hosted-style web scanner blocks private/internal URLs; the standalone local CLI can audit your own `localhost` development pages. Only scan websites you are authorized to test.

---

## Features in detail

### Accessibility audits and inspection

- Uses Chromium and axe-core to return violation rules, impact levels, affected HTML, selectors, and page details.
- Discovers same-origin HTML links within configured page/depth limits. Client-rendered routes, authentication, and anti-bot controls may reduce coverage.
- Offers a desktop issue/preview split view and mobile **Issues**/**Preview** tabs.
- Supports searching, severity/status filters, grouped-rule and individual-element views, expandable explanations, and affected-node navigation.
- Uses captured HTML and backend-served preview documents for supported highlighting. Dynamic content, security restrictions, and invalid selectors can prevent a one-to-one preview match.
- Exports **CSV/JSON** and opens a printable executive report for **PDF** output.

### Fix suggestions and verification

Sarvya provides **rule-based proposal templates** and a browser-based check of a **constructed HTML document**. The workflow is:

```text
Detect finding -> Review generated suggestion -> Inspect/copy candidate HTML
               -> Verify in sandbox -> Apply and manually test in source
```

A successful snippet check does not prove that the original page, repository, or deployed application is accessible. Ignoring/restoring an issue currently changes the frontend state; that particular decision is not persisted by a dedicated backend issue endpoint.

### Scheduled monitoring and comparisons

Monitoring uses Redis/BullMQ to support:

- **Daily or weekly** runs with local time, IANA time zone, and optional weekday.
- A **fixed baseline** or **previous completed run** baseline, plus manual baseline selection.
- Finding-level outcomes: **new, resolved, persistent, uncertain**, and **worsened** where impact or occurrences increase.
- Persisted run history, schedule status, worker heartbeat, and deduplicated **in-app** notifications.
- Pause/resume, run-now, cancellation requests, retries, and reconciliation after transient failures.

Changes are compared using rule/page/selector fingerprints, not only issue totals or scores. Failed pages and unstable selectors may produce **uncertain** results. Monitoring workers must remain running to execute recurring jobs. Alerts are currently **in-app only**—not email, push, or webhook messages.

### Reading and visual learning tools

- Preview reading controls: **play, pause, resume, stop**, speech rate and voice selection, and structural filters for headings, links, landmarks, controls, and images.
- Reading transcript and current/proposed HTML inspection.
- Contrast calculator, color-vision learning views, light/dark themes, contrast-conscious severity labels, keyboard focus, and reduced-motion support.

The reader relies on available **browser speech synthesis** and an approximate DOM-based outline. Results vary with browser, platform, and preview content; it does not reproduce native assistive-technology behavior.

---

## Command-line interface

The `sarvya-cli` package provides a `sarvya` terminal command for **local single-page audits**. It works independently of the React application, Redis, backend API, and GitHub OAuth.

**Distribution status:** The source and buildable `.tgz` package are available; the package is **not yet published to npm**.

### Run directly from source

```bash
cd cli
npm ci
node bin/sarvya.js --install-browser
node bin/sarvya.js https://example.com
```

For convenience during development, run `npm link` from `cli/` to make the `sarvya` command available locally.

### Install the locally packaged CLI

From the repository root:

```bash
npm ci --prefix cli
npm ci --prefix extension
npm run release:pack
npm install --global ./release/sarvya-cli-0.1.0.tgz

sarvya --install-browser
sarvya --help
```

### Useful commands

```bash
# Standard audit
sarvya https://example.com

# JSON findings
sarvya https://example.com --format json --output audit.json

# Human-readable HTML report
sarvya https://example.com --format html --output audit.html

# Spreadsheet-friendly CSV report
sarvya https://example.com --format csv --output audit.csv

# Fail CI only when critical issues are found
sarvya https://example.com --fail-on critical

# Save a report without failing on detected findings
sarvya https://example.com --format json --output audit.json --fail-on none

# Audit a locally running website
sarvya http://localhost:3000
```

| Option | Purpose | Default |
| --- | --- | --- |
| `--format json\|html\|csv` | Report format | `json` |
| `--output <file>` | Save report to a file | stdout |
| `--fail-on <impact>` | `minor`, `moderate`, `serious`, `critical`, or `none` | `serious` |
| `--timeout <milliseconds>` | Bound audit time after browser launch (1,000–300,000 ms) | `45000` |
| `--install-browser` | Install compatible Chromium and exit | Explicit action |
| `--help`, `--version` | Show help/version | — |

**Exit codes:** `0` = no findings at/above the threshold; `1` = threshold reached; `2` = invalid input/runtime error; `130` = interrupted.

The CLI does **not** currently perform multi-page crawling, continuous monitoring, or automatic source changes. For further CLI details, see [cli/README.md](cli/README.md).

---

## Chrome / Edge extension

The **Sarvya Accessibility Auditor** Manifest V3 extension scans the active page locally using bundled axe-core. It does **not** require a running backend or npm CLI.

**Distribution status:** Available as a local build or ZIP; **not yet published** to the Chrome Web Store or Edge Add-ons.

### Build and install

```bash
npm ci --prefix extension
npm run build:extension
```

Then:

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose the generated **`extension/dist/`** folder.
5. Open a supported website and choose **Scan current page** from the extension popup.

Alternatively, build the ZIP using `npm run release:pack`, extract `release/sarvya-extension.zip`, and load the **extracted directory containing `manifest.json`** (not the ZIP itself).

The extension supports severity filtering, rule details, supported-element highlighting, JSON export, and clearing results.

| Permission | Use |
| --- | --- |
| `activeTab` | Temporary access after the user starts an audit |
| `scripting` | Inject the bundled audit/inspection logic |
| `storage` | Save audit state in browser session storage |

The extension does not request blanket host permissions or upload scanned page content to Sarvya, an AI service, or analytics. Some restricted pages, frames, and browser-internal URLs cannot be scanned. See [extension/README.md](extension/README.md) and [extension/PRIVACY.md](extension/PRIVACY.md).

---

## GitHub integration

With **GitHub OAuth configured**, Sarvya can connect to authorized repositories and guide developers through a controlled patch-review workflow:

1. Authenticate and choose a repository with write access.
2. Select a finding from a **real, completed scan**.
3. **Manually** map the finding to the correct source file and code block.
4. Review diffs and approve individual proposed changes.
5. Explicitly authorize creation of a **draft pull request**.

The integration does **not** infer arbitrary JSX/template locations automatically, merge pull requests, or claim that CI has passed. GitHub login stays disabled until OAuth is configured; demo data is not substituted for real GitHub API responses.

### Local OAuth setup

1. Create a GitHub OAuth App in **Settings → Developer settings → OAuth Apps**. See the [official GitHub guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).
2. Use `http://localhost:5173` as the **Homepage URL** and `http://localhost:5173/api/github/oauth/callback` as the **Authorization callback URL**.
3. Add credentials to `backend/.env`. Generate a random session secret with `openssl rand -hex 32`.

```dotenv
FRONTEND_ORIGIN=http://localhost:5173
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
GITHUB_SESSION_SECRET=your_random_secret_at_least_32_bytes
GITHUB_CALLBACK_URL=http://localhost:5173/api/github/oauth/callback
GITHUB_OAUTH_SCOPE=public_repo
```

4. With Redis running, restart the API, visit the **same** `http://localhost:5173` hostname, and sign in through the GitHub page.

Use `GITHUB_OAUTH_SCOPE=repo` **only if private repository access is needed**; reconnect after changing scope. Never commit OAuth secrets. In production, this cookie-based flow requires a secure HTTPS, same-origin configuration.

GitHub sessions use server-side encrypted Redis storage and HttpOnly cookies; repository edits require deliberate approval. See the source and [deployment guidance](docs/DEPLOYMENT.md) for the full security and operating model.

---

## API overview

Local base URL: `http://localhost:3000`. The API accepts a submission and **queues** work; it does not return a completed audit synchronously.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health metadata |
| `POST` | `/api/scans` | Queue an audit (`url`, `maxPages`, `maxDepth`) |
| `GET` | `/api/scans` | List stored scans |
| `GET` | `/api/scans/:scanId` | Retrieve state and results |
| `GET` | `/api/scans/:scanId/issues` | Findings for a scan |
| `GET` | `/api/scans/:scanId/events` | Stream status via SSE |
| `POST` | `/api/scans/:scanId/cancel` | Request cancellation |
| `POST` | `/api/scans/:scanId/rescan` | Repeat a saved target/scope |
| `POST` | `/api/crawls` | Queue link discovery only |
| `POST` | `/api/fixes/generate` | Generate a rule-based candidate fix |
| `POST` | `/api/fixes/verify` | Check a candidate snippet in a constructed document |
| `GET` | `/api/scans/:scanId/compare?baselineId=...` | Compare saved scans |
| `GET`, `POST` | `/api/monitors` | List/create monitoring schedules |
| `PATCH`, `DELETE` | `/api/monitors/:id` | Update/remove a schedule |
| `POST` | `/api/monitors/:id/run` | Request an immediate monitored run |
| `GET` | `/api/preview?url=...&scanId=...` | Serve supported preview HTML |
| `GET` | `/api/github/repos?page=1` | Writable repositories after OAuth |
| `POST` | `/api/github/pull-requests` | Create an approved draft PR |

### Example: queue an audit

```bash
curl --fail http://localhost:3000/api/scans \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com","maxPages":5,"maxDepth":2}'
```

The `202 Accepted` response contains IDs and a `queued` status. Use the returned ID to follow the audit:

```bash
curl -N http://localhost:3000/api/scans/SCAN_ID/events
curl --fail http://localhost:3000/api/scans/SCAN_ID
```

Supported scan states include `queued`, `processing`, `retrying`, `completed`, `failed`, `cancelling`, and `cancelled`. A run can finish with some pages failed; inspect page-level results before treating it as fully covered.

### Example: generate and verify a candidate fix

```bash
curl --fail http://localhost:3000/api/fixes/generate \
  -H 'Content-Type: application/json' \
  --data '{"ruleId":"image-alt","snippet":"<img src=\"logo.png\">"}'

curl --fail http://localhost:3000/api/fixes/verify \
  -H 'Content-Type: application/json' \
  --data '{"ruleId":"image-alt","fix":"<img src=\"logo.png\" alt=\"Company logo\">"}'
```

---

## Accessibility score

The backend calculates an **internal project score** from the number of aggregated violation objects:

```text
score = clamp(100 - 12 × critical - 6 × serious - 3 × moderate - 1 × minor, 0, 100)
```

- Counts represent aggregated violations across scanned pages, **not** the total number of affected DOM elements.
- A frontend fallback may use affected-element counts and different weights; fallback and backend scores should **not** be treated as directly interchangeable.
- **100 is not a WCAG certification** or evidence that all accessibility issues were found.

---

## Configuration and persistence

Create `backend/.env` using [backend/.env.example](backend/.env.example) only when custom configuration is needed. The default local setup needs no GitHub or AI credentials.

| Variable | Purpose | Default / note |
| --- | --- | --- |
| `PORT` | API port | `3000` |
| `REDIS_URL` | Queue and scheduler connection | `redis://127.0.0.1:6379` |
| `FRONTEND_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `DATA_DIR` | Shared persistent records directory | Use the same absolute path for API and workers |
| `SCAN_QUEUE_NAME` | Scan queue namespace | `sarvya-scans` |
| `SCAN_WORKER_CONCURRENCY` | Active jobs per worker | `1` |
| `SCAN_GLOBAL_CONCURRENCY` | Shared active-job cap | `2` |
| `SCAN_ATTEMPTS` | Maximum attempts per job | `3` |
| `SCAN_JOB_TIMEOUT_MS` | Deadline per attempt | `180000` |
| `VITE_API_BASE_URL` | Optional frontend API origin | Leave unset for Vite's local proxy; do not append `/api` |

Scan/crawl snapshots are written atomically beneath `DATA_DIR`; monitoring and GitHub-review records also use shared storage. Redis stores queue coordination, **not permanent audit history**. Back up the data directory and enable Redis persistence for durable operation. Historical records currently have no automatic retention policy.

> **Secrets:** Do not commit `.env` files or place credentials in `VITE_` variables; Vite-prefixed values are exposed to client code.

---

## Testing, builds, and release artifacts

### Frontend production build

```bash
npm --prefix frontend run build
```

### Full test suite

With local Redis running and Chromium installed:

```bash
REDIS_TEST_URL=redis://127.0.0.1:6379 BROWSER_TESTS=1 npm test
```

For targeted browser tests:

```bash
cd frontend
npm run test:scan
npm run test:reader
npm run test:github
npm run test:monitoring
```

Backend tests cover API behavior, queue coordination, and browser scanning. Some real-browser and Redis-backed tests are **skipped** unless their required environment variables/services are available. GitHub integration tests use controlled responses, **not** live third-party PR creation.

### Build distributable packages

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix cli
npm ci --prefix extension

npm run release:check
npm run release:pack
npm --prefix frontend run build
```

Generated files include:

| Artifact | Purpose |
| --- | --- |
| `release/sarvya-cli-0.1.0.tgz` | Installable local CLI package |
| `release/sarvya-extension.zip` | Unpacked-browser-extension distribution |
| `release/SHA256SUMS` | Package integrity checksums |
| `extension/dist/` | Loadable extension folder |

Build outputs are intentionally excluded from Git. A successful release build **does not** publish the CLI to npm or the extension to a browser store. The repository includes a CI workflow that can prepare a downloadable release artifact when checks pass.

---

## Deployment and security status

Sarvya includes a **Dockerfile**, **Docker Compose** definition, **Render configuration**, and a more detailed [deployment guide](docs/DEPLOYMENT.md). These are operational resources—not evidence that a public deployment is already live.

- Docker Compose defines an API, scan worker, monitoring worker, and private Redis with a shared scan-data volume.
- The API is published on `127.0.0.1:3000` in the provided Compose configuration; the frontend is run separately.
- The container setup is designed around non-root Chromium with sandboxing and resource limits, but **host compatibility and browser sandboxing must be verified**.
- The Docker image/runtime was **not validated on the original workstation** because a Docker daemon was unavailable.

**Do not publish the scanner as an unrestricted public service yet.** It processes untrusted websites and HTML, and the current prototype has important production boundaries:

1. **Network isolation:** URL/DNS/IP checks exist, but additional egress/firewall protections are needed against DNS rebinding and server-side request forgery (SSRF).
2. **Authentication:** GitHub routes have scoped OAuth sessions; general scan/history/monitor endpoints do **not** yet provide full per-user authorization or rate limiting.
3. **Storage:** Shared atomic JSON files suit a single workspace, not horizontally scaled or multi-tenant deployments. A database migration is future work.
4. **Preview isolation:** Remote HTML and snippet execution require stronger isolation before public exposure.
5. **Verification limits:** Proposed fixes, simulated reading behavior, and automated tests require manual accessibility validation.
6. **Distribution:** CLI/npm and browser store publication are pending.

For a protected team deployment, follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** and verify infrastructure, access protection, backups, and browser isolation before accepting real traffic.

---

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Chromium executable is missing | From `backend/`, run `npx playwright install chromium`. |
| Chromium fails on Linux | Run `npx playwright install --with-deps chromium`; verify OS and sandbox support. |
| UI starts but audits fail | Check Redis, `npm run worker`, `http://localhost:3000/api/health`, and the Vite `/api` proxy. |
| Monitoring has no scheduled runs | Check `npm run monitor`, Redis connectivity, worker heartbeat, and time zone. |
| `localhost` URL is blocked in the web app | The web scanner intentionally rejects private/internal targets; use the **local CLI** for `localhost`. |
| Preview/highlights do not match | Check captured HTML, dynamic content, selector validity, and browser restrictions. |
| Scan results vanish after restart | Check `backend/data/` or custom `DATA_DIR` permissions and backend logs. |
| GitHub sign-in is unavailable | Configure OAuth credentials and the exact callback URL, then restart the API. |
| OAuth fails after redirect | Use `localhost` consistently rather than switching to `127.0.0.1`; check session/Redis settings. |
| Large audits time out | Reduce crawl size/depth and check worker/navigation timeouts. |

---

## Roadmap

The following are **not claimed as completed features**:

- [ ] Harden preview and scanner network isolation for wider public access.
- [ ] Add application-wide authentication, ownership, and rate limiting.
- [ ] Move persistent history from shared JSON files to a transactional database.
- [ ] Add external alert delivery (email, webhooks, or push notifications).
- [ ] Explore external AI-assisted proposals only with explicit safeguards and human review.
- [ ] Publish the CLI to npm and the extension to supported browser stores.
- [ ] Complete and validate a hosted production deployment.

## Contributing

Before contributing, read [AGENTS.md](AGENTS.md), inspect the relevant implementation, and keep sample data distinct from real results. Preserve error/loading states, keyboard usability, responsive behavior, and privacy-sensitive defaults. Run applicable tests and review the diff before submitting changes.

## License

**UNLICENSED.** This project currently has no open-source license. Public visibility of the repository does not grant permission to redistribute or reuse its source. Third-party dependencies retain their respective licenses.

---

<sub>Built to make accessibility issues easier to identify, understand, track, and fix—while keeping the limits of automated testing explicit.</sub>
