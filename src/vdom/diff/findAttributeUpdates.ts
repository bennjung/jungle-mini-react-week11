import type { VNodeAttribute } from '../types';
import type { AttributeUpdate } from './types';

/**
 * 입력: 이전·다음 HTML 속성 목록.
 * 출력: 추가·변경할 속성과 제거할 속성 이름. 작업이 없는 항목은 생략한다.
 * 책임: 속성 이름·값을 비교한다. 속성 나열 순서는 차이로 보지 않는다.
 */
export function findAttributeUpdates(
  prevAttributes: VNodeAttribute[],
  nextAttributes: VNodeAttribute[]
): AttributeUpdate {
  const prevByName = new Map(prevAttributes.map(({ name, value }) => [name, value]));
  const nextByName = new Map(nextAttributes.map(({ name, value }) => [name, value]));
  const setAttributes = nextAttributes.filter(({ name, value }) =>
    !prevByName.has(name) || prevByName.get(name) !== value
  );
  const removeAttributes = prevAttributes
    .filter(({ name }) => !nextByName.has(name))
    .map(({ name }) => name);

  return {
    ...(setAttributes.length > 0 && { setAttributes }),
    ...(removeAttributes.length > 0 && { removeAttributes })
  };
}
