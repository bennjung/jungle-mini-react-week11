import { afterEach, describe, expect, it } from 'vitest';
import type { HistoryEntry } from '../../src/app/history';
import { restoreSnapshot } from '../../src/app/restore';
import { createSnapshot, parseHTML } from '../../src/vdom/create';
import { diff } from '../../src/vdom/diff';
import { applyPatch } from '../../src/vdom/patch';
import type { VNode, VRoot } from '../../src/vdom/types';

afterEach(() => {
  document.body.replaceChildren();
});

function createEntry(html: string): HistoryEntry {
  return { vdom: createSnapshot(parseHTML(html)), html };
}

function createActualRoot(html = ''): HTMLDivElement {
  const actualRoot = document.createElement('div');
  actualRoot.innerHTML = html;
  document.body.append(actualRoot);
  return actualRoot;
}

function createEditor(value = ''): HTMLTextAreaElement {
  const editor = document.createElement('textarea');
  editor.value = value;
  document.body.append(editor);
  return editor;
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

// 반환된 VDOM의 모든 노드가 actualRoot의 올바른 부모 아래에 연결됐는지 확인한다.
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

describe('restoreSnapshot — HIST·PATCH', () => {
  it('HIST-02: 저장 entry의 구조·텍스트·속성·properties를 렌더링하고 전체 DOM 참조를 연결한다', () => {
    const html =
      '<section class="box" data-kind="demo"><p id="title">A<span>B</span></p>' +
      '<input value="hello" checked></section>';
    const entry = createEntry(html);
    const actualRoot = createActualRoot('<p>기존</p>');
    const editor = createEditor('이전 편집기 원문');

    const restored = restoreSnapshot(entry, actualRoot, { editor });

    const section = requireElement<HTMLElement>(actualRoot, 'section');
    expect(section.className).toBe('box');
    expect(section.getAttribute('data-kind')).toBe('demo');

    const paragraph = requireElement<HTMLParagraphElement>(actualRoot, 'p');
    expect(paragraph.id).toBe('title');
    expect(paragraph.textContent).toBe('AB');
    expect(paragraph.firstChild?.nodeValue).toBe('A');
    expect(requireElement<HTMLElement>(paragraph, 'span').textContent).toBe('B');

    const input = requireElement<HTMLInputElement>(actualRoot, 'input');
    expect(input.value).toBe('hello');
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);

    expect(restored.childNodes).toHaveLength(1);
    expect(restored.childNodes[0]?.tagName).toBe('SECTION');
    expectFullyLinked(restored, actualRoot);

    // 옵션의 기본값은 restoreEditor: true다.
    expect(editor.value).toBe(html);
  });

  it('HIST-02: 복원은 entry 원본을 수정하지 않고 별도의 VDOM을 반환한다', () => {
    const html = '<div class="box"><p>A</p><input value="A" checked></div>';
    const entry = createEntry(html);
    const originalEntry = structuredClone(entry);
    const actualRoot = createActualRoot();
    const editor = createEditor();

    const restored = restoreSnapshot(entry, actualRoot, { editor });

    expect(entry).toEqual(originalEntry);
    expect(entry.html).toBe(html);
    expectAllUnlinked(entry.vdom);

    expect(restored).not.toBe(entry.vdom);
    expect(restored.dom).toBe(actualRoot);
    expect(restored.childNodes[0]).not.toBe(entry.vdom.childNodes[0]);
    expect(restored.childNodes[0]?.attributes).not.toBe(entry.vdom.childNodes[0]?.attributes);
    expect(restored.childNodes[0]?.childNodes[1]).not.toBe(
      entry.vdom.childNodes[0]?.childNodes[1]
    );
    expect(restored.childNodes[0]?.childNodes[1]?.properties).not.toBe(
      entry.vdom.childNodes[0]?.childNodes[1]?.properties
    );

    const restoredText = restored.childNodes[0]?.childNodes[0]?.childNodes[0];
    const entryText = entry.vdom.childNodes[0]?.childNodes[0]?.childNodes[0];
    expect(restoredText).not.toBe(entryText);
    expect(entryText?.nodeValue).toBe('A');
  });

  it('restoreEditor: false이면 실제 영역만 복원하고 편집기 원문은 유지한다', () => {
    const entry = createEntry('<div><p>복원될 내용</p></div>');
    const actualRoot = createActualRoot('<p>기존</p>');
    const editor = createEditor('편집기 원문\n  그대로');

    const restored = restoreSnapshot(entry, actualRoot, {
      editor,
      restoreEditor: false
    });

    expect(actualRoot.textContent).toBe('복원될 내용');
    expect(editor.value).toBe('편집기 원문\n  그대로');
    expectFullyLinked(restored, actualRoot);
  });

  it('restoreEditor: false이면 editor가 없어도 실제 영역을 복원한다', () => {
    const entry = createEntry('<p>editor 없이 복원</p>');
    const actualRoot = createActualRoot('<p>기존</p>');

    const restored = restoreSnapshot(entry, actualRoot, { restoreEditor: false });

    expect(actualRoot.textContent).toBe('editor 없이 복원');
    expectFullyLinked(restored, actualRoot);
  });

  it('editor 누락 오류는 실제 영역을 렌더링하기 전에 발생한다', () => {
    const entry = createEntry('<p>새 내용</p>');
    const actualRoot = createActualRoot('<p>기존</p>');
    const existingParagraph = actualRoot.firstChild;

    expect(() => restoreSnapshot(entry, actualRoot)).toThrow();
    expect(() => restoreSnapshot(entry, actualRoot, { restoreEditor: true })).toThrow();

    expect(actualRoot.innerHTML).toBe('<p>기존</p>');
    expect(actualRoot.firstChild).toBe(existingParagraph);
    expectAllUnlinked(entry.vdom);
  });

  it('빈 VDOM을 복원하면 실제 영역의 자식을 모두 제거하고 루트를 연결한다', () => {
    const entry = createEntry('');
    const actualRoot = createActualRoot('<p>기존</p><span>형제</span>');
    const editor = createEditor('남아 있는 원문');

    const restored = restoreSnapshot(entry, actualRoot, { editor });

    expect(actualRoot.childNodes).toHaveLength(0);
    expect(actualRoot.innerHTML).toBe('');
    expect(restored.childNodes).toEqual([]);
    expect(restored.dom).toBe(actualRoot);
    expect(editor.value).toBe('');
  });

  it('PATCH-06: 단일·다중 SELECT의 선택 상태를 자식 OPTION 렌더링 후 복원한다', () => {
    const singleEntry = createEntry(
      '<select><option value="a">A</option><option value="b" selected>B</option></select>'
    );
    const singleRoot = createActualRoot();
    const singleEditor = createEditor();
    const singleRestored = restoreSnapshot(singleEntry, singleRoot, { editor: singleEditor });

    const singleSelect = requireElement<HTMLSelectElement>(singleRoot, 'select');
    expect(singleSelect.value).toBe('b');
    expect(singleSelect.options).toHaveLength(2);
    expect(singleSelect.options[0]?.selected).toBe(false);
    expect(singleSelect.options[1]?.selected).toBe(true);
    expectFullyLinked(singleRestored, singleRoot);

    const multiEntry = createEntry(
      '<select multiple><option value="a" selected>A</option>' +
        '<option value="b" selected>B</option></select>'
    );
    const multiRoot = createActualRoot();
    const multiEditor = createEditor();
    const multiRestored = restoreSnapshot(multiEntry, multiRoot, { editor: multiEditor });

    const multiSelect = requireElement<HTMLSelectElement>(multiRoot, 'select');
    expect(multiSelect.multiple).toBe(true);
    expect(multiSelect.options[0]?.selected).toBe(true);
    expect(multiSelect.options[1]?.selected).toBe(true);
    expectFullyLinked(multiRestored, multiRoot);
  });

  it('HIST-05: 복원 후 후속 Diff·Patch가 복원된 실제 노드를 수정한다', () => {
    const entry = createEntry('<div><p key="p1">처음</p></div>');
    const actualRoot = createActualRoot('<p>기존</p>');
    const editor = createEditor();

    const restored = restoreSnapshot(entry, actualRoot, { editor });
    const restoredParagraph = requireElement<HTMLParagraphElement>(actualRoot, 'p');

    const next = createSnapshot(parseHTML('<div><p key="p1">다시</p></div>'));
    const changes = diff(restored, next);
    const completed = applyPatch(restored, next, changes);

    expect(requireElement<HTMLParagraphElement>(actualRoot, 'p')).toBe(restoredParagraph);
    expect(actualRoot.textContent).toBe('다시');
    expectFullyLinked(completed, actualRoot);
    expectAllUnlinked(entry.vdom);
  });
});
