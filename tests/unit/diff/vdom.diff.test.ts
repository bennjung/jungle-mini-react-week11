import { afterEach, describe, expect, it } from 'vitest';
import { diff } from '../../../src/vdom/diff';
import { orderChanges } from '../../../src/vdom/diff/orderChanges';
import { applyPatch } from '../../../src/vdom/patch';
import type {
  DiffCommand,
  VNode,
  VNodeProperties,
  VRoot
} from '../../../src/vdom/types';

/**
 * docs/p1_test_cases.md §5–§6을 공개 함수의 결과로 검증한다.
 * Diff·정렬 단위 검증과 ORDER의 실제 diff()·orderChanges()·applyPatch() 연계를 확인한다.
 * 이력은 이 단위 테스트의 검증 범위가 아니다.
 */
function readFixtureProperties(node: Node): VNodeProperties {
  if (node instanceof HTMLInputElement) {
    return {
      value: node.value,
      checked: node.checked,
      indeterminate: node.indeterminate
    };
  }
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
    return { value: node.value };
  }
  if (node instanceof HTMLOptionElement) return { selected: node.selected };
  return {};
}

function fixtureNode(node: Node, linked: boolean): VNode {
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) {
    throw new Error('테스트 입력은 요소·텍스트 노드만 지원한다.');
  }
  return {
    nodeType: node.nodeType === Node.ELEMENT_NODE ? 1 : 3,
    tagName: node instanceof Element ? node.tagName : null,
    attributes: node instanceof Element
      ? Array.from(node.attributes, ({ name, value }) => ({ name, value }))
      : [],
    nodeValue: node.nodeType === Node.TEXT_NODE ? node.nodeValue : null,
    childNodes: Array.from(node.childNodes, (child) => fixtureNode(child, linked)),
    properties: readFixtureProperties(node),
    dom: linked ? node : null
  };
}

function fixture(prevHTML: string, nextHTML: string) {
  const actualRoot = document.createElement('div');
  actualRoot.innerHTML = prevHTML;
  document.body.append(actualRoot);

  const template = document.createElement('template');
  template.innerHTML = nextHTML;

  const prev: VRoot = {
    childNodes: Array.from(actualRoot.childNodes, (node) => fixtureNode(node, true)),
    dom: actualRoot
  };
  const next: VRoot = {
    childNodes: Array.from(template.content.childNodes, (node) => fixtureNode(node, false)),
    dom: null
  };
  return { actualRoot, prev, next };
}

function child(parent: VRoot | VNode, index = 0): VNode {
  const node = parent.childNodes[index];
  if (!node) throw new Error(`테스트 입력의 ${index}번째 자식이 없다.`);
  return node;
}

function allNodes(root: VRoot | VNode): VNode[] {
  return root.childNodes.flatMap((node) => [node, ...allNodes(node)]);
}

/** 명세에서 같은 순서로 대응하는 트리의 기존 DOM 객체 참조를 확인한다. */
function expectSameDomTree(prev: VRoot | VNode, next: VRoot | VNode): void {
  expect(prev.dom).not.toBeNull();
  expect(next.dom).toBe(prev.dom);
  expect(next.childNodes).toHaveLength(prev.childNodes.length);
  prev.childNodes.forEach((node, index) => expectSameDomTree(node, child(next, index)));
}

function rememberVDOM(root: VRoot, preserveDom = true) {
  const rememberParent = (node: VRoot | VNode) => ({
    node,
    dom: node.dom,
    childArray: node.childNodes,
    children: [...node.childNodes]
  });
  const parents = [root, ...allNodes(root)].map(rememberParent);
  const values = allNodes(root).map((node) => ({
    node,
    nodeType: node.nodeType,
    tagName: node.tagName,
    nodeValue: node.nodeValue,
    attributeArray: node.attributes,
    attributes: node.attributes.map((attribute) => ({
      reference: attribute,
      name: attribute.name,
      value: attribute.value
    })),
    propertiesReference: node.properties,
    properties: { ...node.properties }
  }));

  return () => {
    for (const entry of parents) {
      if (preserveDom) expect(entry.node.dom).toBe(entry.dom);
      expect(entry.node.childNodes).toBe(entry.childArray);
      expect(entry.node.childNodes).toHaveLength(entry.children.length);
      entry.children.forEach((node, index) => {
        expect(entry.node.childNodes[index]).toBe(node);
      });
    }
    for (const entry of values) {
      expect(entry.node.nodeType).toBe(entry.nodeType);
      expect(entry.node.tagName).toBe(entry.tagName);
      expect(entry.node.nodeValue).toBe(entry.nodeValue);
      expect(entry.node.attributes).toBe(entry.attributeArray);
      expect(entry.node.attributes).toHaveLength(entry.attributes.length);
      entry.attributes.forEach((attribute, index) => {
        expect(entry.node.attributes[index]).toBe(attribute.reference);
        expect(entry.node.attributes[index]).toEqual({
          name: attribute.name,
          value: attribute.value
        });
      });
      expect(entry.node.properties).toBe(entry.propertiesReference);
      expect(entry.node.properties).toEqual(entry.properties);
    }
  };
}

