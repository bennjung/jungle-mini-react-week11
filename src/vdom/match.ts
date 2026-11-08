import type { VNode } from './types';

// 같은 부모 안에서 대응된 이전·다음 노드 쌍
export interface MatchedPair {
  prev: VNode;
  next: VNode;
}

// matchChildren()이 반환하는 자식 대응 계획
export interface ChildMatchPlan {
  pairs: MatchedPair[];
  inserts: Array<{ next: VNode; before: VNode | null }>;
  removals: VNode[];
  moves: Array<{ prev: VNode; next: VNode; before: VNode | null }>;
}

// next 자식 대응 단계의 중간 결과
interface NextMatchResult {
  pairs: MatchedPair[];
  matchedPrev: Set<VNode>;
  matchedNext: Set<VNode>;
}

// 요소의 key attribute 값을 식별자로 반환한다. 텍스트/keyless 요소는 null
function keyOf(node: VNode): string | null {
  if (node.nodeType !== 1) return null;
  const attribute = node.attributes.find(({ name }) => name === 'key');
  return attribute ? attribute.value : null;
}

/**
 * 같은 부모 안의 자식 대응을 계산한다.
 * keyed 요소는 key로, keyless 요소와 텍스트 노드는 자식 순서로 대응한다.
 * 중복 key는 현재 등장 순서대로 대응하며 CONF-03 확정 전까지의 잠정 동작이다.
 */
export function matchChildren(
  prevChildren: VNode[],
  nextChildren: VNode[]
): ChildMatchPlan {
  const nextOrder = indexByPosition(nextChildren);
  const { pairs, matchedPrev, matchedNext } = pairNextChildren(
    prevChildren,
    nextChildren
  );

  return {
    pairs,
    inserts: collectInserts(nextChildren, matchedNext),
    removals: prevChildren.filter((node) => !matchedPrev.has(node)),
    moves: collectMoves(pairs, prevChildren, nextChildren, nextOrder)
  };
}

// prev 인덱스를 만들고 next 자식을 한 번 순회해 keyed/keyless 대응을 만든다.
// nextChildren 순서대로 pair를 추가하므로 pairs는 별도 정렬이 필요 없다.
function pairNextChildren(
  prevChildren: VNode[],
  nextChildren: VNode[]
): NextMatchResult {
  const { keyed: keyedPrev, keyless: keylessPrev } = indexPrevChildren(prevChildren);

  const pairs: MatchedPair[] = [];
  const matchedPrev = new Set<VNode>();
  const matchedNext = new Set<VNode>();
  let keylessCursor = 0;

  // keyed/keyless 조회 결과를 공통 형식으로 등록한다.
  const recordPair = (prev: VNode, next: VNode): void => {
    pairs.push({ prev, next });
    matchedPrev.add(prev);
    matchedNext.add(next);
  };

  for (const next of nextChildren) {
    const key = keyOf(next);

    if (key !== null) {
      const prev = keyedPrev.get(key)?.shift();
      if (prev === undefined) continue;

      recordPair(prev, next);
      continue;
    }

    const prev = keylessPrev[keylessCursor];
    if (prev === undefined) continue;

    keylessCursor += 1;
    recordPair(prev, next);
  }

  return { pairs, matchedPrev, matchedNext };
}

// 다음에만 있는 노드를 insert 후보로 만든다. before는 다음 형제 또는 null이다.
function collectInserts(
  nextChildren: VNode[],
  matchedNext: Set<VNode>
): ChildMatchPlan['inserts'] {
  const inserts: ChildMatchPlan['inserts'] = [];

  nextChildren.forEach((next, index) => {
    if (matchedNext.has(next)) return;

    inserts.push({
      next,
      before: nextChildren[index + 1] ?? null
    });
  });

  return inserts;
}

// keyed 순서가 바뀐 pair만 move 후보로 만든다.
function collectMoves(
  pairs: MatchedPair[],
  prevChildren: VNode[],
  nextChildren: VNode[],
  nextOrder: Map<VNode, number>
): ChildMatchPlan['moves'] {
  const prevOrder = indexByPosition(prevChildren);
  const sequence = pairs.map(({ prev }) => requireIndex(prevOrder, prev));
  const keep = new Set(longestIncreasingSubsequenceIndices(sequence));
  const moves: ChildMatchPlan['moves'] = [];

  pairs.forEach(({ prev, next }, index) => {
    if (keep.has(index)) return;
    if (keyOf(next) === null) return;

    const nextIndex = requireIndex(nextOrder, next);
    moves.push({
      prev,
      next,
      before: nextChildren[nextIndex + 1] ?? null
    });
  });

  return moves;
}

// 이전 자식들을 keyed bucket과 keyless 순서 목록으로 인덱싱한다.
function indexPrevChildren(children: VNode[]): {
  keyed: Map<string, VNode[]>;
  keyless: VNode[];
} {
  const keyed = new Map<string, VNode[]>();
  const keyless: VNode[] = [];

  for (const node of children) {
    const key = keyOf(node);
    if (key === null) {
      keyless.push(node);
      continue;
    }

    const bucket = keyed.get(key);
    if (bucket) bucket.push(node);
    else keyed.set(key, [node]);
  }

  return { keyed, keyless };
}

// VNode 배열을 노드 객체 → 위치 인덱스 Map으로 만든다.
function indexByPosition(children: VNode[]): Map<VNode, number> {
  const order = new Map<VNode, number>();

  children.forEach((node, index) => {
    order.set(node, index);
  });

  return order;
}

function requireIndex(order: Map<VNode, number>, node: VNode): number {
  const index = order.get(node);

  if (index === undefined) {
    throw new Error('VNode is not part of the child list');
  }

  return index;
}

// prev 순서의 LIS를 구해 move가 필요 없는 keyed 노드를 가려낸다.
function longestIncreasingSubsequenceIndices(values: number[]): number[] {
  const tails: number[] = [];
  const previous = new Array<number>(values.length).fill(-1);

  for (let index = 0; index < values.length; index += 1) {
    const value = valueAt(values, index);
    let low = 0;
    let high = tails.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const middleIndex = valueAt(tails, middle);
      if (valueAt(values, middleIndex) < value) low = middle + 1;
      else high = middle;
    }

    if (low > 0) previous[index] = valueAt(tails, low - 1);
    tails[low] = index;
  }

  const result: number[] = [];
  let cursor = tails.length > 0 ? valueAt(tails, tails.length - 1) : -1;

  while (cursor !== -1) {
    result.push(cursor);
    cursor = valueAt(previous, cursor);
  }

  return result.reverse();
}

function valueAt(values: readonly number[], index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new Error(`Missing value at index ${index}`);
  }

  return value;
}
