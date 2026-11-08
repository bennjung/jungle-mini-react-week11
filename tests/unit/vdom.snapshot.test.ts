import { afterEach, describe, expect, it } from 'vitest';
import { createSnapshot, parseHTML } from '../../src/vdom/create';
import type { VNode, VRoot } from '../../src/vdom/types';
import { createHTMLContext, expectHistoryUnchanged } from '../helpers/html.context';

function expectAllUnlinked(root: VRoot | VNode): void {
  expect(root.dom).toBeNull();
  root.childNodes.forEach(expectAllUnlinked);
}

describe('스냅샷 — SNAP', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('SNAP-01: 요소·텍스트 데이터와 중첩 자식 순서를 복사한다', () => {
    const context = createHTMLContext();
    const actualParagraph = context.elements.actualRoot.firstChild;
    const parsedRoot = parseHTML('<div class="box">A<span>B</span>C</div>');

    const root = createSnapshot(parsedRoot);

    expect(root).toEqual({
      dom: null,
      childNodes: [{
        nodeType: 1, tagName: 'DIV', attributes: [{ name: 'class', value: 'box' }],
        nodeValue: null, properties: {}, dom: null,
        childNodes: [
          {
            nodeType: 3, tagName: null, attributes: [], nodeValue: 'A',
            childNodes: [], properties: {}, dom: null
          },
          {
            nodeType: 1, tagName: 'SPAN', attributes: [], nodeValue: null,
            properties: {}, dom: null,
            childNodes: [{
              nodeType: 3, tagName: null, attributes: [], nodeValue: 'B',
              childNodes: [], properties: {}, dom: null
            }]
          },
          {
            nodeType: 3, tagName: null, attributes: [], nodeValue: 'C',
            childNodes: [], properties: {}, dom: null
          }
        ]
      }]
    });
    expect(parsedRoot.childNodes).toHaveLength(1);
    expect(parsedRoot.firstChild?.isConnected).toBe(false);
    expect(context.elements.actualRoot.innerHTML).toBe('<p>기존</p>');
    expect(context.elements.actualRoot.firstChild).toBe(actualParagraph);
    expectHistoryUnchanged(context);
  });

  it('SNAP-02: 주석만 제외하고 이웃 텍스트·요소 순서를 유지한다', () => {
    const parsedRoot = parseHTML('<div>A<!-- 메모 --><span>B</span></div>');

    const root = createSnapshot(parsedRoot);

    const children = root.childNodes[0]?.childNodes;
    expect(children).toHaveLength(2);
    expect(children?.[0]).toMatchObject({ nodeType: 3, nodeValue: 'A', childNodes: [] });
    expect(children?.[1]).toMatchObject({
      nodeType: 1, tagName: 'SPAN',
      childNodes: [{ nodeType: 3, nodeValue: 'B', childNodes: [] }]
    });
    expect(parsedRoot.firstChild?.childNodes).toHaveLength(3);
    expectAllUnlinked(root);
  });

  it('SNAP-03: 원본 임시 DOM·편집기를 수정해도 기존 Snapshot 데이터는 유지한다', () => {
    const context = createHTMLContext();
    context.elements.editor.value = '<p class="a">A</p>';
    const parsedRoot = parseHTML('<p class="a">A</p>');
    const paragraph = parsedRoot.querySelector('p');
    if (!paragraph) throw new Error('테스트 입력의 p가 없습니다.');
    const originalText = paragraph.firstChild;
    if (!originalText) throw new Error('테스트 입력의 텍스트가 없습니다.');
    const root = createSnapshot(parsedRoot);

    paragraph.setAttribute('class', 'b');
    originalText.nodeValue = 'B';
    paragraph.append(document.createElement('span'));
    context.elements.editor.value = '<section>변경</section>';

    expect(root).toEqual({
      dom: null,
      childNodes: [{
        nodeType: 1, tagName: 'P', attributes: [{ name: 'class', value: 'a' }],
        nodeValue: null, properties: {}, dom: null,
        childNodes: [{
          nodeType: 3, tagName: null, attributes: [], nodeValue: 'A',
          childNodes: [], properties: {}, dom: null
        }]
      }]
    });
    expectAllUnlinked(root);
    expectHistoryUnchanged(context);
  });

  it('SNAP-04: 일반 속성·data 속성·key를 이름과 값으로 복사한다', () => {
    const context = createHTMLContext();
    const actualParagraph = context.elements.actualRoot.firstChild;
    const parsedRoot = parseHTML('<p id="title" class="a" data-extra="x" title="설명">A</p>');

    const root = createSnapshot(parsedRoot);

    expect(root.childNodes[0]?.attributes).toHaveLength(4);
    expect(root.childNodes[0]?.attributes).toEqual(expect.arrayContaining([
      { name: 'id', value: 'title' },
      { name: 'class', value: 'a' },
      { name: 'data-extra', value: 'x' },
      { name: 'title', value: '설명' }
    ]));
    expect(parsedRoot.firstElementChild?.outerHTML).toBe(
      '<p id="title" class="a" data-extra="x" title="설명">A</p>'
    );
    const keyedInput = parseHTML('<p key="p1">A</p>');
    const keyedRoot = createSnapshot(keyedInput);
    expect(keyedRoot.childNodes[0]?.attributes).toEqual([{ name: 'key', value: 'p1' }]);
    expect(keyedInput.firstElementChild?.getAttribute('key')).toBe('p1');
    expectAllUnlinked(root);
    expectAllUnlinked(keyedRoot);
    expect(context.elements.actualRoot.innerHTML).toBe('<p>기존</p>');
    expect(context.elements.actualRoot.firstChild).toBe(actualParagraph);
    expectHistoryUnchanged(context);
  });

  it('SNAP-05: 다음 VDOM 전체를 dom null로 두고 이전 데이터·실제 DOM 참조는 유지한다', () => {
    const actualRoot = document.createElement('div');
    actualRoot.innerHTML = '<p>A</p>';
    document.body.append(actualRoot);
    const paragraph = actualRoot.firstChild;
    const text = paragraph?.firstChild ?? null;
    const prevRoot: VRoot = {
      dom: actualRoot,
      childNodes: [{
        nodeType: 1, tagName: 'P', attributes: [], nodeValue: null,
        properties: {}, dom: paragraph,
        childNodes: [{
          nodeType: 3, tagName: null, attributes: [], nodeValue: 'A',
          childNodes: [], properties: {}, dom: text
        }]
      }]
    };
    const prevParagraph = prevRoot.childNodes[0];
    const prevText = prevParagraph?.childNodes[0];
    const parsedRoot = parseHTML('<p>B</p><span>C</span>');

    const nextRoot = createSnapshot(parsedRoot);

    expect(nextRoot.childNodes).toHaveLength(2);
    expect(nextRoot.childNodes[0]).toMatchObject({
      nodeType: 1, tagName: 'P', childNodes: [{ nodeType: 3, nodeValue: 'B' }]
    });
    expect(nextRoot.childNodes[1]).toMatchObject({
      nodeType: 1, tagName: 'SPAN', childNodes: [{ nodeType: 3, nodeValue: 'C' }]
    });
    expectAllUnlinked(nextRoot);
    expect(actualRoot.innerHTML).toBe('<p>A</p>');
    expect(actualRoot.firstChild).toBe(paragraph);
    expect(paragraph?.firstChild).toBe(text);
    expect(prevRoot.dom).toBe(actualRoot);
    expect(prevRoot.childNodes[0]).toBe(prevParagraph);
    expect(prevParagraph?.dom).toBe(paragraph);
    expect(prevParagraph?.childNodes[0]).toBe(prevText);
    expect(prevText?.dom).toBe(text);
    expect(prevText?.nodeValue).toBe('A');
    expect(nextRoot.childNodes[0]).not.toBe(prevParagraph);
  });

  it('SNAP-06: HTML의 입력값·체크·선택 상태를 attributes와 별도 properties로 수집한다', () => {
    const liveInput = document.createElement('input');
    liveInput.value = '실제 화면에서 입력한 값';
    document.body.append(liveInput);
    const cases = [
      { html: '<input value="A">', properties: { value: 'A', checked: false, indeterminate: false } },
      { html: '<input type="checkbox" checked>', properties: { value: 'on', checked: true, indeterminate: false } },
      { html: '<textarea>메모</textarea>', properties: { value: '메모' } },
      { html: '<select><option>A</option><option selected>B</option></select>', properties: { value: 'B' } }
    ];

    for (const fixture of cases) {
      const parsedRoot = parseHTML(fixture.html);
      const root = createSnapshot(parsedRoot);
      expect(root.childNodes).toHaveLength(1);
      expect(root.childNodes[0]?.properties).toEqual(fixture.properties);
      expectAllUnlinked(root);
      if (root.childNodes[0]?.tagName === 'SELECT') {
        expect(root.childNodes[0].childNodes.map((option) => option.properties)).toEqual([
          { selected: false }, { selected: true }
        ]);
      }
    }
    const inputRoot = createSnapshot(parseHTML('<input value="A">'));
    expect(inputRoot.childNodes[0]?.attributes).toEqual([{ name: 'value', value: 'A' }]);
    const checkboxRoot = createSnapshot(parseHTML('<input type="checkbox" checked>'));
    expect(checkboxRoot.childNodes[0]?.attributes).toEqual(expect.arrayContaining([
      { name: 'type', value: 'checkbox' }, { name: 'checked', value: '' }
    ]));
    expect(liveInput.value).toBe('실제 화면에서 입력한 값');
    expect(liveInput.isConnected).toBe(true);
  });
});