function rememberDOM(actualRoot: Element) {
  const visit = (node: Node): Node[] => [node, ...Array.from(node.childNodes).flatMap(visit)];
  const originalNodes = visit(actualRoot);
  const entries = originalNodes.map((node) => ({
    node,
    nodeValue: node.nodeValue,
    attributes: node instanceof Element
      ? Array.from(node.attributes, ({ name, value }) => ({ name, value }))
      : [],
    properties: readFixtureProperties(node),
    children: [...node.childNodes]
  }));

  return () => {
    expect(actualRoot.parentNode).toBe(document.body);
    const currentNodes = visit(actualRoot);
    expect(currentNodes).toHaveLength(originalNodes.length);
    originalNodes.forEach((node, index) => expect(currentNodes[index]).toBe(node));
    for (const entry of entries) {
      expect(entry.node.nodeValue).toBe(entry.nodeValue);
      expect(Array.from(entry.node.childNodes)).toHaveLength(entry.children.length);
      entry.children.forEach((node, index) => expect(entry.node.childNodes[index]).toBe(node));
      if (entry.node instanceof Element) {
        expect(Array.from(entry.node.attributes, ({ name, value }) => ({ name, value })))
          .toEqual(entry.attributes);
      }
      expect(readFixtureProperties(entry.node)).toEqual(entry.properties);
    }
  };
}

/** 다음 VDOM의 dom 연결만 허용하고, 데이터·이전 VDOM·실제 DOM은 보존한다. */
function withoutMutations<T>(input: ReturnType<typeof fixture>, run: () => T): T {
  const assertPrev = rememberVDOM(input.prev);
  const assertNext = rememberVDOM(input.next, false);
  const assertDOM = rememberDOM(input.actualRoot);

  expect(input.prev.dom).toBe(input.actualRoot);
  for (const node of allNodes(input.prev)) {
    expect(node.dom).not.toBeNull();
    expect(input.actualRoot.contains(node.dom)).toBe(true);
  }
  expect(input.next.dom).toBeNull();
  for (const node of allNodes(input.next)) expect(node.dom).toBeNull();

  try {
    return run();
  } finally {
    assertPrev();
    assertNext();
    assertDOM();
  }
}

function textUpdates(changes: DiffCommand[], expected: Array<[VNode, string]>) {
  expect(changes).toHaveLength(expected.length);
  for (const [target, nodeValue] of expected) {
    const matching = changes.filter((change) =>
      change.type === 'update' && change.target === target && change.data.nodeValue === nodeValue
    );
    expect(matching).toHaveLength(1);
    const change = matching[0];
    if (!change || change.type !== 'update') throw new Error('텍스트 update가 없다.');
    expect(change.target).toBe(target);
    expect(change.data.nodeValue).toBe(nodeValue);
    expect(change.data.setAttributes ?? []).toHaveLength(0);
    expect(change.data.removeAttributes ?? []).toHaveLength(0);
    expect(Object.keys(change.data.setProperties ?? {})).toHaveLength(0);
    expect(change.data.removeProperties ?? []).toHaveLength(0);
  }
}

afterEach(() => document.body.replaceChildren());

