export type VNodeAttribute = {
  name: string;
  value: string;
};

export type VNodeProperties = Record<string, unknown>;

export type VNodeType = 1 | 3;

/**
 * 스냅샷·Diff의 요소/텍스트 노드.
 * dom은 Snapshot·Diff 종료까지 null이며 Patch 성공 시 실제 DOM에 연결된다.
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
