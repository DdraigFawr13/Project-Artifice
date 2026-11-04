# Lessons

One line per mistake. Read the entries for an area before working in it. When a mistake repeats, bump its count; at ×2 it also becomes a rule (in DECISIONS, AGENTS.md, or proposed to AI-Master-Instructions). Mark retired entries SUPERSEDED; never delete them.

Format: `- <area> · <mistake> · <root cause> · <rule> · ×<n> (<YYYY-MM-DD>)`

- spec · forge spec: 3 fresh checks found many gaps (not counted) (scale rule, strike offset, heat rates, slice order, CI-05 preview override); 2 re-checks and a final zero-decision check found more, incl. a colour test that would fail on its own data and a missing debug `send()` · most fixed, 4 escalated to Morgan (tiers, ore stock, lighting, previews), 0 contested · each fix pass added new gaps; re-check after every pass (VER-08) · ×1 (2026-11-04)
- tooling · `npm install` on npm 10.9.9 crashed ("Cannot read properties of null (reading 'edgesOut')") on vitest 5's optional peers · npm 10 arborist bug; `npm ci` from the lockfile works · change dependencies with `npx npm@11 install`, install with `npm ci` (AGENTS.md) · ×1 (2026-11-04)
- spec · forge S1 zero-decision re-check before building found 10 consequential gaps (entry file, vitest picking up e2e specs, preview server, lockfile and CI browser, save interface, wide-shot crop, token method, override format, items type) and 2 contradictions with the approved mock-up (item list layout, tap-to-start) · the spec's last check ran before Morgan's final answers changed it · 8 filled with stated defaults, 2 escalated, 0 contested; no build-time design decision beyond those · ×1 (2026-11-04)
- ui · mechanically re-sampling all tokens from new reference art would have dropped the button accent to 3.3:1 · fire areas are small in the new images, so median cut muddied the warm ramp · check contrast before adopting re-sampled tokens; re-sample by role · ×1 (2026-11-04)
