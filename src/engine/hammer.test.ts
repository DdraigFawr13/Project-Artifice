import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { allWorked, createCraft, currentRound, PASSES, step, type CraftState, type Input } from './craft';
import { liveLines, pointsLost } from './grade';

// J3 through the craft: targets, strikes, ruin, burning and the live lines (S3 "Settled at S3 start").
const knife = itemById('knife');
const ALLOY = knife.defaultAlloy;

function run(s: CraftState, inputs: Input[]): CraftState {
  for (const i of inputs) s = step(s, i);
  return s;
}
/** A knife with its slag cleared, for checks that strike targets directly (S3). */
const fresh = (seed: number, item = 'knife', alloy = ALLOY): CraftState => ({ ...createCraft(seed, item, alloy), slag: [] });
const toAnvil: Input[] = [{ grab: true }, { drop: 'anvil' }];
const at = (s: CraftState, temp: number): CraftState => ({ ...s, temp });

describe('craft with strikes', () => {
  it('moves each target by whole px, at most 3, from the seed', () => {
    const a = fresh(7, 'knife', ALLOY);
    const b = fresh(8, 'knife', ALLOY);
    expect(a.targets).toHaveLength(knife.targets.length);
    a.targets.forEach((t, i) => {
      const base = knife.targets[i]!;
      expect(Number.isInteger(t.x) && Number.isInteger(t.y)).toBe(true);
      expect(Math.abs(t.x - base.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(t.y - base.y)).toBeLessThanOrEqual(3);
      expect(t.hits).toBe(0);
    });
    expect(a.targets).not.toEqual(b.targets);
  });

  it('marks a target struck on the anvil, and ignores strikes elsewhere', () => {
    let s = fresh(1, 'knife', ALLOY);
    const t0 = s.targets[0]!;
    s = step(s, { strike: { x: t0.x, y: t0.y } }); // in the fire
    expect(s.strikes).toHaveLength(0);
    s = at(run(s, toAnvil), 950);
    s = step(s, { strike: { x: t0.x, y: t0.y } });
    expect(s.strikes).toHaveLength(1);
    expect(s.strikes[0]).toMatchObject({ kind: 'hit', target: 0, lines: [] });
    expect(s.targets[0]!.hits).toBe(1);
    // The same spot again in round 1 is a repeat.
    s = step(at(s, 950), { strike: { x: t0.x, y: t0.y } });
    expect(s.strikes[1]!.kind).toBe('repeat');
  });

  it('works in rounds: round 2 opens only when every target has its first hit, and a worked piece takes no more', () => {
    expect(PASSES).toBe(2);
    let s = at(run(fresh(5, 'knife', ALLOY), toAnvil), 950);
    const hit = (i: number) => {
      const t = s.targets[i]!;
      s = step(at(s, 950), { strike: { x: t.x, y: t.y } });
      return s.strikes[s.strikes.length - 1]!;
    };
    expect(currentRound(s)).toBe(1);
    for (let i = 0; i < 8; i++) expect(hit(i).kind).toBe('hit');
    expect(currentRound(s)).toBe(1);
    expect(hit(0).kind).toBe('repeat'); // target 8 still lacks its first hit
    expect(s.targets[0]!.hits).toBe(1);
    expect(hit(8).kind).toBe('hit');
    expect(currentRound(s)).toBe(2);
    expect(hit(3)).toMatchObject({ kind: 'hit', target: 3 });
    expect(s.targets[3]!.hits).toBe(2);
    expect(hit(3).kind).toBe('repeat'); // done for round 2
    for (let i = 0; i < 9; i++) if (i !== 3) expect(hit(i).kind).toBe('hit');
    expect(allWorked(s)).toBe(true);
    expect(currentRound(s)).toBe(2);
    expect(hit(5).kind).toBe('repeat');
    expect(s.targets.every((t) => t.hits === 2)).toBe(true);
  });

  it('scores a strike at its step\'s temperature, before the heat changes', () => {
    // Exactly at the band's lower edge: after this step's cooling it would be a cold strike.
    const base = run(fresh(1, 'knife', ALLOY), toAnvil);
    const edge = base.props.bandLowC;
    let s = at(base, edge);
    const t0 = s.targets[0]!;
    s = step(s, { strike: { x: t0.x, y: t0.y } });
    expect(s.strikes[0]!.lines.find((l) => l.cause === 'cold-strike')).toBeUndefined();
    expect(s.temp).toBeLessThan(edge);
  });

  it('ends the craft as cracked on the 3rd hit in the black band, after scoring it', () => {
    let s = run(fresh(1, 'knife', ALLOY), toAnvil);
    for (let i = 0; i < 2; i++) {
      const t = s.targets[i]!;
      s = step(at(s, 300), { strike: { x: t.x, y: t.y } });
    }
    expect(s.location).toBe('anvil');
    s = step(at(s, 300), { strike: { x: 0, y: 0 } }); // wild: misses the metal, doesn't count
    expect(s.ruin).toBeNull();
    const t = s.targets[2]!;
    s = step(at(s, 300), { strike: { x: t.x, y: t.y } });
    expect(s.strikes).toHaveLength(4);
    expect(s).toMatchObject({ location: 'done', ruin: 'cracked' });
    expect(step(s, { strike: { x: t.x, y: t.y } })).toBe(s);
  });

  it('accrues out-of-band on the anvil and burning anywhere, per second, and flags burning', () => {
    // 1 s on the anvil held below the band: −2.
    let s = run(fresh(1, 'knife', ALLOY), toAnvil);
    const start = s.lost['out-of-band'] ?? 0; // the drop step itself lands on the anvil at 20 °C
    for (let i = 0; i < 62; i++) s = step(at(s, 600), { none: true });
    expect(s.lost['out-of-band']! - start).toBeCloseTo(2 * 62 * 0.016, 5);
    expect(s.burning).toBe(false);
    // In the fire, white heat burns (−5 per second) but isn't charged as out of band.
    let f = fresh(1, 'knife', ALLOY);
    for (let i = 0; i < 10; i++) f = step(at(f, 1250), { none: true });
    expect(f.burning).toBe(true);
    expect(f.lost.burning).toBeCloseTo(5 * 10 * 0.016, 5);
    expect(f.lost['out-of-band'] ?? 0).toBe(0);
  });

  it('gives live lines per cause, rounded, without zeros, and their total', () => {
    let s = at(run(fresh(3, 'knife', ALLOY), toAnvil), 950);
    const [a, b] = s.targets;
    s = step(s, { strike: { x: a!.x + 5, y: a!.y } }); // −2 off-centre
    s = step(at(s, 700), { strike: { x: b!.x + 4.6, y: b!.y } }); // −1.6 off-centre, −4 cold
    s = step(at(s, 950), { strike: { x: 0, y: 0 } }); // −2 wild
    const lines = liveLines(s);
    expect(lines).toEqual([
      { cause: 'off-centre', points: 4 },
      { cause: 'wild-strike', points: 2 },
      { cause: 'cold-strike', points: 4 },
    ]);
    expect(pointsLost(s)).toBe(10);
  });
});
