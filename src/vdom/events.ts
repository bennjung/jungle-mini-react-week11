import type { VNode, VNodeEventMap, VRoot } from './types';

/**
 * 이벤트 뒤 최신 VDOM 정보와 대상 확인을 연결하는 Component 소유 정보.
 * events 모듈은 콜백 정체성만 비교하고, context 객체 자체의 동일성은 요구하지 않는다.
 */
export type EventContext = {
  recordVNode: (node: VNode) => void;
  requestInputCheck: (target: Element) => void;
};

type RequestInputCheck = (target: Element) => void;

/**
 * 실제 DOM 노드에 마지막으로 연결한 handler 기록.
 * original은 VNode가 준 handler이고 wrapper는 실제 addEventListener에 넘긴 함수다.
 * 재연결 여부는 original과 요청 콜백의 정체성으로 판단하고, 제거는 wrapper로 한다.
 */
type BoundEvent = {
  original: EventListener;
  wrapper: EventListener;
  requestInputCheck: RequestInputCheck | null;
};

type ElementEventMap = Map<string, BoundEvent>;

/**
 * VNode는 갱신마다 새로 만들어지므로, handler 추가·교체·제거를 판단할 기준은
 * 실제 노드에 남아 있는 이 기록이어야 한다. 최신 VDOM 정보 기록과 listener 수명은
 * 이 map에서 분리해 다룬다.
 */
const nodeEvents = new WeakMap<Element, ElementEventMap>();

/** 조합 중 여부는 요소 기준 약한 기록으로 관리한다. input의 isComposing과 compositionend로 갱신한다. */
const composingElements = new WeakMap<Element, boolean>();

type CompositionTracker = {
  start: EventListener;
  end: EventListener;
};

const compositionTrackers = new WeakMap<Element, CompositionTracker>();

const inputLikeEvents: ReadonlySet<string> = new Set(['input', 'change']);

/** input/change wrapper가 남긴 조합 상태를 읽는다. 조합 중에는 값 보정을 막는 판단에 쓴다. */
export function isComposing(element: Element): boolean {
  return composingElements.get(element) === true;
}

/**
 * 새 요소에 VNode의 handler를 직접 연결하고 같은 map을 기록한다.
 * 기록 시점과 연결 시점을 한 곳에 두어 실제 연결과 기록이 어긋나지 않게 한다.
 * context가 없으면 Phase 1과 같이 원본 handler를 그대로 연결한다.
 */
export function bindEvents(
  element: Element,
  events: VNodeEventMap,
  context?: EventContext
): void {
  const requestInputCheck = context?.requestInputCheck ?? null;
  const boundEvents: ElementEventMap = new Map();

  for (const [eventName, listener] of Object.entries(events)) {
    const bound = createBoundEvent(
      element,
      eventName,
      listener,
      requestForEvent(eventName, requestInputCheck)
    );
    element.addEventListener(eventName, bound.wrapper);
    boundEvents.set(eventName, bound);
  }

  updateCompositionTrackers(element, boundEvents);
  nodeEvents.set(element, boundEvents);
}

/**
 * next 트리를 순회하며 실제 노드의 handler 연결을 최신 VNode에 맞춘다.
 * 새로 만든 노드는 renderNode()가 이미 연결·기록했으므로 비교 결과가 같음이 된다.
 * DOM 데이터가 바뀌지 않은 갱신에서도 호출된다.
 */
export function syncEvents(root: VRoot, context?: EventContext): void {
  for (const node of root.childNodes) {
    syncNodeEvents(node, context);
  }
}

function syncNodeEvents(node: VNode, context?: EventContext): void {
  if (node.nodeType === 1) {
    syncElementEvents(node, context);
  }

  for (const child of node.childNodes) {
    syncNodeEvents(child, context);
  }
}

function syncElementEvents(node: VNode, context?: EventContext): void {
  if (node.dom === null) {
    throw new Error('syncEvents: VNode.dom is not linked');
  }

  if (!(node.dom instanceof Element)) {
    throw new Error('syncEvents: element VNode dom is not an Element');
  }

  // renderNode()와 같은 기록을 이 순회에서도 남긴다. Component는 이 기록으로 대상 VNode를 찾는다.
  context?.recordVNode(node);

  replaceNodeEvents(node.dom, node.events ?? {}, context);
}

