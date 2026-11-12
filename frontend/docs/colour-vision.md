# Colour vision preferences

On the first visit, Sarvya asks “Are you colour blind?” with an optional, self-selected preference. No diagnosis or test is performed. Selecting Continue or Skip saves only a preference identifier in this browser's `localStorage` (`sarvya-vision-v1`); nothing is sent to the API. Invalid saved values reopen the welcome screen. If browser storage is disabled, the selection still works for the current visit and a message explains that it could not be saved.

Use the glasses button labelled **Colour preferences** in the header to change the selection. Existing scan results, filters, and the current page remain in memory while preferences are edited. Keyboard focus returns to that button after saving. Choosing the original colours restores the existing palette.

| Preference | Application palette | Additional cues |
| --- | --- | --- |
| Original | Existing blue/light lavender and slate dark themes | Severity labels and distinct icons |
| Protanopia / protanomaly | Blue and amber; strong neutral text | Octagon, triangle, circle, and information icons; labelled states |
| Deuteranopia / deuteranomaly | Same shared red–green support palette | Same labels and shapes; no red-versus-green requirement |
| Tritanopia / tritanomaly | Magenta and teal with strong neutral text | Underlined links, selected-state outlines, labels and icons |
| Monochrome / achromatopsia | Neutral grey application controls | Brightness, shapes, text, and patterned progress fills |
| Not sure | Stronger neutral contrast with blue and amber/purple accents | Same non-colour cues |

Both light and dark themes support each adapted preference. The styles map the existing status colour utility families (red/rose/pink, orange/amber/yellow, green/emerald/teal, blue/sky/cyan/purple/violet/indigo, and accent) to semantic roles. This covers the main workspace, summary, finding badges, filters, navigation, forms, monitoring, and secondary pages without changing scan evidence. Existing preview simulations are a separate educational tool and are not used to “correct” the whole application.

Scanned website content, screenshots, manually chosen contrast-checker colours, source code, and exported reports retain their original colours. Controlled preview highlights use a dashed black outline with a white halo under an adapted preference, so the inspected element has a spatial cue independent of hue. Charts have numeric labels; progress bars gain striped fills. Severity icons match the visible labels rather than asking the user to infer a severity from a coloured dot.

## Verification

Run `npm run test:vision` from `frontend/`. No new test dependencies are required; the test reuses the existing Playwright and axe-core installation from the backend.

The browser tests cover:

- First visit, skipping, subtype selection, persistence and reload, changing preferences, focus return, and preserving issue search state.
- Invalid or blocked storage, and layout down to 320px.
- Rendered axe-core text contrast checks for each of the five adapted preferences in both themes: workspace, Assistive Tech & Vision, History, Monitoring, GitHub, Reports, Documentation, and Settings. The fixture includes sample audit findings and intentionally unavailable service states; it does not claim that every authenticated, loaded, or asynchronous state is covered.
- Explicit semantic-role checks: at least 4.5:1 for role text and primary button text; at least 3:1 for control boundaries, focus outlines, and score arcs against their relevant surfaces.
- Chromium DevTools vision-deficiency emulation (protanopia, deuteranopia, tritanopia, achromatopsia), with screenshots saved in a unique `sarvya-vision-checks-*` directory under the operating system's temporary directory. The test output prints its location. These are approximate developer simulations, not evidence of an individual's perception. The “not sure” screenshot uses normal rendering.
- The existing scan, monitoring, GitHub, and screen-reader browser tests explicitly select the original palette so onboarding does not obscure those independent workflows.

These checks do **not** certify complete WCAG conformance or universal visibility. Automated tools cannot fully assess colour semantics, all overlays/states, individual severity, light sensitivity, displays, or real-world perception. Testing with people who have the relevant colour vision differences remains necessary. The user can choose a different preference at any time.

## References

- [W3C: Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html): information should have cues in addition to colour.
- [W3C: Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum): normal text contrast of at least 4.5:1, subject to the criterion's exceptions.
- [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast): essential controls and graphics need contrast against adjacent colours.
- [National Eye Institute: Types of Color Vision Deficiency](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness/types-color-vision-deficiency): red–green, blue–yellow, and complete colour vision differences.
