import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, startApp, useEffect, useState } from '../../../src/component';
import { applyPatch } from '../../../src/vdom/patch';
import type { VNode } from '../../../src/vdom/types';
import {
  buttonByText,
  createContainer,
  flushUpdates,
  resetBody
} from '../../helpers/p2';

vi.mock('../../../src/vdom/patch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/vdom/patch')>();
  return { ...actual, applyPatch: vi.fn(actual.applyPatch) };
});

const applyPatchMock = vi.mocked(applyPatch);

beforeEach(() => {
  resetBody();
  applyPatchMock.mockClear();
});

afterEach(resetBody);

describe('ERR-01 갱신 중 render 오류는 DOM 반영 전에 중단된다', () => {
  it('이전 화면을 유지하고 다음 갱신은 다시 동작한다', async () => {
    let fail = false;

    function App() {
      const [tick, setTick] = useState(0);

      if (fail) {
        return 'X' as unknown as VNode;
      }

      return h(
        'div',
        {},
        h('span', {}, tick),
        h('button', { onClick: () => setTick((prev) => prev + 1) }, 'tick')
      );
    }

    const container = createContainer();
    startApp(App, container);
    const span = container.querySelector('span');

    fail = true;
    buttonByText(container, 'tick').click();
    await flushUpdates();

    expect(container.querySelector('span')).toBe(span);
    expect(container.textContent).toBe('0');
    expect(applyPatchMock).not.toHaveBeenCalled();

    fail = false;
    buttonByText(container, 'tick').click();
    await flushUpdates();

    expect(container.textContent).toBe('2');
  });
});

describe('ERR-02 applyPatch 실패는 마지막 성공 VDOM으로 복구하고 오류를 전파한다', () => {
  it('이전 화면을 다시 그리고 effect는 실행하지 않는다', async () => {
    let effectRuns = 0;

    function App() {
      const [value, setValue] = useState('A');

      useEffect(() => {
        effectRuns += 1;
      }, [value]);

      return h(
        'div',
        {},
        h('span', {}, value),
        h('button', { onClick: () => setValue('B') }, 'next')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(container.textContent).toBe('A');
    expect(effectRuns).toBe(1);

    applyPatchMock.mockImplementationOnce(() => {
      throw new Error('applyPatch failure');
    });

    buttonByText(container, 'next').click();
    await flushUpdates();

    expect(container.textContent).toBe('A');
    expect(effectRuns).toBe(1);

    buttonByText(container, 'next').click();
    await flushUpdates();

    expect(container.textContent).toBe('B');
    expect(effectRuns).toBe(2);
  });
});
