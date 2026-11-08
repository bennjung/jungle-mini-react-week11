import { afterEach, describe, expect, it } from 'vitest';
import { linkMatchedDom } from '../../src/vdom/link';
import {
  applyPatch,
  assertAllLinked,
  renderChildren
} from '../../src/vdom/patch';
import type { DiffCommand, VRoot } from '../../src/vdom/types';
import { collectNodes, element, root, text } from '../helpers/vdom';

// 실제 흐름에서는 diff가 유지 노드의 dom을 연결한 뒤 applyPatch()를 호출한다.
function applyAfterDiff(
  prev: VRoot,
  next: VRoot,
  changes: DiffCommand[]
): VRoot {
  linkMatchedDom(prev, next);
  return applyPatch(prev, next, changes);
}

function setup(prev: VRoot): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderChildren(prev, container);
  return container;
}

function childKeys(container: Element): Array<string | null> {
  return Array.from(container.children).map((child) => child.getAttribute('key'));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('PATCH-01 update text', () => {
  it('기존 요소·텍스트 객체를 유지하며 값만 바꾼다', () => {
    const prevText = text('A');
    const prevP = element('p', { key: 'p1', children: [prevText] });
    const prev = root([prevP]);
    const container = setup(prev);
    const pDom = prevP.dom;
    const textDom = prevText.dom;

    const nextText = text('B');
    const nextP = element('p', { key: 'p1', children: [nextText] });
    const next = root([nextP]);

    const changes: DiffCommand[] = [
      { type: 'update', target: prevText, data: { nodeValue: 'B' } }
    ];

    const result = applyAfterDiff(prev, next, changes);

    expect(result).toBe(next);
    expect(nextP.dom).toBe(pDom);
    expect(nextText.dom).toBe(textDom);
    expect(container.textContent).toBe('B');
  });
});

describe('PATCH-02 update attributes and properties', () => {
  it('기존 input 객체를 유지하며 속성과 프로퍼티를 갱신한다', () => {
    const prevInput = element('input', {
      key: 'i1',
      attributes: [
        { name: 'class', value: 'a' },
        { name: 'title', value: '설명' }
      ],
      properties: { value: 'A', checked: true, indeterminate: true }
    });
    const prev = root([prevInput]);
    setup(prev);
    const input = prevInput.dom as HTMLInputElement;

    const nextInput = element('input', {
      key: 'i1',
      attributes: [
        { name: 'class', value: 'b' },
        { name: 'data-extra', value: 'x' }
      ],
      properties: { value: '', checked: false, indeterminate: false }
    });
    const next = root([nextInput]);

    const changes: DiffCommand[] = [
      {
        type: 'update',
        target: prevInput,
        data: {
          setAttributes: [
            { name: 'class', value: 'b' },
            { name: 'data-extra', value: 'x' }
          ],
          removeAttributes: ['title'],
          setProperties: { value: '', checked: false, indeterminate: false }
        }
      }
    ];

    applyAfterDiff(prev, next, changes);

    expect(nextInput.dom).toBe(input);
    expect(input.getAttribute('class')).toBe('b');
    expect(input.getAttribute('data-extra')).toBe('x');
    expect(input.hasAttribute('title')).toBe(false);
    expect(input.value).toBe('');
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(false);
  });

  it('removeProperties로 직접 추가한 프로퍼티를 제거한다', () => {
    const prevInput = element('input', {
      key: 'i1',
      properties: { value: 'A', customFlag: 'x' }
    });
    const prev = root([prevInput]);
    setup(prev);
    const input = prevInput.dom as HTMLInputElement & { customFlag?: string };
    expect(input.customFlag).toBe('x');

    const nextInput = element('input', {
      key: 'i1',
      properties: { value: 'B' }
    });
    const next = root([nextInput]);

    applyAfterDiff(prev, next, [
      {
        type: 'update',
        target: prevInput,
        data: {
          setProperties: { value: 'B' },
          removeProperties: ['customFlag']
        }
      }
    ]);

    expect(nextInput.dom).toBe(input);
    expect(input.value).toBe('B');
    expect(input.customFlag).toBeUndefined();
  });
});

describe('PATCH-03 insert and remove', () => {
  it('A 앞에 X를 삽입한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);

    const x = element('span', { key: 'x', children: [text('X')] });
    const next = root([x, a, b, c]);

    applyAfterDiff(prev, next, [
      { type: 'insert', node: x, parent: next, before: a }
    ]);

    expect(childKeys(container)).toEqual(['x', 'a', 'b', 'c']);
    expect(x.dom).toBe(container.firstElementChild);
  });

  it('B 앞에 X를 삽입한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);

    const x = element('span', { key: 'x', children: [text('X')] });
    const next = root([a, x, b, c]);

    applyAfterDiff(prev, next, [
      { type: 'insert', node: x, parent: next, before: b }
    ]);

    expect(childKeys(container)).toEqual(['a', 'x', 'b', 'c']);
    expect(x.dom).toBe(container.children[1]);
  });

  it('맨 뒤에 X를 삽입한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);

    const x = element('span', { key: 'x', children: [text('X')] });
    const next = root([a, b, c, x]);

    applyAfterDiff(prev, next, [
      { type: 'insert', node: x, parent: next, before: null }
    ]);

    expect(childKeys(container)).toEqual(['a', 'b', 'c', 'x']);
    expect(x.dom).toBe(container.lastElementChild);
  });

  it('A를 제거한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);
    const aDom = a.dom;

    const next = root([b, c]);
    applyAfterDiff(prev, next, [{ type: 'remove', target: a }]);

    expect(childKeys(container)).toEqual(['b', 'c']);
    expect(aDom?.parentNode).toBeNull();
  });

  it('B를 제거한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);

    const next = root([a, c]);
    applyAfterDiff(prev, next, [{ type: 'remove', target: b }]);

    expect(childKeys(container)).toEqual(['a', 'c']);
  });

  it('C를 제거한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);

    const next = root([a, b]);
    applyAfterDiff(prev, next, [{ type: 'remove', target: c }]);

    expect(childKeys(container)).toEqual(['a', 'b']);
  });
});

