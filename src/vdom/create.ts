import type { VNode, VNodeAttribute, VNodeProperties, VRoot } from './types';

const propertySchema: Readonly<Record<string, readonly string[]>> = {
  INPUT: ['value', 'checked', 'indeterminate'],
  TEXTAREA: ['value'],
  SELECT: ['value'],
  OPTION: ['selected']
};

export function parseHTML(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

export function createSnapshot(parsedRoot: ParentNode): VRoot {
  return { childNodes: snapshotChildren(parsedRoot), dom: null };
}

function snapshotChildren(root: ParentNode): VNode[] {
  const children: VNode[] = [];
  for (const child of root.childNodes) {
    const snapshot = snapshotNode(child);
    if (snapshot !== null) children.push(snapshot);
  }
  return children;
}

export function snapshotNode(node: Node): VNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      nodeType: 3,
      tagName: null,
      attributes: [],
      nodeValue: node.nodeValue,
      childNodes: [],
      properties: {},
      dom: null
    };
  }
  // 지원하는 요소·텍스트 외의 노드(주석 포함)는 VDOM에 넣지 않는다.
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  return {
    nodeType: 1,
    tagName: element.tagName.toUpperCase(),
    attributes: readAttributes(element),
    nodeValue: null,
    childNodes: snapshotChildren(element),
    properties: readProperties(element),
    dom: null
  };
}

export function readAttributes(element: Element): VNodeAttribute[] {
  return Array.from(element.attributes, ({ name, value }) => ({ name, value }));
}

export function readProperties(element: Element): VNodeProperties {
  const properties: VNodeProperties = {};
  for (const name of propertySchema[element.tagName.toUpperCase()] ?? []) {
    properties[name] = Reflect.get(element, name);
  }
  return properties;
}

/**
 * 실제 영역 컨테이너에 대응하는 빈 논리적 루트를 만든다.
 * 초기화 시 비교 기준으로 사용하며, 루트의 dom은 실제 컨테이너를 가리킨다.
 */
export function createEmptyVDOM(actualRoot: Element): VRoot {
  return {
    childNodes: [],
    dom: actualRoot
  };
}
