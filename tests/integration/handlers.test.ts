import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistory } from '../../src/app/history';
import type { History } from '../../src/app/history';
import { createHandlers } from '../../src/app/handlers';
import type { AppElements, AppHandlers } from '../../src/app/init';
import { createEmptyVDOM, createSnapshot, parseHTML } from '../../src/vdom/create';
import { diff } from '../../src/vdom/diff';
import { applyPatch } from '../../src/vdom/patch';
import type { DiffCommand, VNode, VRoot } from '../../src/vdom/types';

// applyPatch 실패만 테스트에서 주입한다. 나머지 Patch API와 성공 경로는 실제 구현을 사용한다.
const patchInjection = vi.hoisted(() => ({
  failNext: null as null | ((prev: VRoot, next: VRoot, changes: DiffCommand[]) => void)
}));

vi.mock('../../src/vdom/patch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/vdom/patch')>();
  return {
    ...actual,
    applyPatch: vi.fn((prev: VRoot, next: VRoot, changes: DiffCommand[]) => {
      const injection = patchInjection.failNext;
      if (injection !== null) {
        patchInjection.failNext = null;
        injection(prev, next, changes);
      }
      return actual.applyPatch(prev, next, changes);
    })
  };
});

afterEach(() => {
  document.body.replaceChildren();
  patchInjection.failNext = null;
  vi.clearAllMocks();
});

function createElements(): AppElements {
  const editor = document.createElement('textarea');
  const actualRoot = document.createElement('div');
  const patchButton = document.createElement('button');
  const backButton = document.createElement('button');
  const forwardButton = document.createElement('button');
  document.body.append(editor, actualRoot, patchButton, backButton, forwardButton);

  return { editor, actualRoot, patchButton, backButton, forwardButton };
}

// 실제 초기화 경로와 같은 parseHTML → Snapshot → Diff → Patch 순서로 첫 이력을 만든다.
function initializeHistory(
  elements: AppElements,
  history: History,
  html: string
): VRoot {
  const empty = createEmptyVDOM(elements.actualRoot);
  const next = createSnapshot(parseHTML(html));
  const changes = diff(empty, next);
  const completed = applyPatch(empty, next, changes);

  elements.editor.value = html;
  history.set(completed, html);
  return completed;
}

function setup(initialHTML: string) {
  const elements = createElements();
  const history = createHistory();
  initializeHistory(elements, history, initialHTML);
  vi.mocked(applyPatch).mockClear();

  // 실제 저장·이동을 유지하면서 호출 횟수만 기록한다.
  const setSpy = vi.spyOn(history, 'set');
  const moveSpy = vi.spyOn(history, 'move');
  const handlers = createHandlers(elements, history);

  return { elements, history, handlers, setSpy, moveSpy };
}

function patchTo(elements: AppElements, handlers: AppHandlers, html: string): void {
  elements.editor.value = html;
  handlers.handlePatch();
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`요소를 찾지 못했습니다: ${selector}`);
  return element;
}

function expectAllUnlinked(node: VRoot | VNode): void {
  expect(node.dom).toBeNull();
  node.childNodes.forEach(expectAllUnlinked);
}

// VDOM의 모든 노드가 actualRoot의 올바른 부모 아래에 연결됐는지 확인한다.
function expectFullyLinked(root: VRoot, actualRoot: Element): void {
  expect(root.dom).toBe(actualRoot);

  const visit = (node: VNode, parentDom: Node): void => {
    const dom = node.dom;
    if (dom === null) throw new Error('연결되지 않은 VNode가 있습니다.');
    expect(dom.parentNode).toBe(parentDom);
    for (const child of node.childNodes) visit(child, dom);
  };

  for (const child of root.childNodes) visit(child, actualRoot);
}

interface DomSnapshot {
  html: string;
  nodes: Node[];
}

function captureDom(actualRoot: Element): DomSnapshot {
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    for (const child of node.childNodes) visit(child);
  };

  visit(actualRoot);
  return { html: actualRoot.innerHTML, nodes };
}

function expectDomUnchanged(actualRoot: Element, snapshot: DomSnapshot): void {
  expect(actualRoot.innerHTML).toBe(snapshot.html);

  const currentNodes: Node[] = [];
  const visit = (node: Node): void => {
    currentNodes.push(node);
    for (const child of node.childNodes) visit(child);
  };
  visit(actualRoot);

  expect(currentNodes).toHaveLength(snapshot.nodes.length);
  snapshot.nodes.forEach((node, index) => {
    expect(currentNodes[index]).toBe(node);
  });
}

