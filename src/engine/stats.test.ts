import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { alloyProps } from './alloy';
import { PASSES, type CraftState, type Strike } from './craft';
import { grade, type Graded } from './grade';
import { statWord, statsFor } from './stats';

// J5 (forge-depth spec, S4): stats from the work done and the mix. States are built by hand, never by createCraft.
const KNIFE_MIX = { ore2: 4, ore1: 1 };

const strike = (kind: Strike['kind'], target: number | null, offPx: number | null, crack = false): Strike => ({
  step: 0, x: 0, y: 0, target, kind, crack, force: 0.5, heat: 'in', offPx, perfect: false, lines: [],
});

interface Build {
  /** Per target index: the offPx of each hit it took (default: 2 hits dead centre). */
  offs?: Record<number, number[]>;
  extra?: Strike[];
  slagLeft?: number;
  slagCleared?: number;
  lost?: CraftState['lost'];
  quenchC?: number | null;
}

/** An ended craft as plain data: the item's targets, the given hits, slag, lost seconds and quench. */
function ended(itemId: string, alloy: Record<string, number>, b: Build = {}): CraftState {
  const item = itemById(itemId);
  const strikes: Strike[] = [];
  const targets = item.targets.map((t, i) => {
    const offs = b.offs?.[i] ?? Array.from({ length: PASSES }, () => 0);
    for (const off of offs) strikes.push(strike('hit', i, off));
    return { x: t.x, y: t.y, hits: offs.length };
  });
  const spot = (cleared: boolean, gap: number) => ({ x: 0, y: 0, gap, cleared });
  const slag = [
    ...Array.from({ length: b.slagLeft ?? 0 }, (_, i) => spot(false, i)),
    ...Array.from({ length: b.slagCleared ?? 0 }, (_, i) => spot(true, 7 - i)),
  ];
  return {
    rulesVersion: 2, bandShiftC: 0, seed: 1, itemId, alloy, props: alloyProps(alloy), step: 100, temp: 830, location: 'done',
    heldFrom: 'anvil', bellows: false, targets, slag, strikes: [...strikes, ...(b.extra ?? [])], lost: b.lost ?? {}, burning: false,
    quenchC: b.quenchC === undefined ? 830 : b.quenchC, ruin: null, log: [],
  };
}
const edge = (s: CraftState) => statsFor(s).edge!;
const tough = (s: CraftState) => statsFor(s).toughness!;
const balance = (s: CraftState) => statsFor(s).balance!;
// A mix whose multiplier is 1 for the stat under test: Starmetal for Edge, Bog Iron for Toughness, Ridge Iron for Balance.
const E = { ore3: 5 };
const T = { ore1: 5 };
const B = { ore2: 5 };

describe('J5 ore traits', () => {
  it('gives an Ore 3 knife the higher Edge and the lower Toughness than an Ore 1 knife', () => {
    const soft = statsFor(ended('knife', { ore1: 4, ore2: 1 }));
    const hard = statsFor(ended('knife', { ore3: 4, ore2: 1 }));
    expect(Object.keys(hard)).toEqual(['edge', 'toughness', 'balance']);
    expect(hard.edge!.value).toBeGreaterThan(soft.edge!.value);
    expect(hard.toughness!.value).toBeLessThan(soft.toughness!.value);
    // Exact: 100 x the parts-weighted multipliers (0.77 / 0.97 Edge, 0.97 / 0.77 Toughness).
    expect([soft.edge!.value, hard.edge!.value, soft.toughness!.value, hard.toughness!.value]).toEqual([77, 97, 97, 77]);
  });

  it('gives different swords different Balance', () => {
    const mixed = balance(ended('sword', { ore1: 4, ore3: 4 }));
    const standard = balance(ended('sword', itemById('sword').defaultAlloy));
    expect(mixed.value).toBe(85);
    expect(standard.value).toBe(98); // round(100 x (7 + 0.85) / 8)
    expect(mixed.value).not.toBe(standard.value);
  });

  it('rounds work x multiplier and clamps to 0-100', () => {
    // 2 hits 13 px out (10 over the centre each) among 18: work 100 - 10 x 20/18 = 88.89, x 0.83 = 73.8.
    expect(edge(ended('knife', KNIFE_MIX, { offs: { 0: [13, 13] } })).value).toBe(74);
    expect(edge(ended('knife', E)).value).toBe(100);    // Work below 0 is 0: a quench 1170 °C off costs 234.
    expect(tough(ended('knife', T, { quenchC: 2000 })).value).toBe(0);
  });
});

