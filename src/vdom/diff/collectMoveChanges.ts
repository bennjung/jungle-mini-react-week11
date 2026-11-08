import type { DiffCommand, VNode } from '../types';
import type { ChildMatch, Parent } from './types';

/**
 * 입력: 이전 자식 순서, 다음 부모와 자식 순서, 노드 대응 결과.
 * 출력: move 명령만 담긴 배열.
 * 책임: 이동할 대상과 기준 형제를 결정한다.
 * 삽입·제거 때문에 인덱스가 바뀐 것을 이동으로 오인하지 않는다.
 */
export function collectMoveChanges(
  prevChildren: VNode[],
  nextParent: Parent,
  matches: ChildMatch[]
): Extract<DiffCommand, { type: 'move' }>[] {
  const { previousOrder, targetOrder } = collectMatchedChildren(prevChildren, matches);
  const movedChildren = findMovedChildren(previousOrder, targetOrder);
  return createMoveCommands(movedChildren, nextParent, matches);
}

/** 대응된 이전 노드들만 이전 순서·목표 순서로 나열한다. 삽입·제거 대상은 제외한다. */
function collectMatchedChildren(
  prevChildren: VNode[],
  matches: ChildMatch[]
): { previousOrder: VNode[]; targetOrder: VNode[] } {
  // findChildMatches는 대응 쌍을 다음 자식 순서로 반환한다.
  const targetOrder = matches
    .filter((match) => match.kind === 'matched')
    .map((match) => match.prev);
  const matchedChildren = new Set(targetOrder);
  const previousOrder = prevChildren.filter((child) => matchedChildren.has(child));
  return { previousOrder, targetOrder };
}

/** 작업용 목록을 목표에 맞추며 이동할 이전 노드를 선택한다. 입력 순서는 변경하지 않는다. */
function findMovedChildren(previousOrder: VNode[], targetOrder: VNode[]): VNode[] {
  const workingOrder = [...previousOrder];
  const movedChildren: VNode[] = [];

  for (const [index, target] of targetOrder.entries()) {
    if (workingOrder[index] === target) continue;
    const currentIndex = workingOrder.indexOf(target);
    if (currentIndex === -1) throw new Error('대응된 이전 형제를 찾을 수 없습니다.');
    workingOrder.splice(currentIndex, 1);
    workingOrder.splice(index, 0, target);
    movedChildren.push(target);
  }
  return movedChildren;
}

/** 이동 대상과 다음 부모·기준 형제 참조를 가진 move 명령을 만든다. DOM은 변경하지 않는다. */
function createMoveCommands(
  movedChildren: VNode[],
  nextParent: Parent,
  matches: ChildMatch[]
): Extract<DiffCommand, { type: 'move' }>[] {
  const nextByPrevious = new Map(
    matches.filter((match) => match.kind === 'matched').map((match) => [match.prev, match.next])
  );
  const nextSiblings = new Map(
    nextParent.childNodes.map((node, index) => [node, nextParent.childNodes[index + 1] ?? null])
  );

  return movedChildren.map((target) => {
    const next = nextByPrevious.get(target);
    if (!next || !nextSiblings.has(next)) {
      throw new Error('이동 대상의 다음 형제 위치를 찾을 수 없습니다.');
    }
    return { type: 'move', target, parent: nextParent, before: nextSiblings.get(next) ?? null };
  });
}
