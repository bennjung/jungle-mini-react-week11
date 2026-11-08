import { describe, expect, it } from 'vitest';
import { matchChildren } from '../../src/vdom/match';
import { element, text } from '../helpers/vdom';

describe('matchChildren', () => {
  it('keyed 형제는 key로 대응하고 순서 변경은 move로 계산한다', () => {
    const a = element('li', { key: 'a' });
    const b = element('li', { key: 'b' });

    const plan = matchChildren([a, b], [b, a]);

    expect(plan.pairs.map(({ next }) => next)).toEqual([b, a]);
    expect(plan.moves.map(({ next }) => next)).toEqual([b]);
    expect(plan.moves[0]?.before).toBe(a);
  });

  it('keyless 형제와 텍스트는 같은 부모 안의 순서로 대응한다', () => {
    const a = element('li', { children: [text('A')] });
    const b = element('li', { children: [text('B')] });

    const plan = matchChildren([a, b], [b, a]);

    expect(plan.pairs.map(({ prev }) => prev)).toEqual([a, b]);
    expect(plan.moves).toEqual([]);
  });

  it('keyed와 keyless가 섞여도 각 규칙을 적용한다', () => {
    const keyed = element('li', { key: 'a' });
    const keyless = element('li');

    const plan = matchChildren([keyed, keyless], [keyed, keyless]);

    expect(plan.pairs).toHaveLength(2);
    expect(plan.moves).toEqual([]);
  });

  it('새 key는 insert, 사라진 key는 remove로 계산한다', () => {
    const oldNode = element('li', { key: 'old' });
    const newNode = element('li', { key: 'new' });

    const plan = matchChildren([oldNode], [newNode]);

    expect(plan.pairs).toEqual([]);
    expect(plan.removals).toEqual([oldNode]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]?.next).toBe(newNode);
    expect(plan.inserts[0]?.before).toBeNull();
  });
});
