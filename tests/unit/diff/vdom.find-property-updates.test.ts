import { describe, expect, it } from 'vitest';
import { findPropertyUpdates } from '../../../src/vdom/diff/findPropertyUpdates';

describe('DIFF-05: DOM 프로퍼티 변경 계산', () => {
  it.each([
    [{ value: 'A' }, { value: 'B' }, { setProperties: { value: 'B' } }],
    [{ value: 'A' }, { value: '' }, { setProperties: { value: '' } }],
    [{ checked: true }, { checked: false }, { setProperties: { checked: false } }],
    [{ selected: false }, { selected: true }, { setProperties: { selected: true } }],
    [{}, { selected: false }, { setProperties: { selected: false } }],
    [{ checked: true }, {}, { removeProperties: ['checked'] }],
    [{ value: 'A', checked: true }, { value: 'B' }, { setProperties: { value: 'B' }, removeProperties: ['checked'] }],
    [{ value: 'A', checked: false }, { checked: false, value: 'A' }, {}]
  ])('이전 %j → 다음 %j 변경을 계산하고 입력을 보존한다', (prev, next, expected) => {
    Object.freeze(prev);
    Object.freeze(next);
    expect(findPropertyUpdates(prev, next)).toEqual(expected);
  });
});
