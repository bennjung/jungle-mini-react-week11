import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectChildChanges } from '../../../src/vdom/diff/collectChildChanges';
import { findChildMatches } from '../../../src/vdom/diff/findChildMatches';
import { collectNodeChanges } from '../../../src/vdom/diff/collectNodeChanges';
import { collectMoveChanges } from '../../../src/vdom/diff/collectMoveChanges';
import type { ChildMatch } from '../../../src/vdom/diff/types';
import type { DiffCommand, VNode, VRoot } from '../../../src/vdom/types';

vi.mock(import('../../../src/vdom/diff/findChildMatches'), () => ({
  findChildMatches: vi.fn()
}));
vi.mock(import('../../../src/vdom/diff/collectNodeChanges'), () => ({
  collectNodeChanges: vi.fn()
}));
vi.mock(import('../../../src/vdom/diff/collectMoveChanges'), () => ({
  collectMoveChanges: vi.fn()
}));

function element(key: string, childNodes: VNode[] = []): VNode {
  return {
    nodeType: 1,
    tagName: 'DIV',
    attributes: [{ name: 'key', value: key }],
    nodeValue: null,
    childNodes,
    properties: {},
    dom: null
  };
}

function root(childNodes: VNode[] = []): VRoot {
  return { childNodes, dom: null };
}

function freezeInput(parent: VRoot | VNode): void {
  for (const child of parent.childNodes) freezeInput(child);
  Object.freeze(parent.childNodes);
  if ('attributes' in parent) {
    for (const attribute of parent.attributes) Object.freeze(attribute);
    Object.freeze(parent.attributes);
    Object.freeze(parent.properties);
  }
  Object.freeze(parent);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findChildMatches).mockReturnValue([]);
  vi.mocked(collectNodeChanges).mockReturnValue([]);
  vi.mocked(collectMoveChanges).mockReturnValue([]);
});

