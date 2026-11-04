# UI style

<!-- Template from the `ui-style` skill. Fill each section from the taste board picks and the project's files; keep these prompt comments. Never write a value from memory (WS-06). -->

Picked on 2026-11-04 through two taste boards: [step 1](https://claude.ai/artifact/1MpZv8TsgQK6DXwHRtRnNT) and [step 2](https://claude.ai/artifact/LMMZGoVFjiwkUbSt4yBYnH). Decision: [D-003](DECISIONS.md#d-003-art-direction).

## Target devices
<!-- Devices and widths in px, and which width is first (mock-ups and checks start there). Write the minimums as `Minimum text: <n> px` and `Minimum tap: <n> px`; `ui-mockups` reads them for its lint. Take these from the project's docs; if none say, ask Morgan. -->

- First target: Morgan's Google Pixel 10 Pro XL, in portrait, touch. Mock-ups and checks start at **412 px** wide (CSS px). Sources disagree: 412 × 914 or 414 × 921 at a device pixel ratio of 3.25–3.5 ([screensizechecker.com](https://screensizechecker.com/devices/android-viewport-sizes), [mobileviewer.github.io](https://mobileviewer.github.io/2026-flagship-phones-responsive-design)). Confirm with `window.innerWidth` on the device at the first playtest.
- Also works with a mouse on PC (design round 1). No layout for landscape.
- Minimum text: 14 px
- Minimum tap: 44 px
- Morgan confirmed both minimums on the final plan (D-004).

## Idea
<!-- The look in two sentences, from the taste board picks. -->

Ember Night for the forge: a dark smithy lit only by the fire and the hot metal, drawn as semi high detail pixel art with hue-shifted shadows (Ember concept 3). Daylight Workshop's warm morning light is kept for the shop in a later phase (Daylight concept 2).

## Tokens
<!-- Colours and spacing as named tokens, for light and dark. Screens use the names, never literal values. -->

The game has one fixed dark look, so there is no light/dark switch. Colours are sampled from the picked concept images with a median-cut quantiser (Ember concept 3 and Daylight concept 2, 2026-11-04); they are a starting palette, to be tuned to 32–48 colours when the art is made.

Forge (Ember Night), darkest to brightest:

- `--night-0` #090610: deepest shadow
- `--night-1` #100a14: unlit wall; UI panel background
- `--night-2` #17111f
- `--soot` #261a29: stone in shadow
- `--ember-0` #30161c
- `--ember-1` #451b1a
- `--ember-2` #64281d: lit stone, far from the fire
- `--ember-3` #93341d
- `--fire-0` #a9512b
- `--fire-1` #c05024
- `--fire-2` #e26328
- `--fire-3` #f87f33: UI accent
- `--fire-4` #f7a74e
- `--fire-5` #fdd479: brightest firelight

Shop (Daylight, later phase), darkest to brightest: #251412, #2f1c18, #302728, #3e2a24, #452a21, #592d1b, #4d4037, #74452c, #735b44, #aa6a3e, #d79653, #ead59c. Name these when the shop is designed.

UI ink:
- `--ink` #ead59c: text on `--night-1` (taken from the Daylight sample's lightest colour)
- `--ink-dim` #735b44: decoration and captions only, never information (3.08:1 on `--night-1`, measured, below 4.5:1)

Heat colours for metal are not tokens yet. They are a ramp from dull red to yellow-white whose brightness rises with heat, defined in the forge spec, with a second cue for every band (D-003).

Spacing: game pixels on a 4 px grid (4, 8, 12, 16, 24).

## Type
<!-- Faces, sizes and number settings (tabular figures, units). Copy settings from the accepted specimen, not from memory (adventure-manager LESSONS:10). -->

- Face: Pixelify Sans (Google Fonts, weights 400 and 600), as on the Ember Night sample in taste board 1. Fallback `monospace`.
- Figures: Press Start 2P (Google Fonts) for scores and point lines. Morgan found Pixelify Sans's 7 "a little off" in the forge mock-up: it has a hook at the top left.
- Body 16 px, labels 14 px (the minimum), grade score 40 px in the figures face (the result is the screen's main fact; changed from 24 px in the forge mock-up).
- Scores use tabular figures so they don't jump as they count.

## Controls
<!-- Buttons, sheets, inputs: how each looks and how it answers a tap (done, waiting, or refused and why). -->

- Buttons: `--fire-3` fill with `--night-0` text, square corners (2 px), at least 44 px tall. Pressed: `--fire-2`, moved down 1 game pixel. Disabled: `--soot` fill with `--ink-dim` text and a one-line reason under it in `--ink`.
- Crafting input happens on the scene, not on buttons. Strikes register on release, with a marker drawn above the thumb so the thumb doesn't hide the spot (review finding r_touch). Every strike answers at once: a spark, a sound and a mark on the metal.
- During a craft, browser gestures (pull to refresh, double-tap zoom, back swipe) are blocked.

## Layout and sizes
<!-- Columns, gutters and spacing at each target width; what moves or hides at each width. -->

- The game renders at 360 × 640 game pixels in portrait (D-003), scaled by a whole number so pixels stay sharp. The viewport grows in height for taller phones.
- On the Pixel 10 Pro XL (1344 physical px wide, reported, not checked) a ×4 scale shows 336 game px across. Keep everything that matters inside the central 336 px; the outer 12 px on each side may be cropped.
- Two views while forging: a wide shot of the smithy for the fire, moving the piece and the quench, and a close-up at the anvil for hammering (Morgan, forge mock-up).
- The forge scene fills the screen. Controls and the grade sit in the bottom third, within thumb reach.

## Avoid
<!-- The master Avoid list is linked below. Add this project's own items under Project, each tagged (lint) or (look) and ending with its source in brackets. -->
Master list: `../.claude/skills/ui-style/references/avoid.md` (the path from `docs/`; from another folder, make it relative to that folder).
### Project

- (look) Smooth scaling, blur or anti-aliased edges on game art; pixels stay crisp [taste board 2, research]
- (look) Heat shown by colour alone; every heat band also differs in brightness and has a second cue [D-003]
- (look) Mixing art from different pack families or styles in one scene [design review r_art]
- (look) AI-generated images used as final art; they are placeholders and concepts only [design review q_ai]

## Pitfalls
<!-- The master Pitfalls are linked below. A LESSONS `ui` entry at count 2 becomes a Project pitfall here, ending with its source in brackets (SRC-05). -->
Master list: `../.claude/skills/ui-style/references/avoid.md`.
### Project

- None yet.

## Where facts live
<!-- The files that hold the names, numbers and options screens show (content files, schemas, rules), plus docs/DECISIONS.md. Mock-ups take facts only from these. -->

- `docs/CONCEPT.md`: what the game is and isn't.
- `docs/DECISIONS.md`: settled choices.
- `docs/design/planning-answers.md`: the design answers (items, grade display, mistakes, prototype scope) until the final plan moves them into DECISIONS.
- No content files yet. Items, alloys and heat bands will be data files in the engine (GAME-04); add them here when they exist.

## New-screen checklist
<!-- Run before calling a screen done. Add project items at the end. -->
1. Colours and faces come from Tokens and Type; no literal values.
2. Fits the first target width without sideways scroll; text and taps meet the minimums.
3. Every view state screenshotted (normal, empty, alert, loading).
4. New class names grepped against the CSS.
5. Every tap answers on the same screen (done, waiting, or refused and why).
6. Buttons, alerts and empty states worded on purpose; no Avoid-list copy.
7. The built screen screenshotted at the same width beside its approved mock-up; differences listed for Morgan.
8. Heat stays readable in a greyscale screenshot (brightness alone tells the bands apart).
9. Game art is scaled by a whole number; no blurred pixels.
