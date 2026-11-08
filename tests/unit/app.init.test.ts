import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitializer } from '../../src/app/initialize';
import { getElements, init } from '../../src/app/init';
import { parseHTML } from '../../src/vdom/create';
import type { VNode, VRoot } from '../../src/vdom/types';

const sampleHTML = '<section><p>A</p></section>';

function expectLinkedTree(vnode: VRoot | VNode, dom: Node): void {
  expect(vnode.dom).toBe(dom);
  expect(vnode.childNodes).toHaveLength(dom.childNodes.length);
  vnode.childNodes.forEach((child, index) => {
    const childDom = dom.childNodes.item(index);
    expect(child.nodeType).toBe(childDom.nodeType);
    expect(child.nodeValue).toBe(childDom.nodeValue);
    expectLinkedTree(child, childDom);
  });
}

// Snapshot·Patch·History의 실제 구현이 아닌 INIT 호출 경계의 테스트 대역이다.
function createMocks() {
  const elements = getElements();
  const text: VNode = {
    nodeType: 3, tagName: null, attributes: [], nodeValue: 'A',
    childNodes: [], properties: {}, dom: null
  };
  const paragraph: VNode = {
    nodeType: 1, tagName: 'P', attributes: [], nodeValue: null,
    childNodes: [text], properties: {}, dom: null
  };
  const section: VNode = {
    nodeType: 1, tagName: 'SECTION', attributes: [], nodeValue: null,
    childNodes: [paragraph], properties: {}, dom: null
  };
  const sampleVDOM: VRoot = { childNodes: [section], dom: null };
  const saved: Array<{ vdom: VRoot; html: string }> = [];
  const history = {
    set: vi.fn((vdom: VRoot, html: string) => {
      expectLinkedTree(vdom, elements.actualRoot);
      expect(elements.editor.value).toBe(html);
      saved.push({ vdom, html });
    }),
    get: vi.fn(() => {
      const entry = saved.at(-1);
      if (!entry) throw new Error('테스트 대역에 저장된 VDOM이 없습니다.');
      return entry.vdom;
    })
  };
  const dependencies = {
    parseHTML: vi.fn(parseHTML),
    createSnapshot: vi.fn((_parsedRoot: ParentNode) => sampleVDOM),
    diff: vi.fn((_prev: VRoot, next: VRoot) => {
      expect(next.dom).toBeNull();
      expect(section.dom).toBeNull();
      expect(paragraph.dom).toBeNull();
      expect(text.dom).toBeNull();
      return [];
    }),
    applyPatch: vi.fn((prev: VRoot, next: VRoot) => {
      expect(prev.dom).toBe(elements.actualRoot);
      expect(prev.childNodes).toEqual([]);
      const sectionDom = document.createElement('section');
      const paragraphDom = document.createElement('p');
      const textDom = document.createTextNode('A');
      paragraphDom.append(textDom);
      sectionDom.append(paragraphDom);
      elements.actualRoot.append(sectionDom);
      next.dom = elements.actualRoot;
      section.dom = sectionDom;
      paragraph.dom = paragraphDom;
      text.dom = textDom;
    })
  };
  return { elements, sampleVDOM, saved, history, dependencies };
}

