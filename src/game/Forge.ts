import * as Phaser from 'phaser';
import { look } from '../data/heatBands';
import feel from '../data/feel.json';
import hints from '../data/hints.json';
import { itemById, type AlloyMix, type Item } from '../data/items';
import grading from '../data/grading.json';
import { cleanStreak, createCraft, currentRound, step, STEP_MS, type CraftState, type Input } from '../engine/craft';
import { grade, pointsLost } from '../engine/grade';
import { forceFromHold, idealForce } from '../engine/strike';
import { recordCraft, writeSave } from '../save/save';
import type { ResultData } from './Result';
import { mulberry32, type Rng } from '../engine/rng';
import { debugEnabled, setForgeDebug, takeDebugSeed, type CssBox } from '../ui/debug';
import { showForgePanel, type ForgeMode, type ForgePanel } from '../ui/forge';
import { CLOSE_LINE_Y } from './closeLayout';
import type { GameContext } from './context';
import { OUTLINE_RGB, outline, scaled, shapesFor, worked, WIDE_SCALE, type PieceShapes, type Raster } from './shapes';
import { CONTENT_BOTTOM_Y, CONTENT_MID_Y, FIRE_GLOW, inside, REST, WATER, ZONES } from './wideLayout';

const BG_W = 400;
/** Hints show the first 3 times a step is reached (forge spec, Data → hints.json). */
const HINT_TIMES = 3;
/** Real time is capped per frame so a stalled tab doesn't run a burst of steps. */
const MAX_FRAME_MS = 250;
/** Smallest hit area around the piece: 44 CSS px at the Pixel's ×3 on 2.4375 dpr is about 36 game px. */
const MIN_HIT = 36;
const SPARK = 0xfdd479; // --fire-5
const FORGE_GLOW = 0xf87f33; // --fire-3
const INK = 0xead59c; // --ink: targets still open this round
const RING = 0xfdd479; // --fire-5: where the strike will land
/** A strike's points show for this long, advancing with engine steps (S3). */
const POINTS_S = 0.8;
/** After a craft ends, the last view stays this long (so a ruin's last points show) before the result or ruin screen. */
const END_S = 0.8;
/** After a quench the tub holds the screen longer: steam bursts, the piece sinks and its glow dies (Morgan, S5 playtest). */
const QUENCH_S = 1.6;
/** The piece turns tip-down over the water and slides in, its whole length going under in this long. */
const SINK_S = 1.1;
/** A ring spreads on the water from the plunge for this long. */
const RIPPLE_S = 0.7;
/** Steam puffs per 100 °C of the quench heat: a hotter quench boils harder. */
const STEAM_PER_100C = 3;
const STEAM = 0xead59c; // --ink: pale steam over the dark tub
/** Target squares: 11 game px, about the mock-up's 14 CSS px on the Pixel (1.23 CSS px per game px). */
const TARGET_PX = 11;
const PIT = 0x0d091b; // --night-0: a slag pit
const PIT_EDGE = 0x30161c; // --ember-0: its faint ember rim
const SCALE = 0x8a8494; // grey scale knocked out of a pit

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number }
interface Popup { set(progress: number): void; age: number }

/**
 * The forge: the wide view for the fire (forge spec S2; mock-up frame 3) and the close-up anvil view for hammering
 * (S3; mock-up frame 4). Shows the engine's state; never computes a rule.
 */
export class Forge extends Phaser.Scene {
  private item!: Item;
  /** The mix this craft uses, from the alloy screen or the result's "Forge another" (S5). */
  private alloy!: AlloyMix;
  private craft!: CraftState;
  private queue: Input[] = [];
  private carryMs = 0;
  private paused = false;
  private pinned: number | null = null;

  private panel!: ForgePanel;
  private bgX = 0;
  private bgY = 0;
  private closeX = 0;
  private closeY = 0;
  // The piece as worked so far (shapes.ts), drawn at close size and at wide size; repainted when a target is struck.
  private shapes!: PieceShapes;
  private shapeKey = '';
  private closeR!: Raster;
  private wideR!: Raster;
  private closeFill!: Phaser.GameObjects.Image;
  private closeEdge!: Phaser.GameObjects.Image;
  private wideFill!: Phaser.GameObjects.Image;
  private wideEdge!: Phaser.GameObjects.Image;
  private mode: ForgeMode = 'wide';
  private sparkGfx!: Phaser.GameObjects.Graphics;
  private metalGlow!: Phaser.GameObjects.Image;
  private fireGlow!: Phaser.GameObjects.Image;
  private bg!: Phaser.GameObjects.Image;
  private bgClose!: Phaser.GameObjects.Image;
  private targetGfx!: Phaser.GameObjects.Graphics;
  private ringGfx!: Phaser.GameObjects.Graphics;

  private sparks: Spark[] = [];
  private steam: Puff[] = [];
  private steamGfx!: Phaser.GameObjects.Graphics;
  /** Grey scale flung out when a slag spot clears (S3); its own list, seeded from the spark generator. */
  private dust: Puff[] = [];
  private scaleGfx!: Phaser.GameObjects.Graphics;
  /** True once the piece has gone into the water. */
  private plunged = false;
  private sinkS = 0;
  private sparkRng!: Rng;
  private flickerRng!: Rng;
  private flicker = 1;
  private draft = 0; // the bellows' effect on the forge, eased 0–1

