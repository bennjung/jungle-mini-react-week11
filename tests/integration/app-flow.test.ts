import { afterEach, describe, expect, it } from 'vitest';
import { createHistory as createActualHistory } from '../../src/app/history';
import type { History } from '../../src/app/history';
import { createHandlers } from '../../src/app/handlers';
import { getElements, init } from '../../src/app/init';
import type { AppElements } from '../../src/app/init';
import { createInitializer } from '../../src/app/initialize';
import type { InitializerDependencies } from '../../src/app/initialize';
import { getSampleHTML, SAMPLE_HTML } from '../../src/sample';
import { createSnapshot, parseHTML } from '../../src/vdom/create';
import { diff } from '../../src/vdom/diff';
import { applyPatch } from '../../src/vdom/patch';
import type { VNode, VRoot } from '../../src/vdom/types';

// 실제 초기화·Handler가 사용하는 VDOM 의존성 그대로 연결한다.
const vdomDependencies: InitializerDependencies = {
  parseHTML,
  createSnapshot,
  diff,
  applyPatch
};

interface RunningApp {
  elements: AppElements;
  history: History;
  root: VRoot;
}

// main.html과 같은 필수 요소 구성을 만든다.
function mountMainPage(): void {
  document.body.innerHTML = `
    <textarea id="editor" class="editor" spellcheck="false" autocomplete="off"></textarea>
    <div id="actual" class="preview"></div>
    <footer class="footer">
      <div class="footer__actions">
        <button type="button" id="back" class="btn">← 뒤로</button>
        <button type="button" id="forward" class="btn">앞으로 →</button>
        <button type="button" id="patch" class="btn btn--primary">Patch</button>
      </div>
    </footer>
  `;
}

// 실제 init에 실제 함수를 전달하고, History 인스턴스는 검증을 위해 보관만 한다.
function startApp(): RunningApp {
  const captured: { history: History | null } = { history: null };

  const app = init({
    ...vdomDependencies,
    createHistory(): History {
      const history = createActualHistory();
      captured.history = history;
      return history;
    },
    getSampleHTML,
    createHandlers
  });

  if (captured.history === null) {
    throw new Error('createHistory가 호출되지 않았습니다.');
  }

  return { elements: app.elements, history: captured.history, root: app.root };
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`요소를 찾지 못했습니다: ${selector}`);
  return element;
}

