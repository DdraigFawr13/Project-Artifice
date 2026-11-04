import * as Phaser from 'phaser';
import wideUrl from '../../assets/wide.png?url';
import { showLoading } from '../ui/loading';

/** Loads the art and the fonts behind the loading screen, then opens the item list. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const setProgress = showLoading();
    this.load.on('progress', (p: number) => setProgress(p * 0.9));
    this.load.image('wide', wideUrl);
  }

  create(): void {
    // Panels need the pixel faces before they draw, or text jumps when the fonts arrive.
    const fonts = Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('14px "Press Start 2P"')]);
    fonts.catch(() => undefined).finally(() => this.scene.start('Choose'));
  }
}
