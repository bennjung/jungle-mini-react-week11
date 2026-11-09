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

/** 최장 증가 부분 수열의 노드는 유지하고 나머지만 이동한다. 시간 O(n²), 공간 O(n). */
function findMovedChildren(previousOrder: VNode[], targetOrder: VNode[]): VNode[] {
  const previousIndices = new Map(previousOrder.map((node, index) => [node, index]));
  const positions = targetOrder.map((node) => {
    const index = previousIndices.get(node);
    if (index === undefined) throw new Error('대응된 이전 형제를 찾을 수 없습니다.');
    return index;
  });
  const lengths = new Array<number>(positions.length).fill(1);
  const predecessors = new Array<number>(positions.length).fill(-1);
  let longestLength = 0;
  let longestEnd = -1;

  for (const [index, position] of positions.entries()) {
    let length = 1;
    let predecessor = -1;
    // 이전 위치가 더 작은 노드 뒤에 연결하면 상대 순서를 유지할 수 있다.
    for (let candidate = 0; candidate < index; candidate++) {
      if (positions[candidate]! < position && lengths[candidate]! + 1 > length) {
        length = lengths[candidate]! + 1;
        predecessor = candidate;
      }
    }
    lengths[index] = length;
    predecessors[index] = predecessor;
    // 동률이면 목표의 뒤쪽에서 끝나는 수열을 유지한다. A B → B A에서는 A를 유지한다.
    if (length >= longestLength) {
      longestLength = length;
      longestEnd = index;
    }
  }

  const keptIndices = new Set<number>();
  for (let index = longestEnd; index !== -1; index = predecessors[index]!) {
    keptIndices.add(index);
  }
  // 목표 순서로 반환해야 기존 명령 생성 단계가 오른쪽부터 이동을 배치할 수 있다.
  return targetOrder.filter((_, index) => !keptIndices.has(index));
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

  // 오른쪽 기준 형제의 위치를 먼저 확정하도록 이동 명령을 역순으로 만든다.
  return [...movedChildren].reverse().map((target) => {
    const next = nextByPrevious.get(target);
    if (!next || !nextSiblings.has(next)) {
      throw new Error('이동 대상의 다음 형제 위치를 찾을 수 없습니다.');
    }
    return { type: 'move', target, parent: nextParent, before: nextSiblings.get(next) ?? null };
  });
}
