/**
 * Phase 2 공개 경계.
 * 아직 구현하지 않은 Hook은 호출 시 오류를 던져 테스트 실패 원인을 드러낸다.
 */
import { propertySchema } from '../vdom/create';
import { renderChildren } from '../vdom/patch';
import type {
  VNode,
  VNodeAttribute,
  VNodeEventMap,
  VNodeProperties,
  VRoot
} from '../vdom/types';

type ComponentFunction = () => unknown;

type ClassifiedProps = {
  attributes: VNodeAttribute[];
  properties: VNodeProperties;
  events: VNodeEventMap;
};

// 이벤트 prop 이름은 사용자 표기(onClick)를, 값은 실제 DOM 이벤트 이름을 쓴다.
const eventNameByProp: Readonly<Record<string, string>> = {
  onClick: 'click',
  onInput: 'input',
  onChange: 'change'
};

export function h(
  tagName: string,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
): VNode {
  const normalizedTagName = normalizeTagName(tagName);
  const { attributes, properties, events } = classifyProps(normalizedTagName, props);

  const node: VNode = {
    nodeType: 1,
    tagName: normalizedTagName,
    attributes,
    nodeValue: null,
    childNodes: normalizeChildren(children),
    properties,
    dom: null
  };

  // 1단계 VNode와 같은 모양을 유지하려고 이벤트가 없으면 필드 자체를 만들지 않는다.
  if (Object.keys(events).length > 0) node.events = events;

  return node;
}

/**
 * 컨테이너별 1회 시작 표식.
 * 첫 렌더가 실패해도 해제하지 않는다. 부분 화면이 남은 컨테이너를 다시 시작하면
 * 이전 실패의 흔적 위에 새 앱이 겹치기 때문이다.
 */
const startedContainers = new WeakSet<Element>();

export function startApp(component: ComponentFunction, container: Element): void {
  assertStartContainer(container);

  // 검증 직후 사용 중으로 등록한다. 첫 렌더가 실패해도 같은 컨테이너는 재사용할 수 없다.
  startedContainers.add(container);

  new FunctionComponent(component, container).mount();
}

export function useState<T>(
  _initialValue: T
): [T, (next: T | ((prev: T) => T)) => void] {
  throw new Error('useState() is not implemented');
}

export function useMemo<T>(_calculate: () => T, _deps: unknown[]): T {
  throw new Error('useMemo() is not implemented');
}

export function useEffect(
  _effect: () => void | (() => void),
  _deps?: unknown[]
): void {
  throw new Error('useEffect() is not implemented');
}

/**
 * 루트 컴포넌트의 실행 상태. 사용자 API로 노출하지 않고 startApp 내부에서만 쓴다.
 */
class FunctionComponent {
  readonly component: ComponentFunction;
  readonly container: Element;
  // Hook 기록은 #57에서 이 자리에 채운다. 지금은 mount가 소비하지 않는다.
  hooks: unknown[] = [];
  cursor = 0;
  currentVDOM: VRoot | null = null;

  constructor(component: ComponentFunction, container: Element) {
    this.component = component;
    this.container = container;
  }

  /**
   * 최초 렌더링. 반환값 검증이 끝난 뒤에만 컨테이너를 교체하므로
   * 컴포넌트 오류는 DOM을 건드리지 않고 호출자에게 전파된다.
   */
  mount(): void {
    const root = createVRoot(renderComponent(this));
    renderChildren(root, this.container);

    // 성공한 렌더만 비교 기준이 된다. 실패한 렌더는 이전 화면을 덮어쓰지 않는다.
    this.currentVDOM = root;

    // effect 실행은 commit 뒤 단계로 #59에서 추가한다.
  }
}

/**
 * 컴포넌트를 실행하고 반환값을 VNode 목록으로 정규화한다.
 * DOM 생성 전에 검증하므로 잘못된 반환값이 부분 화면을 남기지 않는다.
 */
function renderComponent(instance: FunctionComponent): VNode[] {
  // Hook 문맥 연결과 cursor 초기화는 Hook 구현(#57)과 함께 이 단계에 들어온다.
  const result = instance.component();
  return normalizeComponentResult(result);
}

/**
 * 컴포넌트 반환값을 자식 VNode 목록으로 바꾼다.
 * h()와 달리 원시 문자열·숫자를 Text VNode로 바꾸지 않는다. 텍스트는 h()에서만 만든다.
 */
function normalizeComponentResult(value: unknown): VNode[] {
  const nodes: VNode[] = [];
  appendComponentResult(nodes, value);
  return nodes;
}

function appendComponentResult(nodes: VNode[], value: unknown): void {
  if (isIgnoredChild(value)) return;

  // 배열은 화면 조각 목록이므로 Fragment 노드 없이 자식 목록 자체를 펼친다.
  if (Array.isArray(value)) {
    for (const item of value) {
      appendComponentResult(nodes, item);
    }
    return;
  }

  if (isVNode(value)) {
    nodes.push(value);
    return;
  }

  throw new Error(
    `컴포넌트 반환값으로 지원하지 않는 값입니다: ${describeValue(value)}`
  );
}

