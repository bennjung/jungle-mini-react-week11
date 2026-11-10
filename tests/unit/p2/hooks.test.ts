import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { h, startApp, useEffect, useMemo, useState } from '../../../src/component';
import {
  buttonByText,
  createContainer,
  flushUpdates,
  resetBody,
  textNodes
} from '../../helpers/p2';

beforeEach(resetBody);
afterEach(resetBody);

describe('HOOK-01 useState가 mount에서 기록을 만들고 update에서 값과 setter를 유지한다', () => {
  it('클릭마다 값이 바뀌고 setter 참조는 유지된다', async () => {
    const setters: unknown[] = [];
    let renders = 0;

    function App() {
      renders += 1;
      const [count, setCount] = useState(0);
      setters.push(setCount);
      return h('button', { onClick: () => setCount(count + 1) }, count);
    }

    const container = createContainer();
    startApp(App, container);

    expect(container.textContent).toBe('0');
    expect(renders).toBe(1);

    buttonByText(container, '0').click();
    await flushUpdates();

    expect(container.textContent).toBe('1');
    expect(renders).toBe(2);
    expect(setters[0]).toBe(setters[1]);
  });
});

describe('HOOK-02 여러 useState가 호출 순서로 분리된다', () => {
  it('두 번째 setter가 첫 번째 값을 바꾸지 않는다', async () => {
    function App() {
      const [first, setFirst] = useState('A');
      const [second, setSecond] = useState('B');

      return h(
        'div',
        {},
        h('span', {}, first),
        h('span', {}, second),
        h('button', { onClick: () => setSecond('B2') }, 'second'),
        h('button', { onClick: () => setFirst('A2') }, 'first')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(textNodes(container)).toEqual(['A', 'B']);

    buttonByText(container, 'second').click();
    await flushUpdates();
    expect(textNodes(container)).toEqual(['A', 'B2']);

    buttonByText(container, 'first').click();
    await flushUpdates();
    expect(textNodes(container)).toEqual(['A2', 'B2']);
  });
});

describe('HOOK-03 함수형 updater가 이전 값 기준으로 계산한다', () => {
  it('한 handler에서 두 번 호출해도 직전 값 기준으로 누적된다', async () => {
    function App() {
      const [count, setCount] = useState(0);

      return h(
        'button',
        {
          onClick: () => {
            setCount((prev) => prev + 1);
            setCount((prev) => prev + 1);
          }
        },
        count
      );
    }

    const container = createContainer();
    startApp(App, container);
    buttonByText(container, '0').click();
    await flushUpdates();

    expect(container.textContent).toBe('2');
  });
});

describe('HOOK-04 useMemo가 의존성이 같으면 다시 계산하지 않는다', () => {
  it('다른 State 변경으로 재렌더해도 계산 횟수는 늘지 않는다', async () => {
    let calculateCalls = 0;

    function App() {
      const [count] = useState(2);
      const [label, setLabel] = useState('A');
      const doubled = useMemo(() => {
        calculateCalls += 1;
        return count * 2;
      }, [count]);

      return h(
        'div',
        {},
        h('span', {}, label),
        h('span', {}, String(doubled)),
        h('button', { onClick: () => setLabel('B') }, 'label')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(calculateCalls).toBe(1);

    buttonByText(container, 'label').click();
    await flushUpdates();

    expect(textNodes(container)).toEqual(['B', '4']);
    expect(calculateCalls).toBe(1);
  });
});

describe('HOOK-05 useMemo가 의존성이 바뀌면 다시 계산한다', () => {
  it('count 변경 시 계산이 한 번 더 실행된다', async () => {
    let calculateCalls = 0;

    function App() {
      const [count, setCount] = useState(1);
      const doubled = useMemo(() => {
        calculateCalls += 1;
        return count * 2;
      }, [count]);

      return h(
        'div',
        {},
        h('span', {}, String(doubled)),
        h('button', { onClick: () => setCount(count + 1) }, 'inc')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(calculateCalls).toBe(1);

    buttonByText(container, 'inc').click();
    await flushUpdates();

    expect(calculateCalls).toBe(2);
    expect(textNodes(container)).toEqual(['4']);
  });
});

describe('HOOK-06 useEffect가 commit 뒤 실행되고 의존성이 같으면 다시 실행하지 않는다', () => {
  it('label만 바뀌면 effect는 다시 실행되지 않는다', async () => {
    let effectCalls = 0;

    function App() {
      const [count] = useState(0);
      const [label, setLabel] = useState('A');

      useEffect(() => {
        effectCalls += 1;
      }, [count]);

      return h(
        'div',
        {},
        h('span', {}, label),
        h('button', { onClick: () => setLabel('B') }, 'label')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(effectCalls).toBe(1);

    buttonByText(container, 'label').click();
    await flushUpdates();

    expect(textNodes(container)).toEqual(['B']);
    expect(effectCalls).toBe(1);
  });
});

describe('HOOK-07 Component 실행 밖에서 Hook을 호출하면 오류다', () => {
  it('일반 함수 호출은 오류로 중단된다', () => {
    function outside(): void {
      useState(0);
    }

    expect(() => outside()).toThrow();
  });
});

describe('HOOK-08 Hook 개수나 종류가 render 사이에 바뀌면 오류다', () => {
  it('개수가 줄어드는 render는 화면을 바꾸지 않는다', async () => {
    function App() {
      const [flag, setFlag] = useState(true);
      if (flag) {
        useState(0);
      }

      return h('div', {}, h('button', { onClick: () => setFlag(false) }, 'off'));
    }

    const container = createContainer();
    startApp(App, container);
    const button = buttonByText(container, 'off');

    button.click();
    await flushUpdates();

    expect(container.contains(button)).toBe(true);
    expect(container.textContent).toBe('off');
  });

  it('같은 위치의 Hook 종류가 바뀌어도 화면을 바꾸지 않는다', async () => {
    function App() {
      const [flag, setFlag] = useState(true);

      if (flag) {
        useState(0);
      } else {
        useMemo(() => 0, []);
      }

      return h('div', {}, h('button', { onClick: () => setFlag(false) }, 'switch'));
    }

    const container = createContainer();
    startApp(App, container);
    const button = buttonByText(container, 'switch');

    button.click();
    await flushUpdates();

    expect(container.contains(button)).toBe(true);
    expect(container.textContent).toBe('switch');
  });
});

describe('HOOK-09 같은 값을 넣는 setter는 갱신을 예약하지 않는다', () => {
  it('같은 값·같은 updater·NaN은 재렌더를 만들지 않는다', async () => {
    let renders = 0;

    function App() {
      renders += 1;
      const [count, setCount] = useState(0);
      const [label, setLabel] = useState('A');

      return h(
        'div',
        {},
        h('span', {}, String(count)),
        h('span', {}, label),
        h('button', { onClick: () => setCount(0) }, 'same'),
        h('button', { onClick: () => setCount((prev) => prev) }, 'updater'),
        h('button', { onClick: () => setLabel('B') }, 'label')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(renders).toBe(1);

    buttonByText(container, 'same').click();
    await flushUpdates();
    expect(renders).toBe(1);

    buttonByText(container, 'updater').click();
    await flushUpdates();
    expect(renders).toBe(1);

    buttonByText(container, 'label').click();
    await flushUpdates();
    expect(renders).toBe(2);
    expect(textNodes(container)).toEqual(['0', 'B']);
  });

  it('NaN은 같은 값으로 판정한다', async () => {
    let renders = 0;

    function App() {
      renders += 1;
      const [value, setValue] = useState(Number.NaN);

      return h(
        'button',
        { onClick: () => setValue(Number.NaN) },
        String(value)
      );
    }

    const container = createContainer();
    startApp(App, container);
    buttonByText(container, 'NaN').click();
    await flushUpdates();

    expect(renders).toBe(1);
  });
});

describe('EFF-01 의존성이 바뀌면 이전 cleanup이 새 effect보다 먼저 실행된다', () => {
  it('기록 순서가 run → cleanup → run이다', async () => {
    const log: string[] = [];

    function App() {
      const [count, setCount] = useState(0);

      useEffect(() => {
        log.push(`run${count}`);
        return () => {
          log.push(`cleanup${count}`);
        };
      }, [count]);

      return h('div', {}, h('button', { onClick: () => setCount(count + 1) }, 'inc'));
    }

    const container = createContainer();
    startApp(App, container);
    expect(log).toEqual(['run0']);

    buttonByText(container, 'inc').click();
    await flushUpdates();

    expect(log).toEqual(['run0', 'cleanup0', 'run1']);
  });
});