describe('PATCH-04 replace', () => {
  it('지정한 노드만 교체하고 형제는 유지한다', () => {
    const previousDiv = element('div', { key: 'n1', children: [text('A')] });
    const span = element('span', { key: 's1', children: [text('유지')] });
    const prev = root([previousDiv, span]);
    const container = setup(prev);
    const spanDom = span.dom;

    const replacement = element('p', { key: 'n1', children: [text('B')] });
    const next = root([replacement, span]);

    applyAfterDiff(prev, next, [
      { type: 'replace', target: previousDiv, node: replacement }
    ]);

    expect(container.firstElementChild).toBe(replacement.dom);
    expect(container.firstElementChild?.tagName).toBe('P');
    expect(span.dom).toBe(spanDom);
    expect(previousDiv.dom?.parentNode).toBeNull();
  });
});

describe('PATCH-05 move', () => {
  it('C를 A 앞으로 이동하고 객체 동일성을 유지한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);
    const aDom = a.dom;
    const bDom = b.dom;
    const cDom = c.dom;

    const next = root([c, a, b]);
    applyAfterDiff(prev, next, [
      { type: 'move', target: c, parent: next, before: a }
    ]);

    expect(childKeys(container)).toEqual(['c', 'a', 'b']);
    expect(c.dom).toBe(cDom);
    expect(a.dom).toBe(aDom);
    expect(b.dom).toBe(bDom);
  });

  it('A를 맨 뒤로 이동한다', () => {
    const a = element('span', { key: 'a', children: [text('A')] });
    const b = element('span', { key: 'b', children: [text('B')] });
    const c = element('span', { key: 'c', children: [text('C')] });
    const prev = root([a, b, c]);
    const container = setup(prev);

    const next = root([b, c, a]);
    applyAfterDiff(prev, next, [
      { type: 'move', target: a, parent: next, before: null }
    ]);

    expect(childKeys(container)).toEqual(['b', 'c', 'a']);
  });
});

