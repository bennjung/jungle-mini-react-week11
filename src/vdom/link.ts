import type { VNode } from './types';

/** 대응이 정해진 같은 종류·태그의 노드에만 기존 DOM 참조를 연결한다. */
export function linkNode(prev: VNode, next: VNode): boolean {
  if (prev.nodeType !== next.nodeType || prev.tagName !== next.tagName) return false;
  next.dom = prev.dom;
  return true;
}