// 기록과 다음 map을 비교해 바뀐 listener만 제거하고 추가한다.
function replaceNodeEvents(
  element: Element,
  nextEvents: VNodeEventMap,
  context?: EventContext
): void {
  const previousEvents = nodeEvents.get(element) ?? new Map<string, BoundEvent>();
  const requestInputCheck = context?.requestInputCheck ?? null;
  const nextBoundEvents: ElementEventMap = new Map();
  const additions: Array<[string, BoundEvent]> = [];

  for (const [eventName, listener] of Object.entries(nextEvents)) {
    const nextRequest = requestForEvent(eventName, requestInputCheck);
    const previous = previousEvents.get(eventName);

    // context 객체가 달라도 같은 원본 handler와 같은 요청 콜백이면 wrapper를 그대로 쓴다.
    if (
      previous !== undefined &&
      previous.original === listener &&
      previous.requestInputCheck === nextRequest
    ) {
      nextBoundEvents.set(eventName, previous);
      continue;
    }

    const bound = createBoundEvent(element, eventName, listener, nextRequest);
    nextBoundEvents.set(eventName, bound);
    additions.push([eventName, bound]);
  }

  for (const [eventName, bound] of previousEvents) {
    if (nextBoundEvents.get(eventName) === bound) continue;
    element.removeEventListener(eventName, bound.wrapper);
  }

  for (const [eventName, bound] of additions) {
    element.addEventListener(eventName, bound.wrapper);
  }

  updateCompositionTrackers(element, nextBoundEvents);

  if (nextBoundEvents.size === 0) {
    // event가 모두 사라진 노드는 이후 갱신에서 비교할 기록도 남기지 않는다.
    nodeEvents.delete(element);
    return;
  }

  nodeEvents.set(element, nextBoundEvents);
}

// input/change만 실제 연결 함수로 감싼다. 다른 event는 원본 handler를 그대로 쓴다.
function createBoundEvent(
  element: Element,
  eventName: string,
  listener: EventListener,
  requestInputCheck: RequestInputCheck | null
): BoundEvent {
  if (requestInputCheck === null) {
    return { original: listener, wrapper: listener, requestInputCheck: null };
  }

  const wrapper: EventListener = (event) => {
    // handler가 요소를 옮기거나 바꿔도 원래 이벤트 대상을 확인 대상으로 남긴다.
    const target = event.target instanceof Element ? event.target : element;

    if (eventName === 'input') {
      trackCompositionFromInput(target, event);
    }

    listener.call(element, event);

    // handler가 정상 종료한 뒤에만 대상 확인을 요청한다. 예외는 그대로 전파한다.
    requestInputCheck(target);
  };

  return { original: listener, wrapper, requestInputCheck };
}

// 요청 콜백은 값을 바꾸는 입력 계열 이벤트에만 연결한다.
function requestForEvent(
  eventName: string,
  requestInputCheck: RequestInputCheck | null
): RequestInputCheck | null {
  if (requestInputCheck === null) return null;
  return inputLikeEvents.has(eventName) ? requestInputCheck : null;
}

// input 이벤트가 실제로 전달한 조합 상태만 반영한다. 값이 없는 일반 Event는 이전 상태를 유지한다.
function trackCompositionFromInput(target: Element, event: Event): void {
  if (!('isComposing' in event)) return;

  const composing: unknown = (event as InputEvent).isComposing;
  if (typeof composing !== 'boolean') return;

  composingElements.set(target, composing);
}

function updateCompositionTrackers(
  element: Element,
  events: ElementEventMap
): void {
  let needsCompositionTracking = false;

  for (const eventName of events.keys()) {
    if (inputLikeEvents.has(eventName)) {
      needsCompositionTracking = true;
      break;
    }
  }

  if (needsCompositionTracking) {
    ensureCompositionTrackers(element);
    return;
  }

  removeCompositionTrackers(element);
}

function ensureCompositionTrackers(element: Element): void {
  if (compositionTrackers.has(element)) return;

  const start: EventListener = (event) => {
    setCompositionTarget(event, true);
  };
  const end: EventListener = (event) => {
    setCompositionTarget(event, false);
  };

  element.addEventListener('compositionstart', start);
  element.addEventListener('compositionend', end);
  compositionTrackers.set(element, { start, end });
}

function removeCompositionTrackers(element: Element): void {
  const tracker = compositionTrackers.get(element);
  if (tracker === undefined) return;

  element.removeEventListener('compositionstart', tracker.start);
  element.removeEventListener('compositionend', tracker.end);
  compositionTrackers.delete(element);
  // 더 이상 조합 종료를 관찰할 수 없으므로 남은 조합 기록도 확정하지 않는다.
  composingElements.delete(element);
}

// 조합 이벤트는 버블링될 수 있으므로 실제 입력 요소(target)에 상태를 남긴다.
function setCompositionTarget(event: Event, composing: boolean): void {
  if (event.target instanceof Element) {
    composingElements.set(event.target, composing);
  }
}
