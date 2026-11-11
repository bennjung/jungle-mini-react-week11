/**
 * h·Patch·입력 확인이 공유하는 DOM 프로퍼티 판단 규칙.
 * 세 소비자가 같은 의미를 각자 복제하지 않도록 작은 순수 판단만 모은다.
 * 실제 DOM 쓰기나 VDOM 순회는 하지 않는다.
 */

/** Patch가 값 반영 뒤 한 번에 적용할 선택 영역 선언 이름. */
export const selectionPropertyNames = [
  'selectionStart',
  'selectionEnd',
  'selectionDirection'
] as const;

export function isSelectionProperty(name: string): boolean {
  return (selectionPropertyNames as readonly string[]).includes(name);
}

/**
 * 다중 선택의 value는 OPTION.selected로 복원한다.
 * SELECT.value 대입은 다른 OPTION의 선택을 해제하므로 값 비교·쓰기에서 제외한다.
 */
export function isMultiSelectValue(element: Element, name: string): boolean {
  return (
    element instanceof HTMLSelectElement && element.multiple && name === 'value'
  );
}

/**
 * 앱이 지정한 프로퍼티 값이 실제 요소 값과 같은지 판단한다.
 * value는 DOM 문자열 정규화를 따르고, boolean 계열은 boolean 값으로 비교한다.
 * 선택 영역 프로퍼티는 DOM API를 읽지 않는다는 입력 확인 규칙에 따라 여기서 다루지 않는다.
 */
export function isSameDomProperty(
  element: Element,
  name: string,
  desired: unknown
): boolean {
  const actual: unknown = Reflect.get(element, name);

  if (name === 'value') return isSameValueText(actual, desired);

  if (name === 'checked' || name === 'indeterminate' || name === 'selected') {
    return Boolean(actual) === Boolean(desired);
  }

  return Object.is(actual, desired);
}

// input/textarea/select의 value DOM 프로퍼티는 항상 문자열이다. 숫자 등은 같은 문자열이면 같다.
function isSameValueText(actual: unknown, desired: unknown): boolean {
  if (typeof actual !== 'string') return Object.is(actual, desired);
  return actual === toValueText(desired);
}

function toValueText(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}
