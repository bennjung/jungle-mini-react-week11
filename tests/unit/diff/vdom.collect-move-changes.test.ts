import { describe, expect, it } from 'vitest';
import { diff } from '../../../src/vdom/diff';
import { collectMoveChanges } from '../../../src/vdom/diff/collectMoveChanges';
import { findChildMatches } from '../../../src/vdom/diff/findChildMatches';
import { orderChanges } from '../../../src/vdom/diff/orderChanges';
import { applyPatch } from '../../../src/vdom/patch';
import type { DiffCommand, VNode, VRoot } from '../../../src/vdom/types';

const cases = [
  { name: '변경 없음', prev: ['a', 'b', 'c'], next: ['a', 'b', 'c'], moves: false },
  { name: '앞쪽 이동', prev: ['a', 'b', 'c'], next: ['c', 'a', 'b'], moves: true },
  { name: '뒤쪽 이동', prev: ['a', 'b', 'c'], next: ['b', 'c', 'a'], moves: true },
  { name: '이웃 교환', prev: ['a', 'b', 'c'], next: ['b', 'a', 'c'], moves: true },
  { name: '역순', prev: ['a', 'b', 'c'], next: ['c', 'b', 'a'], moves: true },
  { name: '여러 노드 재배치', prev: ['a', 'b', 'c', 'd'], next: ['c', 'a', 'd', 'b'], moves: true },
  { name: '삽입만', prev: ['a', 'b'], next: ['x', 'a', 'b'], moves: false },
  { name: '삭제만', prev: ['a', 'b', 'c'], next: ['a', 'c'], moves: false },
  { name: '이동과 삽입', prev: ['a', 'b', 'c'], next: ['c', 'x', 'a', 'b'], moves: true },
  { name: '이동과 삭제', prev: ['a', 'b', 'c', 'd'], next: ['d', 'a', 'c'], moves: true }
];

function element(label: string, keyed: boolean, linked: boolean): VNode {
  const dom = document.createElement('li');
  dom.textContent = label;
  if (keyed) dom.setAttribute('key', label);
  return {
    nodeType: 1, tagName: 'LI',
    attributes: keyed ? [{ name: 'key', value: label }] : [],
    nodeValue: null, childNodes: [], properties: {}, dom: linked ? dom : null
  };
}

function fixture(prevLabels: string[], nextLabels: string[], keyed = true) {
  const actual = document.createElement('ul');
  const prev = prevLabels.map((label) => element(label, keyed, true));
  for (const node of prev) actual.appendChild(node.dom!);
  const next: VRoot = { childNodes: nextLabels.map((label) => element(label, keyed, false)), dom: actual };
  const matches = findChildMatches(prev, next.childNodes);
  // 호출 시점의 기존 노드 참조를 입력으로 준비한다. 이동 판단은 하지 않는다.
  for (const match of matches) {
    if (match.kind === 'matched') match.next.dom = match.prev.dom;
  }

  const originalDOM = [...actual.childNodes];
  const originalHTML = actual.innerHTML;
  const previousState = prev.map((node) => ({ node, dom: node.dom }));
  const nextState = next.childNodes.map((node) => ({ node, dom: node.dom }));
  for (const node of [...prev, ...next.childNodes]) {
    node.attributes.forEach(Object.freeze);
    Object.freeze(node.attributes);
    Object.freeze(node.properties);
    Object.freeze(node.childNodes);
    Object.freeze(node);
  }
  matches.forEach(Object.freeze);
  Object.freeze(matches);
  Object.freeze(prev);
  Object.freeze(next.childNodes);
  Object.freeze(next);

  function assertPreserved() {
    expect(actual.innerHTML).toBe(originalHTML);
    expect(actual.childNodes).toHaveLength(originalDOM.length);
    originalDOM.forEach((node, index) => expect(actual.childNodes[index]).toBe(node));
    previousState.forEach(({ node, dom }) => expect(node.dom).toBe(dom));
    nextState.forEach(({ node, dom }) => expect(node.dom).toBe(dom));
  }

  return { actual, prev, next, matches, originalDOM, assertPreserved };
}

function plan(input: ReturnType<typeof fixture>) {
  try {
    const changes = collectMoveChanges(input.prev, input.next, input.matches);
    const pairs = input.matches.filter((match) => match.kind === 'matched');
    for (const change of changes) {
      expect(change.type).toBe('move');
      expect(pairs.some(({ prev }) => prev === change.target)).toBe(true);
      expect(change.parent).toBe(input.next);
      if (change.before !== null) {
        expect(input.next.childNodes).toContain(change.before);
        expect(pairs.some(({ prev, next }) => prev === change.target && next === change.before)).toBe(false);
      }
    }
    return changes;
  } finally {
    input.assertPreserved();
  }
}

