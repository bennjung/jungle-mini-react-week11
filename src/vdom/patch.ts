import type {
  DiffCommand,
  UpdateData,
  VNode,
  VNodeAttribute,
  VNodeProperties,
  VRoot
} from './types';

/**
 * 정렬된 Diff 명령을 실제 DOM에 적용하고 전체 연결을 검증한다.
 * diff가 유지 노드의 dom 참조를 연결한 상태를 전제로 하며,
 * insert/replace 노드만 renderNode()가 새 DOM을 생성·연결한다.
 * History 저장은 하지 않는다.
 */
export function applyPatch(
  prevRoot: VRoot,
  nextRoot: VRoot,
  changes: DiffCommand[]
): VRoot {
  const actualRoot = prevRoot.dom;
  if (!actualRoot) throw new Error('prevRoot.dom is not linked');

  for (const change of changes) {
    applyChange(change);
  }

  assertAllLinked(nextRoot, actualRoot);
  return nextRoot;
}

/**
 * VNode를 실제 DOM으로 만들고, vnode.dom과 하위 노드의 dom을 연결한다.
 */
export function renderNode(vnode: VNode): Node {
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
    element.appendChild(renderNode(child));
  }

  applyProperties(element, vnode.properties);
  return element;
}

/**
 * 실제 영역의 기존 자식을 모두 제거하고 root의 자식들을 새로 렌더링한다.
 */
export function renderChildren(root: VRoot, container: Element): void {
  container.replaceChildren();
  root.dom = container;

  const fragment = document.createDocumentFragment();

  for (const child of root.childNodes) {
    fragment.appendChild(renderNode(child));
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
function applyChange(change: DiffCommand): void {
  switch (change.type) {
    case 'replace':
      replaceNode(change.target, change.node);
      return;
    case 'update':
      updateNode(change.target, change.data);
      return;
    case 'insert':
      insertNode(change.node, change.parent, change.before);
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

  if (data.setProperties) {
    updateProperties(target, data.setProperties);
  }

  if (data.removeProperties) {
    removeProperties(target, data.removeProperties);
  }
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

// 설정할 properties 값을 실제 DOM 프로퍼티에 적용한다.
function updateProperties(target: VNode, properties: VNodeProperties): void {
  applyProperties(requireElementDom(target, 'update target'), properties);
}

// 제거할 properties 이름을 실제 DOM 프로퍼티에서 삭제한다.
// 표준 DOM 프로퍼티의 기본값 복원은 diff가 setProperties로 표현한다.
function removeProperties(target: VNode, names: string[]): void {
  const element = requireElementDom(target, 'update target');

  for (const name of names) {
    Reflect.deleteProperty(element, name);
  }
}

// target의 실제 DOM을 새 VNode의 DOM으로 제자리 교체한다.
function replaceNode(target: VNode, node: VNode): void {
  const targetDom = requireDom(target, 'replace target');
  const parent = requireParent(targetDom, 'replace target');

  parent.replaceChild(renderNode(node), targetDom);
}

// 새 VNode를 parent의 before 앞에 삽입하고 하위 dom을 연결한다.
function insertNode(
  node: VNode,
  parent: VNode | VRoot,
  before: VNode | null
): void {
  const { parentDom, beforeDom } = resolveInsertionPoint(parent, before, 'insert');
  parentDom.insertBefore(renderNode(node), beforeDom);
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

// properties를 실제 DOM 프로퍼티로 설정한다.
function applyProperties(element: Element, properties: VNodeProperties): void {
  for (const [name, value] of Object.entries(properties)) {
    if (isMultiSelectValue(element, name)) continue;
    Reflect.set(element, name, value);
  }
}

// 다중 선택은 OPTION.selected로 복원한다. SELECT.value 대입이 선택을 해제하지 않게 한다.
function isMultiSelectValue(element: Element, name: string): boolean {
  return element instanceof HTMLSelectElement && element.multiple && name === 'value';
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