describe('PATCH-06 select rendering', () => {
  it('OPTION 생성 후 단일 선택 값을 적용한다', () => {
    const optionA = element('option', {
      key: 'a',
      attributes: [{ name: 'value', value: 'a' }],
      properties: { selected: false },
      children: [text('A')]
    });
    const optionB = element('option', {
      key: 'b',
      attributes: [{ name: 'value', value: 'b' }],
      properties: { selected: true },
      children: [text('B')]
    });
    const select = element('select', {
      key: 's',
      properties: { value: 'b' },
      children: [optionA, optionB]
    });

    const prev = root([select]);
    setup(prev);

    const selectDom = select.dom as HTMLSelectElement;
    expect(selectDom.value).toBe('b');
    expect(selectDom.options[1]?.selected).toBe(true);
  });

  it('다중 선택은 OPTION.selected를 기준으로 유지한다', () => {
    const optionA = element('option', {
      key: 'a',
      attributes: [{ name: 'value', value: 'a' }],
      properties: { selected: true },
      children: [text('A')]
    });
    const optionB = element('option', {
      key: 'b',
      attributes: [{ name: 'value', value: 'b' }],
      properties: { selected: true },
      children: [text('B')]
    });
    const select = element('select', {
      key: 's',
      attributes: [{ name: 'multiple', value: '' }],
      properties: { value: 'a' },
      children: [optionA, optionB]
    });

    const prev = root([select]);
    setup(prev);

    const selectDom = select.dom as HTMLSelectElement;
    expect(selectDom.multiple).toBe(true);
    expect(selectDom.options[0]?.selected).toBe(true);
    expect(selectDom.options[1]?.selected).toBe(true);
  });
});

describe('PATCH-07 mixed changes', () => {
  it('삽입·삭제·이동·수정·교체를 함께 적용한다', () => {
    const aText = text('A');
    const a = element('li', { key: 'a', children: [aText] });
    const b = element('li', { key: 'b', children: [text('B')] });
    const c = element('li', { key: 'c', children: [text('C')] });
    const d = element('li', { key: 'd', children: [text('D')] });
    const prev = root([a, b, c, d]);
    const container = setup(prev);
    const aDom = a.dom;
    const cDom = c.dom;

    const nextA = element('li', { key: 'a', children: [text('A2')] });
    const nextC = c;
    const nextX = element('li', { key: 'x', children: [text('X')] });
    const nextD = element('em', { key: 'd', children: [text('D2')] });
    const next = root([nextC, nextX, nextA, nextD]);

    const changes: DiffCommand[] = [
      { type: 'remove', target: b },
      { type: 'insert', node: nextX, parent: next, before: nextA },
      { type: 'move', target: c, parent: next, before: nextX },
      { type: 'update', target: aText, data: { nodeValue: 'A2' } },
      { type: 'replace', target: d, node: nextD }
    ];

    applyAfterDiff(prev, next, changes);

    expect(childKeys(container)).toEqual(['c', 'x', 'a', 'd']);
    expect(nextC.dom).toBe(cDom);
    expect(nextA.dom).toBe(aDom);
    expect(container.children[2]?.textContent).toBe('A2');
    expect(container.children[3]?.tagName).toBe('EM');
    expect(nextX.dom).toBe(container.children[1]);
    assertAllLinked(next, container);
  });
});

