import { isComposing } from './events';
import {
  isMultiSelectValue,
  isSameDomProperty,
  isSelectionProperty,
  selectionPropertyNames
} from './properties';
import type {
  DiffCommand,
  UpdateData,
  VNode,
  VNodeProperties
} from './types';

type ElementUpdate = Extract<DiffCommand, { type: 'update' }>;

/**
 * 이벤트가 남긴 대상만 실제 DOM과 최신 VNode properties를 비교해 보정 update 명령을 만든다.
 * 기존 changes는 그대로 두고, 같은 대상의 update 명령이 있으면 setProperties를 합친다.
 * 실제 DOM 쓰기는 하지 않는다. 삭제·교체되는 요소와 그 하위 대상은 제외한다.
 * multiple select는 그 요소가 관리하는 OPTION.selected 선언까지 확인 대상으로 넓힌다.
 */
export function collectInputChanges(
  targets: ReadonlySet<Element>,
  nodes: WeakMap<Element, VNode>,
  changes: DiffCommand[]
): DiffCommand[] {
  if (targets.size === 0) return changes;

  const inspectedTargets = expandInputTargets(targets);
  const removedRoots = collectRemovedRoots(changes);
  const updatesByElement = indexUpdatesByElement(changes);
  const corrections = new Map<
    Element,
    { vnode: VNode; setProperties: VNodeProperties }
  >();

  for (const target of inspectedTargets) {
    const vnode = nodes.get(target);
    if (vnode === undefined || vnode.nodeType !== 1) continue;
    if (!isAttachedTarget(target)) continue;
    if (isInsideRemovedRoot(target, removedRoots)) continue;

    const desired = applyTargetUpdates(
      vnode.properties,
      updatesByElement.get(target) ?? []
    );
    const setProperties = collectCorrectionProperties(target, desired);

    // 앱이 지정한 값이 실제 DOM과 같으면 추가 명령을 만들지 않는다.
    if (Object.keys(setProperties).length === 0) continue;

    corrections.set(target, { vnode, setProperties });
  }

  if (corrections.size === 0) return changes;

  return mergeCorrections(changes, corrections);
}

/**
 * multiple select의 이벤트는 실제 선택 상태를 OPTION에 남긴다. 이벤트 대상 select가
 * 관리하는 OPTION만 후보에 더하고, Set으로 중복 대상을 합친다. 전체 VDOM은 찾지 않는다.
 */
function expandInputTargets(targets: ReadonlySet<Element>): Set<Element> {
  const expanded = new Set<Element>(targets);

  for (const target of targets) {
    if (!(target instanceof HTMLSelectElement) || !target.multiple) continue;

    for (const option of Array.from(target.options)) {
      expanded.add(option);
    }
  }

  return expanded;
}

// remove/replace 명령이 제거할 실제 DOM 루트. 하위 대상 판정에 쓴다.
function collectRemovedRoots(changes: DiffCommand[]): Set<Node> {
  const roots = new Set<Node>();

  for (const change of changes) {
    if (change.type !== 'remove' && change.type !== 'replace') continue;
    if (change.target.dom !== null) roots.add(change.target.dom);
  }

  return roots;
}

// 같은 요소를 대상으로 하는 update 명령을 모은다. 이번 VDOM 갱신의 set/remove 반영에 쓴다.
function indexUpdatesByElement(
  changes: DiffCommand[]
): Map<Element, ElementUpdate[]> {
  const updatesByElement = new Map<Element, ElementUpdate[]>();

  for (const change of changes) {
    if (change.type !== 'update') continue;
    if (!(change.target.dom instanceof Element)) continue;

    const updates = updatesByElement.get(change.target.dom);
    if (updates === undefined) {
      updatesByElement.set(change.target.dom, [change]);
      continue;
    }

    updates.push(change);
  }

  return updatesByElement;
}