describe('Edge', () => {
  it('is 0 with no hits, and says so', () => {
    const s = ended('knife', E, { offs: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, []])) });
    expect(edge(s).value).toBe(0);
    expect(edge(s).word).toBe('Dull');
    expect(edge(s).why).toBe('hurt most by no hits landing');
  });

  it('loses 10 per px of the mean over hits beyond the 3 px centre, uncapped', () => {
    expect(edge(ended('knife', E, { offs: { 0: [3, 3], 1: [3] } })).value).toBe(100); // within the centre: nothing
    expect(edge(ended('knife', E, { offs: { 0: [5, 5] } })).value).toBe(Math.round(100 - (10 * 4) / 18));
    // 2 hits at 13 px (10 over each) among 18: mean 20/18.
    expect(edge(ended('knife', E, { offs: { 0: [13, 13] } })).value).toBe(Math.round(100 - (10 * 20) / 18));
    // No cap: one far hit keeps lowering it (60 px = 57 over).
    expect(edge(ended('knife', E, { offs: { 0: [60, 3] } })).value).toBe(Math.round(100 - (10 * 57) / 18));
  });

  it('counts hits only: repeats, wild, slag and blocked strikes do not move it', () => {
    const extra = [strike('repeat', null, null), strike('wild', null, null), strike('slag', null, 40), strike('blocked', 0, 40), strike('light', null, null)];
    expect(edge(ended('knife', E, { extra })).value).toBe(100);
  });

  it('names off-centre strikes (offPx over the centre) as the why', () => {
    const s = ended('knife', E, { offs: { 0: [8, 4], 1: [3, 3] } });
    expect(edge(s).why).toBe('hurt most by 2 off-centre strikes');
  });
});

describe('Toughness', () => {
  it('loses 4 per second out of the working heat, from the unrounded lost points', () => {
    // 2 points per second: lost 8 = 4 s = 16 points.
    expect(tough(ended('knife', T, { lost: { 'out-of-band': 8 } })).value).toBe(84);
    // 6.4 points = 3.2 s: 12.8 -> 87 (unrounded), n rounds to 3.
    const s = ended('knife', T, { lost: { 'out-of-band': 6.4 } });
    expect(tough(s).value).toBe(87);
    expect(tough(s).why).toBe('hurt most by 3 s out of the working heat');
    expect(tough(ended('knife', T, { lost: { 'out-of-band': 0.4 } })).why).toBe('hurt most by 1 s out of the working heat');
  });

  it('loses 1 per 5 degrees from 830 °C, either way, and treats no quench as 830', () => {
    expect(tough(ended('knife', T, { quenchC: 830 })).value).toBe(100);
    expect(tough(ended('knife', T, { quenchC: 780 })).value).toBe(90);
    expect(tough(ended('knife', T, { quenchC: 880 })).value).toBe(90);
    expect(tough(ended('knife', T, { quenchC: 1130 })).value).toBe(40);
    expect(tough(ended('knife', T, { quenchC: null })).value).toBe(100);
    expect(tough(ended('knife', T, { quenchC: 780 })).why).toBe('hurt most by the quench heat');
  });

  it('loses 10 per cracking strike of any kind', () => {
    const one = ended('knife', T, { extra: [strike('hit', 0, 0, true)] });
    expect(tough(one).value).toBe(90);
    expect(tough(one).why).toBe('hurt most by 1 cracking strike');
    const two = ended('knife', T, { extra: [strike('repeat', null, null, true), strike('slag', null, null, true)] });
    expect(tough(two).value).toBe(80);
    expect(tough(two).why).toBe('hurt most by 2 cracking strikes');
  });

  it('is not moved by Edge or Balance terms', () => {
    expect(tough(ended('knife', T, { offs: { 0: [30, 30] }, slagLeft: 2 })).value).toBe(100);
  });
});

describe('Balance', () => {
  it('loses 3 per missing hit', () => {
    const s = ended('knife', B, { offs: { 0: [0], 1: [] } }); // 1 + 2 missing
    expect(balance(s).value).toBe(100 - 3 * 3);
    expect(balance(s).why).toBe('hurt most by 3 hits missing');
  });

  it('names a single count in the singular', () => {
    expect(balance(ended('knife', B, { offs: { 0: [0] } })).why).toBe('hurt most by 1 hit missing');
    expect(edge(ended('knife', E, { offs: { 0: [5, 0] } })).why).toBe('hurt most by 1 off-centre strike');
  });

  it('loses 15 per slag spot left, and cleared spots cost nothing', () => {
    const s = ended('knife', B, { slagLeft: 2, slagCleared: 1 });
    expect(balance(s).value).toBe(70);
    expect(balance(s).why).toBe('hurt most by 2 slag spots left');
  });

  it('loses 2 per px between the best and worst target mean beyond the centre', () => {
    // Target 0 averages 3 + 7 = hits at 10 and 10: 7 over; the rest 0: spread 7 -> 14.
    const s = ended('knife', B, { offs: { 0: [10, 10] } });
    expect(balance(s).value).toBe(86);
    expect(balance(s).why).toBe('hurt most by uneven work');
    // Per-target means: 0 and 8 over -> mean 4 over; others 0: spread 4 -> 8.
    expect(balance(ended('knife', B, { offs: { 0: [3, 11] } })).value).toBe(92);
  });

  it('has no spread with fewer than 2 targets that were hit', () => {
    const none = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, []]));
    const s = ended('knife', B, { offs: { 0: [40, 40], ...none } });
    // 16 missing hits only (3 each): no spread term on top.
    expect(balance(s).value).toBe(100 - 16 * 3);
  });

  it('is not moved by Edge or Toughness terms', () => {
    expect(balance(ended('knife', B, { lost: { 'out-of-band': 20 }, quenchC: 1000, extra: [strike('hit', 0, 0, true)] })).value).toBe(100);
  });
});

