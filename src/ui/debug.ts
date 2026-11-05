import type { CraftState, Input } from '../engine/craft';
import type { ScaleInfo } from '../game/scale';

/** What `window.__artifice.info()` returns (forge spec, Debug API). */
export interface DebugInfo extends ScaleInfo {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
}

/** A box in CSS px, relative to the page. */
export interface CssBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the forge screen offers tests while it is open (forge spec, Debug API). */
export interface ForgeDebug {
  state(): CraftState;
  /** The last strike's first hammer play (`rate`) and whether a second, Perfect ring played; null before any strike. */
  lastSound(): { key: string; rate: number; perfect: boolean } | null;
  /** The striking finger's hold so far: engine steps while it is down, and the force that gives; 0 with no finger down. */
  hold(): { steps: number; force: number };
  /** Engine steps of holding that give the ideal force at the temperature now. */
  idealHold(): number;
  /** Stop real time driving the fixed step. */
  pause(): void;
  /** Run the fixed step for `ms`; a part step is carried to the next call. */
  advance(ms: number): void;
  /** Feed one input to the next step. */
  send(input: Input): void;
  /** Hold the temperature at `c` °C after every step, or stop holding it. */
  pinTemp(c: number | null): void;
  /** The metal's bounding box (the piece itself, not its glow), in whichever view shows it. */
  metalBox(): CssBox;
  /** A drop zone in the wide view (fire, anvil or tub), in CSS px relative to the page. */
  zone(name: 'fire' | 'anvil' | 'tub'): CssBox;
  /** The strike targets' centres in CSS px, relative to the page, with how many hits each has had. */
  targets(): { x: number; y: number; hits: number }[];
  /** The slag spots' centres in CSS px, relative to the page, like `targets()`. */
  slag(): { x: number; y: number; cleared: boolean }[];
  /** The cutting edge's ends in CSS px, relative to the page, like `targets()`; for items that grind (S6). */
  edgeLine(): { x0: number; y0: number; x1: number; y1: number };
  /** Mark every slag spot cleared, so checks that strike targets directly don't depend on the seed's slag. */
  clearSlag(): void;
}

export interface DebugApi extends Omit<ForgeDebug, 'state'> {
  info(): DebugInfo;
  /** Use seed `n` for the next craft started. Works outside the forge. */
  setSeed(n: number): void;
  /** The craft in progress, or null outside the forge. */
  state(): CraftState | null;
}

declare global {
  interface Window {
    __artifice?: DebugApi;
  }
}

export function debugEnabled(search = location.search): boolean {
  return new URLSearchParams(search).has('debug');
}

let forge: ForgeDebug | null = null;
let nextSeed: number | null = null;

/** The seed set with `setSeed`, once; null when none was set (the forge then takes one from the clock). */
export function takeDebugSeed(): number | null {
  const s = nextSeed;
  nextSeed = null;
  return s;
}

/** The forge screen registers itself while open, and passes null when it closes. Does nothing without ?debug. */
export function setForgeDebug(api: ForgeDebug | null): void {
  forge = api;
}

const noForge = (): never => {
  throw new Error('The forge is not open');
};

/** Install the debug API and the corner readout. Only called with ?debug; it never ships otherwise. */
export function installDebug(stage: HTMLElement, current: () => DebugInfo, fps: () => number): (info: DebugInfo) => void {
  const readout = document.createElement('div');
  readout.className = 'debug';
  readout.dataset.testid = 'debug-readout';
  stage.append(readout);
  window.__artifice = {
    info: current,
    setSeed: (n) => {
      nextSeed = n >>> 0;
    },
    targets: () => (forge ?? noForge()).targets(),
    slag: () => (forge ?? noForge()).slag(),
    edgeLine: () => (forge ?? noForge()).edgeLine(),
    clearSlag: () => (forge ?? noForge()).clearSlag(),
    state: () => forge?.state() ?? null,
    lastSound: () => (forge ?? noForge()).lastSound(),
    hold: () => (forge ?? noForge()).hold(),
    idealHold: () => (forge ?? noForge()).idealHold(),
    pause: () => (forge ?? noForge()).pause(),
    advance: (ms) => (forge ?? noForge()).advance(ms),
    send: (input) => (forge ?? noForge()).send(input),
    pinTemp: (c) => (forge ?? noForge()).pinTemp(c),
    metalBox: () => (forge ?? noForge()).metalBox(),
    zone: (name) => (forge ?? noForge()).zone(name),
  };
  const render = (i: DebugInfo) => {
    readout.textContent = `${i.cssWidth}×${i.cssHeight} css · dpr ${i.devicePixelRatio} · ×${i.scale} · ${i.visibleWidth}×${i.visibleHeight} · ${Math.round(fps())} fps`;
  };
  render(current());
  setInterval(() => render(current()), 1000);
  return render;
}
