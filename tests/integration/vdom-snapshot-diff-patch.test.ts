import { afterEach, describe, expect, it } from 'vitest';
import { readEditorHTML } from '../../src/app/editor';
import { createEmptyVDOM, createSnapshot, parseHTML } from '../../src/vdom/create';
import { diff } from '../../src/vdom/diff';
import { applyPatch, assertAllLinked } from '../../src/vdom/patch';
import type { DiffCommand, VNode, VRoot } from '../../src/vdom/types';
import { collectNodes } from '../helpers/vdom';

interface PatchFlowState {
  editor: HTMLTextAreaElement;
  actualRoot: HTMLDivElement;
  current: VRoot;
}

interface PreparedPatch {
  html: string;
  next: VRoot;
  changes: DiffCommand[];
}

interface PatchResult extends PreparedPatch {
  applied: boolean;
  completed: VRoot;
}

/*
 * handlePatch()의 현재 구현 가능한 흐름을 그대로 따른다.
 * History는 아직 구현되지 않았으므로 현재 VDOM 보관만 테스트 상태가 대신한다.
 */
function preparePatch(state: PatchFlowState): PreparedPatch {
  const html = readEditorHTML(state.editor);
  const next = createSnapshot(parseHTML(html));
  const changes = diff(state.current, next);

  return { html, next, changes };
}

function commitPatch(state: PatchFlowState, prepared: PreparedPatch): PatchResult {
  if (prepared.changes.length === 0) {
    return { ...prepared, applied: false, completed: state.current };
  }

  const completed = applyPatch(state.current, prepared.next, prepared.changes);
  state.current = completed;
  return { ...prepared, applied: true, completed };
}

function runPatchFlow(state: PatchFlowState): PatchResult {
  return commitPatch(state, preparePatch(state));
}

function createPatchFlowState(initialHTML: string): PatchFlowState {
  const editor = document.createElement('textarea');
  const actualRoot = document.createElement('div');
  document.body.append(editor, actualRoot);

  const state: PatchFlowState = {
    editor,
    actualRoot,
    current: createEmptyVDOM(actualRoot)
  };

  editor.value = initialHTML;
  runPatchFlow(state);
  return state;
}

function findByKey(root: VRoot, key: string): VNode {
  const node = collectNodes(root).find((candidate) =>
    candidate.attributes.some(({ name, value }) => name === 'key' && value === key)
  );

  if (!node) throw new Error(`key="${key}" VNode를 찾지 못했다.`);
  return node;
}