describe('초기화 — INIT (의존 함수 mock)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <textarea id="editor"></textarea>
      <div id="actual"></div>
      <button id="patch" type="button">Patch</button>
      <button id="back" type="button">뒤로</button>
      <button id="forward" type="button">앞으로</button>
    `;
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('INIT-01: initializeDOM(sampleHTML)이 파싱·Snapshot·Diff·Patch 후 원문과 첫 이력을 준비한다', () => {
    const { elements, history, dependencies, sampleVDOM, saved } = createMocks();
    const initializeDOM = createInitializer(elements, history, dependencies);
    expect(saved).toHaveLength(0);
    expect(elements.actualRoot.childNodes).toHaveLength(0);

    initializeDOM(sampleHTML);

    expect(dependencies.parseHTML).toHaveBeenCalledExactlyOnceWith(sampleHTML);
    expect(dependencies.createSnapshot).toHaveBeenCalledExactlyOnceWith(
      dependencies.parseHTML.mock.results[0]?.value
    );
    expect(dependencies.diff).toHaveBeenCalledExactlyOnceWith(
      { childNodes: [], dom: elements.actualRoot }, sampleVDOM
    );
    expect(dependencies.applyPatch).toHaveBeenCalledExactlyOnceWith(
      dependencies.diff.mock.calls[0]?.[0], sampleVDOM,
      dependencies.diff.mock.results[0]?.value
    );
    expect(elements.editor.value).toBe('<section><p>A</p></section>');
    expect(history.set).toHaveBeenCalledExactlyOnceWith(sampleVDOM, sampleHTML);
    expect(saved).toEqual([{ vdom: sampleVDOM, html: sampleHTML }]);
    expect(history.get()).toBe(sampleVDOM);
  });

  it('INIT-01: initializeDOM(sampleHTML)이 컨테이너를 유지하고 샘플 한 개와 전체 DOM 참조를 준비한다', () => {
    const { elements, history, dependencies, sampleVDOM } = createMocks();
    const actualRoot = elements.actualRoot;
    const initializeDOM = createInitializer(elements, history, dependencies);

    initializeDOM(sampleHTML);

    expect(document.querySelector('#actual')).toBe(actualRoot);
    expect(actualRoot.innerHTML).toBe('<section><p>A</p></section>');
    expect(actualRoot.childNodes).toHaveLength(1);
    expect(actualRoot.querySelectorAll('section')).toHaveLength(1);
    expect(actualRoot.querySelectorAll('p')).toHaveLength(1);
    expectLinkedTree(sampleVDOM, actualRoot);
  });

  it('INIT-02: init 후 첫 이력이 준비되고 각 클릭이 지정된 핸들러를 한 번씩 실행한다', () => {
    const { elements, history, dependencies, sampleVDOM, saved } = createMocks();
    const handlePatch = vi.fn(() => {
      // 실제 Patch 핸들러 대신 변경 저장 1회를 모사한다.
      history.set(sampleVDOM, elements.editor.value);
    });
    const handleHistoryMove = vi.fn((_direction: -1 | 1) => {});
    const createHistory = vi.fn(() => history);
    const getSampleHTML = vi.fn(() => sampleHTML);
    const createHandlers = vi.fn(() => ({ handlePatch, handleHistoryMove }));

    const app = init({ ...dependencies, createHistory, getSampleHTML, createHandlers });

    expect(createHistory).toHaveBeenCalledTimes(1);
    expect(getSampleHTML).toHaveBeenCalledTimes(1);
    expect(createHandlers).toHaveBeenCalledExactlyOnceWith(elements, history);
    expect(app.root).toBe(sampleVDOM);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.html).toBe(sampleHTML);
    expect(handlePatch).not.toHaveBeenCalled();
    expect(handleHistoryMove).not.toHaveBeenCalled();

    elements.editor.value = '<section><p>B</p></section>';
    elements.patchButton.click();
    expect(handlePatch).toHaveBeenCalledExactlyOnceWith();
    expect(history.set).toHaveBeenCalledTimes(2);
    expect(saved).toHaveLength(2);
    expect(saved[1]?.html).toBe('<section><p>B</p></section>');

    elements.backButton.click();
    expect(handleHistoryMove).toHaveBeenCalledExactlyOnceWith(-1);
    elements.forwardButton.click();
    expect(handleHistoryMove).toHaveBeenCalledTimes(2);
    expect(handleHistoryMove).toHaveBeenNthCalledWith(2, 1);
    expect(history.set).toHaveBeenCalledTimes(2);
    expect(saved).toHaveLength(2);
  });
});
