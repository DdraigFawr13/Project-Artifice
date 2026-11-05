import grading from '../data/grading.json';
import { el, show } from './dom';

export type Step = 'Alloy' | 'Heat' | 'Hammer' | 'Quench';

/**
 * What the forge screen shows: the wide view at the fire, the close-up anvil view, the wide view with the piece in
 * hand for the quench (mock-up frame 5), or the craft just ended (the last view stays, its buttons off, until the
 * result or ruin screen opens).
 */
export type ForgeMode = 'wide' | 'close' | 'quench' | 'done';

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
  /** Clean strikes in a row, from the engine. */
  streak: number;
  /** Where the tub's label sits, in CSS px over the canvas (the quench view only). */
  tub: { x: number; y: number } | null;
  /** Where a held piece was picked up from. */
  heldFrom: 'fire' | 'anvil';
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
  quench(): void;
  putBack(): void;
}

const STEPS: Step[] = ['Alloy', 'Heat', 'Hammer', 'Quench'];
const STEP_FOR: Record<Exclude<ForgeMode, 'done'>, Step> = { wide: 'Heat', close: 'Hammer', quench: 'Quench' };
/** How far a strike's points rise before they fade, in CSS px. */
const RISE = 28;

/** The forge's top bar, scene labels and bottom panel (mock-up frames 3, 3b and 4). */
export function showForgePanel(itemName: string, hints: { heat: string | null; hammer: string | null; force: string | null; quench: string | null }, on: ForgeHandlers): ForgePanel {
  const stepEls = STEPS.map((s) => el('span', { text: s }));
  const top = el('div', { className: 'top' }, el('div', { className: 'steps' }, ...stepEls), el('span', { text: itemName }));

  // In hand for the quench the fire advice doesn't fit; white heat in the tub would crack it, so the advice is to cool.
  const BURN_FIRE = 'The metal is being damaged. Ease off the bellows or take it out of the fire.';
  const BURN_HELD = 'The metal is being damaged. Let it cool before you quench it.';
  const burnText = el('p', { text: BURN_FIRE });
  const burning = el('div', { className: 'alert', testId: 'burning', attrs: { role: 'alert' } },
    el('b', { text: 'Burning!' }),
    burnText,
  );
  burning.hidden = true;

  // ── Wide view (mock-up frame 3) ──
  const INTRO = 'Hold to work the bellows. Keep the metal in the working heat. Too cool or too hot costs points.';
  // Shown in place of the intro while the bar is held and the bellows are disabled (UI_STYLE Controls: a reason).
  const HELD = 'Let go over the fire, the anvil or the tub. Anywhere else, the bar goes back.';
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
  // Quench straight from the fire or the anvil (Morgan, S4 playtest): picks the piece up for the quench view.
  const quenchWide = el('button', { className: 'btn ghost', text: 'Quench', attrs: { type: 'button' } });
  quenchWide.addEventListener('click', () => {
    if (!quenchWide.disabled) on.quench();
  });
  const wide = el('div', { className: 'group' }, intro, ...(heatHint ? [heatHint] : []), el('div', { className: 'trio' }, bellows, move, quenchWide));

  // ── Close-up anvil view (mock-up frame 4) ──
  const closeIntro = el('p', { testId: 'close-intro', text: 'Read the metal: its colour, glow and sparks tell you the heat.' });
  // The hammer hint (where the strike lands) and the force hint (S2) each show their first 3 times.
  const hammerHint = hints.hammer ? el('div', { className: 'hint', testId: 'hammer-hint', text: hints.hammer }) : null;
  const forceHint = hints.force ? el('div', { className: 'hint', testId: 'force-hint', text: hints.force }) : null;
  const back = el('button', { className: 'btn ghost', text: 'Back to the fire', attrs: { type: 'button' } });
  const quench = el('button', { className: 'btn ghost', text: 'Quench', attrs: { type: 'button' } });
  back.addEventListener('click', () => on.back());
  quench.addEventListener('click', () => on.quench());
  const close = el('div', { className: 'group' }, closeIntro, ...(hammerHint ? [hammerHint] : []), ...(forceHint ? [forceHint] : []), el('div', { className: 'pair' }, back, quench));
  close.hidden = true;

  // ── Quench, in the wide view with the piece in hand (mock-up frame 5) ──
  const quenchIntro = el('p', { testId: 'quench-intro', text: 'Read the metal, then plunge it. The right moment is in its colour, glow and sparks.' });
  const quenchHint = hints.quench ? el('div', { className: 'hint', testId: 'quench-hint', text: hints.quench }) : null;
  // Back where the piece was picked up from (the fire or the anvil).
  const putBack = el('button', { className: 'btn ghost', text: 'Back to the anvil', attrs: { type: 'button' } });
  putBack.addEventListener('click', () => on.putBack());
  const quenching = el('div', { className: 'group' }, quenchIntro, ...(quenchHint ? [quenchHint] : []), putBack);
  quenching.hidden = true;

  // The strikes label sits at the scene's top left (mock-up frame 4); points float over the canvas.
  const label = el('span', { className: 'label', testId: 'strikes' });
  label.hidden = true;
  // The quench view names the tub (mock-up frame 5).
  const tubLabel = el('span', { className: 'label tub', testId: 'tub-label', text: 'Quench tub' });
  tubLabel.hidden = true;
  const floats = el('div', { className: 'floats' });

  const panel = el('div', { className: 'panel' }, burning, wide, close, quenching);
  show(el('div', { className: 'screen forge' }, top, el('div', { className: 'scene-gap' }, label), panel, floats, tubLabel));

  let mode: ForgeMode | null = null;
  return {
    top,
    panel,
    update(v) {
      if (v.mode !== mode) {
        mode = v.mode;
        if (v.mode === 'done') {
          // The craft has ended: the last view stays as it was, with nothing left to press.
          for (const b of panel.querySelectorAll('button')) b.disabled = true;
          // In the tub the label would cover the piece going in (S5).
          tubLabel.hidden = true;
          release();
          return;
        }
        stepEls.forEach((e, i) => (e.className = STEPS[i] === STEP_FOR[v.mode as Exclude<ForgeMode, 'done'>] ? 'on' : ''));
        wide.hidden = v.mode !== 'wide';
        close.hidden = v.mode !== 'close';
        quenching.hidden = v.mode !== 'quench';
        label.hidden = v.mode !== 'close';
        if (v.mode !== 'wide') release();
      }
      if (v.mode === 'done') return;
      tubLabel.hidden = v.mode !== 'quench' || !v.tub;
      if (v.tub) {
        // Kept 8 px inside the screen's right edge.
        const half = tubLabel.offsetWidth / 2;
        tubLabel.style.left = `${Math.min(v.tub.x, floats.clientWidth - 8 - half)}px`;
        tubLabel.style.top = `${v.tub.y}px`;
      }
      const isBurning = v.burning;
      const burnWords = v.mode === 'quench' ? BURN_HELD : BURN_FIRE;
      if (burnText.textContent !== burnWords) burnText.textContent = burnWords;
      if (burning.hidden === isBurning) burning.hidden = !isBurning;
      intro.hidden = isBurning;
      closeIntro.hidden = isBurning;
      quenchIntro.hidden = isBurning;
      if (quenchHint) quenchHint.hidden = isBurning;
      if (heatHint) heatHint.hidden = isBurning;
      if (hammerHint) hammerHint.hidden = isBurning;
      if (forceHint) forceHint.hidden = isBurning;
      const text = `Round ${v.round} · ${v.struck} of ${v.targets} · −${v.lost}${v.streak >= grading.streakShowAt ? ` · Clean ×${v.streak}` : ''}`;
      if (label.textContent !== text) label.textContent = text;
      const back = `Back to the ${v.heldFrom}`;
      if (putBack.textContent !== back) putBack.textContent = back;
      if (v.mode !== 'wide') return;
      bellows.disabled = !v.inFire;
      quenchWide.disabled = v.held;
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