describe('handlers — FLOW·HIST 통합', () => {
  it('FLOW-01: 텍스트 수정이 참조를 유지한 채 DOM에 반영되고 VDOM·원문이 한 번 저장된다', () => {
    const { elements, history, handlers, setSpy, moveSpy } = setup('<p key="p1">A</p>');
    const paragraph = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const text = paragraph.firstChild;
    const initialEntry = history.peek(0);
    if (!initialEntry) throw new Error('초기 이력이 없습니다.');
    const initialHTML = initialEntry.html;

    elements.editor.value = '<p key="p1">B</p>';
    handlers.handlePatch();

    // 편집기 원문은 다시 포맷하지 않는다.
    expect(elements.editor.value).toBe('<p key="p1">B</p>');
    expect(elements.actualRoot.textContent).toBe('B');
    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
    expect(text?.nodeValue).toBe('B');

    expect(vi.mocked(applyPatch)).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(moveSpy).not.toHaveBeenCalled();

    const savedCall = setSpy.mock.calls[0];
    if (!savedCall) throw new Error('이력 저장 호출이 없습니다.');
    const [completed, savedHTML] = savedCall;

    expect(savedHTML).toBe('<p key="p1">B</p>');
    expect(history.get()).toBe(completed);
    expectFullyLinked(history.get(), elements.actualRoot);

    expect(history.peek(0)?.html).toBe('<p key="p1">B</p>');
    expect(history.peek(0)?.vdom.childNodes[0]?.childNodes[0]?.nodeValue).toBe('B');
    expectAllUnlinked(history.peek(0)!.vdom);
    expect(history.peek(-1)?.html).toBe(initialHTML);
    expect(history.peek(1)).toBeNull();

    // 이전 이력 데이터는 유지된다.
    expect(initialEntry.vdom.childNodes[0]?.childNodes[0]?.nodeValue).toBe('A');
  });

  it('FLOW-02: 첫 Patch에서 삽입한 p와 텍스트를 다음 Patch가 다시 생성하지 않고 수정한다', () => {
    const { elements, history, handlers, setSpy } = setup('<div></div>');

    patchTo(elements, handlers, '<div><p key="p1">A</p></div>');
    const container = requireElement(elements.actualRoot, 'div');
    const paragraph = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const text = paragraph.firstChild;

    patchTo(elements, handlers, '<div><p key="p1">B</p></div>');

    expect(requireElement(elements.actualRoot, 'div')).toBe(container);
    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
    expect(elements.actualRoot.textContent).toBe('B');

    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(history.peek(-1)?.html).toBe('<div><p key="p1">A</p></div>');
    expect(history.peek(0)?.html).toBe('<div><p key="p1">B</p></div>');
    expect(history.peek(1)).toBeNull();
    expectFullyLinked(history.get(), elements.actualRoot);
  });

  it('FLOW-02: 첫 Patch에서 교체한 p와 텍스트를 다음 Patch가 다시 생성하지 않고 수정한다', () => {
    const { elements, history, handlers, setSpy } = setup(
      '<div><span key="old">A</span></div>'
    );

    patchTo(elements, handlers, '<div><p key="p1">A</p></div>');
    const container = requireElement(elements.actualRoot, 'div');
    const paragraph = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const text = paragraph.firstChild;

    patchTo(elements, handlers, '<div><p key="p1">B</p></div>');

    expect(requireElement(elements.actualRoot, 'div')).toBe(container);
    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
    expect(elements.actualRoot.querySelectorAll('span')).toHaveLength(0);
    expect(elements.actualRoot.textContent).toBe('B');

    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(history.peek(-1)?.html).toBe('<div><p key="p1">A</p></div>');
    expect(history.peek(0)?.html).toBe('<div><p key="p1">B</p></div>');
    expectFullyLinked(history.get(), elements.actualRoot);
  });

  it('FLOW-03: 변경이 없으면 applyPatch와 이력 저장을 모두 생략하고 기존 live를 유지한다', () => {
    const { elements, history, handlers, setSpy, moveSpy } = setup(
      '<p class="a" title="b">A</p>'
    );
    const live = history.get();
    const paragraph = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const text = paragraph.firstChild;
    const storedEntry = history.peek(0);
    if (!storedEntry) throw new Error('초기 이력이 없습니다.');
    const storedHTML = storedEntry.html;
    const domBefore = captureDom(elements.actualRoot);

    // 속성 나열 순서만 바꾼 입력은 Diff 의미상 변경이 아니다.
    elements.editor.value = '<p title="b" class="a">A</p>';
    handlers.handlePatch();

    expect(vi.mocked(applyPatch)).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(moveSpy).not.toHaveBeenCalled();
    expect(history.get()).toBe(live);

    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
    expect(text?.nodeValue).toBe('A');
    expectDomUnchanged(elements.actualRoot, domBefore);

    expect(history.peek(0)).toBe(storedEntry);
    expect(history.peek(0)?.html).toBe(storedHTML);
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(1)).toBeNull();
    expectAllUnlinked(storedEntry.vdom);
  });

  it('HIST-02: 뒤로·앞으로 이동이 실제 영역과 저장 원문을 함께 복원하고 참조를 재연결한다', () => {
    const htmlA = '<section>\n  <p>A</p>\n</section>';
    const htmlB = '<section>\n    <p>B</p>\n</section>';
    const htmlC = '<section><p>C</p><span>추가</span></section>';
    const { elements, history, handlers, setSpy, moveSpy } = setup(htmlA);
    const actualRoot = elements.actualRoot;

    patchTo(elements, handlers, htmlB);
    patchTo(elements, handlers, htmlC);
    const savesAfterPatches = setSpy.mock.calls.length;
    expect(savesAfterPatches).toBe(2);

    // 현재 C에서 이동 전 이력 구조를 보관한다.
    expect(history.peek(-1)?.html).toBe(htmlB);
    expect(history.peek(0)?.html).toBe(htmlC);
    expect(history.peek(1)).toBeNull();

    handlers.handleHistoryMove(-1);

    expect(elements.editor.value).toBe(htmlB);
    expect(requireElement(elements.actualRoot, 'p').textContent).toBe('B');
    expect(elements.actualRoot).toBe(actualRoot);
    const restoredB = history.get();
    expectFullyLinked(restoredB, actualRoot);
    expect(moveSpy).toHaveBeenLastCalledWith(-1, restoredB);
    expect(setSpy).toHaveBeenCalledTimes(savesAfterPatches);
    expect(history.peek(-1)?.html).toBe(htmlA);
    expect(history.peek(0)?.html).toBe(htmlB);
    expect(history.peek(1)?.html).toBe(htmlC);
    expect(
      history.peek(-1)?.vdom.childNodes[0]?.childNodes.find(
        (node) => node.tagName === 'P'
      )?.childNodes[0]?.nodeValue
    ).toBe('A');
    expectAllUnlinked(history.peek(-1)!.vdom);

    handlers.handleHistoryMove(1);

    expect(elements.editor.value).toBe(htmlC);
    expect(actualRoot.textContent).toBe('C추가');
    expect(elements.actualRoot).toBe(actualRoot);
    const restoredC = history.get();
    expectFullyLinked(restoredC, actualRoot);
    expect(moveSpy).toHaveBeenLastCalledWith(1, restoredC);
    expect(setSpy).toHaveBeenCalledTimes(savesAfterPatches);
    expect(history.peek(-1)?.html).toBe(htmlB);
    expect(history.peek(0)?.html).toBe(htmlC);
    expect(history.peek(1)).toBeNull();
  });

  it('HIST-03: 첫 이력 하나에서 뒤로·앞으로 요청은 완전한 no-op이다', () => {
    const { elements, history, handlers, setSpy, moveSpy } = setup('<p>A</p>');
    const live = history.get();
    const paragraph = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const text = paragraph.firstChild;
    const editorValue = elements.editor.value;
    const domBefore = captureDom(elements.actualRoot);

    handlers.handleHistoryMove(-1);
    handlers.handleHistoryMove(1);

    expect(moveSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(history.get()).toBe(live);
    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
    expect(elements.editor.value).toBe(editorValue);
    expectDomUnchanged(elements.actualRoot, domBefore);
    expect(history.peek(0)?.html).toBe(editorValue);
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(1)).toBeNull();
  });

  it('HIST-03: 마지막에서 앞으로, 처음에서 뒤로 이동은 화면·코드·위치를 유지한다', () => {
    const htmlA = '<p>A</p>';
    const htmlB = '<p>B</p>';
    const { elements, history, handlers, setSpy, moveSpy } = setup(htmlA);
    patchTo(elements, handlers, htmlB);

    // 마지막 B에서 앞으로 이동한다.
    const liveB = history.get();
    const paragraphB = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const domB = captureDom(elements.actualRoot);
    moveSpy.mockClear();
    setSpy.mockClear();

    handlers.handleHistoryMove(1);

    expect(moveSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(history.get()).toBe(liveB);
    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraphB);
    expect(elements.editor.value).toBe(htmlB);
    expectDomUnchanged(elements.actualRoot, domB);

    // 정상적으로 처음 A로 이동한 뒤 다시 뒤로 이동한다.
    handlers.handleHistoryMove(-1);
    expect(elements.editor.value).toBe(htmlA);
    expectFullyLinked(history.get(), elements.actualRoot);

    const liveA = history.get();
    const paragraphA = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const domA = captureDom(elements.actualRoot);
    moveSpy.mockClear();
    setSpy.mockClear();

    handlers.handleHistoryMove(-1);

    expect(moveSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(history.get()).toBe(liveA);
    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraphA);
    expect(elements.editor.value).toBe(htmlA);
    expectDomUnchanged(elements.actualRoot, domA);
    expect(history.peek(0)?.html).toBe(htmlA);
    expect(history.peek(1)?.html).toBe(htmlB);
  });

  it('HIST-06: 속성 순서만 바꾼 Patch는 저장하지 않고 이동 시 미저장 편집을 저장 원문으로 되돌린다', () => {
    const htmlA = '<p key="p1" class="a" title="b">A</p>';
    const htmlB = '<p key="p1" class="a" title="b">B</p>';
    const { elements, history, handlers, setSpy, moveSpy } = setup(htmlA);
    patchTo(elements, handlers, htmlB);
    vi.mocked(applyPatch).mockClear();
    setSpy.mockClear();
    moveSpy.mockClear();

    const liveB = history.get();
    const paragraphB = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');

    elements.editor.value = '<p key="p1" title="b" class="a">B</p>';
    handlers.handlePatch();

    expect(vi.mocked(applyPatch)).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(moveSpy).not.toHaveBeenCalled();
    expect(history.get()).toBe(liveB);
    expect(history.peek(0)?.html).toBe(htmlB);
    expect(requireElement(elements.actualRoot, 'p')).toBe(paragraphB);

    // 저장하지 않은 텍스트 편집을 이력 이동으로 버리고 저장 원문 A를 복원한다.
    elements.editor.value = '<p key="p1" class="a" title="b">저장 안 됨</p>';
    handlers.handleHistoryMove(-1);

    expect(elements.editor.value).toBe(htmlA);
    expect(elements.actualRoot.textContent).toBe('A');
    expect(history.peek(0)?.html).toBe(htmlA);
    expect(history.peek(1)?.html).toBe(htmlB);
    expect(setSpy).not.toHaveBeenCalled();
    expect(moveSpy).toHaveBeenCalledExactlyOnceWith(-1, history.get());
    expectFullyLinked(history.get(), elements.actualRoot);
  });

  it('FLOW-04: applyPatch 오류 시 새 이력을 저장하지 않고 현재 이력·위치를 유지한다', () => {
    const htmlA = '<p key="p1">A</p>';
    const { elements, history, handlers, setSpy, moveSpy } = setup(htmlA);
    const liveBefore = history.get();
    const entryBefore = history.peek(0);
    const patchError = new Error('주입된 Patch 오류');

    elements.editor.value = '<p key="p1">B</p>';
    patchInjection.failNext = () => {
      throw patchError;
    };

    expect(() => handlers.handlePatch()).toThrow(patchError);

    expect(setSpy).not.toHaveBeenCalled();
    expect(moveSpy).toHaveBeenCalledExactlyOnceWith(0, history.get());
    expect(history.get()).not.toBe(liveBefore);
    expect(history.peek(0)).toBe(entryBefore);
    expect(history.peek(0)?.html).toBe(htmlA);
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(1)).toBeNull();

    // 실제 영역은 현재 이력 A로 full render 복원되고 editor는 실패한 B를 유지한다.
    expect(elements.actualRoot.textContent).toBe('A');
    expect(elements.editor.value).toBe('<p key="p1">B</p>');
    expectFullyLinked(history.get(), elements.actualRoot);

    // 같은 편집 내용으로 재시도하면 복원된 A를 기준으로 B를 계산한다.
    handlers.handlePatch();

    expect(elements.actualRoot.textContent).toBe('B');
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(history.peek(-1)?.html).toBe(htmlA);
    expect(history.peek(0)?.html).toBe('<p key="p1">B</p>');
    expect(history.peek(1)).toBeNull();
    expectFullyLinked(history.get(), elements.actualRoot);
  });

  it('FLOW-05: 부분 DOM 변경 후 실패하면 현재 이력으로 복원하고 editor 유지 상태에서 재시도한다', () => {
    const htmlA = '<p key="p1">A</p>';
    const htmlB = '<p key="p1">B</p><span>추가</span>';
    const { elements, history, handlers, setSpy, moveSpy } = setup(htmlA);
    const originalParagraph = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    const originalText = originalParagraph.firstChild;
    if (originalText === null) throw new Error('초기 텍스트 노드가 없습니다.');
    const patchError = new Error('부분 적용 후 실패');

    elements.editor.value = htmlB;
    patchInjection.failNext = () => {
      // 실제 text update가 먼저 적용된 것처럼 기존 실제 DOM 일부만 변경한다.
      originalText.nodeValue = 'B';
      throw patchError;
    };

    expect(() => handlers.handlePatch()).toThrow(patchError);

    expect(elements.editor.value).toBe(htmlB);
    expect(elements.actualRoot.textContent).toBe('A');
    expect(elements.actualRoot.querySelectorAll('span')).toHaveLength(0);

    const restoredParagraph = requireElement<HTMLParagraphElement>(elements.actualRoot, 'p');
    expect(restoredParagraph).not.toBe(originalParagraph);
    expect(originalParagraph.isConnected).toBe(false);
    expect(originalText.nodeValue).toBe('B'); // 실패한 next VDOM 쪽 참조는 폐기된다.

    expect(setSpy).not.toHaveBeenCalled();
    expect(moveSpy).toHaveBeenCalledExactlyOnceWith(0, history.get());
    expect(history.peek(0)?.html).toBe(htmlA);
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(1)).toBeNull();

    const restoredLive = history.get();
    expectFullyLinked(restoredLive, elements.actualRoot);
    expect(restoredLive.childNodes[0]?.dom).toBe(restoredParagraph);
    expect(restoredLive.childNodes[0]?.childNodes[0]?.nodeValue).toBe('A');

    // 같은 편집기 내용으로 재시도하면 복원된 A에서 B+span을 한 번만 만든다.
    handlers.handlePatch();

    expect(elements.actualRoot.textContent).toBe('B추가');
    expect(elements.actualRoot.querySelectorAll('p')).toHaveLength(1);
    expect(elements.actualRoot.querySelectorAll('span')).toHaveLength(1);
    expect(requireElement(elements.actualRoot, 'p')).toBe(restoredParagraph);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(history.peek(-1)?.html).toBe(htmlA);
    expect(history.peek(0)?.html).toBe(htmlB);
    expect(history.peek(1)).toBeNull();
    expectFullyLinked(history.get(), elements.actualRoot);
  });

  it('history.set 실패는 applyPatch 복구 경로가 아니라 호출자에게 그대로 전파한다', () => {
    const htmlA = '<p>A</p>';
    const { elements, history, handlers, setSpy, moveSpy } = setup(htmlA);
    const setError = new Error('주입된 저장 오류');

    setSpy.mockImplementationOnce(() => {
      throw setError;
    });
    elements.editor.value = '<p>B</p>';

    expect(() => handlers.handlePatch()).toThrow(setError);

    // applyPatch는 성공했지만 이력에는 저장되지 않는다. 복구용 move(0)도 호출하지 않는다.
    expect(moveSpy).not.toHaveBeenCalled();
    expect(elements.actualRoot.textContent).toBe('B');
    expect(history.peek(0)?.html).toBe(htmlA);
  });
});
