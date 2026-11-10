/**
 * Phase 2 공개 경계.
 * 아직 구현하지 않은 Hook은 호출 시 오류를 던져 테스트 실패 원인을 드러낸다.
 */
import { propertySchema } from '../vdom/create';
import { diff } from '../vdom/diff';
import { syncEvents } from '../vdom/events';
import { applyPatch, renderChildren } from '../vdom/patch';
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

type HookPhase = 'mount' | 'update';

type HookKind = 'state' | 'memo' | 'effect';

type StateSetter<T> = (next: T | ((prev: T) => T)) => void;

// Hook 기록은 호출 순서가 정체성이다. 같은 위치의 종류가 다르면 다른 Hook으로 바뀐 것이다.
type StateHookSlot = {
  kind: 'state';
  value: unknown;
  setter: StateSetter<unknown>;
};

// useMemo는 결과와 그 결과를 만든 deps를 함께 보관해야 다음 render에서 재사용 여부를 판단한다.
type MemoHookSlot = {
  kind: 'memo';
  value: unknown;
  deps: readonly unknown[];
};

// useEffect의 실행 후보·deps 기록은 #59에서 이 자리에 채운다.
type EffectHookSlot = {
  kind: 'effect';
};

type HookSlot = StateHookSlot | MemoHookSlot | EffectHookSlot;

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

export function useState<T>(initialValue: T): [T, StateSetter<T>] {
  const instance = requireHookOwner('useState');
  const slot = claimHookSlot(instance, 'state', () =>
    createStateHookSlot(instance, initialValue)
  );

  return [slot.value as T, slot.setter as StateSetter<T>];
}

export function useMemo<T>(calculate: () => T, deps: readonly unknown[]): T {
  const instance = requireHookOwner('useMemo');
  const nextDeps = assertMemoDependencies(deps);

  // mount에서는 기록 생성과 첫 계산을 함께 끝낸다. 계산이 실패하면 기록도 남지 않는다.
  const slot = claimHookSlot(instance, 'memo', () =>
    createMemoHookSlot(calculate, nextDeps)
  );

  // mount에서 방금 만든 기록은 같은 deps를 가지므로 이 비교를 그대로 통과한다.
  if (areHookDepsEqual(slot.deps, nextDeps)) return slot.value as T;

  return updateMemoHookSlot(slot, calculate, nextDeps);
}

export function useEffect(
  _effect: () => void | (() => void),
  _deps?: unknown[]
): void {
  const instance = requireHookOwner('useEffect');

  // 종류 검사는 useEffect 동작(#59) 이전에 공통 Hook 문맥 규칙으로 수행한다.
  claimHookSlot(instance, 'effect', () => ({ kind: 'effect' }));
  throw new Error('useEffect() is not implemented');
}

/**
 * 루트 컴포넌트의 실행 상태. 사용자 API로 노출하지 않고 startApp 내부에서만 쓴다.
 */
class FunctionComponent {
  readonly component: ComponentFunction;
  readonly container: Element;
  hooks: HookSlot[] = [];
  cursor = 0;
  phase: HookPhase = 'mount';
  currentVDOM: VRoot | null = null;
  updateScheduled = false;

  constructor(component: ComponentFunction, container: Element) {
    this.component = component;
    this.container = container;
  }

  /**
   * 최초 렌더링. 반환값 검증이 끝난 뒤에만 컨테이너를 교체하므로
   * 컴포넌트 오류는 DOM을 건드리지 않고 호출자에게 전파된다.
   */
  mount(): void {
    const root = createVRoot(renderComponent(this, 'mount'));
    renderChildren(root, this.container);

    // 성공한 렌더만 비교 기준이 된다. 실패한 렌더는 이전 화면을 덮어쓰지 않는다.
    this.currentVDOM = root;

    // effect 실행은 commit 뒤 단계로 #59에서 추가한다.
  }

  /**
   * 상태 변경 뒤 재렌더링. 단계마다 실패 지점과 성공 시점이 코드에서 바로 읽히게 한다.
   */
  update(): void {
    const previousRoot = this.currentVDOM;
    if (previousRoot === null) {
      throw new Error('mount() 이전에는 update()를 실행할 수 없습니다');
    }

    const nextRoot = createVRoot(renderComponent(this, 'update'));
    const changes = diff(previousRoot, nextRoot);

    // DOM 변경이 없으면 Patch는 생략하지만 event 동기화는 화면 데이터와 무관하게 수행한다.
    if (changes.length > 0) {
      applyPatch(previousRoot, nextRoot, changes);
    }

    syncEvents(nextRoot);

    // 성공한 갱신만 현재 VDOM이 된다. 실패한 갱신은 마지막 성공 상태를 덮어쓰지 않는다.
    this.currentVDOM = nextRoot;

    // effect 실행은 commit 뒤 단계로 #59에서 추가한다.
  }
}

/**
 * 컴포넌트를 실행하고 반환값을 VNode 목록으로 정규화한다.
 * DOM 생성 전에 검증하므로 잘못된 반환값이 부분 화면을 남기지 않는다.
 */
function renderComponent(
  instance: FunctionComponent,
  phase: HookPhase
): VNode[] {
  beginHooks(instance, phase);

  try {
    const result = instance.component();
    assertHookCountConsumed(instance, phase);
    return normalizeComponentResult(result);
  } finally {
    endHooks();
  }
}