describe('why', () => {
  it('names the largest single deduction of the stat', () => {
    // Toughness: out of heat 4 s = 16, quench 780 = 10, 1 crack = 10.
    expect(tough(ended('knife', T, { lost: { 'out-of-band': 8 }, quenchC: 780, extra: [strike('hit', 0, 0, true)] })).why).toBe('hurt most by 4 s out of the working heat');
    // Balance: 1 slag = 15 beats 2 missing = 6 and a spread of 4 px = 8.
    const s = ended('knife', B, { offs: { 0: [3, 11], 1: [] }, slagLeft: 1 });
    expect(balance(s).why).toBe('hurt most by 1 slag spot left');
    expect(balance(ended('knife', B, { offs: { 0: [3, 11], 1: [0] } })).why).toBe('hurt most by uneven work');
  });

  it('breaks a tie in the formula order', () => {
    // Toughness: quench 780 = 10 and 1 crack = 10 tie: the quench comes first.
    expect(tough(ended('knife', T, { quenchC: 780, extra: [strike('hit', 0, 0, true)] })).why).toBe('hurt most by the quench heat');
    // Toughness: out of heat 2.5 s = 10 ties the crack = 10: out of heat first.
    expect(tough(ended('knife', T, { lost: { 'out-of-band': 5 }, extra: [strike('hit', 0, 0, true)] })).why).toBe('hurt most by 3 s out of the working heat');
    // Balance: 5 missing = 15 ties 1 slag = 15: missing first.
    const five = ended('knife', B, { offs: { 0: [], 1: [], 2: [0] }, slagLeft: 1 });
    expect(balance(five).why).toBe('hurt most by 5 hits missing');
  });

  it('says what the ore did when nothing was deducted', () => {
    expect(edge(ended('knife', { ore3: 4, ore2: 1 })).why).toBe('helped by the Starmetal in the mix');
    expect(tough(ended('knife', { ore3: 4, ore2: 1 })).why).toBe('helped by the Ridge Iron in the mix');
    expect(balance(ended('knife', { ore3: 4, ore2: 1 })).why).toBe('helped by the Ridge Iron in the mix');
    // Ties go to the first ore in ores.json: Bog Iron and Starmetal both give Balance 0.85.
    expect(balance(ended('sword', { ore3: 4, ore1: 4 })).why).toBe('helped by the Bog Iron in the mix');
  });
});

describe('words', () => {
  it.each([
    ['edge', 0, 'Dull'], ['edge', 39, 'Dull'], ['edge', 40, 'Fair'], ['edge', 59, 'Fair'], ['edge', 60, 'Sharp'], ['edge', 74, 'Sharp'], ['edge', 75, 'Keen'], ['edge', 89, 'Keen'], ['edge', 90, 'Razor'], ['edge', 100, 'Razor'],
    ['toughness', 39, 'Brittle'], ['toughness', 40, 'Fair'], ['toughness', 59, 'Fair'], ['toughness', 60, 'Sound'], ['toughness', 74, 'Sound'], ['toughness', 75, 'Sturdy'], ['toughness', 89, 'Sturdy'], ['toughness', 90, 'Unyielding'],
    ['balance', 39, 'Clumsy'], ['balance', 40, 'Fair'], ['balance', 59, 'Fair'], ['balance', 60, 'Steady'], ['balance', 74, 'Steady'], ['balance', 75, 'True'], ['balance', 89, 'True'], ['balance', 90, 'Perfect'],
  ] as const)('%s %i is %s', (stat, value, word) => {
    expect(statWord(stat, value)).toBe(word);
  });

  it('reads the word of the computed value', () => {
    expect(edge(ended('knife', { ore1: 4, ore2: 1 })).word).toBe('Keen'); // 77
    expect(tough(ended('knife', { ore3: 4, ore2: 1 })).word).toBe('Sturdy'); // 77
  });
});

describe('which stats an item has', () => {
  it('gives a horseshoe only toughness and balance', () => {
    const s = statsFor(ended('horseshoe', { ore2: 2, ore1: 1 }));
    expect(Object.keys(s)).toEqual(['toughness', 'balance']);
  });

  it('adds stats to a finished grade and none to a ruin', () => {
    const done = ended('knife', KNIFE_MIX, { slagLeft: 1 });
    const g = grade(done) as Graded;
    expect(g.stats).toEqual(statsFor(done));
    const ruin = grade({ ...done, ruin: 'cracked' });
    expect(ruin.ruined).toBe(true);
    expect('stats' in ruin).toBe(false);
  });
});
