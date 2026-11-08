import type { DiffCommand, VNode } from '../types';
import type { Parent } from './types';
import { findChildMatches } from './findChildMatches';
import { collectNodeChanges } from './collectNodeChanges';
import { collectMoveChanges } from './collectMoveChanges';

/**
 * 입력: 이전·다음 부모.
 * 출력: 직계 자식과 하위 트리의 변경 명령. 실행 순서는 아직 보장하지 않는다.
 * 책임: findChildMatches 결과에 따라 삽입·제거를 생성하고,
 * collectNodeChanges의 변경 명령과 collectMoveChanges의 이동 명령을 취합한다.
 */
export function collectChildChanges(
  prevParent: Parent,
  nextParent: Parent
): DiffCommand[] {
  if (prevParent.childNodes.length === 0 && nextParent.childNodes.length === 0) {
    return [];
  }

  const matches = findChildMatches(prevParent.childNodes, nextParent.childNodes);
  const changes: DiffCommand[] = [];

  // 삽입 기준은 다음 VDOM의 바로 오른쪽 형제다. 대응 노드의 연결은 collectNodeChanges가 맡는다.
  const nextSiblings = new Map<VNode, VNode | null>();
  for (const [index, node] of nextParent.childNodes.entries()) {
    nextSiblings.set(node, nextParent.childNodes[index + 1] ?? null);
  }

  for (const match of matches) {
    switch (match.kind) {
      case 'inserted':
        changes.push({
          type: 'insert',
          node: match.next,
          parent: nextParent,
          before: nextSiblings.get(match.next) ?? null
        });
        break;
      case 'removed':
        changes.push({ type: 'remove', target: match.prev });
        break;
      case 'matched':
        changes.push(...collectNodeChanges(match.prev, match.next));
        break;
    }
  }

  changes.push(...collectMoveChanges(prevParent.childNodes, nextParent, matches));
  return changes;
}
