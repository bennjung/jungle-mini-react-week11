import { describe, expect, it } from 'vitest';
import { findChildMatches } from '../../../src/vdom/diff/findChildMatches';
import type { ChildMatch } from '../../../src/vdom/diff/types';
import type { VNode } from '../../../src/vdom/types';

function element(key?: string, tagName = 'LI', childNodes: VNode[] = []): VNode {
  return {
    nodeType: 1,
    tagName,
    attributes: key === undefined ? [] : [{ name: 'key', value: key }],
    nodeValue: null,
    childNodes,
    properties: {},
    dom: null
  };
}

function text(value: string): VNode {
  return {
    nodeType: 3,
    tagName: null,
    attributes: [],
    nodeValue: value,
    childNodes: [],
    properties: {},
    dom: null
  };
}

function freezeNodes(nodes: VNode[]): void {
  for (const node of nodes) {
    freezeNodes(node.childNodes);
    for (const attribute of node.attributes) Object.freeze(attribute);
    Object.freeze(node.attributes);
    Object.freeze(node.properties);
    Object.freeze(node);
  }
  Object.freeze(nodes);
}

/** 보조 함수는 직접 테스트하지 않고, 실제 공개 함수의 결과·객체 참조를 확인한다. */
function expectMatches(prev: VNode[], next: VNode[], expected: ChildMatch[]): void {
  freezeNodes(prev);
  freezeNodes(next);
  const matches = findChildMatches(prev, next);

  expect(matches).toHaveLength(expected.length);
  for (const [index, wanted] of expected.entries()) {
    const actual = matches[index];
    expect(actual?.kind).toBe(wanted.kind);
    if (!actual || actual.kind !== wanted.kind) throw new Error('분류가 다르다.');
    if ('prev' in wanted && 'prev' in actual) expect(actual.prev).toBe(wanted.prev);
    if ('next' in wanted && 'next' in actual) expect(actual.next).toBe(wanted.next);
  }

  const prevReferences = matches.flatMap((match) => 'prev' in match ? [match.prev] : []);
  const nextReferences = matches.flatMap((match) => 'next' in match ? [match.next] : []);
  expect(prevReferences).toHaveLength(prev.length);
  expect(nextReferences).toHaveLength(next.length);
  expect(new Set(prevReferences).size).toBe(prev.length);
  expect(new Set(nextReferences).size).toBe(next.length);
  for (const node of prev) expect(prevReferences).toContain(node);
  for (const node of next) expect(nextReferences).toContain(node);
}

