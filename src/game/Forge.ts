import * as Phaser from 'phaser';
import { look } from '../data/heatBands';
import hints from '../data/hints.json';
import { itemById, type Item } from '../data/items';
import { defaultAlloy } from '../engine/alloy';
import { createCraft, step, STEP_MS, type CraftState, type Input } from '../engine/craft';
import { mulberry32, type Rng } from '../engine/rng';
import { debugEnabled, setForgeDebug, type CssBox } from '../ui/debug';
import { showForgePanel, type ForgePanel } from '../ui/forge';
import type { GameContext } from './context';
import { bounds, outlineFor, type Outline } from './metal';
import { CONTENT_BOTTOM_Y, CONTENT_MID_Y, FIRE_GLOW, inside, REST, ZONES } from './wideLayout';

const BG_W = 400;
/** Hints show the first 3 times a step is reached (forge spec, Data → hints.json). */
const HINT_TIMES = 3;
/** Real time is capped per frame so a stalled tab doesn't run a burst of steps. */
const MAX_FRAME_MS = 250;
/** Smallest hit area around the piece: 44 CSS px at the Pixel's ×4 on 3.25 dpr is about 36 game px. */
const MIN_HIT = 36;
const OUTLINE = 0x735b44; // --ink-dim
const SPARK = 0xfdd479; // --fire-5
const FORGE_GLOW = 0xf87f33; // --fire-3

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number }

/** The forge, wide view (forge spec S2; mock-up frame 3). Shows the engine's state; never computes a rule. */
export class Forge extends Phaser.Scene {
  private item!: Item;
  private craft!: CraftState;
  private queue: Input[] = [];
  private carryMs = 0;
  private paused = false;
  private pinned: number | null = null;

  private panel!: ForgePanel;
  private bgX = 0;
  private bgY = 0;
  private outline!: Outline;
  private metal!: Phaser.GameObjects.Graphics;
  private sparkGfx!: Phaser.GameObjects.Graphics;
  private metalGlow!: Phaser.GameObjects.Image;
  private fireGlow!: Phaser.GameObjects.Image;
  private bg!: Phaser.GameObjects.Image;

  private sparks: Spark[] = [];
  private sparkRng!: Rng;
  private flickerRng!: Rng;
  private flicker = 1;
  private draft = 0; // the bellows' effect on the forge, eased 0–1

  private dragging = false;
  private dragPointer = -1;
  private panelObserver?: ResizeObserver;
  private dragOffset = { x: 0, y: 0 };
  private heldPos = { x: 0, y: 0 };

  private fireSound?: Phaser.Sound.BaseSound;
  private bellowsSound?: Phaser.Sound.BaseSound;
  private hum?: { osc: OscillatorNode; gain: GainNode; ctx: AudioContext };

  constructor(private readonly ctx: GameContext) {
    super('Forge');
  }

  init(data: { itemId: string }): void {
    this.item = itemById(data.itemId);
    this.queue = [];
    this.carryMs = 0;
    this.paused = false;
    this.pinned = null;
    this.sparks = [];
    this.dragging = false;
    this.draft = 0;
    this.flicker = 1;
  }

