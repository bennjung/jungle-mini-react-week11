import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectNodeChanges } from '../../../src/vdom/diff/collectNodeChanges';
import type { DiffCommand, VNode } from '../../../src/vdom/types';

// 미구현 하위 비교와 자식 명령은 대체하고 현재 노드의 명령 생성만 분리한다.
const dependencies = vi.hoisted(() => ({
  attributes: vi.fn(),
  properties: vi.fn(),
  children: vi.fn()
}));
vi.mock('../../../src/vdom/diff/findAttributeUpdates', () => ({ findAttributeUpdates: dependencies.attributes }));
vi.mock('../../../src/vdom/diff/findPropertyUpdates', () => ({ findPropertyUpdates: dependencies.properties }));
vi.mock('../../../src/vdom/diff/collectChildChanges', () => ({ collectChildChanges: dependencies.children }));

function vnode(node: Node, linked: boolean): VNode {
  return {
    nodeType: node.nodeType === Node.TEXT_NODE ? 3 : 1,
    tagName: node instanceof Element ? node.tagName : null,
    attributes: [],
    nodeValue: node.nodeValue,
    childNodes: [],
    properties: {},
    dom: linked ? node : null
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.attributes.mockReturnValue({});
  dependencies.properties.mockReturnValue({});
  dependencies.children.mockReturnValue([]);
});

describe('NODE-COMMAND-01: 현재 노드의 명령과 자식 명령 구분', () => {
  it('이미 대응한 서로 다른 종류의 노드는 replace만 만들고 자식을 비교하지 않는다', () => {
    const prev = vnode(document.createTextNode('A'), true);
    const next = vnode(document.createElement('p'), false);
    expect(collectNodeChanges(prev, next)).toEqual([{ type: 'replace', target: prev, node: next }]);
    expect(next.dom).toBeNull();
    expect(dependencies.children).not.toHaveBeenCalled();
  });

  it('텍스트 값이 바뀌면 이전 노드 대상 update만 만들고 실제 DOM은 보존한다', () => {
    const text = document.createTextNode('A');
    const prev = vnode(text, true);
    const next = vnode(document.createTextNode('B'), false);
    expect(collectNodeChanges(prev, next)).toEqual([
      { type: 'update', target: prev, data: { nodeValue: 'B' } }
    ]);
    expect(next.dom).toBe(text);
    expect(text.nodeValue).toBe('A');
    expect(dependencies.children).not.toHaveBeenCalled();
  });

  it('요소의 update와 자식이 반환한 insert·remove·move를 구분해 합친다', () => {
    const prev = vnode(document.createElement('div'), true);
    const next = vnode(document.createElement('div'), false);
    const oldChild = vnode(document.createElement('p'), true);
    const newChild = vnode(document.createElement('span'), false);
    const childChanges: DiffCommand[] = [
      { type: 'insert', node: newChild, parent: next, before: null },
      { type: 'remove', target: oldChild },
      { type: 'move', target: oldChild, parent: next, before: null }
    ];
    dependencies.attributes.mockReturnValue({ setAttributes: [{ name: 'class', value: 'new' }] });
    dependencies.children.mockReturnValue(childChanges);
    expect(collectNodeChanges(prev, next)).toEqual([
      { type: 'update', target: prev, data: { setAttributes: [{ name: 'class', value: 'new' }] } },
      ...childChanges
    ]);
    expect(dependencies.children).toHaveBeenCalledOnce();
    expect(dependencies.children).toHaveBeenCalledWith(prev, next);
    expect(next.dom).toBe(prev.dom);
  });

  it('현재 요소에 변경이 없으면 자식 명령만 그대로 반환한다', () => {
    const prev = vnode(document.createElement('div'), true);
    const next = vnode(document.createElement('div'), false);
    const child = vnode(document.createElement('span'), false);
    const insert: DiffCommand = { type: 'insert', node: child, parent: next, before: null };
    dependencies.children.mockReturnValue([insert]);
    expect(collectNodeChanges(prev, next)).toEqual([insert]);
    expect(next.dom).toBe(prev.dom);
  });
});