function expectFullyLinked(root: VRoot, actualRoot: Element): void {
  expect(root.dom).toBe(actualRoot);

  const visit = (node: VNode, parentDom: Node): void => {
    const dom = node.dom;
    if (dom === null) throw new Error('연결되지 않은 VNode가 있습니다.');
    expect(dom.parentNode).toBe(parentDom);
    expect(actualRoot.contains(dom)).toBe(true);
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

const SAMPLE_TEXT = '이름: 홍길동';
const MODIFIED_TEXT = '이름: 김철수';

function modifySampleHTML(sampleHTML: string): string {
  const modified = sampleHTML.replace(SAMPLE_TEXT, MODIFIED_TEXT);
  if (modified === sampleHTML) {
    throw new Error('샘플에서 수정 대상 텍스트를 찾지 못했습니다.');
  }
  return modified;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('app-flow — 실제 의존성 앱 조립', () => {
  it('INIT-01: initializeDOM이 실제 함수로 샘플을 한 번 렌더링하고 편집기·첫 이력을 준비한다', () => {
    mountMainPage();
    const elements = getElements();
    const history = createActualHistory();
    const actualRoot = elements.actualRoot;
    const sampleHTML = getSampleHTML();
    const initializeDOM = createInitializer(elements, history, vdomDependencies);

    expect(sampleHTML).toBe(SAMPLE_HTML);
    expect(actualRoot.childNodes).toHaveLength(0);
    expect(history.peek(0)).toBeNull();

    expect(() => initializeDOM(sampleHTML)).not.toThrow();

    // 실제 영역 컨테이너를 유지하면서 샘플을 정확히 한 번만 렌더링한다.
    expect(elements.actualRoot).toBe(actualRoot);
    expect(actualRoot.children).toHaveLength(1);
    expect(actualRoot.querySelectorAll('#sample-app')).toHaveLength(1);
    expect(actualRoot.querySelectorAll('.sample')).toHaveLength(1);
    expect(actualRoot.textContent).toContain('Mini React Test');

    // 편집기는 샘플 원문을 그대로 표시한다.
    expect(elements.editor.value).toBe(sampleHTML);

    // 샘플 상태가 첫 이력이며 현재 VDOM은 전체가 실제 DOM에 연결되어 있다.
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(0)?.html).toBe(sampleHTML);
    expect(history.peek(1)).toBeNull();
    expectFullyLinked(history.get(), actualRoot);
  });

  it('INIT-02: init이 실제 의존성을 조립하고 Patch 클릭이 실제 DOM을 변경한다', () => {
    mountMainPage();
    const pageRoot = requireElement<HTMLElement>(document, '#actual');
    const sampleHTML = getSampleHTML();

    const { elements, history, root } = startApp();

    // 페이지 초기화는 예외 없이 끝나고 샘플·편집기·첫 이력이 준비된다.
    expect(elements.actualRoot).toBe(pageRoot);
    expect(pageRoot.children).toHaveLength(1);
    expect(pageRoot.querySelectorAll('#sample-app')).toHaveLength(1);
    expect(elements.editor.value).toBe(sampleHTML);
    expect(root).toBe(history.get());
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(0)?.html).toBe(sampleHTML);
    expect(history.peek(1)).toBeNull();
    expectFullyLinked(history.get(), pageRoot);

    const profileParagraph = requireElement<HTMLParagraphElement>(
      pageRoot,
      '#sample-app section.profile p'
    );
    const profileText = profileParagraph.firstChild;
    expect(profileText?.nodeValue).toBe(SAMPLE_TEXT);

    // 편집기 수정 → 실제 Patch 버튼 클릭 → 실제 DOM 반영과 이력 추가.
    const modifiedHTML = modifySampleHTML(sampleHTML);
    elements.editor.value = modifiedHTML;
    elements.patchButton.click();

    expect(elements.editor.value).toBe(modifiedHTML);
    expect(pageRoot.textContent).toContain(MODIFIED_TEXT);
    expect(pageRoot.textContent).not.toContain(SAMPLE_TEXT);
    expect(pageRoot.querySelectorAll('#sample-app')).toHaveLength(1);
    expect(requireElement(pageRoot, '#sample-app section.profile p')).toBe(profileParagraph);
    expect(profileParagraph.firstChild).toBe(profileText);
    expect(profileText?.nodeValue).toBe(MODIFIED_TEXT);

    expect(history.peek(-1)?.html).toBe(sampleHTML);
    expect(history.peek(0)?.html).toBe(modifiedHTML);
    expect(history.peek(1)).toBeNull();
    expectFullyLinked(history.get(), pageRoot);
  });

  it('HIST-02: 뒤로·앞으로 클릭이 실제 화면과 편집기 원문을 함께 복원한다', () => {
    mountMainPage();
    const sampleHTML = getSampleHTML();
    const { elements, history } = startApp();
    const actualRoot = elements.actualRoot;

    const modifiedHTML = modifySampleHTML(sampleHTML);
    elements.editor.value = modifiedHTML;
    elements.patchButton.click();
    expect(actualRoot.textContent).toContain(MODIFIED_TEXT);

    // 뒤로 → 초기 화면과 편집기 원문을 함께 복원한다.
    elements.backButton.click();

    expect(elements.actualRoot).toBe(actualRoot);
    expect(elements.editor.value).toBe(sampleHTML);
    expect(actualRoot.textContent).toContain(SAMPLE_TEXT);
    expect(actualRoot.textContent).not.toContain(MODIFIED_TEXT);
    expect(actualRoot.querySelectorAll('#sample-app')).toHaveLength(1);
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(0)?.html).toBe(sampleHTML);
    expect(history.peek(1)?.html).toBe(modifiedHTML);
    expectFullyLinked(history.get(), actualRoot);

    const restoredParagraph = requireElement<HTMLParagraphElement>(
      actualRoot,
      '#sample-app section.profile p'
    );
    expect(restoredParagraph.firstChild?.nodeValue).toBe(SAMPLE_TEXT);

    // 앞으로 → 수정 상태의 화면과 편집기 원문을 함께 복원한다.
    elements.forwardButton.click();

    expect(elements.actualRoot).toBe(actualRoot);
    expect(elements.editor.value).toBe(modifiedHTML);
    expect(actualRoot.textContent).toContain(MODIFIED_TEXT);
    expect(actualRoot.textContent).not.toContain(SAMPLE_TEXT);
    expect(history.peek(-1)?.html).toBe(sampleHTML);
    expect(history.peek(0)?.html).toBe(modifiedHTML);
    expect(history.peek(1)).toBeNull();
    expectFullyLinked(history.get(), actualRoot);
  });

  it('HIST-03: 처음·마지막 경계에서 뒤로·앞으로 클릭은 아무것도 바꾸지 않는다', () => {
    mountMainPage();
    const sampleHTML = getSampleHTML();
    const { elements, history } = startApp();
    const actualRoot = elements.actualRoot;

    // 처음 경계에서 뒤로: 화면·편집기·현재 live VDOM·이력 위치가 모두 유지된다.
    const liveAtFirst = history.get();
    const domAtFirst = captureDom(actualRoot);
    const editorAtFirst = elements.editor.value;

    elements.backButton.click();

    expect(history.get()).toBe(liveAtFirst);
    expect(elements.editor.value).toBe(editorAtFirst);
    expectDomUnchanged(actualRoot, domAtFirst);
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(0)?.html).toBe(sampleHTML);
    expect(history.peek(1)).toBeNull();

    // 마지막 경계에서 앞으로: 같은 방식으로 완전한 no-op이다.
    const modifiedHTML = modifySampleHTML(sampleHTML);
    elements.editor.value = modifiedHTML;
    elements.patchButton.click();

    const liveAtLast = history.get();
    const domAtLast = captureDom(actualRoot);
    const editorAtLast = elements.editor.value;

    elements.forwardButton.click();

    expect(history.get()).toBe(liveAtLast);
    expect(elements.editor.value).toBe(editorAtLast);
    expectDomUnchanged(actualRoot, domAtLast);
    expect(history.peek(-1)?.html).toBe(sampleHTML);
    expect(history.peek(0)?.html).toBe(modifiedHTML);
    expect(history.peek(1)).toBeNull();
  });
});