describe('Diff — 문서 §5, 공개 diff() 결과', () => {
  it('DIFF-01: 별도 파싱 객체의 데이터가 같으면 빈 배열을 반환한다', () => {
    const input = fixture('<p key="p1">A</p>', '<p key="p1">A</p>');
    expect(child(input.prev)).not.toBe(child(input.next));
    expect(child(input.prev).dom).not.toBeNull();
    expect(child(input.next).dom).toBeNull();

    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    expect(changes).toEqual([]);
    expectSameDomTree(input.prev, input.next);
  });

  it('DIFF-02: 부모 교체 없이 이전 텍스트를 B로 수정하는 명령을 반환한다', () => {
    const input = fixture('<p key="p1">A</p>', '<p key="p1">B</p>');
    const target = child(child(input.prev));

    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    textUpdates(changes, [[target, 'B']]);
    expect(input.actualRoot.textContent).toBe('A');
    expectSameDomTree(input.prev, input.next);
  });

  it('DIFF-03: class 변경·data-extra 추가·title 삭제를 계산한다', () => {
    const input = fixture(
      '<p key="p1" class="a" title="설명">A</p>',
      '<p key="p1" class="b" data-extra="x">A</p>'
    );
    const target = child(input.prev);
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    const setAttributes = [];
    const removeAttributes = [];

    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) {
      expect(change.type).toBe('update');
      if (change.type !== 'update') throw new Error('속성 변경 외의 명령이 나왔다.');
      expect(change.target).toBe(target);
      expect(change.data.nodeValue).toBeUndefined();
      expect(Object.keys(change.data.setProperties ?? {})).toHaveLength(0);
      expect(change.data.removeProperties ?? []).toHaveLength(0);
      setAttributes.push(...change.data.setAttributes ?? []);
      removeAttributes.push(...change.data.removeAttributes ?? []);
    }
    // 명세는 속성 변경을 한 명령에 합칠지 나눌지, 배열 순서는 강제하지 않는다.
    expect(setAttributes).toHaveLength(2);
    expect(setAttributes).toEqual(expect.arrayContaining([
      { name: 'class', value: 'b' },
      { name: 'data-extra', value: 'x' }
    ]));
    expect(removeAttributes).toEqual(['title']);
    expectSameDomTree(input.prev, input.next);
  });

  it('DIFF-03: HTML 속성의 나열 순서만 다르면 변경이 없다', () => {
    const input = fixture(
      '<p key="p1" class="a" title="설명">A</p>',
      '<p title="설명" class="a" key="p1">A</p>'
    );
    expect(withoutMutations(input, () => diff(input.prev, input.next))).toEqual([]);
    expectSameDomTree(input.prev, input.next);
  });

  it('DIFF-04: 같은 key의 태그 변경은 하위 중복 없이 replace 하나로 계산한다', () => {
    const input = fixture('<div key="n1">A</div>', '<p key="n1">A</p>');
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    expect(changes).toHaveLength(1);
    const change = changes[0];
    expect(change?.type).toBe('replace');
    if (!change || change.type !== 'replace') throw new Error('replace가 없다.');
    expect(change.target).toBe(child(input.prev));
    expect(change.node).toBe(child(input.next));
    expect(input.next.dom).toBe(input.actualRoot);
    expect(child(input.next).dom).toBeNull();
    for (const node of allNodes(child(input.next))) expect(node.dom).toBeNull();
  });

  it.each([
    {
      label: 'value A → B',
      prevHTML: '<input key="i" value="A">',
      nextHTML: '<input key="i" value="B">',
      property: 'value', value: 'B', path: [0]
    },
    {
      label: 'value A → 빈 문자열',
      prevHTML: '<input key="i" value="A">',
      nextHTML: '<input key="i" value="">',
      property: 'value', value: '', path: [0]
    },
    {
      label: 'checked true → false',
      prevHTML: '<input key="i" type="checkbox" checked>',
      nextHTML: '<input key="i" type="checkbox">',
      property: 'checked', value: false, path: [0]
    },
    {
      label: 'OPTION selected false → true',
      prevHTML: '<select><option>A</option><option key="o">B</option></select>',
      nextHTML: '<select><option>A</option><option key="o" selected>B</option></select>',
      property: 'selected', value: true, path: [0, 1]
    }
  ])('DIFF-05: $label 변경값을 setProperties에 포함한다', (entry) => {
    const input = fixture(entry.prevHTML, entry.nextHTML);
    let target: VRoot | VNode = input.prev;
    for (const index of entry.path) target = child(target, index);

    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    expect(changes.every((change) => change.type === 'update')).toBe(true);
    const updates = changes.filter((change) =>
      change.type === 'update' && change.target === target
    );
    expect(updates.some((change) =>
      change.type === 'update' &&
      Object.hasOwn(change.data.setProperties ?? {}, entry.property) &&
      change.data.setProperties?.[entry.property] === entry.value
    )).toBe(true);
    expectSameDomTree(input.prev, input.next);
  });

  it('DIFF-06: 중첩 텍스트 하나의 변경에 부모·형제 명령을 만들지 않는다', () => {
    const input = fixture(
      '<div key="d1"><section key="s1"><p key="p1">A</p><span key="sp1">유지</span></section></div>',
      '<div key="d1"><section key="s1"><p key="p1">B</p><span key="sp1">유지</span></section></div>'
    );
    const target = child(child(child(child(input.prev))));
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    textUpdates(changes, [[target, 'B']]);
    expectSameDomTree(input.prev, input.next);
  });

  it('DIFF-07: b를 a 앞으로 이동하고 a의 텍스트를 수정한다', () => {
    const input = fixture(
      '<ul><li key="a">A</li><li key="b">B</li></ul>',
      '<ul><li key="b">B</li><li key="a">A2</li></ul>'
    );
    const prevUL = child(input.prev);
    const nextUL = child(input.next);
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    expect(changes.every((change) => change.type === 'move' || change.type === 'update'))
      .toBe(true);
    const moves = changes.filter((change) => change.type === 'move');
    expect(moves).toHaveLength(1);
    const move = moves[0];
    if (!move) throw new Error('move가 없다.');
    expect(move.target).toBe(child(prevUL, 1));
    expect(move.parent).toBe(nextUL);
    expect(move.before).toBe(child(nextUL, 1));
    textUpdates(changes.filter((change) => change.type !== 'move'), [
      [child(child(prevUL)), 'A2']
    ]);
    // DIFF-07의 a·b 대응은 문서에 명시된 key 기준으로 직접 검증한다.
    expect(input.next.dom).toBe(input.actualRoot);
    expect(nextUL.dom).toBe(prevUL.dom);
    expectSameDomTree(child(prevUL, 1), child(nextUL, 0));
    expectSameDomTree(child(prevUL, 0), child(nextUL, 1));
  });

  it('DIFF-08: key 있는 형제와 없는 형제를 각각 대응해 텍스트만 수정한다', () => {
    const input = fixture(
      '<ul><li key="a">A</li><li>B</li></ul>',
      '<ul><li key="a">A2</li><li>B2</li></ul>'
    );
    const prevUL = child(input.prev);
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    textUpdates(changes, [
      [child(child(prevUL)), 'A2'],
      [child(child(prevUL, 1)), 'B2']
    ]);
    expectSameDomTree(input.prev, input.next);
  });

  it('DIFF-09: key 없는 순서 교환은 위치별 텍스트 수정으로 처리한다', () => {
    const input = fixture(
      '<ul><li>A</li><li>B</li></ul>',
      '<ul><li>B</li><li>A</li></ul>'
    );
    const prevUL = child(input.prev);
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    textUpdates(changes, [
      [child(child(prevUL)), 'B'],
      [child(child(prevUL, 1)), 'A']
    ]);
    expectSameDomTree(input.prev, input.next);
  });
});