  create(): void {
    // The view takes the seed from the clock; the engine never reads it (GAME-01).
    const seed = Date.now() >>> 0;
    this.craft = createCraft(seed, this.item.id, defaultAlloy(this.item));
    this.sparkRng = mulberry32(seed ^ 0x5eed);
    this.flickerRng = mulberry32(seed ^ 0xf1c4);
    this.outline = outlineFor(this.item.id);

    // Hint counts stay in memory until the craft ends (S4 writes them).
    const seen = this.ctx.load.save.hintsSeen;
    const hint = (seen.heat ?? 0) < HINT_TIMES ? hints.heat : null;
    seen.heat = (seen.heat ?? 0) + 1;

    this.panel = showForgePanel(this.item.name, hint, {
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
    });

    this.ensureGlowTexture();
    this.bg = this.add.image(0, 0, 'wide').setOrigin(0, 0);
    this.fireGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(FORGE_GLOW);
    this.metalGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD);
    this.metal = this.add.graphics();
    this.sparkGfx = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.layout();
    this.scale.on('resize', this.layout, this);
    // The panel changes height when the Burning alert replaces the intro; keep the scene between the bars.
    this.panelObserver = new ResizeObserver(() => this.layout());
    this.panelObserver.observe(this.panel.panel);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

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
      this.craft = step(this.craft, this.queue.shift() ?? { none: true });
      if (this.pinned !== null) this.craft = { ...this.craft, temp: this.pinned };
      this.tickEffects();
    }
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  /** Centre the fire-to-tub area between the top bar and the panel, as in mock-up frame 3. */
  private layout(): void {
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

  private pieceBox(): { x: number; y: number; w: number; h: number } {
    const p = this.piecePos();
    const b = bounds(this.outline);
    const minX = p.dir > 0 ? b.minX : -b.maxX;
    const maxX = p.dir > 0 ? b.maxX : -b.minX;
    return { x: Math.round(p.x + minX), y: Math.round(p.y + b.minY), w: Math.round(maxX - minX) + 1, h: Math.round(b.maxY - b.minY) + 1 };
  }

  // ── Input: dragging the piece ─────────────────────────────────────────────

  private onDown(p: Phaser.Input.Pointer): void {
    const loc = this.craft.location;
    // `location` lags the queue by a step or two; a move already queued wins.
    if (this.dragging || this.pendingMove() || (loc !== 'fire' && loc !== 'anvil')) return;
    const b = this.pieceBox();
    const padX = Math.max(8, (MIN_HIT - b.w) / 2);
    const padY = Math.max(8, (MIN_HIT - b.h) / 2);
    if (p.x < b.x - padX || p.x > b.x + b.w + padX || p.y < b.y - padY || p.y > b.y + b.h + padY) return;
    const c = this.piecePos();
    this.dragOffset = { x: c.x - p.x, y: c.y - p.y };
    this.heldPos = { x: c.x, y: c.y };
    this.dragging = true;
    this.dragPointer = p.id;
    this.queue.push({ bellows: false }, { grab: true });
  }

  private pendingMove(): boolean {
    return this.queue.some((i) => 'grab' in i || 'drop' in i);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.dragging || p.id !== this.dragPointer) return;
    this.heldPos = { x: Math.round(p.x + this.dragOffset.x), y: Math.round(p.y + this.dragOffset.y) };
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.dragging || p.id !== this.dragPointer) return;
    this.dragging = false;
    const x = this.heldPos.x - this.bgX;
    const y = this.heldPos.y - this.bgY;
    const zone = (['fire', 'anvil', 'tub'] as const).find((z) => inside(ZONES[z], x, y));
    // Anywhere else, the piece goes back where it came from (forge spec, Engine).
    this.queue.push({ drop: zone ?? this.craft.heldFrom });
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

  // ── Drawing ───────────────────────────────────────────────────────────────

  private draw(): void {
    const l = look(this.craft.temp);
    const color = Phaser.Display.Color.HexStringToColor(l.color).color;
    const p = this.piecePos();

    this.metal.clear();
    this.metal.fillStyle(color, 1);
    this.metal.lineStyle(1, OUTLINE, 1);
    const pts = this.outline.map((q) => new Phaser.Math.Vector2(Math.round(p.x + q.x * p.dir), Math.round(p.y + q.y)));
    this.metal.fillPoints(pts, true);
    this.metal.strokePoints(pts, true);

    // The metal's glow: its band's radius and colour, as strong as the metal is bright (forge spec, Screens).
    const b = this.pieceBox();
    this.metalGlow.setVisible(l.glow > 0);
    this.metalGlow.setPosition(b.x + b.w / 2, b.y + b.h / 2);
    this.metalGlow.setDisplaySize(b.w + l.glow * 4, b.h + l.glow * 4);
    this.metalGlow.setTint(color);
    this.metalGlow.setAlpha(Math.min(1, 0.2 + l.luminance));

    const f = FIRE_GLOW;
    const strength = (0.45 + 0.4 * this.draft) * this.flicker;
    this.fireGlow.setPosition(this.bgX + f.x, this.bgY + f.y);
    this.fireGlow.setDisplaySize(f.size * (0.9 + 0.25 * this.draft), f.size * (0.9 + 0.25 * this.draft));
    this.fireGlow.setAlpha(strength);

    this.sparkGfx.clear();
    for (const s of this.sparks) {
      this.sparkGfx.fillStyle(SPARK, Math.max(0, s.life / s.max));
      this.sparkGfx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }

    this.panel.update({ inFire: this.craft.location === 'fire', held: this.craft.location === 'held' || this.dragging, burning: l.band === 'white' });
    this.updateSound(l.humHz);
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
