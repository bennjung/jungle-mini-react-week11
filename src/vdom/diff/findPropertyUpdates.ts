import type { UpdateData, VNodeProperties } from '../types';

/**
 * 입력: 이전·다음 VNode에 저장된 DOM 프로퍼티 값.
 * 출력: 설정할 프로퍼티와 제거할 이름. 변경이 없으면 항목을 생략한다.
 * 책임: 값의 참·거짓이 아니라 값이 달라졌는지를 판단한다.
 */
export function findPropertyUpdates(
  prevProperties: VNodeProperties,
  nextProperties: VNodeProperties
): Pick<UpdateData, 'setProperties' | 'removeProperties'> {
  const setEntries = Object.entries(nextProperties).filter(([name, value]) =>
    !Object.hasOwn(prevProperties, name) || prevProperties[name] !== value
  );
  const removeProperties = Object.keys(prevProperties).filter((name) =>
    !Object.hasOwn(nextProperties, name)
  );

  return {
    ...(setEntries.length > 0 && { setProperties: Object.fromEntries(setEntries) }),
    ...(removeProperties.length > 0 && { removeProperties })
  };
}
