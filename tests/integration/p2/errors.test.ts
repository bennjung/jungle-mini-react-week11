import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, startApp, useEffect, useState } from '../../../src/component';
import { syncEvents } from '../../../src/vdom/events';
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

vi.mock('../../../src/vdom/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/vdom/events')>();
  return { ...actual, syncEvents: vi.fn(actual.syncEvents) };
});

const applyPatchMock = vi.mocked(applyPatch);
const syncEventsMock = vi.mocked(syncEvents);

/**
 * 예약된 갱신을 테스트가 직접 실행하기 위해 queueMicrotask를 가로챈다.
 * 예약 경로에서 던진 오류를 unhandled error로 흘리지 않고 expect().toThrow()로 잡기 위함이다.
 */
function captureScheduledUpdates(): {
  scheduled: VoidFunction[];
  restore: () => void;
} {
  const scheduled: VoidFunction[] = [];
  const spy = vi
    .spyOn(globalThis, 'queueMicrotask')
    .mockImplementation((callback) => {
      scheduled.push(callback);
    });

  return { scheduled, restore: () => spy.mockRestore() };
}

beforeEach(() => {
  resetBody();
  applyPatchMock.mockClear();
  syncEventsMock.mockClear();
});

afterEach(resetBody);

describe('ERR-01 갱신 중 render 오류는 DOM 반영 전에 중단된다', () => {
  it('이전 화면과 참조를 유지하고, 오류를 전파한 뒤 다음 갱신은 다시 동작한다', async () => {
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
    const span = container.querySelector('span')!;
    const button = buttonByText(container, 'tick');

    const { scheduled, restore } = captureScheduledUpdates();
    try {
      fail = true;
      button.click();

      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow(/반환값/);

      expect(container.querySelector('span')).toBe(span);
      expect(span.textContent).toBe('0');
      expect(applyPatchMock).not.toHaveBeenCalled();
      expect(syncEventsMock).not.toHaveBeenCalled();
    } finally {
      restore();
    }

    fail = false;
    button.click();
    await flushUpdates();

    expect(container.querySelector('span')).toBe(span);
    expect(span.textContent).toBe('2');
  });
});

describe('ERR-02 applyPatch 실패는 마지막 성공 VDOM으로 복구하고 오류를 전파한다', () => {
  it('이전 화면을 다시 그리고 effect는 실행하지 않으며, 다음 갱신은 복구된 화면을 기준으로 동작한다', async () => {
    const failure = new Error('applyPatch failure');
    let effectRuns = 0;

    function App() {
      // 같은 문자열을 다시 넣으면 setter가 갱신을 예약하지 않으므로, 재시도도 새 값이 되도록
      // 매 클릭에서 새 객체를 만든다. 화면에 보이는 데이터는 A와 B로 유지된다.
      const [value, setValue] = useState({ label: 'A' });

      useEffect(() => {
        effectRuns += 1;
      }, [value]);

      return h(
        'div',
        {},
        h('span', {}, value.label),
        h('button', { onClick: () => setValue({ label: 'B' }) }, 'next')
      );
    }

    const container = createContainer();
    startApp(App, container);
    const span = container.querySelector('span')!;
    expect(span.textContent).toBe('A');
    expect(effectRuns).toBe(1);

    applyPatchMock.mockImplementationOnce(() => {
      // Patch가 일부 DOM을 바꾼 뒤 실패하는 상황을 재현한다. 복구가 부분 변경을 지워야 한다.
      span.textContent = 'B';
      throw failure;
    });

    const { scheduled, restore } = captureScheduledUpdates();
    try {
      buttonByText(container, 'next').click();

      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow(failure);
    } finally {
      restore();
    }

    expect(container.querySelector('span')!.textContent).toBe('A');
    expect(effectRuns).toBe(1);
    expect(syncEventsMock).not.toHaveBeenCalled();

    buttonByText(container, 'next').click();
    await flushUpdates();

    expect(container.querySelector('span')!.textContent).toBe('B');
    expect(effectRuns).toBe(2);
  });
});

describe('syncEvents 오류는 DOM 반영 뒤 오류를 전파하고 effect를 실행하지 않는다', () => {
  it('handler 갱신이 실패하면 남은 commit 단계로 넘어가지 않는다', () => {
    const failure = new Error('syncEvents failure');
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
    expect(effectRuns).toBe(1);

    syncEventsMock.mockImplementationOnce(() => {
      throw failure;
    });

    const { scheduled, restore } = captureScheduledUpdates();
    try {
      buttonByText(container, 'next').click();

      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow(failure);
    } finally {
      restore();
    }

    // DOM Patch는 syncEvents보다 먼저 끝났으므로 화면은 새 값이다.
    expect(container.querySelector('span')!.textContent).toBe('B');
    expect(effectRuns).toBe(1);
  });
});

describe('effect 오류는 남은 effect를 실행하지 않는다', () => {
  it('첫 번째 effect가 던진 오류를 전파하고 두 번째 effect는 건너뛴다', () => {
    const failure = new Error('effect failure');
    const log: string[] = [];

    function App() {
      const [value, setValue] = useState('A');

      useEffect(() => {
        log.push(`first:${value}`);
        if (value === 'B') throw failure;
      }, [value]);

      useEffect(() => {
        log.push(`second:${value}`);
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
    expect(log).toEqual(['first:A', 'second:A']);

    const { scheduled, restore } = captureScheduledUpdates();
    try {
      buttonByText(container, 'next').click();

      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow(failure);
    } finally {
      restore();
    }

    // effect는 DOM 반영 뒤에 실행되므로 화면은 이미 갱신되어 있다.
    expect(container.querySelector('span')!.textContent).toBe('B');
    expect(log).toEqual(['first:A', 'second:A', 'first:B']);
  });
});
