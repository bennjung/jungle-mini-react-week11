import { createSnapshot, parseHTML } from '../vdom/create';
import { diff } from '../vdom/diff';
import { applyPatch } from '../vdom/patch';
import type { VRoot } from '../vdom/types';
import { readEditorHTML } from './editor';
import type { History } from './history';
import type { AppElements, AppHandlers } from './init';
import { restoreSnapshot } from './restore';

/**
 * 편집기 내용을 Patch하고 성공한 상태만 History에 저장한다.
 * applyPatch() 실패는 현재 History entry로 실제 영역을 복구하지만,
 * diff()와 history.set() 실패는 DOM 복구 경로에 포함하지 않는다.
 */
export function createHandlers(elements: AppElements, history: History): AppHandlers {
  return {
    handlePatch(): void {
      handlePatch(elements, history);
    },
    handleHistoryMove(direction: -1 | 1): void {
      handleHistoryMove(elements, history, direction);
    }
  };
}

function handlePatch(elements: AppElements, history: History): void {
  const prev = history.get();
  const html = readEditorHTML(elements.editor);
  const next = createSnapshot(parseHTML(html));
  const changes = diff(prev, next);

  // 변경이 없으면 Patch와 이력 저장을 모두 생략하고 기존 live VDOM을 유지한다.
  if (changes.length === 0) return;

  let completed: VRoot;
  try {
    completed = applyPatch(prev, next, changes);
  } catch (patchError) {
    recoverFromPatchFailure(elements, history, patchError);
  }

  // 성공한 Patch만 저장한다. 저장 실패는 applyPatch 복구 범위가 아니다.
  history.set(completed, html);
}

/**
 * applyPatch() 실패 시 저장된 현재 entry로 실제 영역만 full render 복원한다.
 * 편집기는 실패한 입력을 유지해 같은 내용으로 재시도할 수 있게 한다.
 */
function recoverFromPatchFailure(
  elements: AppElements,
  history: History,
  patchError: unknown
): never {
  const entry = history.peek(0);
  if (entry === null) {
    // History 불변식 위반: 복구 기준이 없으므로 원래 오류를 그대로 전파한다.
    throw patchError;
  }

  let live: VRoot;
  try {
    live = restoreSnapshot(entry, elements.actualRoot, {
      editor: elements.editor,
      restoreEditor: false
    });
  } catch (restoreError) {
    throw new AggregateError(
      [patchError, restoreError],
      'applyPatch 실패 후 현재 이력으로 복원하는 데에도 실패했습니다.'
    );
  }

  // 위치 이동 없이 복원된 live VDOM만 현재 상태로 교체한다.
  history.move(0, live);
  throw patchError;
}

function handleHistoryMove(
  elements: AppElements,
  history: History,
  direction: -1 | 1
): void {
  const entry = history.peek(direction);
  if (entry === null) return;

  const live = restoreSnapshot(entry, elements.actualRoot, { editor: elements.editor });
  history.move(direction, live);
}
