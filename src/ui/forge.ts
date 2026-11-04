import { el, show } from './dom';

export type Step = 'Alloy' | 'Heat' | 'Hammer' | 'Quench';

export interface ForgePanel {
  top: HTMLElement;
  panel: HTMLElement;
  /** Update the panel for where the bar is and whether it is burning. */
  update(view: { inFire: boolean; held: boolean; burning: boolean }): void;
  /** Remove listeners that outlive the screen. */
  destroy(): void;
}

export interface ForgeHandlers {
  bellows(down: boolean): void;
  move(): void;
}

/** The forge's top bar and bottom panel in the wide view (mock-up frames 3 and 3b). */
export function showForgePanel(itemName: string, hint: string | null, on: ForgeHandlers): ForgePanel {
  const steps: Step[] = ['Alloy', 'Heat', 'Hammer', 'Quench'];
  const top = el('div', { className: 'top' },
    el('div', { className: 'steps' }, ...steps.map((s) => el('span', { text: s, className: s === 'Heat' ? 'on' : '' }))),
    el('span', { text: itemName }),
  );

  const INTRO = 'Hold to work the bellows. Keep the metal in the working heat. Too cool or too hot costs points.';
  // Shown in place of the intro while the bellows button is disabled (UI_STYLE Controls: disabled with a reason).
  const OUT = 'The bellows work only while the bar is in the fire. Drag it back, or tap "To the fire".';
  const HELD = 'Let go over the fire or the anvil. Anywhere else, the bar goes back.';
  const intro = el('p', { testId: 'intro', text: INTRO });
  const hintEl = hint ? el('div', { className: 'hint', testId: 'hint', text: hint }) : null;
  const burning = el('div', { className: 'alert', testId: 'burning', attrs: { role: 'alert' } },
    el('b', { text: 'Burning!' }),
    el('p', { text: 'The metal is being damaged. Ease off the bellows or take it out of the fire.' }),
  );
  burning.hidden = true;

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

  const panel = el('div', { className: 'panel' }, burning, intro, ...(hintEl ? [hintEl] : []),
    el('div', { className: 'pair' }, bellows, move));
  show(el('div', { className: 'screen forge' }, top, el('div', { className: 'scene-gap' }), panel));

  return {
    top,
    panel,
    update({ inFire, held, burning: isBurning }) {
      if (burning.hidden === isBurning) burning.hidden = !isBurning;
      intro.hidden = isBurning;
      if (hintEl) hintEl.hidden = isBurning;
      bellows.disabled = !inFire;
      if (!inFire) release();
      move.disabled = held;
      move.textContent = inFire || held ? 'To the anvil' : 'To the fire';
      const text = held ? HELD : inFire ? INTRO : OUT;
      if (intro.textContent !== text) intro.textContent = text;
    },
    destroy() {
      window.removeEventListener('pointerup', release);
    },
  };
}