describe('collectChildChanges — 하위 함수를 대체한 격리 검증', () => {
  it('빈 자식 목록은 하위 함수를 호출하지 않고 빈 배열을 반환한다', () => {
    expect(collectChildChanges(root(), root())).toEqual([]);
    expect(findChildMatches).not.toHaveBeenCalled();
    expect(collectNodeChanges).not.toHaveBeenCalled();
    expect(collectMoveChanges).not.toHaveBeenCalled();
  });

  it('부모의 직계 자식 배열을 그대로 짝 찾기에 전달한다', () => {
    const prev = root([element('a')]);
    const next = root([element('a')]);

    expect(collectChildChanges(prev, next)).toEqual([]);

    expect(findChildMatches).toHaveBeenCalledTimes(1);
    const [prevChildren, nextChildren] = vi.mocked(findChildMatches).mock.calls[0]!;
    expect(prevChildren).toBe(prev.childNodes);
    expect(nextChildren).toBe(next.childNodes);
  });

  it('새 하위 트리를 루트 아래에 한 번 삽입하고 하위 비교는 호출하지 않는다', () => {
    const added = element('new', [element('nested')]);
    const next = root([added]);
    vi.mocked(findChildMatches).mockReturnValue([{ kind: 'inserted', next: added }]);

    const changes = collectChildChanges(root(), next);

    expect(changes).toHaveLength(1);
    const command = changes[0];
    if (command?.type !== 'insert') throw new Error('insert 명령이 없다.');
    expect(command.node).toBe(added);
    expect(command.parent).toBe(next);
    expect(command.before).toBeNull();
    expect(collectNodeChanges).not.toHaveBeenCalled();
  });

  it('연속 삽입의 기준은 결과 배열 순서가 아닌 다음 자식 배열에서 찾는다', () => {
    const a = element('a');
    const b = element('b');
    const c = element('c');
    const next = element('parent', [a, b, c]);
    vi.mocked(findChildMatches).mockReturnValue([
      { kind: 'inserted', next: c },
      { kind: 'inserted', next: a },
      { kind: 'inserted', next: b }
    ]);

    const changes = collectChildChanges(element('parent'), next);

    expect(changes).toHaveLength(3);
    for (const [node, before] of [[a, b], [b, c], [c, null]] as const) {
      const command = changes.find((change) => change.type === 'insert' && change.node === node);
      if (command?.type !== 'insert') throw new Error('insert 명령이 없다.');
      expect(command.node).toBe(node);
      expect(command.parent).toBe(next);
      expect(command.before).toBe(before);
    }
  });

  it('사라진 자식을 한 번 제거하고 하위 비교는 호출하지 않는다', () => {
    const removed = element('removed', [element('nested')]);
    vi.mocked(findChildMatches).mockReturnValue([{ kind: 'removed', prev: removed }]);

    const changes = collectChildChanges(root([removed]), root());

    expect(changes).toHaveLength(1);
    expect(changes[0]?.type).toBe('remove');
    const command = changes[0];
    if (command?.type !== 'remove') throw new Error('remove 명령이 없다.');
    expect(command.target).toBe(removed);
    expect(collectNodeChanges).not.toHaveBeenCalled();
  });

  it('비교할 짝마다 노드 비교를 호출하고 빈 결과와 여러 명령을 그대로 취합한다', () => {
    const prevA = element('a', [element('nested')]);
    const nextA = element('a', [element('nested')]);
    const prevB = element('b');
    const nextB = element('b');
    const matches: ChildMatch[] = [
      { kind: 'matched', prev: prevA, next: nextA },
      { kind: 'matched', prev: prevB, next: nextB }
    ];
    const nestedTarget = prevA.childNodes[0]!;
    const first: DiffCommand = { type: 'update', target: prevA, data: { setProperties: { value: '' } } };
    const nested: DiffCommand = { type: 'remove', target: nestedTarget };
    vi.mocked(findChildMatches).mockReturnValue(matches);
    vi.mocked(collectNodeChanges).mockReturnValueOnce([first, nested]).mockReturnValueOnce([]);

    const changes = collectChildChanges(root([prevA, prevB]), root([nextA, nextB]));

    expect(collectNodeChanges).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(collectNodeChanges).mock.calls;
    expect(calls[0]?.[0]).toBe(prevA);
    expect(calls[0]?.[1]).toBe(nextA);
    expect(calls[1]?.[0]).toBe(prevB);
    expect(calls[1]?.[1]).toBe(nextB);
    expect(changes).toHaveLength(2);
    expect(changes[0]).toBe(first);
    expect(changes[1]).toBe(nested);
  });

  it('세 종류의 결과와 이동 명령을 빠짐없이 취합하고 입력을 수정하지 않는다', () => {
    const removed = element('removed');
    const prevKept = element('kept');
    const nextKept = element('kept');
    const added = element('added');
    const prev = root([removed, prevKept]);
    const next = root([nextKept, added]);
    const matches: ChildMatch[] = [
      { kind: 'matched', prev: prevKept, next: nextKept },
      { kind: 'inserted', next: added },
      { kind: 'removed', prev: removed }
    ];
    const update: DiffCommand = {
      type: 'update', target: prevKept, data: { setProperties: { checked: false } }
    };
    const move: Extract<DiffCommand, { type: 'move' }> = {
      type: 'move', target: prevKept, parent: next, before: added
    };
    const nodeChanges: DiffCommand[] = [update];
    const moveChanges: Extract<DiffCommand, { type: 'move' }>[] = [move];
    Object.freeze(nodeChanges);
    Object.freeze(moveChanges);
    vi.mocked(findChildMatches).mockReturnValue(matches);
    vi.mocked(collectNodeChanges).mockReturnValue(nodeChanges);
    vi.mocked(collectMoveChanges).mockReturnValue(moveChanges);
    Object.freeze(matches);
    for (const match of matches) Object.freeze(match);
    freezeInput(prev);
    freezeInput(next);

    const changes = collectChildChanges(prev, next);

    expect(changes).toHaveLength(4);
    expect(changes[0]).toBe(update);
    const insertion = changes[1];
    if (insertion?.type !== 'insert') throw new Error('insert 명령이 없다.');
    expect(insertion.node).toBe(added);
    expect(insertion.parent).toBe(next);
    expect(insertion.before).toBeNull();
    const removal = changes[2];
    if (removal?.type !== 'remove') throw new Error('remove 명령이 없다.');
    expect(removal.target).toBe(removed);
    expect(changes[3]).toBe(move);
    expect(collectMoveChanges).toHaveBeenCalledTimes(1);
    const moveArgs = vi.mocked(collectMoveChanges).mock.calls[0]!;
    expect(moveArgs[0]).toBe(prev.childNodes);
    expect(moveArgs[1]).toBe(next);
    expect(moveArgs[2]).toBe(matches);
    expect(prev.childNodes[0]).toBe(removed);
    expect(next.childNodes[0]).toBe(nextKept);
    expect(prevKept.dom).toBeNull();
    expect(nextKept.dom).toBeNull();
  });

  it.each(['findChildMatches', 'collectNodeChanges', 'collectMoveChanges'] as const)(
    '%s 오류를 성공 결과로 바꾸지 않고 그대로 전달한다',
    (stage) => {
      const prevNode = element('a');
      const nextNode = element('a');
      const prev = root([prevNode]);
      const next = root([nextNode]);
      const error = new Error(`${stage} 실패`);
      vi.mocked(findChildMatches).mockReturnValue([
        { kind: 'matched', prev: prevNode, next: nextNode }
      ]);
      const target = { findChildMatches, collectNodeChanges, collectMoveChanges }[stage];
      vi.mocked(target).mockImplementation(() => { throw error; });

      let caught: unknown;
      try {
        collectChildChanges(prev, next);
      } catch (failure) {
        caught = failure;
      }

      expect(caught).toBe(error);
      if (stage === 'findChildMatches') expect(collectNodeChanges).not.toHaveBeenCalled();
      if (stage !== 'collectMoveChanges') expect(collectMoveChanges).not.toHaveBeenCalled();
    }
  );
});