  private dragging = false;
  private dragPointer = -1;
  private panelObserver?: ResizeObserver;
  private dragOffset = { x: 0, y: 0 };
  private heldPos = { x: 0, y: 0 };

  // A strike in the close view: the finger that is down and where its ring is, in game px.
  private strikePointer = -1;
  private ring: { x: number; y: number } | null = null;
  private seenStrikes = 0;
  private popups: Popup[] = [];
  /** The last strike's first hammer play, for the debug API. */
  private lastSound: { key: string; rate: number; perfect: boolean } | null = null;
  private hammerHintCounted = false;
  private forceHintShown = false;
  private hammerHintShown = false;
  private slagHintShown = false;
  /** Engine steps the striking finger has been down, for the force ring and the strike's force (S2). */
  private holdSteps = 0;
  private quenchHintCounted = false;
  private layoutPending = false;
  /** True from a Quench press until the piece is dropped on the fire or anvil: the held piece is shown for the quench. */
  private quenching = false;
  /** Set once the craft has ended and the save is written; then the engine time since. */
  private ended: ResultData | null = null;
  private endedS = 0;
  private leaving = false;

  private fireSound?: Phaser.Sound.BaseSound;
  private bellowsSound?: Phaser.Sound.BaseSound;
  private hum?: { osc: OscillatorNode; gain: GainNode; ctx: AudioContext };

  constructor(private readonly ctx: GameContext) {
    super('Forge');
  }

  init(data: { itemId: string; alloy: AlloyMix }): void {
    this.item = itemById(data.itemId);
    this.alloy = { ...data.alloy };
    this.queue = [];
    this.carryMs = 0;
    this.paused = false;
    this.pinned = null;
    this.sparks = [];
    this.steam = [];
    this.dust = [];
    this.plunged = false;
    this.sinkS = 0;
    this.dragging = false;
    this.draft = 0;
    this.flicker = 1;
    this.mode = 'wide';
    this.strikePointer = -1;
    this.ring = null;
    this.holdSteps = 0;
    this.seenStrikes = 0;
    this.popups = [];
    this.lastSound = null;
    this.hammerHintCounted = false;
    this.quenchHintCounted = false;
    this.layoutPending = false;
    this.quenching = false;
    this.ended = null;
    this.endedS = 0;
    this.leaving = false;
  }

