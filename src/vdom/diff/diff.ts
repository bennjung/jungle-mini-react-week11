import type { DiffCommand, VRoot } from '../types';
import { collectChildChanges } from './collectChildChanges';
import { orderChanges } from './orderChanges';

/**
 * 입력: 이전·다음 VDOM 전체.
 * 출력: Patch가 순서대로 실행할 수 있는 변경 명령 배열.
 * 책임: 루트 DOM을 연결하고 자식 비교를 시작한 뒤 최종 명령 순서를 정리한다.
 * 일부 하위 함수는 여전히 미구현 오류를 던진다.
 */
export function diff(prevRoot: VRoot, nextRoot: VRoot): DiffCommand[] {
  nextRoot.dom = prevRoot.dom;
  const changes = collectChildChanges(prevRoot, nextRoot);
  return orderChanges(changes);
}
