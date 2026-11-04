import * as Phaser from 'phaser';
import './ui/style.css';
import { Boot } from './game/Boot';
import { Choose } from './game/Choose';
import { createContext } from './game/context';
import { computeScale } from './game/scale';
import { debugEnabled, installDebug, type DebugInfo } from './ui/debug';

const NIGHT_0 = '#0d091b'; // --night-0 (docs/UI_STYLE.md)

function measure(): DebugInfo {
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;
  const devicePixelRatio = window.devicePixelRatio || 1;
  return { cssWidth, cssHeight, devicePixelRatio, ...computeScale(cssWidth, cssHeight, devicePixelRatio) };
}

const stage = document.getElementById('stage');
if (!stage) throw new Error('#stage is missing from index.html');

/** The canvas holds game px; CSS zoom of scale ÷ dpr makes each game px exactly `scale` physical px. */
function fitStage(i: DebugInfo): number {
  const zoom = i.scale / i.devicePixelRatio;
  stage!.style.width = `${i.visibleWidth * zoom}px`;
  stage!.style.height = `${i.visibleHeight * zoom}px`;
  return zoom;
}

let info = measure();
const ctx = createContext();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: info.visibleWidth,
  height: info.visibleHeight,
  pixelArt: true,
  backgroundColor: NIGHT_0,
  scale: { mode: Phaser.Scale.NONE, zoom: fitStage(info) },
  scene: [new Boot(), new Choose(ctx)],
});

const renderDebug = debugEnabled() ? installDebug(stage, () => info) : undefined;

window.addEventListener('resize', () => {
  info = measure();
  const zoom = fitStage(info);
  game.scale.resize(info.visibleWidth, info.visibleHeight);
  game.scale.setZoom(zoom);
  renderDebug?.(info);
});
