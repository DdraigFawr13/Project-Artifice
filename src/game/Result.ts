import * as Phaser from 'phaser';
import { itemById, type AlloyMix } from '../data/items';
import type { GradeResult } from '../engine/grade';
import { showResult } from '../ui/result';

/** What the forge hands the result screen when a craft ends; the save is already written. */
export interface ResultData {
  itemId: string;
  /** The mix the craft used; "Forge another" and "Try again" start with it (S5). */
  alloy: AlloyMix;
  graded: GradeResult;
  /** Each target's hit count, for the piece image (S5). */
  hits: number[];
  newBest: boolean;
  previousBest: number | null;
  /** False when the save couldn't be written (or storage is unavailable). */
  saved: boolean;
}

/** The result or ruin screen (mock-up frames 6 and 7). Shows the engine's grade; never computes a rule. */
export class Result extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData): void {
    const item = itemById(data.itemId);
    showResult(item, data, {
      choose: () => this.scene.start('Choose', { selectedId: item.id }),
      again: () => this.scene.start('Forge', { itemId: item.id, alloy: data.alloy }),
    });
  }
}
