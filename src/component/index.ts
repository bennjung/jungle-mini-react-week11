/**
 * Phase 2 공개 경계.
 * 아직 구현하지 않은 Hook은 호출 시 오류를 던져 테스트 실패 원인을 드러낸다.
 */
import { propertySchema } from '../vdom/create';
import { diff } from '../vdom/diff';
import { syncEvents } from '../vdom/events';
import { applyPatch, renderChildren } from '../vdom/patch';
import type {
  DiffCommand,
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

type EffectCleanup = () => void;

type EffectHandler = () => void | EffectCleanup;

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

// useEffect는 이번 render의 실행 후보와 마지막으로 실행된 기준을 분리해 보관한다.
// commit이 실패하면 후보를 소비하지 않고, 성공한 실행만 다음 비교의 기준이 된다.
type EffectHookSlot = {
  kind: 'effect';
  effect: EffectHandler;
  deps: readonly unknown[] | undefined;
  nextDeps: readonly unknown[] | undefined;
  cleanup: EffectCleanup | null;
  shouldRun: boolean;
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
  effect: EffectHandler,
  deps?: readonly unknown[]
): void {
  const instance = requireHookOwner('useEffect');
  const nextDeps = assertEffectDependencies(deps);
  const isMounting = instance.phase === 'mount';

  const slot = claimHookSlot(instance, 'effect', () =>
    createEffectHookSlot(effect, nextDeps)
  );

  // mount에서 만든 기록은 이번 commit 뒤에 첫 실행을 기다린다. 여기서 다시 비교하면
  // 방금 기록한 deps와 같아져 첫 실행을 잃는다.
  if (isMounting) return;

  registerEffectForCommit(slot, effect, nextDeps);
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
  /**
   * 이번 갱신이 시작되기 전 Hook 슬롯 필드의 얕은 복사본.
   * applyPatch 실패 시 화면과 내부 상태를 같은 시점으로 되돌리는 기준이다.
   */
  hooksBeforeUpdate: HookSlot[] | null = null;

  constructor(component: ComponentFunction, container: Element) {
    this.component = component;
    this.container = container;
  }

  /**
   * 첫 setter가 값을 쓰기 전에 슬롯을 복사한다.
   * 갱신 시작 시점에 복사하면 이미 새 값이 들어 있어 되돌릴 수 없다.
   */
  rememberHooksBeforeUpdate(): void {
    // 여러 setter가 한 배치에 들어와도 시작 상태는 하나다. 첫 복사본만 유지한다.
    if (this.hooksBeforeUpdate !== null) return;

    this.hooksBeforeUpdate = this.hooks.map(copyHookSlot);
  }

  /**
   * applyPatch 실패 시 슬롯 필드만 복사본의 값으로 되돌린다.
   * setter가 슬롯 객체를 직접 참조하므로 배열이나 객체 동일성은 바꾸지 않는다.
   */
  restoreHooksBeforeUpdate(): void {
    const snapshot = this.hooksBeforeUpdate;
    if (snapshot === null) return;

    for (let index = 0; index < snapshot.length; index += 1) {
      const slot = this.hooks[index];
      const saved = snapshot[index];
      if (slot === undefined || saved === undefined) continue;

      Object.assign(slot, saved);
    }

    this.discardHooksBeforeUpdate();
  }

  /** 성공한 갱신이 끝나면 복사본을 버려 다음 배치가 새 시작 상태를 복사하게 한다. */
  discardHooksBeforeUpdate(): void {
    this.hooksBeforeUpdate = null;
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

    // 효과는 VDOM 교체까지 끝난 성공한 commit 뒤에 실행한다.
    runEffects(this);
  }

  /**
   * 상태 변경 뒤 재렌더링. 단계마다 실패 지점과 성공 시점이 코드에서 바로 읽히게 한다.
   */
  update(): void {
    const previousRoot = this.currentVDOM;
    if (previousRoot === null) {
      throw new Error('mount() 이전에는 update()를 실행할 수 없습니다');
    }

    try {
      const nextRoot = createVRoot(renderComponent(this, 'update'));
      const changes = diff(previousRoot, nextRoot);

      // DOM 변경이 없으면 Patch는 생략하지만 event 동기화는 화면 데이터와 무관하게 수행한다.
      if (changes.length > 0) {
        applyPatchOrRestore(this, previousRoot, nextRoot, changes);
      }

      syncEvents(nextRoot);

      // 성공한 갱신만 현재 VDOM이 된다. 실패한 갱신은 마지막 성공 상태를 덮어쓰지 않는다.
      this.currentVDOM = nextRoot;
    } finally {
      // 성공·실패 모두 이번 갱신의 복사본은 commit 경계에서 끝난다. applyPatch 실패는
      // 예외를 전파하기 전에 복원을 마쳤으므로 여기서는 남은 복사본만 버린다.
      this.discardHooksBeforeUpdate();
    }

    // effect 안 setter는 다음 갱신으로 이어진다. 복사본을 버린 뒤 실행해야 그 setter가
    // 새 배치의 시작 상태를 복사할 수 있다. 화면 변경이 없어도 효과 판단은 생략하지 않는다.
    runEffects(this);
  }
}

/**
 * DOM 변경을 적용한다. 실패하면 마지막 성공 화면과 내부 상태를 함께 되돌린 뒤 원래 오류를 전파한다.
 * 이 복구 경로에서는 event 동기화와 effect를 실행하지 않는다.
 */
function applyPatchOrRestore(
  instance: FunctionComponent,
  previousRoot: VRoot,
  nextRoot: VRoot,
  changes: DiffCommand[]
): void {
  try {
    applyPatch(previousRoot, nextRoot, changes);
  } catch (error) {
    restorePatchFailure(instance, previousRoot);
    throw error;
  }
}

/**
 * 실패한 갱신의 화면과 내부 상태를 갱신 시작 전 시점으로 함께 되돌린다.
 * 두 상태가 같은 시점을 가리켜야 다음 setter가 새 변경으로 예약된다.
 */
function restorePatchFailure(
  instance: FunctionComponent,
  previousRoot: VRoot
): void {
  restoreLastCommittedRoot(instance, previousRoot);
  instance.restoreHooksBeforeUpdate();

  // 복원 직후 다음 setter가 새 갱신을 예약할 수 있게 한다.
  instance.updateScheduled = false;
}

function restoreLastCommittedRoot(
  instance: FunctionComponent,
  previousRoot: VRoot
): void {
  try {
    // renderChildren은 마지막 성공 VDOM의 VNode.dom을 새 DOM으로 다시 연결한다.
    // 그래야 다음 갱신의 diff가 방금 복구한 실제 화면을 기준으로 비교할 수 있다.
    renderChildren(previousRoot, instance.container);
  } catch {
    // 복구 중 오류는 원래 반영 오류를 가리지 않는다. 이후 동작은 보장하지 않는다.
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

/**
 * 슬롯 필드만 새 객체로 복사한다. 상태 값 자체는 참조를 유지하는 얕은 복사다.
 * 값 객체를 제자리에서 바꾸는 사용은 React와 같은 불변 전제를 따르므로 지원하지 않는다.
 */
function copyHookSlot(slot: HookSlot): HookSlot {
  return { ...slot };
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

function createEffectHookSlot(
  effect: EffectHandler,
  deps: readonly unknown[] | undefined
): EffectHookSlot {
  // deps는 효과가 성공적으로 실행된 뒤에 기록한다. mount의 첫 실행은 runEffects가 맡는다.
  return {
    kind: 'effect',
    effect,
    deps: undefined,
    nextDeps: deps,
    cleanup: null,
    shouldRun: true
  };
}

function assertEffectDependencies(
  deps: unknown
): readonly unknown[] | undefined {
  // deps 생략은 "매 render 실행"이라는 뜻이므로 undefined만 허용한다.
  if (deps === undefined) return undefined;

  if (!Array.isArray(deps)) {
    throw new Error(
      `useEffect의 deps는 배열이거나 생략해야 합니다: ${describeValue(deps)}`
    );
  }

  return deps;
}

function registerEffectForCommit(
  slot: EffectHookSlot,
  effect: EffectHandler,
  nextDeps: readonly unknown[] | undefined
): void {
  // 이번 render의 효과와 deps를 후보로 남기고, commit 뒤 실행 여부만 지금 판단한다.
  slot.effect = effect;
  slot.nextDeps = nextDeps;
  slot.shouldRun = shouldRunEffect(slot, nextDeps);
}

function shouldRunEffect(
  slot: EffectHookSlot,
  nextDeps: readonly unknown[] | undefined
): boolean {
  // deps를 생략한 효과는 비교 기준 없이 매 render 실행한다.
  if (nextDeps === undefined) return true;

  // 이전 실행이 deps 없이 끝났다면 비교할 배열이 없다. 이번 render부터 새 기준을 만든다.
  if (slot.deps === undefined) return true;

  return !areHookDepsEqual(slot.deps, nextDeps);
}

function runEffects(instance: FunctionComponent): void {
  // Hook 호출 순서가 효과의 실행·정리 순서다. 각 효과의 cleanup과 실행 사이에
  // 다음 효과를 끼워 넣지 않고, 오류가 나면 남은 효과는 실행하지 않는다.
  for (const slot of instance.hooks) {
    if (slot.kind !== 'effect' || !slot.shouldRun) continue;
    runEffectSlot(slot);
  }
}

function runEffectSlot(slot: EffectHookSlot): void {
  runEffectCleanup(slot);

  const cleanup = invokeEffect(slot.effect);

  // 실행이 성공한 뒤에만 비교 기준을 갱신한다. 실패한 효과의 deps가 남으면
  // 다음 render가 실행되지 않은 효과를 최신으로 오해한다.
  slot.cleanup = cleanup;
  slot.deps = slot.nextDeps;
  slot.shouldRun = false;
}

function runEffectCleanup(slot: EffectHookSlot): void {
  const cleanup = slot.cleanup;
  if (cleanup === null) return;

  // cleanup을 다시 실행하지 않도록 호출 전에 비운다. cleanup 오류는 잡지 않고 전파한다.
  slot.cleanup = null;
  cleanup();
}

function invokeEffect(effect: EffectHandler): EffectCleanup | null {
  const cleanup = effect();

  if (cleanup === undefined) return null;

  // async effect의 Promise나 `return setInterval(...)`의 숫자를 cleanup으로 저장하지 않는다.
  if (typeof cleanup !== 'function') {
    throw new Error(
      `useEffect의 반환값은 cleanup 함수 또는 undefined여야 합니다: ${describeValue(cleanup)}`
    );
  }

  return cleanup;
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

  // 되돌릴 기준은 setter가 값을 쓰기 전 상태다. 갱신이 시작된 뒤에 복사하면 이미 새 값이
  // 들어 있으므로, 첫 setter에서 값 대입보다 먼저 이번 배치의 복사본을 만든다.
  instance.rememberHooksBeforeUpdate();

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