function createVRoot(nodes: VNode[]): VRoot {
  return { childNodes: nodes, dom: null };
}

function assertStartContainer(container: Element): void {
  if (!(container instanceof Element)) {
    throw new Error('startApp의 container는 Element여야 합니다');
  }

  if (startedContainers.has(container)) {
    throw new Error('이미 startApp으로 시작한 container입니다');
  }
}

function normalizeTagName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('tagName은 문자열이어야 합니다');
  }

  // Phase 1 createSnapshot과 같은 대문자 표기를 써야 Diff가 같은 노드로 인식한다.
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error('tagName은 비어 있을 수 없습니다');
  }

  return trimmed.toUpperCase();
}

function classifyProps(
  tagName: string,
  props?: Record<string, unknown> | null
): ClassifiedProps {
  const classified: ClassifiedProps = {
    attributes: [],
    properties: {},
    events: {}
  };

  for (const [name, value] of Object.entries(props ?? {})) {
    classifyProp(classified, tagName, name, value);
  }

  return classified;
}

function classifyProp(
  classified: ClassifiedProps,
  tagName: string,
  name: string,
  value: unknown
): void {
  if (isEventProp(name)) {
    addEvent(classified.events, name, value);
    return;
  }

  if (isPropertyProp(tagName, name)) {
    // properties는 DOM 프로퍼티에 그대로 대입되므로 타입을 강제 변환하지 않는다.
    classified.properties[name] = value;
    return;
  }

  addAttribute(classified.attributes, normalizeAttributeName(name), value);
}

function isEventProp(name: string): boolean {
  return name.startsWith('on');
}

function isPropertyProp(tagName: string, name: string): boolean {
  return (propertySchema[tagName] ?? []).includes(name);
}

function normalizeAttributeName(name: string): string {
  return name === 'className' ? 'class' : name;
}

function addAttribute(
  attributes: VNodeAttribute[],
  name: string,
  value: unknown
): void {
  if (value === null || value === undefined || value === false) return;

  // style·dataset 같은 객체를 "[object Object]" 문자열로 조용히 바꾸지 않는다.
  if (typeof value === 'object') {
    throw new Error(`지원하지 않는 prop 값입니다: ${name} (${describeValue(value)})`);
  }

  attributes.push({ name, value: value === true ? '' : String(value) });
}

function addEvent(
  events: VNodeEventMap,
  propName: string,
  value: unknown
): void {
  const eventName = eventNameByProp[propName];
  if (eventName === undefined) {
    throw new Error(`지원하지 않는 이벤트 prop입니다: ${propName}`);
  }

  if (value === null || value === undefined) return;

  if (typeof value !== 'function') {
    throw new Error(`이벤트 prop 값은 함수여야 합니다: ${propName}`);
  }

  events[eventName] = value as EventListener;
}

function normalizeChildren(values: unknown[]): VNode[] {
  const nodes: VNode[] = [];

  for (const value of values) {
    appendChild(nodes, value);
  }

  return nodes;
}

function appendChild(nodes: VNode[], value: unknown): void {
  if (isIgnoredChild(value)) return;

  // Fragment를 별도 노드로 만들지 않고 자식 목록 자체를 펼친다.
  if (Array.isArray(value)) {
    for (const item of value) {
      appendChild(nodes, item);
    }
    return;
  }

  if (typeof value === 'string') {
    appendTextChild(nodes, value);
    return;
  }

  if (typeof value === 'number') {
    appendTextChild(nodes, String(value));
    return;
  }

  if (isVNode(value)) {
    nodes.push(value);
    return;
  }

  throw new Error(`지원하지 않는 자식 값입니다: ${describeValue(value)}`);
}

function isIgnoredChild(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'boolean';
}

function appendTextChild(nodes: VNode[], text: string): void {
  // 빈 문자열은 화면에 아무것도 만들지 않으므로 Text VNode도 만들지 않는다.
  if (text === '') return;

  nodes.push(createTextVNode(text));
}

function createTextVNode(nodeValue: string): VNode {
  return {
    nodeType: 3,
    tagName: null,
    attributes: [],
    nodeValue,
    childNodes: [],
    properties: {},
    dom: null
  };
}

function isVNode(value: unknown): value is VNode {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<VNode>;
  // DOM Node의 childNodes는 NodeList라서 배열 검사에서 걸러진다.
  return (
    (candidate.nodeType === 1 || candidate.nodeType === 3) &&
    Array.isArray(candidate.childNodes)
  );
}

function describeValue(value: unknown): string {
  return Object.prototype.toString.call(value);
}
