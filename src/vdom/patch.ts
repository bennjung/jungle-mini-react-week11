import { bindEvents, isComposing } from './events';
import type { EventContext } from './events';
import {
  isMultiSelectValue,
  isSameDomProperty,
  isSelectionProperty,
  selectionPropertyNames as SELECTION_PROPERTY_NAMES
} from './properties';
import { mapSelection } from './selection';
import type { SelectionRange } from './selection';
import type {
  DiffCommand,
  UpdateData,
  VNode,
  VNodeAttribute,
  VNodeProperties,
  VRoot
} from './types';

// selection API 위치를 읽고 쓸 수 있는 텍스트 입력 요소.
type TextControl = HTMLInputElement | HTMLTextAreaElement;

// 값 쓰기 직전의 실제 문자열과 선택. 자동 위치 대응의 기준이다.
type SelectionSnapshot = {
  value: string;
  selection: SelectionRange;
};

// selection API를 지원하는 input type. 미지원 타입은 값만 반영한다.
const SELECTION_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'url',
  'tel',
  'password'
]);

/**
 * 정렬된 Diff 명령을 실제 DOM에 적용하고 전체 연결을 검증한다.
 * diff가 유지 노드의 dom 참조를 연결한 상태를 전제로 하며,
 * insert/replace 노드만 renderNode()가 새 DOM을 생성·연결한다.
 * History 저장은 하지 않는다.
 */
export function applyPatch(
  prevRoot: VRoot,
  nextRoot: VRoot,
  changes: DiffCommand[],
  context?: EventContext
): VRoot {
  const actualRoot = prevRoot.dom;
  if (!actualRoot) throw new Error('prevRoot.dom is not linked');

  for (const change of changes) {
    applyChange(change, context);
  }

  assertAllLinked(nextRoot, actualRoot);
  return nextRoot;
}

/**
 * VNode를 실제 DOM으로 만들고, vnode.dom과 하위 노드의 dom을 연결한다.
 * context가 있으면 이번 작업의 노드 기록과 event 요청 경계를 새 노드에 함께 전달한다.
 */
export function renderNode(vnode: VNode, context?: EventContext): Node {
  if (vnode.nodeType === 3) {
    const dom = document.createTextNode(vnode.nodeValue ?? '');
    vnode.dom = dom;
    return dom;
  }

  const tagName = vnode.tagName;
  if (tagName === null) {
    throw new Error('Element VNode must have tagName');
  }

  const element = document.createElement(tagName);
  vnode.dom = element;
  applyAttributes(element, vnode.attributes);

  for (const child of vnode.childNodes) {
    element.appendChild(renderNode(child, context));
  }

  applyProperties(element, vnode.properties);

  // 생성 시점에 dom이 연결된 뒤 기록해야 event 대상 조회가 같은 VNode를 찾는다.
  context?.recordVNode(vnode);

  // 새 노드의 handler는 DOM을 만든 직후 연결한다. 갱신 시점의 비교 기준도 이 기록이다.
  if (vnode.events) {
    bindEvents(element, vnode.events, context);
  }

  return element;
}

/**
 * 실제 영역의 기존 자식을 모두 제거하고 root의 자식들을 새로 렌더링한다.
 */
export function renderChildren(
  root: VRoot,
  container: Element,
  context?: EventContext
): void {
  container.replaceChildren();
  root.dom = container;

  const fragment = document.createDocumentFragment();

  for (const child of root.childNodes) {
    fragment.appendChild(renderNode(child, context));
  }

  container.appendChild(fragment);
}

/**
 * nextRoot의 모든 VNode가 actualRoot 안의 실제 DOM을 가리키는지 검증한다.
 */
export function assertAllLinked(root: VRoot, actualRoot: Element): void {
  if (root.dom !== actualRoot) {
    throw new Error('VRoot.dom does not point to actualRoot');
  }

  for (const child of root.childNodes) {
    assertSubtreeLinked(child, actualRoot);
  }
}

// 변경 명령 하나를 해당 실제 DOM 연산으로 분기한다.
function applyChange(change: DiffCommand, context?: EventContext): void {
  switch (change.type) {
    case 'replace':
      replaceNode(change.target, change.node, context);
      return;
    case 'update':
      updateNode(change.target, change.data);
      return;
    case 'insert':
      insertNode(change.node, change.parent, change.before, context);
      return;
    case 'remove':
      removeNode(change.target);
      return;
    case 'move':
      moveNode(change.target, change.parent, change.before);
      return;
    default:
      assertNever(change);
  }
}

// update 명령의 텍스트·속성·properties 변경을 적용한다.
function updateNode(target: VNode, data: UpdateData): void {
  if (target.nodeType === 3) {
    if (data.nodeValue !== undefined) {
      updateText(target, data.nodeValue);
    }
    return;
  }

  updateAttributes(target, data);

  const element = requireElementDom(target, 'update target');
  const setProperties = data.setProperties ?? {};
  const removeProperties = data.removeProperties ?? [];

  // 속성만 바뀐 patch는 이전 선택 선언을 다시 적용하지 않는다. 값·선택과 무관한
  // 갱신이 사용자가 옮긴 커서를 과거 위치로 되돌리면 안 된다.
  if (Object.keys(setProperties).length === 0 && removeProperties.length === 0) {
    return;
  }

  applyPropertyChanges(
    element,
    setProperties,
    removeProperties,
    declaredSelectionAfterUpdate(target.properties, setProperties, removeProperties)
  );
}

