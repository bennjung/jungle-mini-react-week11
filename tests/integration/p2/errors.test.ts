import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, startApp, useEffect, useState } from '../../../src/component';
import { syncEvents } from '../../../src/vdom/events';
import { applyPatch } from '../../../src/vdom/patch';
import type { VNode } from '../../../src/vdom/types';
import {
  buttonByText,
  captureScheduledUpdates,
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

  it('실패한 갱신의 내부 State도 복원되어 같은 setter가 다시 새 변경으로 예약된다', async () => {
    const failure = new Error('applyPatch failure');
    let renders = 0;

    function App() {
      renders += 1;
      const [value, setValue] = useState('A');

      return h(
        'div',
        {},
        h('span', {}, value),
        h('button', { onClick: () => setValue('B') }, 'next')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(renders).toBe(1);

    applyPatchMock.mockImplementationOnce(() => {
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

    // 실패한 render는 실행됐지만 화면과 내부 State는 A로 돌아와 있다.
    expect(renders).toBe(2);
    expect(container.querySelector('span')!.textContent).toBe('A');

    buttonByText(container, 'next').click();
    await flushUpdates();

    // State가 B로 남아 있었다면 같은 값이라 갱신이 예약되지 않아 render 횟수가 늘지 않는다.
    expect(renders).toBe(3);
    expect(container.querySelector('span')!.textContent).toBe('B');
  });

  it('effect setter로 시작한 갱신이 실패해도 이미 실행한 효과의 실행 기록을 잃지 않는다', async () => {
    const failure = new Error('applyPatch failure');
    const log: string[] = [];

    function App() {
      const [value, setValue] = useState('A');

      useEffect(() => {
        log.push('effect');

        // mount 효과가 setter를 호출해 다음 갱신을 예약한다.
        if (value === 'A') setValue('B');

        return () => {
          log.push(`cleanup:${value}`);
        };
      }, []);

      return h(
        'div',
        {},
        h('span', {}, value),
        h('button', { onClick: () => setValue('C') }, 'next')
      );
    }

    const container = createContainer();
    const { scheduled, restore } = captureScheduledUpdates();
    try {
      startApp(App, container);
      expect(scheduled).toHaveLength(1);
    } finally {
      restore();
    }

    // effect 본문과 cleanup 반환까지 끝난 뒤, 예약된 갱신의 Patch가 실패한다.
    expect(log).toEqual(['effect']);
    applyPatchMock.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() => scheduled[0]!()).toThrow(failure);

    expect(container.querySelector('span')!.textContent).toBe('A');

    buttonByText(container, 'next').click();
    await flushUpdates();

    expect(container.querySelector('span')!.textContent).toBe('C');
    // 실행 기록이 복원되면 effect를 다시 실행하지 않는다. 다시 실행되면 log가 늘어난다.
    expect(log).toEqual(['effect']);
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

describe('effect cleanup 오류는 남은 effect를 실행하지 않는다', () => {
  it('첫 번째 cleanup 오류를 전파하고 새 본문과 두 번째 cleanup·본문은 실행하지 않는다', () => {
    const failure = new Error('cleanup failure');
    const log: string[] = [];

    function App() {
      const [value, setValue] = useState('A');

      useEffect(() => {
        log.push(`first-run:${value}`);
        return () => {
          log.push(`first-cleanup:${value}`);
          if (value === 'A') throw failure;
        };
      }, [value]);

      useEffect(() => {
        log.push(`second-run:${value}`);
        return () => {
          log.push(`second-cleanup:${value}`);
        };
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
    expect(log).toEqual(['first-run:A', 'second-run:A']);

    const { scheduled, restore } = captureScheduledUpdates();
    try {
      buttonByText(container, 'next').click();

      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow(failure);
    } finally {
      restore();
    }

    // 효과는 DOM 반영 뒤에 실행되므로 화면은 새 값이다. cleanup 오류 뒤의 새 효과와
    // 두 번째 효과의 cleanup·본문은 실행되지 않는다.
    expect(container.querySelector('span')!.textContent).toBe('B');
    expect(log).toEqual(['first-run:A', 'second-run:A', 'first-cleanup:A']);
  });
});