describe('명령 순서 — 문서 §6 중 Diff·정렬 종료 시점', () => {
  it('ORDER-01: 새 기준 형제 B의 삽입을 A 삽입보다 앞에 둔다', () => {
    const input = fixture(
      '<ul><li key="c">C</li></ul>',
      '<ul><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>'
    );
    const parent = child(input.next);
    const a = child(parent);
    const b = child(parent, 1);
    const c = child(parent, 2);
    const commands: DiffCommand[] = [
      { type: 'insert', node: a, parent, before: b },
      { type: 'insert', node: b, parent, before: c }
    ];
    const ordered = withoutMutations(input, () => orderChanges(commands));
    expect(ordered).toHaveLength(2);
    const bIndex = ordered.findIndex((change) => change.type === 'insert' && change.node === b);
    const aIndex = ordered.findIndex((change) => change.type === 'insert' && change.node === a);
    expect(bIndex).toBeGreaterThanOrEqual(0);
    expect(aIndex).toBeGreaterThan(bIndex);
    for (const change of ordered) {
      if (change.type !== 'insert') throw new Error('삽입 외의 명령이 나왔다.');
      expect(change.parent).toBe(parent);
      expect(change.before).toBe(change.node === a ? b : c);
    }
  });

  it('ORDER-02: 빈 루트의 새 하위 트리를 중복 계획하지 않고 부모 의존성을 지킨다', () => {
    const input = fixture('', '<section><p>A</p></section>');
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    const inserts = changes.filter((change) => change.type === 'insert');
    expect(changes.length).toBeGreaterThan(0);
    expect(inserts).toHaveLength(changes.length);
    const targets = inserts.map((change) => change.node);
    expect(new Set(targets).size).toBe(targets.length);
    const section = child(input.next);
    expect(targets).toContain(section);
    const sectionCommand = inserts.find((change) => change.node === section);
    expect(sectionCommand?.parent).toBe(input.next);
    expect(sectionCommand?.before).toBeNull();

    // 명세가 허용하는 별도 자식 명령도 수용한다. 실제 중복 DOM 생성은 Patch 연계에서 검증한다.
    for (const [index, change] of inserts.entries()) {
      expect(allNodes(input.next)).toContain(change.node);
      if (change.node === section) continue;
      const parentIndex = inserts.findIndex((candidate) => candidate.node === change.parent);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    }
  });

  it('ORDER-03: 제거할 B를 X 삽입의 기준으로 사용하지 않는다', () => {
    const input = fixture(
      '<ul><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>',
      '<ul><li key="a">A</li><li key="x">X</li><li key="c">C</li></ul>'
    );
    const prevUL = child(input.prev);
    const nextUL = child(input.next);
    const b = child(prevUL, 1);
    const x = child(nextUL, 1);
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    const removals = changes.filter((change) => change.type === 'remove');
    expect(removals).toHaveLength(1);
    expect(removals[0]?.target).toBe(b);
    const inserts = changes.filter((change) => change.type === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.node).toBe(x);
    expect(inserts[0]?.parent).toBe(nextUL);
    expect(changes.every((change) =>
      change.type === 'remove' || change.type === 'insert' || change.type === 'move'
    )).toBe(true);

    for (const [index, change] of changes.entries()) {
      if (change.type !== 'insert' && change.type !== 'move') continue;
      expect(change.parent).toBe(nextUL);
      expect(change.before).not.toBe(b);
      if (change.before !== null) {
        expect(nextUL.childNodes).toContain(change.before);
        if (change.type === 'insert') expect(change.before).not.toBe(change.node);
        if (change.before === x) {
          const insertIndex = changes.findIndex((candidate) =>
            candidate.type === 'insert' && candidate.node === x
          );
          expect(insertIndex).toBeGreaterThanOrEqual(0);
          expect(insertIndex).toBeLessThan(index);
        }
      }
    }
  });

  it('ORDER-04: 부모 제거에 포함된 자식에 별도 명령을 만들지 않는다', () => {
    const input = fixture('<div key="d1"><p key="p1">A</p></div>', '');
    const changes = withoutMutations(input, () => diff(input.prev, input.next));
    expect(changes).toHaveLength(1);
    const change = changes[0];
    expect(change?.type).toBe('remove');
    if (!change || change.type !== 'remove') throw new Error('remove가 없다.');
    expect(change.target).toBe(child(input.prev));
  });

  it('ORDER-04: key 변경은 remove + insert로 계산하고 하위 명령·생성을 중복하지 않는다', () => {
    const input = fixture(
      '<div key="d1"><p key="p1">A</p></div>',
      '<section key="d2"><span key="sp1">B</span></section>'
    );
    const prevDiv = child(input.prev);
    const nextSection = child(input.next);
    const changes = withoutMutations(input, () => diff(input.prev, input.next));

    // 명령 배열의 순서는 강제하지 않고, 명령 종류와 대상 관계만 검증한다.
    expect(changes).toHaveLength(2);
    expect(changes.map((change) => change.type).sort()).toEqual(['insert', 'remove']);

    const removals = changes.filter((change) => change.type === 'remove');
    expect(removals).toHaveLength(1);
    expect(removals[0]?.target).toBe(prevDiv);

    const inserts = changes.filter((change) => change.type === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.node).toBe(nextSection);
    expect(inserts[0]?.parent).toBe(input.next);
    expect(inserts[0]?.before).toBeNull();

    // 이전 p에 별도 remove·update가 없고 새 span을 중복 생성하지 않는다.
    const prevParagraph = child(prevDiv);
    const nextSpan = child(nextSection);
    expect(changes.some((change) => change.type === 'update' && change.target === prevParagraph))
      .toBe(false);
    expect(changes.some((change) =>
      (change.type === 'insert' || change.type === 'replace') && change.node === nextSpan
    )).toBe(false);
    expect(changes.some((change) => change.type === 'replace')).toBe(false);
    expect(nextSection.dom).toBeNull();
    expect(nextSpan.dom).toBeNull();
  });

  it('ORDER-05: 같은 대상의 move를 replace보다 먼저 실행한다', () => {
    const input = fixture(
      '<ul><div key="a">A</div><li key="b">B</li><li key="c">C</li></ul>',
      '<ul><li key="b">B</li><p key="a">A</p><li key="c">C</li></ul>'
    );
    const prevA = child(child(input.prev));
    const nextUL = child(input.next);
    const nextA = child(nextUL, 1);
    const nextC = child(nextUL, 2);
    const commands: DiffCommand[] = [
      { type: 'replace', target: prevA, node: nextA },
      { type: 'move', target: prevA, parent: nextUL, before: nextC }
    ];
    const ordered = withoutMutations(input, () => orderChanges(commands));
    expect(ordered).toHaveLength(2);

    const moveIndex = ordered.findIndex((change) => change.type === 'move');
    const replaceIndex = ordered.findIndex((change) => change.type === 'replace');
    expect(moveIndex).toBeGreaterThanOrEqual(0);
    expect(replaceIndex).toBeGreaterThan(moveIndex);

    const movement = ordered[moveIndex];
    const replacement = ordered[replaceIndex];
    if (!movement || movement.type !== 'move' || !replacement || replacement.type !== 'replace') {
      throw new Error('move → replace 관계가 아니다.');
    }
    expect(movement.target).toBe(prevA);
    expect(movement.parent).toBe(nextUL);
    expect(movement.before).toBe(nextC);
    expect(replacement.target).toBe(prevA);
    expect(replacement.node).toBe(nextA);
  });
});

