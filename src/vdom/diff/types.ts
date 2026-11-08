import type { VNode, VNodeAttribute, VRoot } from '../types';

/** 자식 목록을 비교할 부모. */
export type Parent = VRoot | VNode;

/** 비교할 짝, 새 자식, 사라진 자식. 변경 명령이 아닌 대응 결과다. */
export type ChildMatch =
  | { kind: 'matched'; prev: VNode; next: VNode }
  | { kind: 'inserted'; next: VNode }
  | { kind: 'removed'; prev: VNode };

export type AttributeUpdate = {
  setAttributes?: VNodeAttribute[];
  removeAttributes?: string[];
};
