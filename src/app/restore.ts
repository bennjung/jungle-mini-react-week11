import { cloneSnapshotData } from '../vdom/create';
import { assertAllLinked, renderChildren } from '../vdom/patch';
import type { VRoot } from '../vdom/types';
import { writeEditorHTML } from './editor';
import type { HistoryEntry } from './history';

export interface RestoreSnapshotOptions {
  editor?: HTMLTextAreaElement;
  restoreEditor?: boolean;
}

/**
 * 저장 entry를 실제 영역과 편집기로 복원한다.
 * entry는 읽기 전용 view로 취급하며, cloneSnapshotData()로 복사한 데이터만
 * renderChildren()에 전달한다. 복원 순서는 계약에 따라 editor 검사 →
 * 복사 → 렌더링 → 전체 연결 검증 → 편집기 쓰기다.
 */
export function restoreSnapshot(
  entry: Readonly<HistoryEntry>,
  actualRoot: Element,
  options: RestoreSnapshotOptions = {}
): VRoot {
  const restoreEditor = options.restoreEditor !== false;
  const editor = options.editor;

  // editor 누락 오류로 실제 DOM만 먼저 바뀌는 상태를 피하려면 렌더링 전에 검사한다.
  if (restoreEditor && editor === undefined) {
    throw new Error('편집기 복원에는 editor가 필요합니다.');
  }

  const root = cloneSnapshotData(entry.vdom);
  renderChildren(root, actualRoot);
  assertAllLinked(root, actualRoot);

  if (restoreEditor && editor !== undefined) {
    writeEditorHTML(editor, entry.html);
  }

  return root;
}
