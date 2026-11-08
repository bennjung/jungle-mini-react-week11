import { expect, vi } from 'vitest';
import { init } from '../../src/app/init';
import { parseHTML } from '../../src/vdom/create';
import type { VNode, VRoot } from '../../src/vdom/types';

// 실제 앱의 초기화 경계에 History mock을 연결한다. 이력 알고리즘은 모사하지 않는다.
export function createHTMLContext() {
  document.body.innerHTML = `
    <textarea id="editor"></textarea>
    <div id="actual"></div>
    <button id="patch" type="button">Patch</button>
    <button id="back" type="button">뒤로</button>
    <button id="forward" type="button">앞으로</button>
  `;
  const text: VNode = {
    nodeType: 3, tagName: null, attributes: [], nodeValue: '기존',
    childNodes: [], properties: {}, dom: null
  };
  const paragraph: VNode = {
    nodeType: 1, tagName: 'P', attributes: [], nodeValue: null,
    childNodes: [text], properties: {}, dom: null
  };
  const root: VRoot = { childNodes: [paragraph], dom: null };
  const history = {
    get: vi.fn(() => root),
    set: vi.fn<(vdom: VRoot, html: string) => void>(),
    move: vi.fn<(direction: -1 | 0 | 1, liveVDOM: VRoot) => void>()
  };
  const app = init({
    createHistory: () => history,
    getSampleHTML: () => '<p>기존</p>',
    parseHTML,
    createSnapshot: () => root,
    diff: () => [],
    applyPatch: (prev, next) => {
      const container = prev.dom;
      if (!container) throw new Error('테스트 컨테이너가 연결되지 않았습니다.');
      const paragraphDom = document.createElement('p');
      const textDom = document.createTextNode('기존');
      paragraphDom.append(textDom);
      container.append(paragraphDom);
      next.dom = container;
      paragraph.dom = paragraphDom;
      text.dom = textDom;
    },
    createHandlers: () => ({ handlePatch: vi.fn(), handleHistoryMove: vi.fn() })
  });
  const initialHistoryWrites = history.set.mock.calls.slice();
  expect(initialHistoryWrites).toHaveLength(1);
  expect(initialHistoryWrites[0]).toEqual([root, '<p>기존</p>']);

  return { ...app, history, initialHistoryWrites };
}

export function expectHistoryUnchanged(context: ReturnType<typeof createHTMLContext>): void {
  expect(context.history.set.mock.calls).toEqual(context.initialHistoryWrites);
  expect(context.history.move).not.toHaveBeenCalled();
  expect(context.history.get()).toBe(context.root);
  const actualRoot = context.elements.actualRoot;
  const paragraphDom = actualRoot.firstChild;
  const textDom = paragraphDom?.firstChild ?? null;
  expect(context.root).toEqual({
    childNodes: [{
      nodeType: 1, tagName: 'P', attributes: [], nodeValue: null,
      properties: {}, dom: paragraphDom,
      childNodes: [{
        nodeType: 3, tagName: null, attributes: [], nodeValue: '기존',
        properties: {}, dom: textDom, childNodes: []
      }]
    }],
    dom: actualRoot
  });
  expect(context.root.dom).toBe(actualRoot);
  expect(context.root.childNodes[0]?.dom).toBe(paragraphDom);
  expect(context.root.childNodes[0]?.childNodes[0]?.dom).toBe(textDom);
}