// Hook 슬롯을 호출 순서대로 꺼내고, mount에서만 새 기록을 만든다.
function claimHookSlot<T extends HookSlot>(
  instance: FunctionComponent,
  kind: HookKind,
  create: () => T
): T {
  const index = instance.cursor;

  if (index >= instance.hooks.length) {
    // 개수가 늘어난 render는 같은 위치의 Hook 기록을 새로 만들 수 없다.
    if (instance.phase !== 'mount') {
      throw new Error(`render 사이에 Hook 개수가 늘었습니다: ${kind}`);
    }

    const slot = create();
    instance.hooks.push(slot);
    instance.cursor += 1;
    return slot;
  }

  const slot = instance.hooks[index]!;
  if (slot.kind !== kind) {
    throw new Error(
      `Hook 종류가 render 사이에 바뀌었습니다: ${slot.kind} → ${kind}`
    );
  }

  instance.cursor += 1;
  return slot as T;
}

function createStateHookSlot<T>(
  instance: FunctionComponent,
  initialValue: T
): StateHookSlot {
  const slot: StateHookSlot = {
    kind: 'state',
    value: initialValue,
    // setter는 소유 인스턴스와 자기 슬롯을 기억해야 render가 바뀌어도 같은 기록을 갱신한다.
    setter: (next) => {
      applyStateUpdate(instance, slot, next);
    }
  };

  return slot;
}

function assertMemoDependencies(deps: unknown): readonly unknown[] {
  // useMemo의 deps는 생략할 수 없다. 생략(undefined)과 비배열을 같은 검사로 거른다.
  if (!Array.isArray(deps)) {
    throw new Error(`useMemo의 deps는 배열이어야 합니다: ${describeValue(deps)}`);
  }

  return deps;
}

function areHookDepsEqual(
  previous: readonly unknown[],
  next: readonly unknown[]
): boolean {
  // deps 배열은 render마다 새로 만들어지므로 배열 참조가 아니라 길이와 각 값을 비교한다.
  // Object.is는 useState의 값 비교와 같은 규칙(NaN 동일, +0/-0 구분)을 쓴다.
  if (previous.length !== next.length) return false;

  for (let index = 0; index < next.length; index += 1) {
    if (!Object.is(previous[index], next[index])) return false;
  }

  return true;
}

function createMemoHookSlot<T>(
  calculate: () => T,
  deps: readonly unknown[]
): MemoHookSlot {
  // 계산이 끝난 뒤에만 기록을 만들므로 첫 render의 계산 오류가 빈 기록을 남기지 않는다.
  return { kind: 'memo', value: calculate(), deps };
}

function updateMemoHookSlot<T>(
  slot: MemoHookSlot,
  calculate: () => T,
  deps: readonly unknown[]
): T {
  const value = calculate();

  // 계산이 성공한 뒤에만 기록을 바꾼다. 실패한 계산의 deps가 남으면 다음 render가
  // 실제로 만들어지지 않은 결과를 캐시로 신뢰하게 된다.
  slot.value = value;
  slot.deps = deps;

  return value;
}

function applyStateUpdate(
  instance: FunctionComponent,
  slot: StateHookSlot,
  next: unknown | ((prev: unknown) => unknown)
): void {
  const previous = slot.value;
  const value =
    typeof next === 'function'
      ? (next as (prev: unknown) => unknown)(previous)
      : next;

  // Object.is는 NaN을 같은 값으로, +0과 -0을 다른 값으로 판정한다.
  // 같은 값이면 슬롯도 쓰지 않고 갱신도 예약하지 않는다.
  if (Object.is(previous, value)) return;

  slot.value = value;
  scheduleUpdate(instance);
}

function scheduleUpdate(instance: FunctionComponent): void {
  // 인스턴스별 예약은 1회만 유지한다. 처리 중 들어온 setter는 현재 처리 뒤의
  // microtask로 이어지므로 중첩 update를 만들지 않는다.
  if (instance.updateScheduled) return;

  instance.updateScheduled = true;
  queueMicrotask(() => {
    instance.updateScheduled = false;
    instance.update();
  });
}

let activeHookOwner: FunctionComponent | null = null;

function beginHooks(instance: FunctionComponent, phase: HookPhase): void {
  activeHookOwner = instance;
  instance.cursor = 0;
  instance.phase = phase;
}

function endHooks(): void {
  // 오류가 나도 Hook 실행 문맥은 finally에서 해제한다. 오류 자체는 잡지 않는다.
  activeHookOwner = null;
}

function requireHookOwner(hookName: string): FunctionComponent {
  if (activeHookOwner === null) {
    throw new Error(
      `${hookName}()는 컴포넌트 실행 중에만 호출할 수 있습니다`
    );
  }

  return activeHookOwner;
}

// update에서 모든 Hook 기록을 소비했는지 확인한다. 남은 기록은 개수가 줄었다는 뜻이다.
function assertHookCountConsumed(
  instance: FunctionComponent,
  phase: HookPhase
): void {
  if (phase === 'update' && instance.cursor !== instance.hooks.length) {
    throw new Error(
      `render 사이에 Hook 개수가 줄었습니다: ${instance.hooks.length} → ${instance.cursor}`
    );
  }
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
