import type { AlloyMix, Item } from '../data/items';
import type { MixCheck, MixRefusal, Ore } from '../engine/alloy';
import { el, show } from './dom';

export interface AlloyView {
  /** Parts per ore id, every ore included (0 for an ore not in the mix). */
  parts: Record<string, number>;
  check: MixCheck;
  /** The mix's material quality when it can start a craft, else null. */
  quality: number | null;
}

export interface AlloyHandlers {
  change(oreId: string, by: 1 | -1): void;
  start(): void;
  back(): void;
}

export interface AlloyPanel {
  update(view: AlloyView): void;
}

const partsText = (n: number) => `${n} ${n === 1 ? 'part' : 'parts'}`;

/** Why "Start forging" is off, in words (S5 "Settled at S5 start"; the empty case is mock-up frame 2b's line). */
function reasonText(refusal: MixRefusal, item: Item, total: number): string {
  const name = item.name.toLowerCase();
  const a = /^[aeiou]/.test(name) ? 'an' : 'a';
  switch (refusal) {
    case 'empty':
      return 'Add at least one part of ore first.';
    case 'short': {
      const n = item.parts - total;
      return `Add ${n} more ${n === 1 ? 'part' : 'parts'}: ${a} ${name} takes ${item.parts}.`;
    }
    case 'over': {
      const n = total - item.parts;
      return `Take out ${n} ${n === 1 ? 'part' : 'parts'}: ${a} ${name} takes ${item.parts}.`;
    }
    case 'one-ore':
      return 'Mix at least 2 ores.';
    case 'bad':
      return "This mix can't be used.";
  }
}

/** The alloy screen (mock-up frames 2 and 2b): share the item's parts between the ores, then start forging. */
export function showAlloy(item: Item, ores: readonly Ore[], hint: string | null, on: AlloyHandlers): AlloyPanel {
  const steps = ['Alloy', 'Heat', 'Hammer', 'Quench'].map((s) => el('span', { className: s === 'Alloy' ? 'on' : '', text: s }));
  const rows = ores.map((ore) => {
    const less = el('button', { text: '−', attrs: { type: 'button', 'aria-label': `Less ${ore.name}` } });
    const more = el('button', { text: '+', attrs: { type: 'button', 'aria-label': `More ${ore.name}` } });
    less.addEventListener('click', () => on.change(ore.id, -1));
    more.addEventListener('click', () => on.change(ore.id, 1));
    const info = el('span', { className: 'sub' });
    const fill = el('i');
    const row = el('div', { className: 'ore', testId: 'ore-row' },
      el('b', { text: ore.name }),
      el('div', { className: 'stepper' }, less, more),
      info,
      el('p', { className: 'sub note', text: ore.note }),
      el('div', { className: 'bar' }, fill),
    );
    return { ore, row, less, more, info, fill };
  });

  const quality = el('p', { testId: 'alloy-quality' });
  const notes: HTMLElement[] = [quality];
  if (hint) notes.push(el('div', { className: 'hint', testId: 'alloy-hint', text: hint }));

  const start = el('button', { className: 'btn', text: 'Start forging', attrs: { type: 'button' } });
  const back = el('button', { className: 'btn ghost', text: 'Back to the list', attrs: { type: 'button' } });
  const reason = el('p', { className: 'reason', testId: 'mix-reason' });
  start.addEventListener('click', () => on.start());
  back.addEventListener('click', () => on.back());

  show(
    el('div', { className: 'screen alloy' },
      el('div', { className: 'top' }, el('div', { className: 'steps' }, ...steps), el('span', { text: item.name })),
      el('div', { className: 'panel fill' },
        el('p', { text: `Mix the metal for your ${item.name.toLowerCase()} from 2–3 ores.` }),
        ...rows.map((r) => r.row),
        ...notes,
      ),
      el('div', { className: 'panel' }, reason, el('div', { className: 'pair' }, back, start)),
    ),
  );

  return {
    update(view) {
      const total = Object.values(view.parts).reduce((a, n) => a + n, 0);
      for (const r of rows) {
        const n = view.parts[r.ore.id] ?? 0;
        r.info.textContent = `Quality ${r.ore.quality} · ${partsText(n)}`;
        r.fill.style.width = `${(Math.min(n, item.parts) / item.parts) * 100}%`;
        r.less.disabled = n <= 0;
        r.more.disabled = total >= item.parts;
      }
      quality.hidden = view.quality === null;
      quality.textContent = view.quality === null ? '' : `Material quality ${view.quality}`;
      start.disabled = !view.check.ok;
      reason.hidden = view.check.ok;
      reason.textContent = view.check.ok ? '' : reasonText(view.check.refusal, item, total);
    },
  };
}

/** The mix without its empty ores: what the engine takes (forge spec, Engine → AlloyMix). */
export function mixOf(parts: Record<string, number>): AlloyMix {
  return Object.fromEntries(Object.entries(parts).filter(([, n]) => n > 0));
}
