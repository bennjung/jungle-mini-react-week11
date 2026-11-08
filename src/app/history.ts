import { cloneSnapshotData } from '../vdom/create';
import type { VRoot } from '../vdom/types';

export type HistoryDirection = -1 | 0 | 1;

export interface HistoryEntry {
  vdom: VRoot; // 모든 dom null
  html: string;
}

export interface History {
  get(): VRoot;
  set(vdom: VRoot, html: string): void;
  peek(direction: HistoryDirection): Readonly<HistoryEntry> | null;
  move(direction: HistoryDirection, liveVDOM: VRoot): void;
}

const MAX_ENTRIES = 50;

export function createHistory(): History {
  const entries: HistoryEntry[] = [];
  let index = -1;
  let currentLive: VRoot | null = null;

  return {
    get(): VRoot {
      if (currentLive === null) {
        throw new Error('History에 현재 VDOM이 없습니다. 먼저 set()을 호출해야 합니다.');
      }
      return currentLive;
    },

    set(vdom: VRoot, html: string): void {
      // 복사가 실패하면 기존 entries·index·currentLive를 변경하지 않는다.
      const snapshot = cloneSnapshotData(vdom);

      // 현재 위치 뒤의 미래 이력만 제거한다.
      if (index < entries.length - 1) {
        entries.splice(index + 1);
      }
      entries.push({ vdom: snapshot, html });

      if (entries.length > MAX_ENTRIES) {
        entries.shift();
        index -= 1;
      }

      index = entries.length - 1;
      currentLive = vdom;
    },

    peek(direction: HistoryDirection): Readonly<HistoryEntry> | null {
      const target = index + direction;
      if (target < 0 || target >= entries.length) return null;
      return entries[target] ?? null;
    },

    move(direction: HistoryDirection, liveVDOM: VRoot): void {
      const target = index + direction;
      if (target < 0 || target >= entries.length) return;
      index = target;
      currentLive = liveVDOM;
    }
  };
}
