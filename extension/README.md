# Sarvya browser extension

A Manifest V3 Chrome/Edge extension. It runs bundled axe-core on the active page after an explicit click, shows real findings and manual-review counts, filters by impact, inspects supported selectors with a removable black/white dashed overlay, and exports JSON. Results stay in browser session storage and are cleared on tab navigation or close. No server, AI service, telemetry, remotely hosted code, or website account credentials are involved.

From the repository root: install `extension/` dependencies with `npm ci --prefix extension`, then `npm run build:extension`. Open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension/dist`. Load the built folder, not the source directory. The packaged ZIP can also be extracted first and loaded unpacked.

Permissions are `activeTab`, `scripting`, and `storage`; there are no blanket host permissions. Browser pages, extension stores, some PDF viewers, restricted frames and protected pages cannot be scanned. Complex shadow/frame selectors are retained in reports but may require manual inspection. At most 100 nodes per rule are retained in session storage; full occurrence counts remain visible. An explicit Clear results button removes stored results. Pages that change after scanning must be rescanned.

Only test pages you are authorised to inspect. A passing automated scan is not proof of WCAG compliance. The extension is not published to any store. Submission still requires the owner's developer account, screenshots, accurate privacy declarations, support information and store review. See PRIVACY.md. License: UNLICENSED, as requested by the owner.
