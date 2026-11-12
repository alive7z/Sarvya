# sarvya-cli

Run a single-page accessibility audit locally using Playwright and axe-core. Node.js 22.12+ is required. No server, account, telemetry, or API key is involved. Localhost is supported because scans run on your own machine.

```sh
npm install --global sarvya-cli
sarvya --install-browser
sarvya https://example.com --format json --output audit.json
sarvya http://localhost:3000 --format html --output audit.html --fail-on critical
sarvya https://example.com --format csv --output audit.csv --fail-on none
```

These installation commands apply **after publication**. Until then, run `npm ci` in `cli/`, then `node bin/sarvya.js --help`, or install the tarball produced by `npm run release:pack` from the repository root. Browser installation is explicit: no lifecycle script downloads Chromium during package installation. Linux CI may need OS libraries (`npx playwright install --with-deps chromium` from an environment with Playwright installed).

Exit codes: 0 below the configured threshold; 1 qualifying findings; 2 usage/runtime failure; 130 interruption. Default threshold is serious. JSON stdout contains only the report; diagnostics go to stderr. `--timeout` accepts 1000–300000 ms. Reports record the axe version, selectors, snippets, incomplete checks, and scan scope. Output files are private to the current user where supported and are replaced atomically. HTML is escaped; CSV neutralises spreadsheet formula prefixes.

Only audit websites you are authorised to test. Page scripts execute inside Chromium; this local CLI is not a secure multi-user scanning service. Never give it production secrets or a privileged browser profile. A passing automated scan is not proof of WCAG compliance. Protected pages, cross-origin frames and dynamic states need further assessment. Multi-page crawling and AI fixes are provided by the separate application, not this CLI.

License: **UNLICENSED** (all rights reserved). This is not an open-source license. Registry name availability and ownership and publication credentials must be supplied by the owner; this repository does not publish automatically.