describe('ORDER의 Patch 적용 후 검증', () => {
  function keysOf(parent: Node): Array<string | null> {
    return Array.from(parent.childNodes, (node) =>
      node instanceof Element ? node.getAttribute('key') : null
    );
  }

  function expectAllLinked(root: VRoot): void {
    expect(root.dom).not.toBeNull();
    for (const node of allNodes(root)) expect(node.dom).not.toBeNull();
  }

  it('ORDER-01: 실제 DOM은 A→B→C, C·부모 유지, 새 노드 참조 연결', () => {
    const input = fixture(
      '<ul><li key="c">C</li></ul>',
      '<ul><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>'
    );
    const actualRoot = input.actualRoot;
    const prevUL = child(input.prev);
    const nextUL = child(input.next);
    const [a, b, c] = nextUL.childNodes;
    if (!a || !b || !c) throw new Error('다음 형제가 부족하다.');
    const cDom = child(prevUL).dom;

    // 실제 diff로 유지 노드 C의 연결을 준비한다. 삽입 명령은 A → B 순서로 직접 준비한다.
    const planned = diff(input.prev, input.next);
    expect(planned).toHaveLength(2);
    expect(planned.every((change) => change.type === 'insert')).toBe(true);

    const commands: DiffCommand[] = [
      { type: 'insert', node: a, parent: nextUL, before: b },
      { type: 'insert', node: b, parent: nextUL, before: c }
    ];
    const ordered = orderChanges(commands);
    expect(ordered).toHaveLength(2);

    const bIndex = ordered.findIndex((change) => change.type === 'insert' && change.node === b);
    const aIndex = ordered.findIndex((change) => change.type === 'insert' && change.node === a);
    expect(bIndex).toBeGreaterThanOrEqual(0);
    expect(aIndex).toBeGreaterThan(bIndex);

    const bCommand = ordered[bIndex];
    const aCommand = ordered[aIndex];
    if (!bCommand || bCommand.type !== 'insert' || !aCommand || aCommand.type !== 'insert') {
      throw new Error('삽입 명령이 아니다.');
    }
    expect(bCommand.before).toBe(c);
    expect(aCommand.before).toBe(b);

    const result = applyPatch(input.prev, input.next, ordered);

    expect(result).toBe(input.next);
    expect(input.next.dom).toBe(actualRoot);
    expect(actualRoot.childNodes).toHaveLength(1);
    expect(actualRoot.firstChild).toBe(nextUL.dom);
    expect(nextUL.dom).toBe(prevUL.dom);
    expect(keysOf(nextUL.dom as Element)).toEqual(['a', 'b', 'c']);
    expect((nextUL.dom as Element).children[0]).toBe(a.dom);
    expect((nextUL.dom as Element).children[1]).toBe(b.dom);
    expect((nextUL.dom as Element).children[2]).toBe(c.dom);
    expect(c.dom).toBe(cDom);
    expectAllLinked(input.next);
  });

  it('ORDER-02: section·p·텍스트를 한 번만 생성하고 루트 유지', () => {
    const input = fixture('', '<section><p>A</p></section>');
    const actualRoot = input.actualRoot;
    const section = child(input.next);
    const paragraph = child(section);
    const textNode = child(paragraph);

    const planned = diff(input.prev, input.next);
    const ordered = orderChanges(planned);
    const createdNodes = ordered.flatMap((change) =>
      change.type === 'insert' || change.type === 'replace' ? [change.node] : []
    );
    expect(new Set(createdNodes).size).toBe(createdNodes.length);

    // 별도 자식 삽입 명령을 쓰더라도 부모 생성이 먼저여야 한다.
    for (const [index, change] of ordered.entries()) {
      if (change.type !== 'insert' || change.node === section) continue;
      const parentIndex = ordered.findIndex((candidate) =>
        (candidate.type === 'insert' || candidate.type === 'replace') &&
        candidate.node === change.parent
      );
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    }

    applyPatch(input.prev, input.next, ordered);

    expect(input.next.dom).toBe(actualRoot);
    expect(actualRoot.childNodes).toHaveLength(1);
    expect(actualRoot.firstChild).toBe(section.dom);
    expect(actualRoot.querySelectorAll('section')).toHaveLength(1);
    expect(actualRoot.querySelectorAll('p')).toHaveLength(1);
    expect(actualRoot.textContent).toBe('A');
    expect(section.dom?.nodeName).toBe('SECTION');
    expect(paragraph.dom?.nodeName).toBe('P');
    expect(section.dom?.parentNode).toBe(actualRoot);
    expect(paragraph.dom?.parentNode).toBe(section.dom);
    expect(textNode.dom?.parentNode).toBe(paragraph.dom);
    expect(textNode.dom?.nodeValue).toBe('A');
    expectAllLinked(input.next);
  });

  it('ORDER-03: 실제 DOM은 A→X→C, A·C 객체 동일성 유지', () => {
    const input = fixture(
      '<ul><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>',
      '<ul><li key="a">A</li><li key="x">X</li><li key="c">C</li></ul>'
    );
    const actualRoot = input.actualRoot;
    const prevUL = child(input.prev);
    const nextUL = child(input.next);
    const prevA = child(prevUL);
    const prevB = child(prevUL, 1);
    const prevC = child(prevUL, 2);
    const nextA = child(nextUL);
    const nextX = child(nextUL, 1);
    const nextC = child(nextUL, 2);
    const aDom = prevA.dom;
    const cDom = prevC.dom;

    const planned = diff(input.prev, input.next);
    const removals = planned.filter((change) => change.type === 'remove');
    expect(removals).toHaveLength(1);
    expect(removals[0]?.target).toBe(prevB);
    const inserts = planned.filter((change) => change.type === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.node).toBe(nextX);
    expect(inserts[0]?.parent).toBe(nextUL);
    expect(inserts[0]?.before).toBe(nextC);
    expect(nextC.dom).toBe(cDom);
    expect(nextC.dom?.parentNode).toBe(nextUL.dom);

    const ordered = orderChanges(planned);
    applyPatch(input.prev, input.next, ordered);

    expect(input.next.dom).toBe(actualRoot);
    expect(nextUL.dom).toBe(prevUL.dom);
    expect(actualRoot.firstChild).toBe(nextUL.dom);
    expect(keysOf(nextUL.dom as Element)).toEqual(['a', 'x', 'c']);
    expect((nextUL.dom as Element).children[0]).toBe(nextA.dom);
    expect((nextUL.dom as Element).children[1]).toBe(nextX.dom);
    expect((nextUL.dom as Element).children[2]).toBe(nextC.dom);
    expect(nextA.dom).toBe(aDom);
    expect(nextC.dom).toBe(cDom);
    expect(nextX.dom).toBe((nextUL.dom as Element).children[1]);
    expect(prevB.dom?.parentNode).toBeNull();
    expectAllLinked(input.next);
  });

  it('ORDER-04: 제거·교체 후 중복 생성·분리된 대상의 재조작 없음', () => {
    // 부모 제거: remove 하나만 적용하고 분리된 p에 다시 명령을 적용하지 않는다.
    const removalInput = fixture('<div key="d1"><p key="p1">A</p></div>', '');
    const removalRoot = removalInput.actualRoot;
    const removedDiv = child(removalInput.prev);
    const keptParagraph = child(removedDiv);
    const removalChanges = diff(removalInput.prev, removalInput.next);

    expect(removalChanges).toHaveLength(1);
    const removal = removalChanges[0];
    if (!removal || removal.type !== 'remove') throw new Error('remove가 없다.');
    expect(removal.target).toBe(removedDiv);

    applyPatch(removalInput.prev, removalInput.next, orderChanges(removalChanges));

    expect(removalRoot.childNodes).toHaveLength(0);
    expect(removedDiv.dom?.parentNode).toBeNull();
    expect(keptParagraph.dom?.parentNode).toBe(removedDiv.dom);
    expect(keptParagraph.dom?.textContent).toBe('A');

    // key 변경: 기존 div 제거와 새 section 삽입으로 처리하고 하위 트리를 중복 생성하지 않는다.
    const replacementInput = fixture(
      '<div key="d1"><p key="p1">A</p></div>',
      '<section key="d2"><span key="sp1">B</span></section>'
    );
    const replacementRoot = replacementInput.actualRoot;
    const prevDiv = child(replacementInput.prev);
    const prevParagraph = child(prevDiv);
    const nextSection = child(replacementInput.next);
    const nextSpan = child(nextSection);
    const nextText = child(nextSpan);
    const replacementChanges = diff(replacementInput.prev, replacementInput.next);

    expect(replacementChanges).toHaveLength(2);
    expect(replacementChanges.map((change) => change.type).sort())
      .toEqual(['insert', 'remove']);
    expect(replacementChanges.some((change) => change.type === 'update')).toBe(false);
    expect(replacementChanges.some((change) => change.type === 'replace')).toBe(false);
    expect(replacementChanges.some((change) =>
      change.type === 'update' && change.target === prevParagraph
    )).toBe(false);

    applyPatch(
      replacementInput.prev,
      replacementInput.next,
      orderChanges(replacementChanges)
    );

    expect(replacementRoot.childNodes).toHaveLength(1);
    expect(replacementRoot.firstChild).toBe(nextSection.dom);
    expect(replacementRoot.querySelectorAll('section')).toHaveLength(1);
    expect(replacementRoot.querySelectorAll('span')).toHaveLength(1);
    expect(nextSection.dom?.textContent).toBe('B');
    expect(nextSpan.dom?.parentNode).toBe(nextSection.dom);
    expect(nextText.dom?.parentNode).toBe(nextSpan.dom);
    expect(prevDiv.dom?.parentNode).toBeNull();
    expect(prevParagraph.dom?.parentNode).toBe(prevDiv.dom);
    expect(prevParagraph.dom?.textContent).toBe('A');
    expectAllLinked(replacementInput.next);
  });

  it('ORDER-05: 실제 DOM은 B→A\'→C, B·C 객체 동일성 유지', () => {
    const input = fixture(
      '<ul><div key="a">A</div><li key="b">B</li><li key="c">C</li></ul>',
      '<ul><li key="b">B</li><p key="a">A</p><li key="c">C</li></ul>'
    );
    const actualRoot = input.actualRoot;
    const prevUL = child(input.prev);
    const nextUL = child(input.next);
    const prevA = child(prevUL);
    const prevB = child(prevUL, 1);
    const prevC = child(prevUL, 2);
    const nextB = child(nextUL);
    const nextA = child(nextUL, 1);
    const nextC = child(nextUL, 2);
    const aDom = prevA.dom;
    const bDom = prevB.dom;
    const cDom = prevC.dom;

    // 실제 diff로 B·C의 연결을 준비한다. move·replace 명령은 명세대로 직접 준비한다.
    const planned = diff(input.prev, input.next);
    expect(planned.some((change) =>
      change.type === 'replace' && change.target === prevA && change.node === nextA
    )).toBe(true);
    expect(nextB.dom).toBe(bDom);
    expect(nextC.dom).toBe(cDom);
    expect(nextA.dom).toBeNull();

    const commands: DiffCommand[] = [
      { type: 'replace', target: prevA, node: nextA },
      { type: 'move', target: prevA, parent: nextUL, before: nextC }
    ];
    const ordered = orderChanges(commands);
    expect(ordered.map((change) => change.type)).toEqual(['move', 'replace']);

    const movement = ordered[0];
    const replacement = ordered[1];
    if (!movement || movement.type !== 'move' || !replacement || replacement.type !== 'replace') {
      throw new Error('move → replace 관계가 아니다.');
    }
    expect(movement.target).toBe(prevA);
    expect(movement.parent).toBe(nextUL);
    expect(movement.before).toBe(nextC);
    expect(replacement.target).toBe(prevA);
    expect(replacement.node).toBe(nextA);

    applyPatch(input.prev, input.next, ordered);

    expect(input.next.dom).toBe(actualRoot);
    expect(nextUL.dom).toBe(prevUL.dom);
    expect(actualRoot.firstChild).toBe(nextUL.dom);
    expect(keysOf(nextUL.dom as Element)).toEqual(['b', 'a', 'c']);
    expect((nextUL.dom as Element).children[0]).toBe(bDom);
    expect((nextUL.dom as Element).children[1]).toBe(nextA.dom);
    expect((nextUL.dom as Element).children[2]).toBe(cDom);
    expect(nextA.dom?.nodeName).toBe('P');
    expect(nextA.dom).not.toBe(aDom);
    expect(prevA.dom?.parentNode).toBeNull();
    expect(nextB.dom).toBe(bDom);
    expect(nextC.dom).toBe(cDom);
    expectAllLinked(input.next);
  });
});
