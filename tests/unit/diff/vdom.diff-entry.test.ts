import { describe, expect, it } from 'vitest';
import * as entry from '../../../src/vdom/diff';

describe('Diff 외부 진입점', () => {
  it('diff만 내보내고 세부 함수는 노출하지 않는다', () => {
    expect(Object.keys(entry)).toEqual(['diff']);
    expect(typeof entry.diff).toBe('function');
  });
});
