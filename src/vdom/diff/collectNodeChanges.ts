import type { DiffCommand, UpdateData, VNode } from '../types';
import { linkNode } from '../link';
import { collectChildChanges } from './collectChildChanges';
import { findAttributeUpdates } from './findAttributeUpdates';
import { findPropertyUpdates } from './findPropertyUpdates';

/**
 * 입력: 비교할 짝으로 정해진 이전·다음 VNode.
 * 출력: 현재 노드의 replace·update와 하위 트리의 변경 명령.
 * 책임: 교체 여부를 판단하고, 유지 노드의 DOM 연결과 변경 데이터 취합을 수행한다.
 * 유지되는 요소의 자식은 collectChildChanges로 비교한다.
 * 자기 자신의 형제 간 이동은 판단하지 않는다.
 */
export function collectNodeChanges(prev: VNode, next: VNode): DiffCommand[] {
  // 교체할 하위 트리는 순회·연결하지 않는다. Patch가 새 DOM을 만든다.
  if (!linkNode(prev, next)) {
    return [{ type: 'replace', target: prev, node: next }];
  }

  if (next.nodeType === Node.TEXT_NODE) {
    return prev.nodeValue === next.nodeValue
      ? []
      : [{ type: 'update', target: prev, data: { nodeValue: next.nodeValue ?? '' } }];
  }

  const attributeUpdates = findAttributeUpdates(prev.attributes, next.attributes);
  const propertyUpdates = findPropertyUpdates(prev.properties, next.properties);

  const data: UpdateData = {
    ...propertyUpdates,
    ...attributeUpdates
  };

  // 현재 노드에서 직접 만드는 명령은 replace 또는 update뿐이다.
  const nodeChanges: Extract<DiffCommand, { type: 'update' }>[] = [];
  if (Object.keys(data).length > 0) {
    nodeChanges.push({ type: 'update', target: prev, data });
  }
  // 자체 변경이 없어도 자손의 DOM 참조를 연결하기 위해 재귀한다.
  const childChanges = collectChildChanges(prev, next);
  return [...nodeChanges, ...childChanges];
}