  create(): void {
    // The view takes the seed from the clock; the engine never reads it (GAME-01).
    const seed = takeDebugSeed() ?? Date.now() >>> 0;
    this.craft = createCraft(seed, this.item.id, this.alloy);
    this.ctx.lastMix[this.item.id] = { ...this.alloy };
    this.sparkRng = mulberry32(seed ^ 0x5eed);
    this.flickerRng = mulberry32(seed ^ 0xf1c4);
    this.shapes = shapesFor(this.item.id);
    this.shapeKey = '';

    // Hint counts stay in memory until the craft ends (S4 writes them). The hammer hint counts when the anvil is reached.
    const seen = this.ctx.load.save.hintsSeen;
    const heatHint = (seen.heat ?? 0) < HINT_TIMES ? hints.heat : null;
    // The hammer hint and the force hint (S2) each show their first 3 times, side by side; each counts when shown.
    // The close panel shows at most 2 due hints, in the order hammer, force, slag (S3).
    const due = (['hammer', 'force', 'slag'] as const).filter((k) => (seen[k] ?? 0) < HINT_TIMES).slice(0, 2);
    this.hammerHintShown = due.includes('hammer');
    this.forceHintShown = due.includes('force');
    this.slagHintShown = due.includes('slag');
    const forceHint = this.forceHintShown ? hints.force : null;
    const hammerHint = this.hammerHintShown ? hints.hammer : null;
    const slagHint = this.slagHintShown ? hints.slag : null;
    const quenchHint = (seen.quench ?? 0) < HINT_TIMES ? hints.quench : null;
    seen.heat = (seen.heat ?? 0) + 1;

    this.panel = showForgePanel(this.item.name, { heat: heatHint, hammer: hammerHint, force: forceHint, slag: slagHint, quench: quenchHint }, {
      bellows: (down) => this.queue.push({ bellows: down }),
      move: () => {
        if (this.dragging || this.pendingMove()) return;
        const from = this.craft.location;
        if (from !== 'fire' && from !== 'anvil') return;
        // The bar is held for one step on its way; draw it where it rests, not where the last drag left it.
        const r = REST[from];
        this.heldPos = { x: this.bgX + r.x, y: this.bgY + r.y };
        this.queue.push({ bellows: false }, { grab: true }, { drop: from === 'fire' ? 'anvil' : 'fire' });
      },
      back: () => {
        if (this.craft.location !== 'anvil' || this.pendingMove()) return;
        this.cancelStrike();
        // Held for one step on its way: draw it at the anvil in the wide view, not where a drag last left it.
        this.heldPos = { x: this.bgX + REST.anvil.x, y: this.bgY + REST.anvil.y };
        this.queue.push({ grab: true }, { drop: 'fire' });
      },
      quench: () => {
        // Pick the piece up off the anvil or out of the fire: the wide view shows it in hand where it was, cooling
        // (S4; mock-up frame 5; from the fire too, Morgan's S4 playtest).
        const from = this.craft.location;
        if ((from !== 'anvil' && from !== 'fire') || this.dragging || this.pendingMove()) return;
        this.cancelStrike();
        this.heldPos = { x: this.bgX + REST[from].x, y: this.bgY + REST[from].y };
        this.quenching = true;
        this.queue.push({ bellows: false }, { grab: true });
      },
      putBack: () => {
        if (this.craft.location !== 'held' || this.dragging || this.pendingMove()) return;
        this.queue.push({ drop: this.craft.heldFrom });
      },
    });

    this.ensureGlowTexture();
    this.bg = this.add.image(0, 0, 'wide').setOrigin(0, 0);
    this.bgClose = this.add.image(0, 0, 'close').setOrigin(0, 0).setVisible(false);
    this.fireGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(FORGE_GLOW);
    this.metalGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD);
    this.makePieceTextures();
    this.wideEdge = this.add.image(0, 0, 'piece-wide-edge');
    this.wideFill = this.add.image(0, 0, 'piece-wide-fill');
    this.closeEdge = this.add.image(0, 0, 'piece-close-edge').setOrigin(0, 0);
    this.closeFill = this.add.image(0, 0, 'piece-close-fill').setOrigin(0, 0);
    this.paintPiece();
    this.targetGfx = this.add.graphics();
    this.ringGfx = this.add.graphics();
    this.sparkGfx = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.steamGfx = this.add.graphics();
    this.scaleGfx = this.add.graphics();
    this.layout();
    this.scale.on('resize', this.layout, this);
    // The panel changes height when the Burning alert replaces the intro; keep the scene between the bars.
    this.panelObserver = new ResizeObserver(() => this.layout());
    this.panelObserver.observe(this.panel.panel);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUpOutside, this);

    this.startSound();
    if (debugEnabled()) this.registerDebug();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.draw();
  }

  update(_time: number, delta: number): void {
    if (!this.paused) this.run(Math.min(delta, MAX_FRAME_MS));
    this.draw();
  }

  /** Run the fixed step for `ms` of time; a part step carries over. */
  private run(ms: number): void {
    this.carryMs += ms;
    while (this.carryMs >= STEP_MS) {
      this.carryMs -= STEP_MS;
      // A pinned temperature holds before the step too, so a strike scores at the pinned heat.
      if (this.pinned !== null) this.craft = { ...this.craft, temp: this.pinned };
      this.craft = step(this.craft, this.queue.shift() ?? { none: true });
      if (this.pinned !== null) this.craft = { ...this.craft, temp: this.pinned };
      // Force counts engine steps while the finger is down, so pause() and advance() control it (GAME-02).
      if (this.strikePointer >= 0) this.holdSteps++;
      this.answerStrikes();
      this.tickEffects();
      if (this.craft.location === 'done') {
        if (!this.ended) this.end();
        this.endedS += STEP_MS / 1000;
        if (this.endedS >= (this.craft.quenchC !== null ? QUENCH_S : END_S) && !this.leaving) {
          this.leaving = true;
          this.scene.start('Result', this.ended!);
          return;
        }
      }
    }
  }

  /** The craft has ended: grade it, write the save once (bests, scrap, hint counts), and hiss if it went in the tub. */
  private end(): void {
    const g = grade(this.craft);
    const r = recordCraft(this.ctx.load.save, this.item.id, g.ruined ? { ruined: true, scrapParts: g.scrapParts } : { ruined: false, score: g.score, stats: Object.fromEntries(Object.entries(g.stats).map(([k, v]) => [k, v.value])) });
    this.ctx.load.save = r.save;
    // Never write over a save that couldn't be read or kept aside (GAME-05); a failed write stops later ones too.
    const saved = this.ctx.load.saving && writeSave(this.ctx.storage, r.save);
    this.ctx.load.saving = saved;
    this.ended = { itemId: this.item.id, alloy: this.alloy, graded: g, hits: this.craft.targets.map((t) => t.hits), newBest: r.newBest, previousBest: r.previousBest, saved };
    if (this.craft.quenchC !== null) {
      this.sound.play('hiss', { volume: 0.7 });
      this.plunged = true;
      const n = Math.round((this.craft.quenchC / 100) * STEAM_PER_100C);
      for (let i = 0; i < n; i++) this.puff(1);
    }
    this.dragging = false;
    this.cancelStrike();
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  /** Centre the fire-to-tub area between the top bar and the panel, as in mock-up frame 3. */
  private layout(): void {
    // Don't move the scene under a finger that is aiming or dragging; lay out again when it lifts. A panel that
    // changed height mid-drag moved the tub away from the finger, and the drop missed it.
    if (this.strikePointer >= 0 || this.dragging) {
      this.layoutPending = true;
      return;
    }
    this.layoutPending = false;
    const W = this.scale.width;
    const H = this.scale.height;
    const k = this.gamePerCss();
    const topG = this.panel.top.getBoundingClientRect().height * k;
    const panelG = this.panel.panel.getBoundingClientRect().height * k;
    const mid = (topG + (H - panelG)) / 2;
    let y = Math.round(mid - CONTENT_MID_Y);
    // The painted floor reaches the panel, so no faded strip shows above it (mock-up frame 3).
    y = Math.max(y, Math.ceil(H - panelG - CONTENT_BOTTOM_Y));
    y = Math.min(y, Math.floor(topG));
    this.bgX = Math.round((W - BG_W) / 2);
    this.bgY = y;
    this.bg.setPosition(this.bgX, this.bgY);
    // The close-up: the anvil face's blade line centred between the bars, the image top never below the top bar.
    this.closeX = this.bgX;
    this.closeY = Math.min(Math.round(mid - CLOSE_LINE_Y), Math.floor(topG));
    this.bgClose.setPosition(this.closeX, this.closeY);
  }

  private gamePerCss(): number {
    const r = this.game.canvas.getBoundingClientRect();
    return r.width > 0 ? this.game.canvas.width / r.width : 1;
  }

  /** The piece's centre and tip direction in game px. */
  private piecePos(): { x: number; y: number; dir: number } {
    const loc = this.craft.location;
    if (this.dragging || loc === 'held') return { ...this.heldPos, dir: this.craft.heldFrom === 'fire' ? -1 : 1 };
    const r = loc === 'anvil' ? REST.anvil : REST.fire;
    return { x: this.bgX + r.x, y: this.bgY + r.y, dir: r.dir };
  }

  /** The piece's box in game px, in whichever view shows it (its raster's box, outline included). */
  private pieceBox(): { x: number; y: number; w: number; h: number } {
    if (this.plunged && this.bg.visible) {
      // Tip-down in the tub: the part still above the water.
      const { w, h } = this.wideR;
      return { x: Math.round(this.bgX + WATER.x - h / 2), y: Math.round(this.bgY + WATER.y - w + this.underwater()), w: h, h: Math.max(0, Math.round(w - this.underwater())) };
    }
    if (this.bgClose.visible) return { x: this.closeX + this.closeR.x, y: this.closeY + this.closeR.y, w: this.closeR.w, h: this.closeR.h };
    const p = this.piecePos();
    const { w, h } = this.wideR;
    return { x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2), w, h };
  }

  // ── The piece's shape: bar stock, shaped stretch by stretch as targets are struck ──

  private makePieceTextures(): void {
    const s = this.shapes.final;
    const k = WIDE_SCALE[this.item.id] ?? 0.45;
    const sizes = { close: [s.w, s.h], wide: [Math.max(1, Math.round(s.w * k)), Math.max(1, Math.round(s.h * k))] } as const;
    for (const view of ['close', 'wide'] as const) {
      for (const layer of ['fill', 'edge'] as const) {
        const key = `piece-${view}-${layer}`;
        if (this.textures.exists(key)) this.textures.remove(key);
        this.textures.createCanvas(key, sizes[view][0], sizes[view][1]);
      }
    }
  }

  /** Repaint both views' textures when a target's hits change: grey shading (tinted at draw) and a dark outline. */
  private paintPiece(): void {
    const hits = this.craft.targets.map((t) => t.hits);
    const key = hits.join('');
    if (key === this.shapeKey) return;
    this.shapeKey = key;
    this.closeR = worked(this.shapes, hits);
    this.wideR = scaled(this.closeR, WIDE_SCALE[this.item.id] ?? 0.45);
    const paint = (r: Raster, view: 'close' | 'wide') => {
      const edge = outline(r);
      for (const layer of ['fill', 'edge'] as const) {
        const tex = this.textures.get(`piece-${view}-${layer}`) as Phaser.Textures.CanvasTexture;
        const img = tex.context.createImageData(r.w, r.h);
        for (let i = 0; i < r.w * r.h; i++) {
          const v = r.shade[i]!;
          if (layer === 'fill' && v > 0) img.data.set([v * 255, v * 255, v * 255, 255], i * 4);
          if (layer === 'edge' && edge[i]) img.data.set([...OUTLINE_RGB, 255], i * 4);
        }
        tex.context.putImageData(img, 0, 0);
        tex.refresh();
      }
    };
    paint(this.closeR, 'close');
    paint(this.wideR, 'wide');
  }

  private viewMode(): ForgeMode {
    const loc = this.craft.location;
    if (loc === 'done') return 'done';
    // The quench ends once the piece lands on the fire or the anvil and no pick-up is still queued.
    if (this.quenching && (loc === 'fire' || loc === 'anvil') && !this.dragging && !this.pendingMove()) this.quenching = false;
    if (this.quenching && loc === 'held') return 'quench';
    return loc === 'anvil' && !this.dragging ? 'close' : 'wide';
  }

  // ── Input: dragging the piece ─────────────────────────────────────────────

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.mode === 'close') {
      // Only the first finger strikes; its ring shows above it and follows it (forge spec, Engine; S3).
      if (this.strikePointer >= 0 || this.pendingMove()) return;
      this.strikePointer = p.id;
      this.holdSteps = 0;
      this.ring = { x: Math.round(p.x), y: Math.round(p.y - grading.strike.offsetPx) };
      return;
    }
    if (this.mode !== 'wide' && this.mode !== 'quench') return;
    const loc = this.craft.location;
    // `location` lags the queue by a step or two; a move already queued wins. In the quench the piece is already held.
    const canTake = this.mode === 'quench' ? loc === 'held' : loc === 'fire' || loc === 'anvil';
    if (this.dragging || this.pendingMove() || !canTake) return;
    const b = this.pieceBox();
    const padX = Math.max(8, (MIN_HIT - b.w) / 2);
    const padY = Math.max(8, (MIN_HIT - b.h) / 2);
    if (p.x < b.x - padX || p.x > b.x + b.w + padX || p.y < b.y - padY || p.y > b.y + b.h + padY) return;
    const c = this.piecePos();
    this.dragOffset = { x: c.x - p.x, y: c.y - p.y };
    this.heldPos = { x: c.x, y: c.y };
    this.dragging = true;
    this.dragPointer = p.id;
    if (this.mode === 'wide') this.queue.push({ bellows: false }, { grab: true });
  }

  private pendingMove(): boolean {
    return this.queue.some((i) => 'grab' in i || 'drop' in i);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id === this.strikePointer && this.ring) {
      this.ring = { x: Math.round(p.x), y: Math.round(p.y - grading.strike.offsetPx) };
      return;
    }
    if (!this.dragging || p.id !== this.dragPointer) return;
    this.heldPos = { x: Math.round(p.x + this.dragOffset.x), y: Math.round(p.y + this.dragOffset.y) };
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.strikePointer) {
      // The strike lands at the ring at the moment of lift, in close-view game px.
      const r = this.ring;
      const force = forceFromHold(this.holdSteps);
      this.cancelStrike();
      if (r && this.mode === 'close') this.queue.push({ strike: { x: r.x - this.closeX, y: r.y - this.closeY, force } });
      return;
    }
    if (!this.dragging || p.id !== this.dragPointer) return;
    this.dragging = false;
    if (this.craft.location !== 'done') {
      // Where the finger lets go decides; the piece's centre counts only when the finger is over no zone. Judged by the
      // centre alone, a piece grabbed near one end missed the tub with the finger over the water (Morgan, S5 playtest).
      const zoneAt = (x: number, y: number) => (['fire', 'anvil', 'tub'] as const).find((z) => inside(ZONES[z], x - this.bgX, y - this.bgY));
      const zone = zoneAt(p.x, p.y) ?? zoneAt(this.heldPos.x, this.heldPos.y);
      // Anywhere else, the piece goes back where it came from (forge spec, Engine).
      this.queue.push({ drop: zone ?? this.craft.heldFrom });
    }
    // Judged against the scene the player saw; only now does a layout held back by the drag move it.
    if (this.layoutPending) this.layout();
  }

  /** A lift over the panel or off the canvas cancels a strike; a drag still drops. */
  private onUpOutside(p: Phaser.Input.Pointer): void {
    if (p.id === this.strikePointer) this.cancelStrike();
    else this.onUp(p);
  }

  private cancelStrike(): void {
    this.strikePointer = -1;
    this.ring = null;
    this.holdSteps = 0;
    if (this.layoutPending) this.layout();
  }

  /** Every new strike answers at once: sparks, the hammer sound, and its points rising from it (UI_STYLE Controls). */
  private answerStrikes(): void {
    const all = this.craft.strikes;
    for (; this.seenStrikes < all.length; this.seenStrikes++) {
      const s = all[this.seenStrikes]!;
      const gx = this.closeX + s.x;
      const gy = this.closeY + s.y;
      const n = 6 + Math.floor(this.sparkRng.next() * 5);
      for (let i = 0; i < n; i++) {
        const max = 0.2 + this.sparkRng.next() * 0.3;
        const a = Math.PI * (1 + this.sparkRng.next());
        const v = 40 + this.sparkRng.next() * 60;
        this.sparks.push({ x: gx, y: gy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max });
      }
      // The hammer's rate says where the strike landed against the working heat; a wild one rings the anvil (rate 1).
      const rate = s.kind === 'wild' ? 1 : feel.hammerRate[s.heat];
      this.sound.play('hammer', { volume: s.kind === 'light' ? feel.lightVolume : 0.6, rate });
      let ring = false;
      if (s.perfect) {
        this.sound.play('hammer', { volume: feel.perfectVolume, rate: feel.perfectRate });
        ring = true;
      }
      // `perfect` records that the second ring played, so a check can tell it was heard.
      this.lastSound = { key: 'hammer', rate, perfect: ring };
      const pts = Math.round(s.lines.reduce((t, l) => t + l.points, 0));
      const k = 1 / this.gamePerCss();
      // Only the newest strike's points show, so quick strikes don't pile their numbers on each other.
      for (const old of this.popups) old.set(1);
      this.popups = [];
      const hard = s.lines.some((l) => l.cause === 'hard-strike');
      // First match wins (S3 "Settled at S3 start").
      const words =
        s.kind === 'light' ? 'Too light'
        : s.kind === 'blocked' ? `Slag first −${pts}`
        : s.kind === 'slag' ? (pts === 0 ? 'Slag out' : `Slag out −${pts}`)
        : hard ? `Too hard −${pts}`
        : s.perfect ? 'Perfect'
        : pts === 0 ? 'Clean'
        : `−${pts}`;
      if (s.kind === 'slag') {
        for (let i = 0; i < 7; i++) {
          const max = 0.3 + this.sparkRng.next() * 0.3;
          const a = Math.PI * (1 + this.sparkRng.next());
          const v = 20 + this.sparkRng.next() * 30;
          this.dust.push({ x: gx, y: gy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1 + this.sparkRng.next(), life: max, max });
        }
      }
      this.popups.push({ set: this.panel.addPoints(words, gx * k, (gy - 6) * k), age: 0 });
    }
  }

  // ── Effects that advance with engine steps, so pause() freezes them ──────

  private tickEffects(): void {
    const dt = STEP_MS / 1000;
    const inFire = this.craft.location === 'fire';
    const target = this.craft.bellows && inFire ? 1 : 0;
    this.draft += (target - this.draft) * Math.min(1, dt * 4);
    this.flicker = Math.min(1, Math.max(0.82, this.flicker + (this.flickerRng.next() - 0.5) * 0.05));

    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 140 * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    if (this.plunged) {
      this.sinkS += dt;
      // The boil settles as the piece sinks: a puff now and then until it is under.
      if (this.sinkS < SINK_S && this.sparkRng.next() < 14 * dt * (1 - this.sinkS / SINK_S)) this.puff(0.5);
    }
    for (const p of this.steam) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= 1 - 0.8 * dt;
      p.r += 7 * dt;
      p.life -= dt;
    }
    this.steam = this.steam.filter((p) => p.life > 0);
    for (const p of this.dust) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      p.life -= dt;
    }
    this.dust = this.dust.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.age += dt;
      p.set(Math.min(1, p.age / POINTS_S));
    }
    this.popups = this.popups.filter((p) => p.age < POINTS_S);

    const rate = look(this.craft.temp).sparksPerSecond;
    if (rate > 0 && this.sparkRng.next() < rate * dt) {
      const b = this.pieceBox();
      const max = 0.35 + this.sparkRng.next() * 0.45;
      this.sparks.push({
        x: b.x + this.sparkRng.next() * b.w,
        y: b.y,
        vx: (this.sparkRng.next() - 0.5) * 50,
        vy: -(35 + this.sparkRng.next() * 55),
        life: max,
        max,
      });
    }
  }

  /** How much of the piece's length is under the water, in game px: fast at the plunge, slowing as it settles. */
  private underwater(): number {
    const t = Math.min(1, this.sinkS / SINK_S);
    return Math.round(this.wideR.w * (1 - (1 - t) * (1 - t)));
  }

  /** One steam puff from the water where the piece went in; `burst` 1 at the plunge, less as it settles. */
  private puff(burst: number): void {
    if (!this.plunged) return;
    const max = 0.7 + this.sparkRng.next() * 0.7;
    this.steam.push({
      x: this.bgX + WATER.x + (this.sparkRng.next() - 0.5) * WATER.halfW * 2,
      y: this.bgY + WATER.y - 2,
      vx: (this.sparkRng.next() - 0.5) * 24 * burst,
      vy: -(18 + this.sparkRng.next() * 40 * burst),
      r: 2 + this.sparkRng.next() * 2,
      life: max,
      max,
    });
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private draw(): void {
    this.setMode(this.viewMode());
    const l = look(this.craft.temp);
    const color = Phaser.Display.Color.HexStringToColor(l.color).color;
    // After a craft ends the last view stays; the close view stays for a ruin on the anvil.
    const wide = this.bg.visible;
    // Once quenched, the piece is in the water: it sinks and fades from where it went in, its glow dying with it.
    const inTub = this.craft.quenchC !== null;
    const sink = inTub ? Math.min(1, this.sinkS / SINK_S) : 0;
    const sinking = inTub && sink < 1;

    // The piece as worked so far (bar, halfway or finished by stretch), its shading tinted with the heat colour; the outline stays dark.
    this.paintPiece();
    this.closeFill.setVisible(!wide && !inTub).setPosition(this.closeX + this.closeR.x, this.closeY + this.closeR.y).setTint(color);
    this.closeEdge.setVisible(!wide && !inTub).setPosition(this.closeX + this.closeR.x, this.closeY + this.closeR.y);
    const pb = this.pieceBox();
    const flip = this.piecePos().dir < 0;
    const showWide = wide && (!inTub || sinking);
    if (inTub) {
      // Tip-down over the water: turned a quarter (the tip is the texture's right end), cropped to what is still above it.
      const { w, h } = this.wideR;
      const under = this.underwater();
      const cx = this.bgX + WATER.x;
      const cy = this.bgY + WATER.y - w / 2 + under;
      for (const img of [this.wideFill, this.wideEdge]) img.setFlipX(false).setAngle(90).setPosition(cx, cy).setCrop(0, 0, Math.max(0, w - under), h);
      this.wideFill.setTint(color);
    } else {
      for (const img of [this.wideFill, this.wideEdge]) img.setAngle(0).setCrop().setFlipX(flip).setPosition(pb.x + pb.w / 2, pb.y + pb.h / 2);
      this.wideFill.setTint(color);
    }
    this.wideFill.setVisible(showWide);
    this.wideEdge.setVisible(showWide);
    if (!wide) this.drawClose(color);
    else {
      this.targetGfx.clear();
      this.ringGfx.clear();
    }

    // The metal's glow: its band's radius and colour, as strong as the metal is bright (forge spec, Screens).
    const b = this.pieceBox();
    this.metalGlow.setVisible(l.glow > 0 && (!inTub || sinking));
    this.metalGlow.setPosition(b.x + b.w / 2, b.y + b.h / 2);
    this.metalGlow.setDisplaySize(b.w + l.glow * 4, b.h + l.glow * 4);
    this.metalGlow.setTint(color);
    this.metalGlow.setAlpha(Math.min(1, 0.2 + l.luminance) * (1 - sink) * (1 - sink));

    const f = FIRE_GLOW;
    const strength = (0.45 + 0.4 * this.draft) * this.flicker;
    this.fireGlow.setPosition(this.bgX + f.x, this.bgY + f.y);
    this.fireGlow.setDisplaySize(f.size * (0.9 + 0.25 * this.draft), f.size * (0.9 + 0.25 * this.draft));
    this.fireGlow.setAlpha(strength);
    this.fireGlow.setVisible(wide);

    this.sparkGfx.clear();
    for (const s of this.sparks) {
      this.sparkGfx.fillStyle(SPARK, Math.max(0, s.life / s.max));
      this.sparkGfx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    this.steamGfx.clear();
    if (this.plunged && this.sinkS < RIPPLE_S && wide) {
      const t = this.sinkS / RIPPLE_S;
      this.steamGfx.lineStyle(1, STEAM, 0.6 * (1 - t));
      this.steamGfx.strokeEllipse(this.bgX + WATER.x, this.bgY + WATER.y, 8 + t * WATER.halfW * 2, 3 + t * 8);
    }
    for (const p of this.steam) {
      const t = p.life / p.max;
      this.steamGfx.fillStyle(STEAM, 0.55 * t);
      this.steamGfx.fillCircle(Math.round(p.x), Math.round(p.y), Math.round(p.r));
    }
    this.scaleGfx.clear();
    for (const p of this.dust) {
      this.scaleGfx.fillStyle(SCALE, Math.max(0, p.life / p.max));
      this.scaleGfx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(p.r)), Math.max(1, Math.round(p.r)));
    }

    this.panel.update({
      mode: this.mode,
      inFire: this.craft.location === 'fire',
      held: this.craft.location === 'held' || this.dragging,
      burning: this.craft.burning,
      round: currentRound(this.craft),
      streak: cleanStreak(this.craft),
      struck: this.craft.targets.filter((t) => t.hits >= currentRound(this.craft)).length,
      targets: this.craft.targets.length,
      lost: pointsLost(this.craft),
      tub: this.mode === 'quench' ? this.tubLabelPos() : null,
      heldFrom: this.craft.heldFrom,
    });
    this.updateSound(l.humHz);
  }

  /** Above the tub's drop zone, in CSS px over the canvas. */
  private tubLabelPos(): { x: number; y: number } {
    const k = 1 / this.gamePerCss();
    const z = ZONES.tub;
    return { x: Math.round((this.bgX + z.x + z.w / 2) * k), y: Math.round((this.bgY + z.y) * k) };
  }

  /** Switch views: backgrounds, and the hammer hint's count the first time this craft reaches the anvil. */
  private setMode(mode: ForgeMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode !== 'done') {
      const wide = mode !== 'close';
      this.bg.setVisible(wide);
      this.bgClose.setVisible(!wide);
    }
    if (mode !== 'close') this.cancelStrike();
    // The quench hint counts once the piece is in hand for the quench (a craft can end before the pick-up lands).
    if (mode === 'quench' && !this.quenchHintCounted) {
      this.quenchHintCounted = true;
      const seen = this.ctx.load.save.hintsSeen;
      seen.quench = (seen.quench ?? 0) + 1;
    }
    if (mode === 'close' && !this.hammerHintCounted) {
      this.hammerHintCounted = true;
      const seen = this.ctx.load.save.hintsSeen;
      // Each hint is counted when it is shown: a new player sees where the strike lands and how force works.
      if (this.forceHintShown) seen.force = (seen.force ?? 0) + 1;
      if (this.hammerHintShown) seen.hammer = (seen.hammer ?? 0) + 1;
      if (this.slagHintShown) seen.slag = (seen.slag ?? 0) + 1;
    }
  }

  /** Targets (dashed squares while open this round), dents where strikes hit the metal, and the ring above a finger. */
  private drawClose(metalColor: number): void {
    const g = this.targetGfx;
    g.clear();
    const dent = Phaser.Display.Color.IntegerToColor(metalColor).darken(35).color;
    g.fillStyle(dent, 1);
    for (const s of this.craft.strikes) {
      if (s.kind === 'wild' || s.kind === 'light') continue;
      g.fillRect(Math.round(this.closeX + s.x) - 1, Math.round(this.closeY + s.y) - 1, 3, 3);
    }
    // Slag pits: dark ovals with a faint ember rim, between the targets (mock-up f-slag).
    for (const p of this.craft.slag) {
      if (p.cleared) continue;
      g.fillStyle(PIT_EDGE, 1);
      g.fillEllipse(this.closeX + p.x, this.closeY + p.y, 10, 8);
      g.fillStyle(PIT, 1);
      g.fillEllipse(this.closeX + p.x, this.closeY + p.y, 8, 6);
    }
    g.fillStyle(INK, 1);
    const h = Math.floor(TARGET_PX / 2);
    const round = currentRound(this.craft);
    for (const t of this.craft.targets) {
      if (t.hits >= round) continue;
      const x0 = this.closeX + t.x - h;
      const y0 = this.closeY + t.y - h;
      // Dashes of 2 px with 1 px gaps along each side.
      for (let i = 0; i < TARGET_PX; i += 3) {
        const len = Math.min(2, TARGET_PX - i);
        g.fillRect(x0 + i, y0, len, 1);
        g.fillRect(x0 + i, y0 + TARGET_PX - 1, len, 1);
        g.fillRect(x0, y0 + i, 1, len);
        g.fillRect(x0 + TARGET_PX - 1, y0 + i, 1, len);
      }
    }
    this.ringGfx.clear();
    if (this.ring && this.mode === 'close') {
      this.ringGfx.lineStyle(2, RING, 1);
      this.ringGfx.strokeCircle(this.ring.x, this.ring.y, grading.strike.reachPx);
      // The force ring: a faint full circle, and an arc filling clockwise from the top as the finger holds (S2).
      const fr = grading.strike.reachPx + 4;
      this.ringGfx.lineStyle(1, RING, 0.3);
      this.ringGfx.strokeCircle(this.ring.x, this.ring.y, fr);
      const f = forceFromHold(this.holdSteps);
      if (f > 0) {
        this.ringGfx.lineStyle(2, RING, 1);
        this.ringGfx.beginPath();
        this.ringGfx.arc(this.ring.x, this.ring.y, fr, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2, false);
        this.ringGfx.strokePath();
      }
    }
  }

  private ensureGlowTexture(): void {
    if (this.textures.exists('glow')) return;
    const size = 64;
    const tex = this.textures.createCanvas('glow', size, size);
    if (!tex) return;
    const g = tex.getContext();
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    tex.refresh();
  }

  // ── Sound: fire and bellows loops (CC0), and a hum made in code ──────────

  private startSound(): void {
    this.fireSound = this.sound.add('fire', { loop: true, volume: 0.35 });
    this.bellowsSound = this.sound.add('bellows', { loop: true, volume: 0 });
    this.fireSound.play();
    this.bellowsSound.play();
    const mgr = this.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx = mgr.context;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 80;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(mgr.destination ?? ctx.destination);
    osc.start();
    this.hum = { osc, gain, ctx };
  }

  private updateSound(humHz: number | null): void {
    const inFire = this.craft.location === 'fire';
    const wantBellows = this.craft.bellows && inFire ? 0.6 : 0;
    const vol = (s: Phaser.Sound.BaseSound | undefined, v: number) => {
      if (s && 'setVolume' in s) (s as Phaser.Sound.WebAudioSound).setVolume(v);
    };
    vol(this.bellowsSound, wantBellows);
    vol(this.fireSound, 0.3 + 0.25 * this.draft);
    if (this.hum) {
      const now = this.hum.ctx.currentTime;
      if (humHz !== null) this.hum.osc.frequency.setTargetAtTime(humHz, now, 0.05);
      this.hum.gain.gain.setTargetAtTime(humHz === null ? 0 : 0.05, now, 0.08);
    }
  }

  // ── Debug API (only with ?debug) ──────────────────────────────────────────

  private registerDebug(): void {
    setForgeDebug({
      state: () => this.craft,
      lastSound: () => this.lastSound,
      idealHold: () => Math.ceil((idealForce(this.craft.temp, this.craft.props) * grading.force.fullHoldS * 1000) / STEP_MS),
      hold: () => ({ steps: this.holdSteps, force: forceFromHold(this.holdSteps) }),
      pause: () => {
        this.paused = true;
      },
      advance: (ms) => {
        this.run(ms);
        this.draw();
      },
      send: (input) => {
        this.queue.push(input);
      },
      pinTemp: (c) => {
        this.pinned = c;
      },
      targets: () => {
        const r = this.game.canvas.getBoundingClientRect();
        const k = r.width / this.game.canvas.width;
        return this.craft.targets.map((t) => ({ x: r.left + (this.closeX + t.x) * k, y: r.top + (this.closeY + t.y) * k, hits: t.hits }));
      },
      slag: () => {
        const r = this.game.canvas.getBoundingClientRect();
        const k = r.width / this.game.canvas.width;
        return this.craft.slag.map((p) => ({ x: r.left + (this.closeX + p.x) * k, y: r.top + (this.closeY + p.y) * k, cleared: p.cleared }));
      },
      clearSlag: () => {
        this.craft = { ...this.craft, slag: this.craft.slag.map((p) => ({ ...p, cleared: true })) };
      },
      zone: (name): CssBox => {
        const r = this.game.canvas.getBoundingClientRect();
        const k = r.width / this.game.canvas.width;
        const z = ZONES[name];
        return { x: r.left + (this.bgX + z.x) * k, y: r.top + (this.bgY + z.y) * k, width: z.w * k, height: z.h * k };
      },
      metalBox: (): CssBox => {
        const r = this.game.canvas.getBoundingClientRect();
        const k = r.width / this.game.canvas.width;
        const b = this.pieceBox();
        return { x: r.left + b.x * k, y: r.top + b.y * k, width: b.w * k, height: b.h * k };
      },
    });
  }

  private cleanup(): void {
    setForgeDebug(null);
    this.panel.destroy();
    this.panelObserver?.disconnect();
    this.scale.off('resize', this.layout, this);
    this.fireSound?.destroy();
    this.bellowsSound?.destroy();
    if (this.hum) {
      this.hum.osc.stop();
      this.hum.osc.disconnect();
      this.hum.gain.disconnect();
      this.hum = undefined;
    }
  }
}
