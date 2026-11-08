export type VNodeAttribute = {
  name: string;
  value: string;
};

export type VNodeProperties = Record<string, unknown>;

export type VNodeType = 1 | 3;

/**
 * 스냅샷·Diff의 요소/텍스트 노드.
 * dom은 Snapshot 종료 시 null이다. Diff가 유지 노드를 연결하고,
 * Patch가 삽입·교체 노드와 그 하위 트리를 생성·연결한다.
 */
export interface VNode {
  nodeType: VNodeType;
  tagName: string | null;
  attributes: VNodeAttribute[];
  nodeValue: string | null;
  childNodes: VNode[];
  properties: VNodeProperties;
  dom: Node | null;
}

/**
 * 실제 영역 컨테이너에 대응하는 논리적 루트.
 * 컨테이너 자체의 태그·속성은 Diff 대상이 아니다.
 */
export interface VRoot {
  childNodes: VNode[];
  dom: Element | null;
}

export type UpdateData = {
  nodeValue?: string;
  setAttributes?: VNodeAttribute[];
  removeAttributes?: string[];
  setProperties?: VNodeProperties;
  removeProperties?: string[];
};

export type DiffCommand =
  | { type: 'replace'; target: VNode; node: VNode }
  | { type: 'update'; target: VNode; data: UpdateData }
  | { type: 'insert'; node: VNode; parent: VNode | VRoot; before: VNode | null }
  | { type: 'remove'; target: VNode }
  | { type: 'move'; target: VNode; parent: VNode | VRoot; before: VNode | null };