// 텍스트 노드의 nodeValue를 변경한다.
function updateText(target: VNode, nodeValue: string): void {
  requireTextDom(target, 'update target').nodeValue = nodeValue;
}

// setAttributes/removeAttributes를 실제 Element에 적용한다.
function updateAttributes(target: VNode, data: UpdateData): void {
  const element = requireElementDom(target, 'update target');

  applyAttributes(element, data.setAttributes ?? []);

  for (const name of data.removeAttributes ?? []) {
    element.removeAttribute(name);
  }
}

// target의 실제 DOM을 새 VNode의 DOM으로 제자리 교체한다.
function replaceNode(target: VNode, node: VNode, context?: EventContext): void {
  const targetDom = requireDom(target, 'replace target');
  const parent = requireParent(targetDom, 'replace target');

  parent.replaceChild(renderNode(node, context), targetDom);
}

// 새 VNode를 parent의 before 앞에 삽입하고 하위 dom을 연결한다.
function insertNode(
  node: VNode,
  parent: VNode | VRoot,
  before: VNode | null,
  context?: EventContext
): void {
  const { parentDom, beforeDom } = resolveInsertionPoint(parent, before, 'insert');
  parentDom.insertBefore(renderNode(node, context), beforeDom);
}

// target의 실제 DOM을 부모에서 제거한다.
function removeNode(target: VNode): void {
  const targetDom = requireDom(target, 'remove target');
  const parent = requireParent(targetDom, 'remove target');

  parent.removeChild(targetDom);
}

// 기존 DOM 객체를 parent의 before 앞으로 이동한다.
function moveNode(
  target: VNode,
  parent: VNode | VRoot,
  before: VNode | null
): void {
  const targetDom = requireDom(target, 'move target');
  const { parentDom, beforeDom } = resolveInsertionPoint(parent, before, 'move');

  parentDom.insertBefore(targetDom, beforeDom);
}

// insert/move 명령의 부모와 기준 형제 DOM을 해석한다.
function resolveInsertionPoint(
  parent: VNode | VRoot,
  before: VNode | null,
  operation: 'insert' | 'move'
): { parentDom: Node; beforeDom: Node | null } {
  const parentDom = requireDom(parent, `${operation} parent`);
  const beforeDom =
    before === null ? null : requireDom(before, `${operation} before`);

  return { parentDom, beforeDom };
}

function assertSubtreeLinked(node: VNode, actualRoot: Element): void {
  if (node.dom === null) {
    throw new Error(`VNode is not linked: ${nodeLabel(node)}`);
  }

  if (!actualRoot.contains(node.dom)) {
    throw new Error(`VNode dom is outside actualRoot: ${nodeLabel(node)}`);
  }

  for (const child of node.childNodes) {
    assertSubtreeLinked(child, actualRoot);
  }
}

// VNode/VRoot의 dom이 연결되어 있는지 확인하고 반환한다.
function requireDom(node: VNode | VRoot, label: string): Node {
  if (node.dom === null) throw new Error(`${label}: dom is not linked`);
  return node.dom;
}

function requireElementDom(node: VNode | VRoot, label: string): Element {
  const dom = requireDom(node, label);
  if (!(dom instanceof Element)) throw new Error(`${label}: dom is not an Element`);
  return dom;
}

function requireTextDom(node: VNode, label: string): Text {
  const dom = requireDom(node, label);
  if (!(dom instanceof Text)) throw new Error(`${label}: dom is not a Text node`);
  return dom;
}

function requireParent(node: Node, label: string): Node {
  const parent = node.parentNode;
  if (parent === null) throw new Error(`${label}: dom is not attached`);
  return parent;
}

function nodeLabel(node: VNode): string {
  return node.nodeType === 3 ? '#text' : node.tagName ?? '#element';
}

// VNode attributes를 실제 Element attribute로 설정한다.
function applyAttributes(element: Element, attributes: VNodeAttribute[]): void {
  for (const { name, value } of attributes) {
    element.setAttribute(name, value);
  }
}

// properties를 실제 DOM 프로퍼티로 설정한다. 선택 영역 선언은 값 반영 뒤 한 번 적용한다.
function applyProperties(element: Element, properties: VNodeProperties): void {
  applyPropertyChanges(
    element,
    properties,
    [],
    declaredSelectionAfterUpdate({}, properties, [])
  );
}

/**
 * set/removeProperties를 실제 DOM에 반영한다.
 * 값 대입 여부를 한 번만 판단하고, 조합 중이면 값·선택 쓰기를 막는다.
 * declared는 이번 반영 뒤에 유효한 선택 영역 선언이다.
 */
