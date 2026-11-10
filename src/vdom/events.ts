import type { VNodeEventMap } from './types';

/**
 * 실제 DOM 노드에 마지막으로 연결한 handler 기록.
 * VNode는 갱신마다 새로 만들어지므로, handler 추가·교체·제거를 판단할 기준은
 * 실제 노드에 남아 있는 이 기록이어야 한다.
 */
const nodeEvents = new WeakMap<Node, VNodeEventMap>();

/**
 * 새 요소에 VNode의 handler를 직접 연결하고 같은 map을 기록한다.
 * 기록 시점과 연결 시점을 한 곳에 두어 실제 연결과 기록이 어긋나지 않게 한다.
 */
export function bindEvents(element: Element, events: VNodeEventMap): void {
  nodeEvents.set(element, events);

  for (const [eventName, listener] of Object.entries(events)) {
    element.addEventListener(eventName, listener);
  }
}

/** 노드에 연결된 handler map. 연결한 적이 없으면 undefined다. */
export function getNodeEvents(node: Node): VNodeEventMap | undefined {
  return nodeEvents.get(node);
}
