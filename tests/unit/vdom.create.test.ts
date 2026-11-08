import { describe, expect, it } from 'vitest';
import { cloneSnapshotData, createEmptyVDOM } from '../../src/vdom/create';
import type { VNode, VRoot } from '../../src/vdom/types';

function expectAllUnlinked(node: VRoot | VNode): void {
  expect(node.dom).toBeNull();
  node.childNodes.forEach(expectAllUnlinked);
}

describe('createEmptyVDOM', () => {
  it('실제 영역 컨테이너를 초기 루트 dom으로 연결한다', () => {
    const actualRoot = document.createElement('div');

    const root = createEmptyVDOM(actualRoot);

    expect(root.childNodes).toEqual([]);
    expect(root.dom).toBe(actualRoot);
  });
});

describe('cloneSnapshotData', () => {
  it('속성·프로퍼티·자식 데이터를 재귀 복사하고 모든 dom을 null로 둔다', () => {
    const actualRoot = document.createElement('div');
    actualRoot.innerHTML = '<div class="box">A<input value="B"></div>';
    document.body.append(actualRoot);
    const actualDiv = actualRoot.firstElementChild;
    const actualText = actualDiv?.firstChild ?? null;
    const actualInput = actualRoot.querySelector('input');
    if (!actualDiv || !actualText || !actualInput) {
      throw new Error('복사 테스트 픽스처를 만들 수 없습니다.');
    }

    const source: VRoot = {
      dom: actualRoot,
      childNodes: [{
        nodeType: 1,
        tagName: 'DIV',
        attributes: [{ name: 'class', value: 'box' }],
        nodeValue: null,
        properties: {},
        dom: actualDiv,
        childNodes: [
          {
            nodeType: 3,
            tagName: null,
            attributes: [],
            nodeValue: 'A',
            childNodes: [],
            properties: {},
            dom: actualText
          },
          {
            nodeType: 1,
            tagName: 'INPUT',
            attributes: [{ name: 'value', value: 'B' }],
            nodeValue: null,
            childNodes: [],
            properties: { value: 'B', checked: false, indeterminate: false },
            dom: actualInput
          }
        ]
      }]
    };

    const clone = cloneSnapshotData(source);

    expect(clone).not.toBe(source);
    expectAllUnlinked(clone);
    expect(clone).toEqual({
      dom: null,
      childNodes: [{
        nodeType: 1,
        tagName: 'DIV',
        attributes: [{ name: 'class', value: 'box' }],
        nodeValue: null,
        properties: {},
        dom: null,
        childNodes: [
          {
            nodeType: 3,
            tagName: null,
            attributes: [],
            nodeValue: 'A',
            childNodes: [],
            properties: {},
            dom: null
          },
          {
            nodeType: 1,
            tagName: 'INPUT',
            attributes: [{ name: 'value', value: 'B' }],
            nodeValue: null,
            childNodes: [],
            properties: { value: 'B', checked: false, indeterminate: false },
            dom: null
          }
        ]
      }]
    });

    const sourceDiv = source.childNodes[0];
    const cloneDiv = clone.childNodes[0];
    if (!sourceDiv || !cloneDiv) throw new Error('복사된 DIV 노드가 없습니다.');

    expect(cloneDiv).not.toBe(sourceDiv);
    expect(cloneDiv.attributes).not.toBe(sourceDiv.attributes);
    expect(cloneDiv.attributes[0]).not.toBe(sourceDiv.attributes[0]);
    expect(cloneDiv.childNodes[0]).not.toBe(sourceDiv.childNodes[0]);
    expect(cloneDiv.childNodes[1]?.properties).not.toBe(sourceDiv.childNodes[1]?.properties);

    // 입력 VDOM은 dom 연결과 데이터를 그대로 유지한다.
    expect(source.dom).toBe(actualRoot);
    expect(sourceDiv.dom).toBe(actualDiv);
    expect(sourceDiv.childNodes[0]?.dom).toBe(actualText);
    expect(sourceDiv.childNodes[1]?.dom).toBe(actualInput);
    expect(sourceDiv.attributes).toEqual([{ name: 'class', value: 'box' }]);
    expect(sourceDiv.childNodes[0]?.nodeValue).toBe('A');
    expect(sourceDiv.childNodes[1]?.properties).toEqual({
      value: 'B',
      checked: false,
      indeterminate: false
    });
  });

  it('복사본과 원본의 속성·프로퍼티·텍스트를 서로 독립적으로 수정할 수 있다', () => {
    const source: VRoot = {
      dom: null,
      childNodes: [{
        nodeType: 1,
        tagName: 'INPUT',
        attributes: [{ name: 'value', value: 'A' }],
        nodeValue: null,
        childNodes: [{
          nodeType: 3,
          tagName: null,
          attributes: [],
          nodeValue: '텍스트',
          childNodes: [],
          properties: {},
          dom: null
        }],
        properties: { value: 'A', checked: false, indeterminate: false },
        dom: null
      }]
    };

    const clone = cloneSnapshotData(source);
    const sourceNode = source.childNodes[0];
    const cloneNode = clone.childNodes[0];
    if (!sourceNode || !cloneNode) throw new Error('복사된 노드가 없습니다.');
    const cloneText = cloneNode.childNodes[0];
    const cloneAttribute = cloneNode.attributes[0];
    if (!cloneText || !cloneAttribute) throw new Error('복사된 자식 데이터가 없습니다.');

    cloneAttribute.value = '복사본';
    cloneNode.properties.value = '복사본';
    cloneText.nodeValue = '복사본 텍스트';

    expect(sourceNode.attributes).toEqual([{ name: 'value', value: 'A' }]);
    expect(sourceNode.properties).toEqual({ value: 'A', checked: false, indeterminate: false });
    expect(sourceNode.childNodes[0]?.nodeValue).toBe('텍스트');

    const sourceAttribute = sourceNode.attributes[0];
    const sourceText = sourceNode.childNodes[0];
    if (!sourceAttribute || !sourceText) throw new Error('원본 자식 데이터가 없습니다.');
    sourceAttribute.value = '원본';
    sourceNode.properties.value = '원본';
    sourceText.nodeValue = '원본 텍스트';

    expect(cloneNode.attributes).toEqual([{ name: 'value', value: '복사본' }]);
    expect(cloneNode.properties).toEqual({
      value: '복사본',
      checked: false,
      indeterminate: false
    });
    expect(cloneText.nodeValue).toBe('복사본 텍스트');
  });
});
