import type { VNode } from './types';

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

export function isLinkablePair(prev: VNode, next: VNode): boolean {
  if (prev.nodeType !== next.nodeType) return false;
  return prev.nodeType === 3 || prev.tagName === next.tagName;
}
