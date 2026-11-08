import { describe, expect, it } from 'vitest';
import { collectMoveChanges } from '../../../src/vdom/diff/collectMoveChanges';
import { findChildMatches } from '../../../src/vdom/diff/findChildMatches';
import { orderChanges } from '../../../src/vdom/diff/orderChanges';
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

describe('MOVE-07: 실제 Patch 연계 검증 — Patch 구현 전 보류', () => {
  it.todo('이동·삽입 혼합: abc → cxab, 실제 orderChanges와 applyPatch 후 목표 순서·기존 객체·새 참조 확인');
  it.todo('이동·삭제 혼합: abcd → dac, 실제 orderChanges와 applyPatch 후 제거 대상 분리·나머지 객체 확인');
});
