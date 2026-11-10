import type { VNode, VNodeEventMap, VRoot } from './types';

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

/**
 * next 트리를 순회하며 실제 노드의 handler 연결을 최신 VNode에 맞춘다.
 * 새로 만든 노드는 renderNode()가 이미 연결·기록했으므로 비교 결과가 같음이 된다.
 * DOM 데이터가 바뀌지 않은 갱신에서도 호출된다.
 */
export function syncEvents(root: VRoot): void {
  for (const node of root.childNodes) {
    syncNodeEvents(node);
  }
}

function syncNodeEvents(node: VNode): void {
  if (node.nodeType === 1) {
    syncElementEvents(node);
  }

  for (const child of node.childNodes) {
    syncNodeEvents(child);
  }
}

function syncElementEvents(node: VNode): void {
  if (node.dom === null) {
    throw new Error('syncEvents: VNode.dom is not linked');
  }

  if (!(node.dom instanceof Element)) {
    throw new Error('syncEvents: element VNode dom is not an Element');
  }

  replaceNodeEvents(node.dom, node.events ?? {});
}

// 기록과 다음 map을 비교해 바뀐 listener만 제거하고 추가한다.
function replaceNodeEvents(element: Element, nextEvents: VNodeEventMap): void {
  const previousEvents = nodeEvents.get(element) ?? {};

  for (const [eventName, listener] of Object.entries(previousEvents)) {
    if (nextEvents[eventName] === listener) continue;
    element.removeEventListener(eventName, listener);
  }

  for (const [eventName, listener] of Object.entries(nextEvents)) {
    if (previousEvents[eventName] === listener) continue;
    element.addEventListener(eventName, listener);
  }

  if (Object.keys(nextEvents).length === 0) {
    // event가 모두 사라진 노드는 이후 갱신에서 비교할 기록도 남기지 않는다.
    nodeEvents.delete(element);
    return;
  }

  nodeEvents.set(element, nextEvents);
}