function applyPropertyChanges(
  element: Element,
  setProperties: VNodeProperties,
  removeProperties: string[],
  declared: VNodeProperties
): void {
  // 자동 위치 대응의 기준은 값 대입 전의 실제 문자열과 선택이다.
  const snapshot = readSelectionSnapshot(element);
  const composing = isComposing(element);
  let valueWritten = false;

  for (const [name, value] of Object.entries(setProperties)) {
    if (isSelectionProperty(name)) continue;
    if (composing && name === 'value') continue;
    if (applyProperty(element, name, value)) valueWritten = true;
  }

  for (const name of removeProperties) {
    // 선택 영역 제거는 native property 삭제가 아니라 선언 계산에서만 처리한다.
    if (isSelectionProperty(name)) continue;
    if (composing && name === 'value') continue;
    Reflect.deleteProperty(element, name);
  }

  // 조합 중 입력은 앱이 보관한 State와 무관하게 사용자의 편집을 유지한다.
  if (composing) return;

  applySelection(element, declared, snapshot, valueWritten);
}

/**
 * 값을 DOM 프로퍼티에 대입한다. 문자열 value가 이미 같은 값이면 쓰지 않는다.
 * 실제 값 대입이 일어난 경우에만 true를 돌려 자동 위치 대응 여부를 알린다.
 */
function applyProperty(
  element: Element,
  name: string,
  value: unknown
): boolean {
  if (isMultiSelectValue(element, name)) return false;

  // value 동일 판정만 공유 규칙을 쓴다. 문자열 정규화 의미는 input.ts와 같다.
  if (name === 'value' && hasStringValue(element)) {
    if (isSameDomProperty(element, name, value)) return false;
    Reflect.set(element, name, value);
    return true;
  }

  Reflect.set(element, name, value);
  return false;
}

// 문자열 value를 가진 폼 요소인지 확인한다. 다중 select 값은 기존 규칙을 따른다.
function hasStringValue(element: Element): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

/**
 * 이전 선언과 이번 set/remove 명령을 합쳐 반영 뒤의 선택 영역 선언을 구한다.
 * 이전 VNode 데이터는 읽기만 하고 바꾸지 않는다.
 */
function declaredSelectionAfterUpdate(
  previous: VNodeProperties,
  setProperties: VNodeProperties,
  removeProperties: string[]
): VNodeProperties {
  const declared: VNodeProperties = {};

  for (const name of SELECTION_PROPERTY_NAMES) {
    if (Object.hasOwn(previous, name)) declared[name] = previous[name];
  }

  for (const [name, value] of Object.entries(setProperties)) {
    if (isSelectionProperty(name)) declared[name] = value;
  }

  for (const name of removeProperties) {
    if (isSelectionProperty(name)) delete declared[name];
  }

  return declared;
}

/**
 * 명시 선언이 있으면 자동 계산보다 우선한다. 선언이 없을 때만 값이 실제로 바뀐
 * 활성·연결 요소에 쓰기 전 선택을 최종 문자열 기준으로 대응시킨다.
 */
function applySelection(
  element: Element,
  declared: VNodeProperties,
  snapshot: SelectionSnapshot | null,
  valueWritten: boolean
): void {
  if (!supportsSelection(element)) return;

  const control = element as TextControl;
  const explicit = resolveDeclaredSelection(control, declared);

  if (explicit !== null) {
    control.setSelectionRange(explicit.start, explicit.end, explicit.direction);
    return;
  }

  if (!valueWritten || snapshot === null) return;
  if (!control.isConnected || document.activeElement !== control) return;

  const mapped = mapSelection(snapshot.value, control.value, snapshot.selection);
  control.setSelectionRange(mapped.start, mapped.end, mapped.direction);
}

// 선언 값이 하나라도 있으면 실제 문자열 길이로 제한한 선택 영역을 만든다.
function resolveDeclaredSelection(
  control: TextControl,
  declared: VNodeProperties
): SelectionRange | null {
  if (!SELECTION_PROPERTY_NAMES.some((name) => Object.hasOwn(declared, name))) {
    return null;
  }

  const length = control.value.length;
  const start = clampPosition(
    toPosition(declared.selectionStart) ?? toPosition(declared.selectionEnd) ?? 0,
    length
  );
  const end = clampPosition(toPosition(declared.selectionEnd) ?? start, length);

  return {
    start,
    end,
    direction: toSelectionDirection(declared.selectionDirection)
  };
}

function readSelectionSnapshot(element: Element): SelectionSnapshot | null {
  if (!supportsSelection(element)) return null;

  const control = element as TextControl;

  return {
    value: control.value,
    selection: {
      start: control.selectionStart ?? 0,
      end: control.selectionEnd ?? 0,
      direction: toSelectionDirection(control.selectionDirection)
    }
  };
}

// selection API를 지원하지 않는 타입(email·number 등)은 값만 반영한다.
function supportsSelection(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;

  return SELECTION_INPUT_TYPES.has(element.type);
}

function toPosition(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampPosition(position: number, length: number): number {
  return Math.min(Math.max(position, 0), length);
}

function toSelectionDirection(value: unknown): SelectionRange['direction'] {
  return value === 'forward' || value === 'backward' ? value : 'none';
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
