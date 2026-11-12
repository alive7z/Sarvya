# Release validation — 11 November 2026

This records work actually run locally. It is not a claim of live hosting, store approval, registry publication, or comprehensive security certification.

| Check | Result |
| --- | --- |
| Node.js target runtime | Node 22.23.4 |
| Backend tests, real Redis and Chromium enabled | 40 passed; 0 skipped |
| Frontend browser and colour-contrast workflows | 30 passed; 0 skipped |
| CLI tests including real browser/threshold behaviour | 5 passed; 0 skipped |
| Extension manifest, real service-worker boot, content audit and popup checks | 4 passed; 0 skipped |
| Render Blueprint against the official JSON schema | Passed |
| Docker Compose configuration parse | Passed |
| Dependency audits: backend, frontend, CLI, extension | Each reported 0 known advisories |
| Release archive contents and SHA-256 checks | Passed |
| CLI explicit Chromium installer | Passed |
| Clean npm-tarball install and actual fixture audit | Passed |
| Production process smoke test | Passed: protected frontend/downloads, Redis/disk readiness, workers, shutdown |
| Frontend production build | Passed |

The browser tests use local controlled fixtures, actual Chromium/axe and isolated Redis queue namespaces. GitHub tests use controlled provider responses; no external PRs were created. Extension tests validate boot, scanner, popup, encoding, reports and selectors; toolbar `activeTab` grant behaviour still needs a manual Chrome/Edge check on an authorised site.

The local Docker daemon is unavailable. CI is configured to build the image, but a CI run and actual Docker image execution were not performed in this session. Render's actual sandbox permissions, disk ownership, billing configuration, live HTTPS and deployment smoke checks remain external validation steps. Startup intentionally fails if Chromium sandboxing is unsupported. This is a single-team, one-instance shared-disk deployment; public multi-tenant hosting requires additional owner-scoped persistent storage and account isolation.

Artifacts are generated under `release/` and excluded from Git. They can be rebuilt from the locked sources with `npm run release:pack`; the extension ZIP and package tarball are accompanied by SHA256SUMS. Both remain unpublished. The project's selected license is UNLICENSED.
