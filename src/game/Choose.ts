import * as Phaser from 'phaser';
import { items, type Item } from '../data/items';
import { showChoose } from '../ui/choose';
import type { GameContext } from './context';

/** The item list. The list is a DOM panel over the canvas; "Forge a <item>" starts a craft. */
export class Choose extends Phaser.Scene {
  constructor(private readonly ctx: GameContext) {
    super('Choose');
  }

  create(): void {
    this.list('knife');
  }

  private list(selectedId: string): void {
    showChoose(items, this.ctx.load, (item) => this.forge(item), selectedId);
  }

  private forge(item: Item): void {
    this.scene.start('Forge', { itemId: item.id });
  }
}