function domKeys(actualRoot: Element): Array<string | null> {
  return Array.from(actualRoot.children, (child) => child.getAttribute('key'));
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

function expectSnapshotUnlinked(root: VRoot): void {
  expect(root.dom).toBeNull();
  for (const node of collectNodes(root)) expect(node.dom).toBeNull();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('IT-01 초기 렌더링 — Snapshot → Diff → Patch', () => {
  it('빈 실제 영역에 새 하위 트리를 한 번만 렌더링하고 전체 참조를 연결한다', () => {
    const actualRoot = document.createElement('div');
    document.body.appendChild(actualRoot);

    const empty = createEmptyVDOM(actualRoot);
    const next = createSnapshot(
      parseHTML('<section key="s"><p key="p">A</p><span key="sp">B</span></section>')
    );

    expectSnapshotUnlinked(next);

    const changes = diff(empty, next);

    expect(actualRoot.childNodes).toHaveLength(0);
    expect(next.dom).toBe(actualRoot);
    for (const node of collectNodes(next)) expect(node.dom).toBeNull();
    expect(changes.length).toBeGreaterThan(0);

    const completed = applyPatch(empty, next, changes);

    expect(completed).toBe(next);
    expect(actualRoot.children).toHaveLength(1);
    expect(actualRoot.querySelector('section > p')?.textContent).toBe('A');
    expect(actualRoot.querySelector('section > span')?.textContent).toBe('B');
    expect(actualRoot.children[0]?.getAttribute('key')).toBe('s');
    assertAllLinked(next, actualRoot);
  });
});

describe('IT-02 값 변경 — 텍스트·속성·프로퍼티', () => {
  it('Diff 중 실제 DOM을 유지하고 Patch 후 같은 객체에 값만 반영한다', () => {
    const state = createPatchFlowState(
      '<article key="root" class="a" title="설명"><h1 key="title">A</h1><input key="field" value="A"></article>'
    );
    const beforeDiff = captureDom(state.actualRoot);
    const article = findByKey(state.current, 'root');
    const title = findByKey(state.current, 'title');
    const articleDom = article.dom;
    const titleDom = title.dom;
    const titleTextDom = title.childNodes[0]?.dom;

    state.editor.value =
      '<article key="root" class="b" data-extra="x"><h1 key="title">B</h1><input key="field" value="B"></article>';

    const prepared = preparePatch(state);

    expectDomUnchanged(state.actualRoot, beforeDiff);
    expect(prepared.changes.length).toBeGreaterThan(0);
    expect(findByKey(prepared.next, 'root').dom).toBe(articleDom);
    expect(findByKey(prepared.next, 'title').dom).toBe(titleDom);
    expect(findByKey(prepared.next, 'title').childNodes[0]?.dom).toBe(titleTextDom);
    expect(prepared.next.childNodes.every((node) => node.dom !== null)).toBe(true);

    const result = commitPatch(state, prepared);

    expect(result.applied).toBe(true);
    expect(findByKey(result.completed, 'root').dom).toBe(articleDom);
    expect(findByKey(result.completed, 'title').dom).toBe(titleDom);
    expect(findByKey(result.completed, 'title').childNodes[0]?.dom).toBe(titleTextDom);
    expect(state.actualRoot.querySelector('h1')?.textContent).toBe('B');

    const articleElement = articleDom as Element;
    expect(articleElement.getAttribute('class')).toBe('b');
    expect(articleElement.getAttribute('data-extra')).toBe('x');
    expect(articleElement.hasAttribute('title')).toBe(false);
    expect((state.actualRoot.querySelector('input') as HTMLInputElement).value).toBe('B');
    assertAllLinked(result.completed, state.actualRoot);
  });
});

describe('IT-03 복합 변경 — 삽입·삭제·이동·수정', () => {
  it('실제 Diff 명령을 그대로 Patch에 적용해 목표 순서와 객체 동일성을 만든다', () => {
    const state = createPatchFlowState(
      '<ul key="list"><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>'
    );
    const beforeDiff = captureDom(state.actualRoot);
    const prevA = findByKey(state.current, 'a');
    const prevB = findByKey(state.current, 'b');
    const prevC = findByKey(state.current, 'c');
    const aDom = prevA.dom;
    const bDom = prevB.dom;
    const cDom = prevC.dom;

    state.editor.value =
      '<ul key="list"><li key="c" class="moved">C</li><li key="a">A2</li><li key="x">X</li></ul>';

    const prepared = preparePatch(state);

    expectDomUnchanged(state.actualRoot, beforeDiff);
    expect(domKeys(state.actualRoot.querySelector('ul') as Element)).toEqual([
      'a',
      'b',
      'c'
    ]);
    expect(findByKey(prepared.next, 'c').dom).toBe(cDom);
    expect(findByKey(prepared.next, 'a').dom).toBe(aDom);
    expect(findByKey(prepared.next, 'x').dom).toBeNull();
    expect(prevB.dom).toBe(bDom);

    const result = commitPatch(state, prepared);

    expect(result.applied).toBe(true);
    expect(domKeys(state.actualRoot.querySelector('ul') as Element)).toEqual([
      'c',
      'a',
      'x'
    ]);
    expect(findByKey(result.completed, 'c').dom).toBe(cDom);
    expect(findByKey(result.completed, 'a').dom).toBe(aDom);
    expect(findByKey(result.completed, 'x').dom).toBe(
      state.actualRoot.querySelector('ul')?.children[2]
    );
    expect((cDom as Element).getAttribute('class')).toBe('moved');
    expect(state.actualRoot.textContent).toBe('CA2X');
    expect(bDom?.parentNode).toBeNull();
    assertAllLinked(result.completed, state.actualRoot);
  });
});

describe('IT-04 삽입 의존성 — 새 형제를 기존 형제 앞에 생성', () => {
  it('Diff가 반환한 순서를 그대로 사용해 부모 없는 삽입 없이 목표 순서를 만든다', () => {
    const state = createPatchFlowState('<ul key="list"><li key="c">C</li></ul>');
    const beforeDiff = captureDom(state.actualRoot);
    const prevC = findByKey(state.current, 'c');
    const cDom = prevC.dom;

    state.editor.value =
      '<ul key="list"><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>';

    const prepared = preparePatch(state);

    expectDomUnchanged(state.actualRoot, beforeDiff);
    expect(prepared.changes.some(({ type }) => type === 'insert')).toBe(true);

    const result = commitPatch(state, prepared);

    expect(result.applied).toBe(true);
    expect(domKeys(state.actualRoot.querySelector('ul') as Element)).toEqual([
      'a',
      'b',
      'c'
    ]);
    expect(
      Array.from(state.actualRoot.querySelectorAll('li'), (child) => child.textContent)
    ).toEqual(['A', 'B', 'C']);
    expect(findByKey(result.completed, 'c').dom).toBe(cDom);
    assertAllLinked(result.completed, state.actualRoot);
  });
});

describe('IT-05 replace — keyless 노드 교체', () => {
  it('같은 위치의 div를 p로 교체하고 새 하위 트리 참조를 연결한다', () => {
    const state = createPatchFlowState(
      '<div key="d"><div>A</div><span>유지</span></div>'
    );
    const beforeDiff = captureDom(state.actualRoot);
    const prevSpan = findByKey(state.current, 'd').childNodes[1];
    const spanDom = prevSpan?.dom;
    const replacedDiv = findByKey(state.current, 'd').childNodes[0];
    const replacedDivDom = replacedDiv?.dom;

    state.editor.value = '<div key="d"><p>B</p><span>유지</span></div>';

    const prepared = preparePatch(state);

    expect(prepared.changes.some(({ type }) => type === 'replace')).toBe(true);
    expectDomUnchanged(state.actualRoot, beforeDiff);

    const nextDiv = findByKey(prepared.next, 'd');
    expect(nextDiv.childNodes[0]?.dom).toBeNull();
    expect(nextDiv.childNodes[1]?.dom).toBe(spanDom);

    const result = commitPatch(state, prepared);

    expect(result.applied).toBe(true);
    expect(state.actualRoot.querySelector('div[key="d"] > p')?.textContent).toBe('B');
    expect(state.actualRoot.querySelector('span')?.textContent).toBe('유지');
    expect(findByKey(result.completed, 'd').childNodes[1]?.dom).toBe(spanDom);
    expect(findByKey(result.completed, 'd').childNodes[0]?.dom).not.toBeNull();
    expect(replacedDivDom?.parentNode).toBeNull();
    assertAllLinked(result.completed, state.actualRoot);
  });
});

describe('IT-06 연속 Patch — 삽입 노드를 다음 Patch에서 재사용', () => {
  it('첫 Patch가 만든 p·텍스트를 두 번째 Patch가 다시 생성하지 않는다', () => {
    const state = createPatchFlowState('<div key="d"></div>');

    state.editor.value = '<div key="d"><p key="p1">A</p></div>';
    const first = runPatchFlow(state);
    expect(first.applied).toBe(true);

    const firstP = findByKey(first.completed, 'p1');
    const firstText = firstP.childNodes[0];
    const pDom = firstP.dom;
    const textDom = firstText?.dom;
    expect(pDom).not.toBeNull();
    expect(textDom).not.toBeNull();

    state.editor.value = '<div key="d"><p key="p1">B</p></div>';
    const second = runPatchFlow(state);
    expect(second.applied).toBe(true);

    const secondP = findByKey(second.completed, 'p1');
    expect(secondP.dom).toBe(pDom);
    expect(secondP.childNodes[0]?.dom).toBe(textDom);
    expect(state.actualRoot.querySelectorAll('p')).toHaveLength(1);
    expect(state.actualRoot.querySelector('p')?.textContent).toBe('B');
    assertAllLinked(second.completed, state.actualRoot);
  });
});

describe('IT-07 연속 Patch — replace 노드를 다음 Patch에서 재사용', () => {
  it('replace로 만든 p·텍스트를 두 번째 Patch가 기존 DOM으로 수정한다', () => {
    const state = createPatchFlowState('<div><span>A</span></div>');

    state.editor.value = '<div><p>A</p></div>';
    const first = runPatchFlow(state);
    expect(first.applied).toBe(true);

    const firstP = first.completed.childNodes[0]?.childNodes[0];
    const pDom = firstP?.dom;
    const textDom = firstP?.childNodes[0]?.dom;
    expect(pDom).not.toBeNull();
    expect(textDom).not.toBeNull();

    state.editor.value = '<div><p>B</p></div>';
    const second = runPatchFlow(state);
    expect(second.applied).toBe(true);

    const secondP = second.completed.childNodes[0]?.childNodes[0];
    expect(secondP?.dom).toBe(pDom);
    expect(secondP?.childNodes[0]?.dom).toBe(textDom);
    expect(state.actualRoot.querySelector('p')?.textContent).toBe('B');
    assertAllLinked(second.completed, state.actualRoot);
  });
});

describe('IT-08 변경 없음 — Diff만 실행', () => {
  it('같은 HTML의 새 Snapshot은 빈 명령을 만들고 Patch를 생략한다', () => {
    const html = '<section key="s"><p key="p">A</p></section>';
    const state = createPatchFlowState(html);
    const before = captureDom(state.actualRoot);
    const beforeCurrent = state.current;
    const beforeSectionDom = findByKey(state.current, 's').dom;

    const prepared = preparePatch(state);

    expect(prepared.changes).toEqual([]);
    expectDomUnchanged(state.actualRoot, before);
    expect(findByKey(prepared.next, 's').dom).toBe(beforeSectionDom);
    expectSnapshotUnlinked(createSnapshot(parseHTML(html)));
    expect(prepared.next.dom).toBe(state.actualRoot);

    const result = commitPatch(state, prepared);

    expect(result.applied).toBe(false);
    expect(result.completed).toBe(beforeCurrent);
    expect(state.current).toBe(beforeCurrent);
    expectDomUnchanged(state.actualRoot, before);
  });
});
