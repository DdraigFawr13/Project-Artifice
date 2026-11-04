import type { Item } from '../data/items';
import type { LoadResult } from '../save/save';
import { el, show } from './dom';

/** The item list (mock-up frame 1): select a row, then "Forge a <item>". */
export function showChoose(items: readonly Item[], load: LoadResult, onForge: (item: Item) => void, selectedId = 'knife'): void {
  let selected = items.find((i) => i.id === selectedId) ?? items[0];
  const rows = items.map((item) => {
    const best = load.save.best[item.id];
    const row = el('button', { className: 'item', testId: 'item-row', attrs: { type: 'button', 'aria-pressed': String(item === selected) } },
      el('b', { text: item.name }),
      el('span', { text: `about ${item.minutes} min` }),
      el('span', { className: 'sub', text: best === undefined ? 'Best: none yet' : `Best: ${best}` }),
    );
    row.addEventListener('click', () => {
      selected = item;
      for (const r of rows) r.setAttribute('aria-pressed', String(r === row));
      forge.textContent = forgeLabel(item);
    });
    return row;
  });

  const forge = el('button', { className: 'btn', text: selected ? forgeLabel(selected) : '', attrs: { type: 'button' } });
  forge.addEventListener('click', () => selected && onForge(selected));

  const notes: HTMLElement[] = [];
  if (Object.keys(load.save.best).length === 0) notes.push(el('div', { className: 'hint', text: 'No crafts yet. Your best grade for each item will show here.' }));
  if (load.save.scrap > 0) notes.push(el('p', { className: 'sub', text: `Scrap kept: ${load.save.scrap} ${load.save.scrap === 1 ? 'part' : 'parts'}` }));
  if (!load.saving) notes.push(el('div', { className: 'hint', text: "Progress won't be saved on this device." }));
  if (load.recovered) notes.push(el('div', { className: 'hint', text: "Your old save couldn't be read. It is kept aside, and a fresh save has started." }));

  show(
    el('div', { className: 'screen' },
      el('div', { className: 'top' }, el('span', { text: 'Choose your work' }), el('span', { text: load.saving ? 'Saved' : 'Not saved' })),
      el('div', { className: 'panel fill' }, ...rows, ...notes),
      el('div', { className: 'panel' }, forge),
    ),
  );
}

function forgeLabel(item: Item): string {
  const name = item.name.toLowerCase();
  return `Forge ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;
}
