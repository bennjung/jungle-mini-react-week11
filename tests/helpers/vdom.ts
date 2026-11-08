import type { VNode, VNodeAttribute, VNodeProperties, VRoot } from '../../src/vdom/types';

interface ElementOptions {
  key?: string;
  attributes?: VNodeAttribute[];
  properties?: VNodeProperties;
  children?: VNode[];
}

export function text(value: string): VNode {
  return {
    nodeType: 3,
    tagName: null,
    attributes: [],
    nodeValue: value,
    childNodes: [],
    properties: {},
    dom: null
  };
}

export function element(tagName: string, options: ElementOptions = {}): VNode {
  const attributes = [...(options.attributes ?? [])];

  if (options.key !== undefined) {
    attributes.unshift({ name: 'key', value: options.key });
  }

  return {
    nodeType: 1,
    tagName,
    attributes,
    nodeValue: null,
    childNodes: options.children ?? [],
    properties: options.properties ?? {},
    dom: null
  };
}

export function root(childNodes: VNode[] = [], dom: Element | null = null): VRoot {
  return { childNodes, dom };
}

export function collectNodes(rootNode: VRoot): VNode[] {
  const nodes: VNode[] = [];

  const visit = (node: VNode): void => {
    nodes.push(node);
    for (const child of node.childNodes) visit(child);
  };

  for (const child of rootNode.childNodes) visit(child);
  return nodes;
}