describe('findChildMatches — 형제 범위의 개인 작업 기준', () => {
  it('양쪽 목록이 비어 있으면 빈 배열을 반환한다', () => {
    expectMatches([], [], []);
  });

  it('다음에만 있는 노드는 하위로 내려가지 않고 inserted로 분류한다', () => {
    const added = element('a', 'DIV', [element('nested')]);
    const addedText = text('추가');
    expectMatches([], [added, addedText], [
      { kind: 'inserted', next: added },
      { kind: 'inserted', next: addedText }
    ]);
  });

  it('이전에만 있는 노드는 이전 순서대로 removed로 분류한다', () => {
    const a = element('a', 'DIV', [element('nested')]);
    const b = text('제거');
    expectMatches([a, b], [], [
      { kind: 'removed', prev: a },
      { kind: 'removed', prev: b }
    ]);
  });

  it('고유 key의 형제 순서가 달라도 다음 순서대로 비교할 짝을 반환한다', () => {
    const prevA = element('a');
    const prevB = element('b');
    const nextA = element('a');
    const nextB = element('b');
    expectMatches([prevA, prevB], [nextB, nextA], [
      { kind: 'matched', prev: prevB, next: nextB },
      { kind: 'matched', prev: prevA, next: nextA }
    ]);
  });

  it('새 자식과 비교할 짝은 다음 순서대로, 사라진 자식은 마지막에 반환한다', () => {
    const prevA = element('a');
    const prevB = element('b');
    const prevC = element('c');
    const nextB = element('b');
    const nextD = element('d');
    expectMatches([prevA, prevB, prevC], [nextB, nextD], [
      { kind: 'matched', prev: prevB, next: nextB },
      { kind: 'inserted', next: nextD },
      { kind: 'removed', prev: prevA },
      { kind: 'removed', prev: prevC }
    ]);
  });

  it('key가 같으면 태그나 하위 내용이 달라도 비교할 짝으로 반환한다', () => {
    const prev = element('a', 'DIV', [text('이전')]);
    const next = element('a', 'P', [text('다음')]);
    expectMatches([prev], [next], [{ kind: 'matched', prev, next }]);
  });

  it('고유 key가 바뀌면 같은 태그라도 새 노드와 사라진 노드로 구분한다', () => {
    const prev = element('a');
    const next = element('b');
    expectMatches([prev], [next], [
      { kind: 'inserted', next },
      { kind: 'removed', prev }
    ]);
  });

  it('고유 key 조회 실패를 이전의 key 없는 자식과 순서 대응시키지 않는다', () => {
    const prev = element();
    const next = element('new');
    expectMatches([prev], [next], [
      { kind: 'inserted', next },
      { kind: 'removed', prev }
    ]);
  });

  it('다음의 key 없는 자식을 이전의 고유 key 자식과 순서 대응시키지 않는다', () => {
    const prev = element('old');
    const next = element();
    expectMatches([prev], [next], [
      { kind: 'inserted', next },
      { kind: 'removed', prev }
    ]);
  });

  it('고유 key와 섞여도 key 없는 요소·텍스트끼리 출현 순서로 짝짓는다', () => {
    const prevA = element('a');
    const prevUnkeyed = element(undefined, 'P');
    const prevText = text('이전');
    const nextText = text('다음');
    const nextA = element('a');
    const nextUnkeyed = element(undefined, 'SPAN');
    expectMatches([prevA, prevUnkeyed, prevText], [nextText, nextA, nextUnkeyed], [
      { kind: 'matched', prev: prevUnkeyed, next: nextText },
      { kind: 'matched', prev: prevA, next: nextA },
      { kind: 'matched', prev: prevText, next: nextUnkeyed }
    ]);
  });

  it('key 없는 자식 수가 늘면 남는 다음 자식만 inserted로 분류한다', () => {
    const prev = element();
    const nextFirst = element();
    const nextSecond = element();
    expectMatches([prev], [nextFirst, nextSecond], [
      { kind: 'matched', prev, next: nextFirst },
      { kind: 'inserted', next: nextSecond }
    ]);
  });

  it('key 없는 자식 수가 줄면 남는 이전 자식만 removed로 분류한다', () => {
    const prevFirst = element();
    const prevSecond = element();
    const next = element();
    expectMatches([prevFirst, prevSecond], [next], [
      { kind: 'matched', prev: prevFirst, next },
      { kind: 'removed', prev: prevSecond }
    ]);
  });

  it('빈 문자열 key도 명시된 고유 key로 취급한다', () => {
    const prevKeyed = element('');
    const prevUnkeyed = element();
    const nextUnkeyed = element();
    const nextKeyed = element('');
    expectMatches([prevKeyed, prevUnkeyed], [nextUnkeyed, nextKeyed], [
      { kind: 'matched', prev: prevUnkeyed, next: nextUnkeyed },
      { kind: 'matched', prev: prevKeyed, next: nextKeyed }
    ]);
  });

  it('id 속성은 key로 사용하지 않는다', () => {
    const prevFirst = element();
    const prevSecond = element();
    const nextFirst = element();
    const nextSecond = element();
    prevFirst.attributes.push({ name: 'id', value: 'a' });
    prevSecond.attributes.push({ name: 'id', value: 'b' });
    nextFirst.attributes.push({ name: 'id', value: 'b' });
    nextSecond.attributes.push({ name: 'id', value: 'a' });
    expectMatches([prevFirst, prevSecond], [nextFirst, nextSecond], [
      { kind: 'matched', prev: prevFirst, next: nextFirst },
      { kind: 'matched', prev: prevSecond, next: nextSecond }
    ]);
  });

  it('이전에서 중복된 key는 양쪽에서 무효화하고 고유 key는 유지한다', () => {
    const prevDupFirst = element('dup');
    const prevUnkeyed = element();
    const prevDupSecond = element('dup');
    const prevUnique = element('unique');
    const nextUnique = element('unique');
    const nextDup = element('dup');
    const nextUnkeyed = element();
    expectMatches(
      [prevDupFirst, prevUnkeyed, prevDupSecond, prevUnique],
      [nextUnique, nextDup, nextUnkeyed],
      [
        { kind: 'matched', prev: prevUnique, next: nextUnique },
        { kind: 'matched', prev: prevDupFirst, next: nextDup },
        { kind: 'matched', prev: prevUnkeyed, next: nextUnkeyed },
        { kind: 'removed', prev: prevDupSecond }
      ]
    );
  });

  it('다음에서만 중복돼도 이전 key를 무효화하고 순서 대응한다', () => {
    const prevDup = element('dup');
    const prevUnkeyed = element();
    const nextUnkeyed = element();
    const nextDupFirst = element('dup');
    const nextDupSecond = element('dup');
    expectMatches([prevDup, prevUnkeyed], [nextUnkeyed, nextDupFirst, nextDupSecond], [
      { kind: 'matched', prev: prevDup, next: nextUnkeyed },
      { kind: 'matched', prev: prevUnkeyed, next: nextDupFirst },
      { kind: 'inserted', next: nextDupSecond }
    ]);
  });

  it('세 번 이상 중복된 key를 다시 유효한 key로 등록하지 않는다', () => {
    const prevFirst = element('dup');
    const prevSecond = element('dup');
    const prevThird = element('dup');
    const nextFirst = element();
    const nextSecond = element('dup');
    expectMatches([prevFirst, prevSecond, prevThird], [nextFirst, nextSecond], [
      { kind: 'matched', prev: prevFirst, next: nextFirst },
      { kind: 'matched', prev: prevSecond, next: nextSecond },
      { kind: 'removed', prev: prevThird }
    ]);
  });

  it('여러 종류의 중복 key도 같은 순서 대응 목록에 포함한다', () => {
    const prevA1 = element('a');
    const prevB1 = element('b');
    const prevA2 = element('a');
    const prevB2 = element('b');
    const nextB = element('b');
    const nextA = element('a');
    expectMatches([prevA1, prevB1, prevA2, prevB2], [nextB, nextA], [
      { kind: 'matched', prev: prevA1, next: nextB },
      { kind: 'matched', prev: prevB1, next: nextA },
      { kind: 'removed', prev: prevA2 },
      { kind: 'removed', prev: prevB2 }
    ]);
  });

  it('다른 부모나 이전 호출의 같은 key를 저장하거나 참조하지 않는다', () => {
    const previousParentChild = element('a');
    expectMatches([previousParentChild], [], [
      { kind: 'removed', prev: previousParentChild }
    ]);
    const nextParentChild = element('a');
    expectMatches([], [nextParentChild], [
      { kind: 'inserted', next: nextParentChild }
    ]);
    expectMatches([], [nextParentChild], [
      { kind: 'inserted', next: nextParentChild }
    ]);
  });
});