// 생성·삭제·교체를 구현한 가짜 Patch가 아니다. 실제 정렬 결과의 move만 DOM 표준 연산으로 적용한다.
function applyOrderedMoves(input: ReturnType<typeof fixture>, changes: DiffCommand[]) {
  const ordered = orderChanges(changes);
  expect(ordered).toHaveLength(changes.length);
  const remaining = [...changes];
  for (const change of ordered) {
    const index = remaining.indexOf(change);
    expect(index).toBeGreaterThanOrEqual(0);
    remaining.splice(index, 1);
    if (change.type !== 'move') throw new Error('이 검증은 이동 명령만 적용한다.');
    const target = change.target.dom;
    const parent = change.parent.dom;
    const before = change.before === null ? null : change.before.dom;
    if (!target || !parent || (change.before !== null && before === null)) {
      throw new Error('이동 대상·부모·기준 형제의 DOM이 연결되지 않았다.');
    }
    expect(target.parentNode).toBe(parent);
    if (before !== null) expect(before.parentNode).toBe(parent);
    parent.insertBefore(target, before);
  }
  expect(remaining).toEqual([]);
  expect([...input.actual.childNodes]).toHaveLength(input.next.childNodes.length);
  expect(Array.from(input.actual.children, (node) => node.getAttribute('key'))).toEqual(
    input.next.childNodes.map((node) => node.attributes.find(({ name }) => name === 'key')?.value)
  );
  input.next.childNodes.forEach((node, index) => {
    expect(input.actual.childNodes[index]).toBe(node.dom);
    expect(input.originalDOM).toContain(node.dom);
  });
}

describe('MOVE-01–04: 이동 명령 계획과 참조 검증', () => {
  it.each(cases)('$name: 대상과 기준 형제가 유효하고 입력·실제 DOM을 보존한다', ({ prev, next, moves }) => {
    const changes = plan(fixture(prev, next));
    if (moves) expect(changes.length).toBeGreaterThan(0);
    else expect(changes).toEqual([]);
  });

  it('DIFF-07: a,b → b,a에서 b를 다음 a 앞으로 한 번 이동한다', () => {
    const input = fixture(['a', 'b'], ['b', 'a']);
    expect(plan(input)).toEqual([
      { type: 'move', target: input.prev[1], parent: input.next, before: input.next.childNodes[1] }
    ]);
  });

  it('MOVE-05 / DIFF-09: key 없는 내용 교환을 이동으로 판단하지 않는다', () => {
    expect(plan(fixture(['a', 'b'], ['b', 'a'], false))).toEqual([]);
  });
});

describe('MOVE-02: 이동만 있는 경우 정렬 후 실제 객체를 재배치한다', () => {
  it.each(cases.filter(({ name }) => ['앞쪽 이동', '뒤쪽 이동', '이웃 교환', '역순', '여러 노드 재배치'].includes(name)))(
    '$name: 목표 순서와 모든 기존 DOM 객체를 유지한다', ({ prev, next }) => {
      const input = fixture(prev, next);
      applyOrderedMoves(input, plan(input));
    }
  );
});

function permutations(values: string[]): string[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, otherIndex) => index !== otherIndex)).map((rest) => [value, ...rest])
  );
}

describe('MOVE-06: 네 형제의 모든 목표 순서', () => {
  it.each(permutations(['a', 'b', 'c', 'd']).map((next) => ({ label: next.join(''), next })))(
    'abcd → $label: 정렬된 명령 적용 후 목표 순서와 객체 동일성을 만족한다', ({ next }) => {
      const input = fixture(['a', 'b', 'c', 'd'], next);
      applyOrderedMoves(input, plan(input));
    }
  );
});

function labelOf(node: VNode): string {
  const label = node.attributes.find(({ name }) => name === 'key')?.value;
  if (label === undefined) throw new Error('key가 있는 테스트 노드가 아니다.');
  return label;
}

/** 실제 diff가 유지 노드를 연결할 수 있도록 dom 참조를 준비한 Patch 연계 입력. */
function patchFixture(prevLabels: string[], nextLabels: string[]) {
  const actual = document.createElement('ul');
  const prev: VRoot = {
    childNodes: prevLabels.map((label) => element(label, true, true)),
    dom: actual
  };
  for (const node of prev.childNodes) actual.appendChild(node.dom!);
  const next: VRoot = {
    childNodes: nextLabels.map((label) => element(label, true, false)),
    dom: null
  };
  return { actual, prev, next };
}

function keysOf(parent: Element): Array<string | null> {
  return Array.from(parent.children, (node) => node.getAttribute('key'));
}