describe('PATCH-08 full link', () => {
  it('변경 없는 노드까지 다음 VDOM 전체의 dom 참조를 완성한다', () => {
    const prevPText = text('A');
    const prevP = element('p', { key: 'p1', children: [prevPText] });
    const prevSpanText = text('유지');
    const prevSpan = element('span', { key: 'sp1', children: [prevSpanText] });
    const prevDiv = element('div', { key: 'd1', children: [prevP, prevSpan] });
    const prev = root([prevDiv]);
    const container = setup(prev);
    const divDom = prevDiv.dom;
    const pDom = prevP.dom;
    const pTextDom = prevPText.dom;
    const spanDom = prevSpan.dom;

    const nextPText = text('B');
    const nextP = element('p', { key: 'p1', children: [nextPText] });
    const nextSpan = element('span', { key: 'sp1', children: [text('유지')] });
    const nextEm = element('em', { key: 'e1', children: [text('추가')] });
    const nextDiv = element('div', {
      key: 'd1',
      children: [nextP, nextSpan, nextEm]
    });
    const next = root([nextDiv]);

    const changes: DiffCommand[] = [
      { type: 'update', target: prevPText, data: { nodeValue: 'B' } },
      { type: 'insert', node: nextEm, parent: nextDiv, before: null }
    ];

    applyAfterDiff(prev, next, changes);

    expect(nextDiv.dom).toBe(divDom);
    expect(nextP.dom).toBe(pDom);
    expect(nextPText.dom).toBe(pTextDom);
    expect(nextSpan.dom).toBe(spanDom);
    expect(nextEm.dom).toBe(container.querySelector('em'));
    expect(collectNodes(next).every((node) => node.dom !== null)).toBe(true);
    assertAllLinked(next, container);
  });
});

describe('root insertion', () => {
  it('VRoot를 parent로 사용해 루트 자식을 삽입한다', () => {
    const prev = root([]);
    const container = setup(prev);

    const section = element('section', {
      key: 's1',
      children: [element('p', { key: 'p1', children: [text('A')] })]
    });
    const next = root([section]);

    applyAfterDiff(prev, next, [
      { type: 'insert', node: section, parent: next, before: null }
    ]);

    expect(container.firstElementChild).toBe(section.dom);
    expect(section.dom).not.toBeNull();
    assertAllLinked(next, container);
  });
});

describe('linkMatchedDom', () => {
  it('유지 노드는 연결하고 새 노드는 null로 둔다', () => {
    const prevText = text('A');
    const prevP = element('p', { key: 'p1', children: [prevText] });
    const prevSpan = element('span', { key: 's1', children: [text('유지')] });
    const prev = root([prevP, prevSpan]);
    const container = setup(prev);

    const nextP = element('p', { key: 'p1', children: [text('B')] });
    const nextSpan = element('span', { key: 's1', children: [text('유지')] });
    const nextEm = element('em', { key: 'e1', children: [text('추가')] });
    const next = root([nextP, nextSpan, nextEm]);

    linkMatchedDom(prev, next);

    expect(next.dom).toBe(container);
    expect(nextP.dom).toBe(prevP.dom);
    expect(nextP.childNodes[0]?.dom).toBe(prevText.dom);
    expect(nextSpan.dom).toBe(prevSpan.dom);
    expect(nextEm.dom).toBeNull();
  });

  it('같은 key라도 태그가 다르면 연결하지 않는다', () => {
    const prevDiv = element('div', { key: 'n1', children: [text('A')] });
    const prev = root([prevDiv]);
    setup(prev);

    const nextP = element('p', { key: 'n1', children: [text('A')] });
    const next = root([nextP]);

    linkMatchedDom(prev, next);

    expect(nextP.dom).toBeNull();
    expect(nextP.childNodes[0]?.dom).toBeNull();
  });
});

describe('key rendering', () => {
  it('key attribute를 실제 DOM에도 렌더링한다', () => {
    const item = element('li', { key: 'a', children: [text('A')] });
    const prev = root([item]);
    const container = setup(prev);

    expect(item.dom).toBe(container.querySelector('[key="a"]'));
    expect((item.dom as Element).getAttribute('key')).toBe('a');
  });
});

describe('link assertion', () => {
  it('연결되지 않은 다음 VDOM을 감지한다', () => {
    const prevP = element('p', { key: 'p1', children: [text('A')] });
    const prev = root([prevP]);
    const container = setup(prev);

    const nextP = element('p', { key: 'p1', children: [text('B')] });
    const next = root([nextP]);

    expect(() => assertAllLinked(next, container)).toThrow();
  });
});
