# Render deployment and release guide

This release targets a **protected, single-team Sarvya workspace** on Render. It does not introduce public multi-tenant accounts or pretend the current JSON store is MySQL. Keep one service instance: API, scan worker and monitoring worker run as separate Node processes supervised in one container and share one persistent disk. This is deliberate because [Render disks belong to a single service instance](https://render.com/docs/disks).

## Before creating paid resources

1. Review `render.yaml`: it requests a paid 4 GB web service, paid 256 MB Key Value instance and 10 GB disk. Confirm current pricing in Render. Free services do not supply this durable architecture.
2. Push the reviewed changes to your connected Git repository. Create a Render Blueprint from `render.yaml`. This repository prepares configuration but does not create services, spend money, publish packages or submit store listings automatically.
3. Set `ACCESS_USER` and a password-manager-generated `ACCESS_PASSWORD` of at least 20 characters. Both frontend and API require HTTP Basic authentication in production; only `/api/health` is public. This is shared-team access, not per-user isolation. Only give credentials to trusted operators. Use HTTPS exclusively.
4. Render supplies `REDIS_URL`, `PORT`, and `RENDER_EXTERNAL_URL`. For a custom domain, set `FRONTEND_ORIGIN` to its exact HTTPS origin and configure the domain in Render. Never expose Redis externally. Key Value has no public IP allow-list entries and uses `noeviction` with journal/snapshot persistence.
5. Verify the persistent disk is mounted at `/app/data` and writable by the image's non-root `node` user. Do not put runtime data in the repository or Render's ephemeral filesystem.

[Blueprint field definitions and current plan IDs](https://render.com/docs/blueprint-spec) were consulted when preparing the template. Provider validation and a real deployment are still required. The local Docker daemon is not available in this development environment; image execution and Render resource provisioning must not be described as tested here.

## Browser sandbox gate

Startup launches a sandboxed Chromium probe **before** starting the web server and workers. If the selected Render runtime blocks Chromium user namespaces/sandboxing, startup fails with Chromium's error and no healthy service is advertised. Do not “fix” this by adding `--no-sandbox` or running the scanner as root. Confirm sandbox support with Render or use a host that supports the checked-in Docker seccomp profile. This platform capability must be verified on the actual hosting instance; a YAML file cannot establish it.

Hosted browser traffic uses a loopback HTTP/CONNECT proxy that resolves hosts, rejects non-public addresses, and connects to the same validated IP. Browser request guards also validate redirects and subresources and block WebSockets. Crawler/preview HTTP requests use a validated DNS lookup in the outbound connector. Verification documents block network and active markup. These controls reduce SSRF exposure; add infrastructure egress controls when your host supports them and treat untrusted-browser execution as a security boundary requiring ongoing maintenance.

## Deploy and smoke test

After the Render build succeeds:

- `/api/health` should return HTTP 200; it is only process liveness.
- Sign into the workspace with the Basic credentials. `/api/ready` must return `ready` after Redis and disk-write checks.
- Submit one authorised public test URL. Confirm queued → processing → completed, actual findings, screenshot/preview, and cancellation on another run.
- Add a monitor with the correct IANA time zone. Confirm the worker is online, Run now persists history, a completed baseline can be selected, pause/resume updates the schedule, and notifications reflect actual comparisons.
- Restart the service and confirm scan history and monitor configuration survive. Failed/retried worker jobs must not fabricate completed results.
- Open `/downloads/sarvya-extension.zip`, extract and load unpacked. Audit an authorised page with a real toolbar click. Restricted browser pages should show an error, never fake findings.

The supervisor terminates all processes if any child fails, so Render restarts the whole service consistently. SIGTERM is propagated; after 25 seconds remaining children are killed. Redis/BullMQ and durable run state recover interrupted jobs. The Docker Compose configuration remains available for self-hosting separate API/worker/monitor containers; supply production access credentials there too. It is not the Render deployment path.

## Optional GitHub OAuth

GitHub remains “coming soon” until configured. Register an OAuth App with callback `https://YOUR-DOMAIN/api/github/oauth/callback`, then set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_SESSION_SECRET` (at least 32 random bytes), `GITHUB_CALLBACK_URL`, and least-privilege `GITHUB_OAUTH_SCOPE`. No credentials belong in `VITE_` variables. Verify OAuth and an explicitly approved draft PR against a test repository before enabling it for a team.

## Backup, upgrades and rollback

The persistent disk stores immutable scan records, screenshots, monitors, notifications and GitHub review evidence. Redis also stores queue schedules, jobs and encrypted OAuth sessions. Set a disk usage alert and review retention requirements; this release does not silently delete historical scans.

For a consistent backup, pause monitors, wait for active jobs to stop (or cancel and await acknowledgement), then stop application writers before copying `/app/data` to encrypted storage. Follow Render's disk snapshot and Key Value backup procedures. A file archive while writers are active is not a transactional backup. Keep OAuth encryption secrets separately in your secret manager. Test restoring to a staging instance using the same schema/version and compatible secret. Never restore over a live workspace. Retain the prior image/commit and back up the disk before upgrades; roll back code with a compatible disk backup if a future migration changes formats.

## Extension and npm releases

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix cli
npm ci --prefix extension
npm run release:check
npm run release:pack
npm --prefix frontend run build
REDIS_TEST_URL=redis://127.0.0.1:6379 BROWSER_TESTS=1 npm test
npm run release:pack
```

`release/` contains SHA-256 checksums, an extension ZIP and `sarvya-cli-0.1.0.tgz`. `release:pack` also copies the ZIP into the frontend's local download folder; build the frontend afterwards for local static hosting. The Docker build performs these steps and includes both artifacts. `zip` must be installed for local packaging (provided on macOS and installed in the Docker builder).

Run `node scripts/smoke-package.mjs` to verify a clean tarball install and actual local Chromium audit. Alternatively test the npm artifact from a clean directory with `npm install /path/to/package.tgz`, run `npx sarvya --install-browser`, and audit an authorised local fixture. Browser installation is explicit; no package lifecycle script downloads Chromium for consumers. The package includes CLI/source/README only, not app credentials, scan data, backend, extension, or tests. It remains **UNLICENSED**, per the owner's request. Publication requires availability and ownership of the `sarvya-cli` registry name, registry authentication and the owner's decision to distribute the proprietary code. Use `npm publish --access public` only after those checks; no automatic publish workflow is installed.

Chrome Web Store / Edge Add-ons submission needs your developer account, accurate screenshots and privacy/support declarations. `extension/PRIVACY.md` describes the implementation. Actual store approval and manual testing of toolbar `activeTab` permission grants remain release checks; the automated tests exercise the content audit, popup, manifest and extension service-worker boot.

## Known boundaries

This is a single-instance shared workspace with bounded browser concurrency, rate limits and queue capacity. It is not suitable for unrelated public users without durable owner-scoped database records and application authentication. There is no MySQL migration in this release. Notifications are in-app only. AI fixes remain proposals; isolated verification does not certify a production site. Automated accessibility results do not prove WCAG conformance. Live Render/OAuth/store/npm publication cannot be verified without the corresponding accounts and deployment.

## Existing deployment rename

Resource names in the Blueprint now use Sarvya. Renaming a service or disk does not transfer an existing deployment's data: back up and migrate its persistent disk before provisioning replacements. Drain in-flight jobs before changing `SCAN_QUEUE_NAME`; existing deployments can retain their explicitly configured queue name until the old queue is empty. The new monitoring worker reconciles future schedules from the preserved monitor records. Browser preference and OAuth session namespaces also change, so users may need to select their preference and reconnect GitHub. Stored scan evidence and Git history are not rewritten by the branding change.
