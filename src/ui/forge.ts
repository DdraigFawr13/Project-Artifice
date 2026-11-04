import grading from '../data/grading.json';
import { el, show } from './dom';

export type Step = 'Alloy' | 'Heat' | 'Hammer' | 'Quench';

/** What the forge screen shows: the wide view, the close-up anvil view, or the ruin placeholder (S3; S4 replaces it). */
export type ForgeMode = 'wide' | 'close' | 'ruined';

export interface ForgeView {
  mode: ForgeMode;
  inFire: boolean;
  held: boolean;
  /** The engine's burning flag. */
  burning: boolean;
  /** The round in progress, targets hit in it out of how many, and the live total of points lost. */
  round: number;
  struck: number;
  targets: number;
  lost: number;
}

export interface ForgePanel {
  top: HTMLElement;
  panel: HTMLElement;
  update(view: ForgeView): void;
  /** Show one strike's points rising from (x, y) in CSS px over the canvas; returns a setter for its progress 0–1. */
  addPoints(text: string, x: number, y: number): (progress: number) => void;
  destroy(): void;
}

export interface ForgeHandlers {
  bellows(down: boolean): void;
  move(): void;
  back(): void;
  again(): void;
}

const STEPS: Step[] = ['Alloy', 'Heat', 'Hammer', 'Quench'];
const STEP_FOR: Record<ForgeMode, Step> = { wide: 'Heat', close: 'Hammer', ruined: 'Hammer' };
/** How far a strike's points rise before they fade, in CSS px. */
const RISE = 28;

/** The forge's top bar, scene labels and bottom panel (mock-up frames 3, 3b and 4). */
export function showForgePanel(itemName: string, hints: { heat: string | null; hammer: string | null }, on: ForgeHandlers): ForgePanel {
  const stepEls = STEPS.map((s) => el('span', { text: s }));
  const top = el('div', { className: 'top' }, el('div', { className: 'steps' }, ...stepEls), el('span', { text: itemName }));

  const burning = el('div', { className: 'alert', testId: 'burning', attrs: { role: 'alert' } },
    el('b', { text: 'Burning!' }),
    el('p', { text: 'The metal is being damaged. Ease off the bellows or take it out of the fire.' }),
  );
  burning.hidden = true;

  // ── Wide view (mock-up frame 3) ──
  const INTRO = 'Hold to work the bellows. Keep the metal in the working heat. Too cool or too hot costs points.';
  // Shown in place of the intro while the bar is held and the bellows are disabled (UI_STYLE Controls: a reason).
  const HELD = 'Let go over the fire or the anvil. Anywhere else, the bar goes back.';
  const intro = el('p', { testId: 'intro', text: INTRO });
  const heatHint = hints.heat ? el('div', { className: 'hint', testId: 'hint', text: hints.heat }) : null;
  const bellows = el('button', { className: 'btn', text: 'Hold: bellows', attrs: { type: 'button' } });
  const move = el('button', { className: 'btn ghost', text: 'To the anvil', attrs: { type: 'button' } });
  let down = false;
  const release = () => {
    if (!down) return;
    down = false;
    on.bellows(false);
  };
  bellows.addEventListener('pointerdown', (e) => {
    if (bellows.disabled) return;
    e.preventDefault();
    down = true;
    on.bellows(true);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) bellows.addEventListener(ev, release);
  window.addEventListener('pointerup', release);
  bellows.addEventListener('contextmenu', (e) => e.preventDefault());
  move.addEventListener('click', () => {
    if (!move.disabled) on.move();
  });
  const wide = el('div', { className: 'group' }, intro, ...(heatHint ? [heatHint] : []), el('div', { className: 'pair' }, bellows, move));

  // ── Close-up anvil view (mock-up frame 4) ──
  const closeIntro = el('p', { testId: 'close-intro', text: 'Read the metal: its colour, glow and sparks tell you the heat.' });
  const hammerHint = hints.hammer ? el('div', { className: 'hint', testId: 'hammer-hint', text: hints.hammer }) : null;
  const back = el('button', { className: 'btn ghost', text: 'Back to the fire', attrs: { type: 'button' } });
  const quench = el('button', { className: 'btn ghost', text: 'Quench', attrs: { type: 'button' } });
  quench.disabled = true; // until S4
  back.addEventListener('click', () => on.back());
  const close = el('div', { className: 'group' }, closeIntro, ...(hammerHint ? [hammerHint] : []),
    el('div', { className: 'pair' }, back, quench),
    el('p', { className: 'reason', text: 'Quenching comes in the next build.' }));
  close.hidden = true;

  // ── Ruin placeholder (S4's ruin screen replaces it) ──
  const again = el('button', { className: 'btn', text: 'Forge again', attrs: { type: 'button' } });
  again.addEventListener('click', () => on.again());
  const ruined = el('div', { className: 'group' },
    el('div', { className: 'alert', attrs: { role: 'alert' } },
      el('b', { text: 'Ruined' }),
      el('p', { text: `${grading.ruin.blackStrikes} strikes on black, cold metal cracked the ${itemName.toLowerCase()}.` }),
    ),
    again);
  ruined.hidden = true;

  // The strikes label sits at the scene's top left (mock-up frame 4); points float over the canvas.
  const label = el('span', { className: 'label', testId: 'strikes' });
  label.hidden = true;
  const floats = el('div', { className: 'floats' });

  const panel = el('div', { className: 'panel' }, burning, wide, close, ruined);
  show(el('div', { className: 'screen forge' }, top, el('div', { className: 'scene-gap' }, label), panel, floats));

  let mode: ForgeMode | null = null;
  return {
    top,
    panel,
    update(v) {
      if (v.mode !== mode) {
        mode = v.mode;
        stepEls.forEach((e, i) => (e.className = STEPS[i] === STEP_FOR[v.mode] ? 'on' : ''));
        wide.hidden = v.mode !== 'wide';
        close.hidden = v.mode !== 'close';
        ruined.hidden = v.mode !== 'ruined';
        label.hidden = v.mode === 'wide';
        if (v.mode !== 'wide') release();
      }
      const isBurning = v.burning && v.mode !== 'ruined';
      if (burning.hidden === isBurning) burning.hidden = !isBurning;
      intro.hidden = isBurning;
      closeIntro.hidden = isBurning;
      if (heatHint) heatHint.hidden = isBurning;
      if (hammerHint) hammerHint.hidden = isBurning;
      const text = `Round ${v.round} · ${v.struck} of ${v.targets} · −${v.lost}`;
      if (label.textContent !== text) label.textContent = text;
      if (v.mode !== 'wide') return;
      bellows.disabled = !v.inFire;
      if (!v.inFire) release();
      move.disabled = v.held;
      const t = v.held ? HELD : INTRO;
      if (intro.textContent !== t) intro.textContent = t;
    },
    addPoints(text, x, y) {
      const p = el('span', { className: 'points', testId: 'points', text });
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      floats.append(p);
      return (progress) => {
        if (progress >= 1) {
          p.remove();
          return;
        }
        p.style.transform = `translate(-50%, calc(-100% - ${Math.round(RISE * progress)}px))`;
        p.style.opacity = String(Math.min(1, 2 * (1 - progress)));
      };
    },
    destroy() {
      window.removeEventListener('pointerup', release);
    },
  };
}
