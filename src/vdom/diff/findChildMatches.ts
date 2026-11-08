import type { VNode } from '../types';
import type { ChildMatch } from './types';

/**
 * 입력: 같은 부모 아래의 이전·다음 자식 목록.
 * 출력: 비교할 노드 쌍, 새 노드, 사라진 노드.
 * 책임: 비교할 짝만 찾는다. 재귀·내용 비교·이동 판단은 하지 않는다.
 * 다음 자식 순서로 짝·새 자식을 기록한 뒤, 남은 이전 자식을 이전 순서로 붙인다.
 */
export function findChildMatches(
  prevChildren: VNode[],
  nextChildren: VNode[]
): ChildMatch[] {
  const duplicateKeys = findDuplicateKeys(prevChildren, nextChildren);
  const { keyedChildren, unkeyedChildren } = indexPreviousChildren(prevChildren, duplicateKeys);
  const { matches, usedPrevious } = matchNextChildren(
    nextChildren,
    duplicateKeys,
    keyedChildren,
    unkeyedChildren
  );

  return [...matches, ...findRemovedMatches(prevChildren, usedPrevious)];
}

/** HTML에 명시된 key 속성만 읽는다. 빈 문자열도 key가 있는 경우다. */
function readKey(node: VNode): string | undefined {
  if (node.nodeType !== Node.ELEMENT_NODE) return undefined;
  return node.attributes.find((attribute) => attribute.name === 'key')?.value;
}

/** 각 목록 안의 중복을 확인한다. 이전·다음에 하나씩 있는 key는 중복이 아니다. */
function findDuplicateKeys(prevChildren: VNode[], nextChildren: VNode[]): Set<string> {
  const duplicateKeys = new Set<string>();

  for (const children of [prevChildren, nextChildren]) {
    const seenKeys = new Set<string>();
    for (const child of children) {
      const key = readKey(child);
      if (key === undefined) continue;
      if (seenKeys.has(key)) duplicateKeys.add(key);
      seenKeys.add(key);
    }
  }

  return duplicateKeys;
}

/** 고유 key 조회표와 순서 대응 목록을 준비한다. 원본 key 속성은 삭제하지 않는다. */
function indexPreviousChildren(
  prevChildren: VNode[],
  duplicateKeys: Set<string>
): { keyedChildren: Map<string, VNode>; unkeyedChildren: VNode[] } {
  const keyedChildren = new Map<string, VNode>();
  const unkeyedChildren: VNode[] = [];

  for (const child of prevChildren) {
    const key = readKey(child);
    if (key === undefined || duplicateKeys.has(key)) {
      unkeyedChildren.push(child);
    } else {
      keyedChildren.set(key, child);
    }
  }

  return { keyedChildren, unkeyedChildren };
}

/** 다음 자식마다 이전 짝을 찾는다. 고유 key의 조회 실패는 순서 대응하지 않는다. */
function matchNextChildren(
  nextChildren: VNode[],
  duplicateKeys: Set<string>,
  keyedChildren: Map<string, VNode>,
  unkeyedChildren: VNode[]
): { matches: ChildMatch[]; usedPrevious: Set<VNode> } {
  const matches: ChildMatch[] = [];
  const usedPrevious = new Set<VNode>();
  const previousUnkeyed = unkeyedChildren.values();

  for (const next of nextChildren) {
    const key = readKey(next);
    const prev = key !== undefined && !duplicateKeys.has(key)
      ? keyedChildren.get(key)
      : previousUnkeyed.next().value;

    if (prev === undefined) {
      matches.push({ kind: 'inserted', next });
    } else {
      matches.push({ kind: 'matched', prev, next });
      usedPrevious.add(prev);
    }
  }

  return { matches, usedPrevious };
}

/** 입력 순서를 유지하면서 짝을 찾지 못한 이전 자식만 반환한다. */
function findRemovedMatches(prevChildren: VNode[], usedPrevious: Set<VNode>): ChildMatch[] {
  return prevChildren
    .filter((prev) => !usedPrevious.has(prev))
    .map((prev): ChildMatch => ({ kind: 'removed', prev }));
}