describe('MOVE-07: 실제 orderChanges·applyPatch 연계', () => {
  it('이동·삽입 혼합: abc → cxab, 목표 순서·기존 객체·새 참조 확인', () => {
    const input = patchFixture(['a', 'b', 'c'], ['c', 'x', 'a', 'b']);
    const prevByLabel = new Map(input.prev.childNodes.map((node) => [labelOf(node), node]));
    const changes = diff(input.prev, input.next);
    const ordered = orderChanges(changes);
    expect(ordered).toHaveLength(changes.length);

    const inserts = ordered.filter((change) => change.type === 'insert');
    const moves = ordered.filter((change) => change.type === 'move');
    expect(inserts).toHaveLength(1);
    expect(moves).toHaveLength(1);

    const insert = inserts[0];
    const move = moves[0];
    if (!insert || insert.type !== 'insert' || !move || move.type !== 'move') {
      throw new Error('이동·삽입 명령이 아니다.');
    }
    expect(insert.node).toBe(input.next.childNodes[1]);
    expect(labelOf(insert.node)).toBe('x');
    expect(insert.parent).toBe(input.next);
    expect(insert.before).toBe(input.next.childNodes[2]);
    expect(move.target).toBe(prevByLabel.get('c'));
    expect(move.parent).toBe(input.next);
    expect(move.before).toBe(input.next.childNodes[1]);
    // move의 기준 형제인 x가 먼저 생성되어야 한다.
    expect(ordered.indexOf(insert)).toBeLessThan(ordered.indexOf(move));

    const result = applyPatch(input.prev, input.next, ordered);

    expect(result).toBe(input.next);
    expect(input.next.dom).toBe(input.actual);
    expect(keysOf(input.actual)).toEqual(['c', 'x', 'a', 'b']);
    expect(input.actual.childNodes).toHaveLength(input.next.childNodes.length);
    expect(input.next.childNodes[0]?.dom).toBe(prevByLabel.get('c')?.dom);
    expect(input.next.childNodes[2]?.dom).toBe(prevByLabel.get('a')?.dom);
    expect(input.next.childNodes[3]?.dom).toBe(prevByLabel.get('b')?.dom);
    expect(input.next.childNodes[0]?.dom).toBe(input.actual.childNodes[0]);
    expect(input.next.childNodes[1]?.dom).toBe(input.actual.childNodes[1]);
    expect(input.next.childNodes[2]?.dom).toBe(input.actual.childNodes[2]);
    expect(input.next.childNodes[3]?.dom).toBe(input.actual.childNodes[3]);
    // 새 x는 기존 객체가 아니며 생성된 실제 노드를 가리킨다.
    expect(prevByLabel.has('x')).toBe(false);
    expect(input.next.childNodes[1]?.dom).not.toBeNull();
    expect(input.next.childNodes[1]?.dom).toBe(input.actual.childNodes[1]);
    for (const node of input.next.childNodes) expect(node.dom).not.toBeNull();
  });

  it('이동·삭제 혼합: abcd → dac, 제거 대상 분리·나머지 객체 확인', () => {
    const input = patchFixture(['a', 'b', 'c', 'd'], ['d', 'a', 'c']);
    const prevByLabel = new Map(input.prev.childNodes.map((node) => [labelOf(node), node]));
    const changes = diff(input.prev, input.next);
    const ordered = orderChanges(changes);
    expect(ordered).toHaveLength(changes.length);

    const removals = ordered.filter((change) => change.type === 'remove');
    const moves = ordered.filter((change) => change.type === 'move');
    expect(removals).toHaveLength(1);
    expect(removals[0]?.target).toBe(prevByLabel.get('b'));
    expect(moves).toHaveLength(1);

    const move = moves[0];
    if (!move || move.type !== 'move') throw new Error('이동 명령이 아니다.');
    expect(move.target).toBe(prevByLabel.get('d'));
    expect(move.parent).toBe(input.next);
    expect(move.before).toBe(input.next.childNodes[1]);
    expect(ordered.some((change) => change.type === 'insert')).toBe(false);

    applyPatch(input.prev, input.next, ordered);

    expect(input.next.dom).toBe(input.actual);
    expect(keysOf(input.actual)).toEqual(['d', 'a', 'c']);
    expect(input.actual.childNodes).toHaveLength(input.next.childNodes.length);
    expect(input.next.childNodes[0]?.dom).toBe(prevByLabel.get('d')?.dom);
    expect(input.next.childNodes[1]?.dom).toBe(prevByLabel.get('a')?.dom);
    expect(input.next.childNodes[2]?.dom).toBe(prevByLabel.get('c')?.dom);
    expect(input.next.childNodes[0]?.dom).toBe(input.actual.childNodes[0]);
    expect(input.next.childNodes[1]?.dom).toBe(input.actual.childNodes[1]);
    expect(input.next.childNodes[2]?.dom).toBe(input.actual.childNodes[2]);
    // 삭제된 b는 실제 영역에서 분리되고 나머지 대상은 재조작되지 않는다.
    expect(prevByLabel.get('b')?.dom?.parentNode).toBeNull();
    expect(input.actual.contains(prevByLabel.get('b')?.dom ?? null)).toBe(false);
    for (const node of input.next.childNodes) expect(node.dom).not.toBeNull();
  });
});
