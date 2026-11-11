import { h } from '../../../src/component';
import type { VNode } from '../../../src/vdom/types';

/**
 * 컴파일 전용 타입 계약. 이 함수는 실행하지 않는다.
 * 런타임 호출로 위험한 입력을 만들지 않으면서 `@ts-expect-error`로 필수 props
 * 누락·타입 불일치·여분 인자가 컴파일 오류임을 고정한다.
 * 파일명이 `*.test.ts`가 아니므로 vitest 실행 대상이 아니고, tsconfig의
 * `tests` include를 통해 `npm run typecheck`에서만 검사된다.
 */
export function assertHTypeContract(): void {
  const callback = (): void => {};

  function RequiredChild(props: {
    count: number;
    onIncrease: () => void;
  }): unknown {
    void props;
    return null;
  }

  // 문자열 분기는 기존대로 요소 VNode 하나를 반환한다.
  const elementNode: VNode = h('div', {}, 'A');
  void elementNode;

  // 함수 분기는 정상 props에서 VNode[]를 반환한다.
  const childNodes: VNode[] = h(RequiredChild, {
    count: 1,
    onIncrease: callback
  });
  void childNodes;

  // @ts-expect-error 필수 props를 생략할 수 없다
  h(RequiredChild);

  // @ts-expect-error null은 필수 props 타입을 만족하지 않는다
  h(RequiredChild, null);

  // @ts-expect-error undefined도 필수 props를 생략한 것이므로 허용하지 않는다
  h(RequiredChild, undefined);

  // @ts-expect-error 빈 객체는 필수 props를 채우지 않는다
  h(RequiredChild, {});

  // @ts-expect-error count의 타입이 number가 아니다
  h(RequiredChild, { count: '0', onIncrease: callback });

  // @ts-expect-error 필수 callback이 빠졌다
  h(RequiredChild, { count: 1 });

  // @ts-expect-error 함수 분기는 props 뒤에 자식 인자를 받지 않는다
  h(RequiredChild, { count: 1, onIncrease: callback }, 'extra');
}
