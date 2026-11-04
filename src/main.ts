import * as Phaser from 'phaser';
import './ui/style.css';
import { Boot } from './game/Boot';
import { Alloy } from './game/Alloy';
import { Choose } from './game/Choose';
import { Forge } from './game/Forge';
import { Result } from './game/Result';
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

/**
 * The canvas holds game px; a CSS zoom of scale ÷ dpr makes each game px exactly `scale` physical px.
 * The stage is centred with its corner on a whole physical pixel, so no game pixel is split.
 */
function fitStage(i: DebugInfo): number {
  const dpr = i.devicePixelRatio;
  const zoom = i.scale / dpr;
  const physW = i.visibleWidth * i.scale;
  const physH = i.visibleHeight * i.scale;
  const left = Math.floor((Math.floor(i.cssWidth * dpr) - physW) / 2);
  const top = Math.floor((Math.floor(i.cssHeight * dpr) - physH) / 2);
  stage!.style.width = `${physW / dpr}px`;
  stage!.style.height = `${physH / dpr}px`;
  stage!.style.left = `${left / dpr}px`;
  stage!.style.top = `${top / dpr}px`;
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
  scene: [new Boot(), new Choose(ctx), new Alloy(ctx), new Forge(ctx), new Result()],
});

const renderDebug = debugEnabled() ? installDebug(stage, () => info, () => game.loop.actualFps) : undefined;

window.addEventListener('resize', () => {
  info = measure();
  const zoom = fitStage(info);
  game.scale.resize(info.visibleWidth, info.visibleHeight);
  game.scale.setZoom(zoom);
  renderDebug?.(info);
});
