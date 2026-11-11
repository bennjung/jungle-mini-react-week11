/**
 * h()와 VNode 값 정규화.
 * VNode를 만드는 규칙만 소유하고 DOM은 만들지 않는다.
 * index.ts는 h를 re-export하고, Component 반환값과 오류 문구에 이 모듈의 helper를 쓴다.
 */
import { propertySchema } from '../vdom/create';
import { isSelectionProperty } from '../vdom/properties';
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

/**
 * 자식 값 순회 정책. h()와 Component 반환값은 무시 값·배열 펼침·VNode 판정을
 * 공유하고, 원시 문자열·숫자를 Text VNode로 바꿀지만 다르다.
 */
type ChildTraversalPolicy = {
  convertPrimitiveToText: boolean;
  unsupportedMessage: string;
};

const hChildPolicy: ChildTraversalPolicy = {
  convertPrimitiveToText: true,
  unsupportedMessage: '지원하지 않는 자식 값입니다'
};

const componentResultPolicy: ChildTraversalPolicy = {
  convertPrimitiveToText: false,
  unsupportedMessage: '컴포넌트 반환값으로 지원하지 않는 값입니다'
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
 * 컴포넌트 반환값을 자식 VNode 목록으로 바꾼다.
 * h()와 달리 원시 문자열·숫자를 Text VNode로 바꾸지 않는다. 텍스트는 h()에서만 만든다.
 */
export function normalizeComponentResult(value: unknown): VNode[] {
  const nodes: VNode[] = [];
  appendChildValue(nodes, value, componentResultPolicy);
  return nodes;
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
  // 명시적 선택 선언은 attribute가 아니라 properties로 전달한다. 자동 읽기와 무관하다.
  if (isSelectionProperty(name)) return true;

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
    appendChildValue(nodes, value, hChildPolicy);
  }

  return nodes;
}

/**
 * 무시 값 제외, 배열 재귀 펼침, VNode 추가, 허용값 오류를 한 곳에서 처리한다.
 * 정책 객체는 원시 문자열·숫자 처리와 오류 문구만 바꾼다.
 */
function appendChildValue(
  nodes: VNode[],
  value: unknown,
  policy: ChildTraversalPolicy
): void {
  if (isIgnoredChild(value)) return;

  // 배열은 화면 조각 목록이므로 Fragment 노드 없이 자식 목록 자체를 펼친다.
  if (Array.isArray(value)) {
    for (const item of value) {
      appendChildValue(nodes, item, policy);
    }
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    if (policy.convertPrimitiveToText) {
      appendTextChild(nodes, String(value));
      return;
    }

    throw new Error(`${policy.unsupportedMessage}: ${describeValue(value)}`);
  }

  if (isVNode(value)) {
    nodes.push(value);
    return;
  }

  throw new Error(`${policy.unsupportedMessage}: ${describeValue(value)}`);
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

export function describeValue(value: unknown): string {
  return Object.prototype.toString.call(value);
}