// 현재 VNode properties에 이번 update 명령의 setProperties/removeProperties를 반영한다.
function applyTargetUpdates(
  properties: VNodeProperties,
  updates: ElementUpdate[]
): VNodeProperties {
  const desired: VNodeProperties = { ...properties };

  for (const update of updates) {
    Object.assign(desired, update.data.setProperties ?? {});

    for (const name of update.data.removeProperties ?? []) {
      delete desired[name];
    }
  }

  return desired;
}

/**
 * 대상 요소에서 실제로 달라진 앱 지정 프로퍼티만 고른다.
 * 선택 프로퍼티는 비교하지 않고, 값 보정이 있을 때 Patch가 함께 적용할 선언으로만 싣는다.
 */
function collectCorrectionProperties(
  element: Element,
  desired: VNodeProperties
): VNodeProperties {
  const composing = isComposing(element);
  const setProperties: VNodeProperties = {};

  for (const [name, value] of Object.entries(desired)) {
    if (isSelectionProperty(name)) continue;
    // 조합 중에는 값 보정만 건너뛴다. 원래 diff의 value 반영은 Patch가 막는다.
    if (composing && name === 'value') continue;
    // 다중 선택의 value는 OPTION.selected로 복원한다. SELECT.value 대입으로 판정하지 않는다.
    if (isMultiSelectValue(element, name)) continue;
    if (isSameDomProperty(element, name, value)) continue;

    setProperties[name] = value;
  }

  if (Object.keys(setProperties).length === 0) return setProperties;

  for (const name of selectionPropertyNames) {
    if (Object.hasOwn(desired, name)) {
      setProperties[name] = desired[name];
    }
  }

  return setProperties;
}

// 실제 DOM 트리에 붙어 있는 대상만 확인한다. 이미 분리된 옛 대상은 보정하지 않는다.
function isAttachedTarget(element: Element): boolean {
  return element.parentNode !== null;
}

// 대상 자신이나 조상이 제거·교체되는 경우 하위 대상도 확인하지 않는다.
function isInsideRemovedRoot(
  element: Element,
  removedRoots: Set<Node>
): boolean {
  // 이번 변경 명령에 제거·교체가 없으면 조상 탐색이 필요 없다.
  // 인스턴스 조회 경로가 아니라 대상 요소의 변경 범위 필터다.
  if (removedRoots.size === 0) return false;

  let node: Node | null = element;

  while (node !== null) {
    if (removedRoots.has(node)) return true;
    node = node.parentNode;
  }

  return false;
}

// 같은 요소의 update 명령에 보정 setProperties를 합쳐 중복 쓰기를 막는다.
function mergeCorrections(
  changes: DiffCommand[],
  corrections: Map<Element, { vnode: VNode; setProperties: VNodeProperties }>
): DiffCommand[] {
  const mergedElements = new Set<Element>();

  const mergedChanges = changes.map((change): DiffCommand => {
    if (change.type !== 'update') return change;
    if (!(change.target.dom instanceof Element)) return change;

    const element = change.target.dom;
    const correction = corrections.get(element);
    if (correction === undefined || mergedElements.has(element)) return change;

    mergedElements.add(element);
    return {
      type: 'update',
      target: change.target,
      data: mergeUpdateData(change.data, correction.setProperties)
    };
  });

  for (const [element, correction] of corrections) {
    if (mergedElements.has(element)) continue;

    // 대상 VNode의 dom이 실제 요소와 다르면 Patch가 적용할 위치를 보장할 수 없다.
    if (correction.vnode.dom !== element) continue;

    mergedChanges.push({
      type: 'update',
      target: correction.vnode,
      data: { setProperties: correction.setProperties }
    });
  }

  return mergedChanges;
}

function mergeUpdateData(
  data: UpdateData,
  setProperties: VNodeProperties
): UpdateData {
  return {
    ...data,
    setProperties: { ...(data.setProperties ?? {}), ...setProperties }
  };
}
