import { matchChildren } from './match';
import type { VNode, VRoot } from './types';

/**
 * 매칭된 prev·next 쌍 중 실제 DOM을 재사용할 수 있는 노드에 참조를 연결한다.
 * type/tag가 다르면 replace 대상이므로 연결하지 않고 false를 반환한다.
 */
export function linkNode(prev: VNode, next: VNode): boolean {
  if (!isLinkablePair(prev, next)) return false;
  if (prev.dom === null) throw new Error('link previous node: dom is not linked');

  next.dom = prev.dom;
  return true;
}

/**
 * 유지·이동 노드의 이전 실제 DOM 참조를 다음 VDOM 전체에 연결한다.
 * diff가 매칭을 한 번만 수행하는 구현에서는 linkNode()를 매칭 계획의 pair마다 호출한다.
 */
export function linkMatchedDom(prev: VRoot, next: VRoot): void {
  if (prev.dom === null) throw new Error('link previous root: dom is not linked');

  next.dom = prev.dom;
  linkChildren(prev.childNodes, next.childNodes);
}

function linkChildren(prevChildren: VNode[], nextChildren: VNode[]): void {
  const { pairs } = matchChildren(prevChildren, nextChildren);

  for (const { prev, next } of pairs) {
    if (!linkNode(prev, next)) continue;
    if (next.nodeType === 1) linkChildren(prev.childNodes, next.childNodes);
  }
}

export function isLinkablePair(prev: VNode, next: VNode): boolean {
  if (prev.nodeType !== next.nodeType) return false;
  return prev.nodeType === 3 || prev.tagName === next.tagName;
}
