/**
 * Phase 2 공개 경계.
 * 아직 구현 전인 함수는 테스트가 이 경계를 통해 실패하는지 확인하는 단계다.
 */
import { propertySchema } from '../vdom/create';
import type {
  VNode,
  VNodeAttribute,
  VNodeEventMap,
  VNodeProperties
} from '../vdom/types';

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

export function startApp(_component: () => unknown, _container: Element): void {
  throw new Error('startApp() is not implemented');
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
