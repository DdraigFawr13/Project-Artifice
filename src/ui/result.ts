import grading from '../data/grading.json';
import type { Item } from '../data/items';
import type { Graded, ResultLine } from '../engine/grade';
import { ores } from '../engine/alloy';
import { sheenOf, shaded } from '../data/sheen';
import { OUTLINE_RGB, outline, shapesFor, worked } from '../game/shapes';
import { STAT_IDS, STAT_NAMES } from '../engine/stats';
import type { CauseId } from '../engine/strike';
import type { ResultData } from '../game/Result';
import { el, show } from './dom';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Each result line in words, from its cause and its count (S4 "Settled at S4 start"). Temperatures are never numbers. */
const WORDS: Record<CauseId, (n: number) => string> = {
  'off-centre': (n) => `${plural(n, 'strike')} off-centre`,
  'wild-strike': (n) => `${plural(n, 'strike')} missed the metal`,
  'cold-strike': (n) => `${plural(n, 'strike')} on metal too cold`,
  'hot-strike': (n) => `${plural(n, 'strike')} on metal too hot`,
  'hard-strike': (n) => `${plural(n, 'strike')} too hard`,
  'repeat-strike': (n) => `${plural(n, 'strike')} on finished spots`,
  'blocked-strike': (n) => `${plural(n, 'strike')} blocked by slag`,
  'missed-target': (n) => `${plural(n, 'hit')} missing`,
  'slag-left': (n) => `${plural(n, 'slag spot')} left`,
  'out-of-band': (n) => `Out of the working heat for ${n} s`,
  burning: (n) => `Burning for ${n} s`,
  'quench-hot': () => 'Quenched too hot',
  'quench-cold': () => 'Quenched too cold',
};

export function lineText(l: ResultLine): string {
  return WORDS[l.cause](l.count);
}

/** A row of label and value (mock-up frames 6 and 7). Figures use Press Start 2P, whose digits read clearly (UI_STYLE). */
const row = (label: string, value: string | Node, minus = false) =>
  el('div', { testId: 'line' }, el('span', { text: label }), el('span', { className: minus ? 'minus pts' : 'pts' }, value));
/** "5 parts": the number in the figures face, the word in the body face. */
const parts = (n: number) => el('span', { className: 'count' }, el('span', { className: 'pts', text: String(n) }), ` ${n === 1 ? 'part' : 'parts'}`);

/** The stat card (mock-up `f-result-stats`): per stat the name, a bar of value ÷ 100, the word and the reason. */
function statCard(item: Item, stats: Graded['stats']): HTMLElement {
  const rows = STAT_IDS.filter((id) => item.stats.includes(id) && stats[id]).map((id) => {
    const s = stats[id]!;
    const bar = el('div', { className: 'sbar' }, el('i'));
    bar.firstElementChild!.setAttribute('style', `width:${s.value}%`);
    return el('div', { className: 'stat', testId: 'stat-row' }, el('b', { text: STAT_NAMES[id] }), bar, el('span', { className: 'word', text: s.word }), el('span', { className: 'why', text: s.why }));
  });
  return el('div', { className: 'stats', testId: 'stat-card' }, ...rows);
}

/** CSS px per game px for the piece image: 2, or less so the raster fits 300 CSS px (the sword). */
const pieceScale = (w: number) => Math.min(2, 300 / w);

/**
 * The finished piece (mock-up `f-result-piece`): the worked raster one canvas px per game px, each pixel the mix's sheen
 * at the raster's shade, with the forge's dark outline (S5). The screen draws; the engine decided the hits.
 */
function pieceImage(item: Item, data: ResultData): HTMLCanvasElement {
  const r = worked(shapesFor(item.id), data.hits);
  const edge = outline(r);
  const sheen = sheenOf(data.alloy);
  const canvas = el('canvas', {
    className: 'piece',
    testId: 'result-piece',
    attrs: { role: 'img', 'aria-label': `${item.name} in ${metalNames(data.alloy)}` },
  });
  canvas.width = r.w;
  canvas.height = r.h;
  canvas.style.width = `${Math.round(r.w * pieceScale(r.w))}px`;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(r.w, r.h);
  for (let i = 0; i < r.w * r.h; i++) {
    const v = r.shade[i]!;
    if (v > 0) img.data.set([...shaded(sheen, v), 255], i * 4);
    else if (edge[i]) img.data.set([...OUTLINE_RGB, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** The mix's ore names, most parts first (ties in the ore list's order), as a list: "A and B", "A, B and C". */
function metalNames(alloy: ResultData['alloy']): string {
  const order = (id: string) => ores.findIndex((o) => o.id === id);
  const names = Object.entries(alloy)
    .sort(([a, pa], [b, pb]) => pb - pa || order(a) - order(b))
    .map(([id]) => ores.find((o) => o.id === id)!.name);
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The result screen (mock-up frame 6) or the ruin screen (frame 7). */
export function showResult(item: Item, data: ResultData, on: { choose(): void; again(): void }): void {
  const g = data.graded;
  const name = item.name.toLowerCase();
  const body: HTMLElement[] = [];
  if (!g.ruined) {
    body.push(
      pieceImage(item, data),
      el('div', { className: 'score' }, el('b', { testId: 'score', text: String(g.score) }), el('span', { testId: 'tier', text: g.tier })),
      el('p', { className: 'sub', testId: 'material', text: `Material quality ${g.materialQuality} · not in the score` }),
      el('div', { className: 'lines' }, row('Start', '100'), ...g.lines.map((l) => row(lineText(l), `−${l.points}`, true))),
      statCard(item, g.stats),
      el('p', { className: 'sub', text: data.newBest ? `New best for ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}.` : `Best: ${data.previousBest}` }),
    );
  } else {
    const cause =
      g.ruin === 'white-quench'
        ? { title: `The ${name} cracked in the quench.`, why: 'It went into the water far too hot.' }
        : { title: `The ${name} cracked on the anvil.`, why: `${grading.ruin.cracks} cracking strikes: on black metal, or too hard below the working heat.` };
    body.push(
      el('div', { className: 'alert', attrs: { role: 'alert' } }, el('b', { text: cause.title }), el('p', { text: cause.why })),
      el('p', { text: 'Half the metal, rounded down, comes back as scrap.' }),
      el('div', { className: 'lines' }, row('Metal used', parts(item.parts)), row('Scrap returned', parts(g.scrapParts))),
      el('p', { text: 'The ruin counts. Your best grades are unchanged.' }),
    );
  }
  const choose = el('button', { className: 'btn ghost', text: 'Choose item', attrs: { type: 'button' } });
  const again = el('button', { className: 'btn', text: g.ruined ? 'Try again' : 'Forge another', attrs: { type: 'button' } });
  choose.addEventListener('click', () => on.choose());
  again.addEventListener('click', () => on.again());
  show(
    el('div', { className: 'screen result' },
      el('div', { className: 'top' }, el('span', { text: `${item.name} ${g.ruined ? 'ruined' : 'finished'}` }), el('span', { className: 'sub', text: data.saved ? 'Saved' : 'Not saved' })),
      el('div', { className: 'panel fill' }, ...body),
      el('div', { className: 'panel pair' }, choose, again),
    ),
  );
}
