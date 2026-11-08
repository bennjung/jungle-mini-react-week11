import { describe, expect, it } from 'vitest';
import { collectChildChanges } from '../../../src/vdom/diff/collectChildChanges';
import type { VNode, VRoot } from '../../../src/vdom/types';

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

describe('collectChildChanges — 자식 변경 명령 취합', () => {
  it('양쪽 자식이 비어 있으면 변경 명령이 없다', () => {
    expect(collectChildChanges(root(), root())).toEqual([]);
  });

  it('새 하위 트리는 한 번 삽입하고 다음 루트를 부모로 지정한다', () => {
    const added = element('new', [element('nested')]);
    const next = root([added]);

    const changes = collectChildChanges(root(), next);

    expect(changes).toHaveLength(1);
    const change = changes[0];
    expect(change?.type).toBe('insert');
    if (!change || change.type !== 'insert') throw new Error('insert가 없다.');
    expect(change.node).toBe(added);
    expect(change.parent).toBe(next);
    expect(change.before).toBeNull();
    expect(next.childNodes).toEqual([added]);
    expect(added.dom).toBeNull();
  });

  it('연속 삽입은 다음 목록의 바로 오른쪽 형제를 기준으로 지정한다', () => {
    const a = element('a');
    const b = element('b');
    const next = root([a, b]);

    const changes = collectChildChanges(root(), next);

    expect(changes).toHaveLength(2);
    const aInsert = changes.find((change) => change.type === 'insert' && change.node === a);
    const bInsert = changes.find((change) => change.type === 'insert' && change.node === b);
    if (aInsert?.type !== 'insert' || bInsert?.type !== 'insert') {
      throw new Error('각 새 노드의 insert가 없다.');
    }
    expect(aInsert.parent).toBe(next);
    expect(aInsert.before).toBe(b);
    expect(bInsert.before).toBeNull();
    // 여기서는 취합 결과만 확인한다. 실행 순서 정리는 orderChanges의 책임이다.
  });

  it('사라진 부모는 한 번 제거하고 하위 제거를 중복 생성하지 않는다', () => {
    const removed = element('removed', [element('nested')]);
    const prev = root([removed]);

    const changes = collectChildChanges(prev, root());

    expect(changes).toHaveLength(1);
    const change = changes[0];
    expect(change?.type).toBe('remove');
    if (!change || change.type !== 'remove') throw new Error('remove가 없다.');
    expect(change.target).toBe(removed);
    expect(prev.childNodes[0]).toBe(removed);
  });
});
