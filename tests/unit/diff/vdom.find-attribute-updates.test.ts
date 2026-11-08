import { describe, expect, it } from 'vitest';
import { findAttributeUpdates } from '../../../src/vdom/diff/findAttributeUpdates';
import type { VNodeAttribute } from '../../../src/vdom/types';

describe('DIFF-03: HTML 속성 변경 계산', () => {
  it('class 변경·data-extra 추가·title 삭제만 반환하고 입력을 변경하지 않는다', () => {
    const prev: VNodeAttribute[] = [
      { name: 'key', value: 'p1' },
      { name: 'class', value: 'a' },
      { name: 'title', value: '설명' }
    ];
    const next: VNodeAttribute[] = [
      { name: 'key', value: 'p1' },
      { name: 'class', value: 'b' },
      { name: 'data-extra', value: 'x' }
    ];
    for (const attribute of [...prev, ...next]) Object.freeze(attribute);
    Object.freeze(prev);
    Object.freeze(next);

    const result = findAttributeUpdates(prev, next);
    expect(result.setAttributes).toHaveLength(2);
    expect(result.setAttributes).toEqual(expect.arrayContaining([
      { name: 'class', value: 'b' },
      { name: 'data-extra', value: 'x' }
    ]));
    expect(result.removeAttributes).toEqual(['title']);
  });

  it('속성 나열 순서만 다르면 빈 객체를 반환한다', () => {
    const prev = [{ name: 'class', value: 'a' }, { name: 'title', value: '설명' }];
    const next = [{ name: 'title', value: '설명' }, { name: 'class', value: 'a' }];
    expect(findAttributeUpdates(prev, next)).toEqual({});
  });
});
