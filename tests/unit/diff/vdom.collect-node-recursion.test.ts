import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectNodeChanges } from '../../../src/vdom/diff/collectNodeChanges';
import type { VNode } from '../../../src/vdom/types';

// 미구현 계산만 대체한다. 노드 비교·자식 대응·재귀·DOM 연결은 실제 함수를 실행한다.
const dependencies = vi.hoisted(() => ({ attributes: vi.fn(), properties: vi.fn(), moves: vi.fn() }));
vi.mock('../../../src/vdom/diff/findAttributeUpdates', () => ({ findAttributeUpdates: dependencies.attributes }));
vi.mock('../../../src/vdom/diff/findPropertyUpdates', () => ({ findPropertyUpdates: dependencies.properties }));
vi.mock('../../../src/vdom/diff/collectMoveChanges', () => ({ collectMoveChanges: dependencies.moves }));

function vnode(node: Node, linked: boolean): VNode {
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) {
    throw new Error('요소와 텍스트 노드만 시험한다.');
  }
  return {
    nodeType: node.nodeType === Node.TEXT_NODE ? 3 : 1,
    tagName: node instanceof Element ? node.tagName : null,
    attributes: node instanceof Element
      ? Array.from(node.attributes, ({ name, value }) => ({ name, value })) : [],
    nodeValue: node.nodeValue,
    childNodes: Array.from(node.childNodes, (child) => vnode(child, linked)),
    properties: {},
    dom: linked ? node : null
  };
}

function child(parent: VNode, index = 0): VNode {
  const result = parent.childNodes[index];
  if (!result) throw new Error('시험 자식이 없다.');
  return result;
}

function expectUnlinked(node: VNode): void {
  expect(node.dom).toBeNull();
  node.childNodes.forEach(expectUnlinked);
}

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.attributes.mockReturnValue({});
  dependencies.properties.mockReturnValue({});
  dependencies.moves.mockReturnValue([]);
});

describe('NODE-COMMAND-01: 주석에 명시된 재귀와 연결 범위', () => {
  it('자체 변경이 없어도 실제 자식 비교를 재귀해 모든 자손 DOM을 연결한다', () => {
    const actual = document.createElement('div');
    actual.innerHTML = '<p>A<span>B</span></p>';
    const parsed = actual.cloneNode(true);
    const prev = vnode(actual, true);
    const next = vnode(parsed, false);

    expect(collectNodeChanges(prev, next)).toEqual([]);
    expect(next.dom).toBe(actual);
    expect(child(next).dom).toBe(actual.firstChild);
    expect(child(child(next)).dom).toBe(actual.firstChild?.firstChild);
    expect(child(child(next), 1).dom).toBe(actual.querySelector('span'));
    expect(child(child(child(next), 1)).dom).toBe(actual.querySelector('span')?.firstChild);
    expect(actual.innerHTML).toBe('<p>A<span>B</span></p>');
  });

  it('교체하는 노드는 하위 트리를 순회하거나 연결하지 않는다', () => {
    const actual = document.createElement('div');
    actual.innerHTML = '<p>A</p>';
    const replacement = document.createElement('section');
    replacement.innerHTML = '<p>B<span>C</span></p>';
    const prev = vnode(actual, true);
    const next = vnode(replacement, false);

    expect(collectNodeChanges(prev, next)).toEqual([{ type: 'replace', target: prev, node: next }]);
    expectUnlinked(next);
    expect(dependencies.attributes).not.toHaveBeenCalled();
    expect(dependencies.properties).not.toHaveBeenCalled();
    expect(dependencies.moves).not.toHaveBeenCalled();
    expect(actual.innerHTML).toBe('<p>A</p>');
  });
});
