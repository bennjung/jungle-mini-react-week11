/**
 * Phase 2 공개 경계.
 * 아직 구현 전이다. 테스트가 이 경계를 통해 실패하는지 확인하는 단계다.
 */
import type { VNode } from '../vdom/types';

export function h(
  _tagName: string,
  _props?: Record<string, unknown> | null,
  ..._children: unknown[]
): VNode {
  throw new Error('h() is not implemented');
}

export function startApp(_component: () => unknown, _container: Element): void {
  throw new Error('startApp() is not implemented');
}

export function useState<T>(
  _initialValue: T
): [T, (next: T | ((prev: T) => T)) => void] {
  throw new Error('useState() is not implemented');
}

export function useMemo<T>(_calculate: () => T, _deps: unknown[]): T {
  throw new Error('useMemo() is not implemented');
}

export function useEffect(
  _effect: () => void | (() => void),
  _deps?: unknown[]
): void {
  throw new Error('useEffect() is not implemented');
}
