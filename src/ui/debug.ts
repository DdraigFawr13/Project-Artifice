import type { ScaleInfo } from '../game/scale';

/** What `window.__artifice.info()` returns (forge spec, Debug API). */
export interface DebugInfo extends ScaleInfo {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
}

export interface DebugApi {
  info(): DebugInfo;
}

declare global {
  interface Window {
    __artifice?: DebugApi;
  }
}

export function debugEnabled(search = location.search): boolean {
  return new URLSearchParams(search).has('debug');
}

/** Install the debug API and the corner readout. Only called with ?debug; it never ships otherwise. */
export function installDebug(stage: HTMLElement, current: () => DebugInfo): (info: DebugInfo) => void {
  const readout = document.createElement('div');
  readout.className = 'debug';
  readout.dataset.testid = 'debug-readout';
  stage.append(readout);
  window.__artifice = { info: current };
  const render = (i: DebugInfo) => {
    readout.textContent = `${i.cssWidth}×${i.cssHeight} css · dpr ${i.devicePixelRatio} · ×${i.scale} · ${i.visibleWidth}×${i.visibleHeight}`;
  };
  render(current());
  return render;
}
