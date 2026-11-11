import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { h, startApp, useEffect, useMemo, useState } from '../../../src/component';
import type { VNode } from '../../../src/vdom/types';
import {
  buttonByText,
  captureScheduledUpdates,
  createContainer,
  flushUpdates,
  resetBody,
  textNodes
} from '../../helpers/p2';

beforeEach(resetBody);
afterEach(resetBody);

/**
 * 루트 실행이 끝난 뒤 세 Hook이 모두 거부되고, 거부 과정에서 계산·효과가
 * 실행되지 않았는지 확인한다. fixture 자체의 카운터는 각 테스트에서 따로 확인한다.
 */
function expectOutsideHooksRejected(): void {
  let calculate = 0;
  let effect = 0;

  expect(() => useState(0)).toThrow(/useState/);
  expect(() =>
    useMemo(() => {
      calculate += 1;
      return 1;
    }, [])
  ).toThrow(/useMemo/);
  expect(() =>
    useEffect(() => {
      effect += 1;
    }, [])
  ).toThrow(/useEffect/);

  expect(calculate).toBe(0);
  expect(effect).toBe(0);
}

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

  it('계산 결과가 undefined여도 의존성이 같으면 캐시를 재사용한다', async () => {
    let calculateCalls = 0;

    function App() {
      const [label, setLabel] = useState('A');
      const value = useMemo(() => {
        calculateCalls += 1;
        return undefined;
      }, []);

      return h(
        'div',
        {},
        h('span', {}, `${label}:${String(value)}`),
        h('button', { onClick: () => setLabel('B') }, 'label')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(textNodes(container)).toEqual(['A:undefined']);
    expect(calculateCalls).toBe(1);

    buttonByText(container, 'label').click();
    await flushUpdates();

    expect(textNodes(container)).toEqual(['B:undefined']);
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

  it('의존성 배열 길이가 바뀌면 다시 계산한다', async () => {
    let calculateCalls = 0;

    function App() {
      const [expanded, setExpanded] = useState(false);
      const deps = expanded ? [1, 2] : [1];
      const length = useMemo(() => {
        calculateCalls += 1;
        return deps.length;
      }, deps);

      return h(
        'div',
        {},
        h('span', {}, String(length)),
        h('button', { onClick: () => setExpanded(true) }, 'expand')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(calculateCalls).toBe(1);
    expect(textNodes(container)).toEqual(['1']);

    buttonByText(container, 'expand').click();
    await flushUpdates();

    expect(calculateCalls).toBe(2);
    expect(textNodes(container)).toEqual(['2']);
  });

  it('의존성 배열 순서가 바뀌면 다시 계산한다', async () => {
    let calculateCalls = 0;

    function App() {
      const [swapped, setSwapped] = useState(false);
      const deps = swapped ? ['b', 'a'] : ['a', 'b'];
      const joined = useMemo(() => {
        calculateCalls += 1;
        return deps.join('');
      }, deps);

      return h(
        'div',
        {},
        h('span', {}, joined),
        h('button', { onClick: () => setSwapped(true) }, 'swap')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(calculateCalls).toBe(1);
    expect(textNodes(container)).toEqual(['ab']);

    buttonByText(container, 'swap').click();
    await flushUpdates();

    expect(calculateCalls).toBe(2);
    expect(textNodes(container)).toEqual(['ba']);
  });

  it('같은 내용의 새 객체 의존성은 참조가 달라 다시 계산한다', async () => {
    let calculateCalls = 0;

    function App() {
      const [config, setConfig] = useState({ size: 2 });
      const area = useMemo(() => {
        calculateCalls += 1;
        return config.size * config.size;
      }, [config]);

      return h(
        'div',
        {},
        h('span', {}, String(area)),
        h('button', { onClick: () => setConfig({ size: 2 }) }, 'replace')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(calculateCalls).toBe(1);

    buttonByText(container, 'replace').click();
    await flushUpdates();

    expect(calculateCalls).toBe(2);
    expect(textNodes(container)).toEqual(['4']);
  });
});

describe('HOOK-04·05 useMemo 의존성 배열 검증', () => {
  it.each([undefined, null, 0, 'count', { length: 1 }])(
    'deps가 배열이 아니면 오류다: %s',
    (deps) => {
      let rendered = false;

      function App() {
        useMemo(() => 1, deps as unknown as unknown[]);
        rendered = true;
        return h('div', {}, 'ok');
      }

      const container = createContainer();
      expect(() => startApp(App, container)).toThrow(/deps/);
      expect(rendered).toBe(false);
      expect(container.textContent).toBe('');
    }
  );
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

  it('의존성이 같으면 cleanup도 실행하지 않는다', async () => {
    const log: string[] = [];

    function App() {
      const [count] = useState(0);
      const [label, setLabel] = useState('A');

      useEffect(() => {
        log.push('run');
        return () => {
          log.push('cleanup');
        };
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
    expect(log).toEqual(['run']);

    buttonByText(container, 'label').click();
    await flushUpdates();

    expect(textNodes(container)).toEqual(['B']);
    expect(log).toEqual(['run']);
  });
});

describe('HOOK-07 Component 실행 밖에서 Hook을 호출하면 오류다', () => {
  it('일반 함수 호출은 오류로 중단된다', () => {
    function outside(): void {
      useState(0);
    }

    expect(() => outside()).toThrow();
  });

  it('useMemo도 컴포넌트 실행 밖 호출은 오류다', () => {
    let calculateCalls = 0;

    function outside(): void {
      useMemo(() => {
        calculateCalls += 1;
        return 1;
      }, []);
    }

    expect(() => outside()).toThrow();
    expect(calculateCalls).toBe(0);
  });
});

describe('HOOK-08 Hook 개수나 종류가 render 사이에 바뀌면 오류다', () => {
  it('개수가 줄어드는 render는 화면을 바꾸지 않는다', () => {
    const { scheduled, restore } = captureScheduledUpdates();

    try {
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

      // 예약된 갱신 오류를 테스트가 직접 실행해 잡는다. unhandled error로 새지 않게 한다.
      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow();

      expect(container.contains(button)).toBe(true);
      expect(container.textContent).toBe('off');
    } finally {
      restore();
    }
  });

  it('개수가 늘어나는 render도 화면을 바꾸지 않는다', () => {
    const { scheduled, restore } = captureScheduledUpdates();

    try {
      function App() {
        const [flag, setFlag] = useState(false);
        if (flag) {
          useState(0);
        }

        return h('div', {}, h('button', { onClick: () => setFlag(true) }, 'on'));
      }

      const container = createContainer();
      startApp(App, container);
      const button = buttonByText(container, 'on');

      button.click();

      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow();

      expect(container.contains(button)).toBe(true);
      expect(container.textContent).toBe('on');
    } finally {
      restore();
    }
  });

  it('같은 위치의 Hook 종류가 바뀌어도 화면을 바꾸지 않는다', () => {
    const { scheduled, restore } = captureScheduledUpdates();

    try {
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

      expect(scheduled).toHaveLength(1);
      expect(() => scheduled[0]!()).toThrow();

      expect(container.contains(button)).toBe(true);
      expect(container.textContent).toBe('switch');
    } finally {
      restore();
    }
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

  it('+0/-0은 다른 값, 같은 참조는 같은 값, 같은 내용의 새 객체는 다른 값으로 판정한다', async () => {
    const shared = { value: 1 };
    let renders = 0;

    function App() {
      renders += 1;
      const [zero, setZero] = useState(0);
      const [, setObject] = useState(shared);

      return h(
        'div',
        {},
        h('span', {}, Object.is(zero, -0) ? '-0' : '0'),
        h('button', { onClick: () => setZero(-0) }, 'negative-zero'),
        h('button', { onClick: () => setObject(shared) }, 'same-reference'),
        h('button', { onClick: () => setObject({ value: 1 }) }, 'new-object')
      );
    }

    const container = createContainer();
    startApp(App, container);

    buttonByText(container, 'same-reference').click();
    await flushUpdates();
    expect(renders).toBe(1);

    buttonByText(container, 'negative-zero').click();
    await flushUpdates();
    expect(renders).toBe(2);
    expect(textNodes(container)).toEqual(['-0']);

    buttonByText(container, 'new-object').click();
    await flushUpdates();
    expect(renders).toBe(3);
  });
});

describe('HOOK-10 자식 실행 중 세 Hook을 모두 거부한다', () => {
  it('Child의 useState는 진입 1회 뒤 거부되고 이후 문장은 실행되지 않는다', () => {
    const counts = { entered: 0, after: 0, calculate: 0, effect: 0 };

    function Child(_props: unknown): null {
      counts.entered += 1;
      useState(0);
      counts.after += 1;
      return null;
    }

    function App(): VNode[] {
      useState('root');
      return h(Child, {});
    }

    const container = createContainer();
    expect(() => startApp(App, container)).toThrow();
    expect(counts.entered).toBe(1);
    expect(counts.after).toBe(0);
    expect(container.childNodes).toHaveLength(0);

    expect(counts.calculate).toBe(0);
    expect(counts.effect).toBe(0);
    expectOutsideHooksRejected();
  });

  it('Child의 useMemo는 진입 1회 뒤 거부되고 계산은 실행되지 않는다', () => {
    const counts = { entered: 0, after: 0, calculate: 0, effect: 0 };

    function Child(_props: unknown): null {
      counts.entered += 1;
      useMemo(() => {
        counts.calculate += 1;
        return 1;
      }, []);
      counts.after += 1;
      return null;
    }

    function App(): VNode[] {
      useState('root');
      return h(Child, {});
    }

    const container = createContainer();
    expect(() => startApp(App, container)).toThrow();
    expect(counts.entered).toBe(1);
    expect(counts.after).toBe(0);
    expect(counts.calculate).toBe(0);
    expect(container.childNodes).toHaveLength(0);

    expect(counts.calculate).toBe(0);
    expect(counts.effect).toBe(0);
    expectOutsideHooksRejected();
  });

  it('Child의 useEffect는 진입 1회 뒤 거부되고 효과는 실행되지 않는다', () => {
    const counts = { entered: 0, after: 0, calculate: 0, effect: 0 };

    function Child(_props: unknown): null {
      counts.entered += 1;
      useEffect(() => {
        counts.effect += 1;
      }, []);
      counts.after += 1;
      return null;
    }

    function App(): VNode[] {
      useState('root');
      return h(Child, {});
    }

    const container = createContainer();
    expect(() => startApp(App, container)).toThrow();
    expect(counts.entered).toBe(1);
    expect(counts.after).toBe(0);
    expect(counts.effect).toBe(0);
    expect(container.childNodes).toHaveLength(0);

    expect(counts.calculate).toBe(0);
    expect(counts.effect).toBe(0);
    expectOutsideHooksRejected();
  });
});

describe('HOOK-11 정상 자식 뒤 부모 Hook 문맥을 복원한다', () => {
  it('자식 앞뒤의 두 State가 순서대로 갱신되고 setter 참조가 유지된다', async () => {
    let childRuns = 0;
    let setFirstOutside: ((next: string) => void) | null = null;
    let setSecondOutside: ((next: string) => void) | null = null;
    const firstSetters: unknown[] = [];
    const secondSetters: unknown[] = [];

    function Child(_props: unknown): VNode {
      childRuns += 1;
      return h('em', {}, 'child');
    }

    function App(): VNode {
      const [first, setFirst] = useState('A');
      const child = h(Child, {});
      const [second, setSecond] = useState('B');

      firstSetters.push(setFirst);
      secondSetters.push(setSecond);
      setFirstOutside = setFirst;
      setSecondOutside = setSecond;

      return h(
        'section',
        {},
        h('span', {}, first),
        h('span', {}, second),
        child
      );
    }

    const container = createContainer();
    startApp(App, container);

    expect(container.textContent).toBe('ABchild');
    expect(childRuns).toBe(1);
    expectOutsideHooksRejected();

    setSecondOutside!('B2');
    await flushUpdates();
    expect(container.textContent).toBe('AB2child');
    expect(childRuns).toBe(2);
    expectOutsideHooksRejected();

    setFirstOutside!('A2');
    await flushUpdates();
    expect(container.textContent).toBe('A2B2child');
    expect(childRuns).toBe(3);
    expectOutsideHooksRejected();

    const firstReference = firstSetters[0];
    const secondReference = secondSetters[0];
    expect(firstSetters).toHaveLength(3);
    expect(secondSetters).toHaveLength(3);
    expect(firstSetters.every((setter) => setter === firstReference)).toBe(true);
    expect(secondSetters.every((setter) => setter === secondReference)).toBe(true);
    expect(firstReference).not.toBe(secondReference);
  });
});

describe('HOOK-12 중첩 자식은 직전의 빈 소유자로 복원한다', () => {
  type Counts = { after: number; calculate: number; effect: number };

  function startNestedChildHook(
    makeChildHook: (counts: Counts) => () => void
  ) {
    const log: string[] = [];
    const counts: Counts = { after: 0, calculate: 0, effect: 0 };
    const firstSetters: unknown[] = [];
    const secondSetters: unknown[] = [];
    let childRuns = 0;
    let grandchildRuns = 0;
    let setSecondOutside: ((next: string) => void) | null = null;

    function Grandchild(_props: unknown): null {
      grandchildRuns += 1;
      return null;
    }

    function Child(_props: unknown): null {
      childRuns += 1;
      log.push('child');
      h(Grandchild, {});
      log.push('grandchild-end');

      try {
        makeChildHook(counts)();
        // Hook 다음 문장은 거부되면 실행되지 않아야 한다.
        counts.after += 1;
      } catch {
        log.push('caught');
      }

      return null;
    }

    function App(): VNode {
      const [first, setFirst] = useState('A');
      const child = h(Child, {});
      const [second, setSecond] = useState('B');

      firstSetters.push(setFirst);
      secondSetters.push(setSecond);
      setSecondOutside = setSecond;

      return h(
        'section',
        {},
        h('span', {}, first),
        h('span', {}, second),
        child
      );
    }

    const container = createContainer();
    startApp(App, container);

    return {
      container,
      log,
      counts,
      firstSetters,
      secondSetters,
      get childRuns() {
        return childRuns;
      },
      get grandchildRuns() {
        return grandchildRuns;
      },
      setSecond: (next: string) => setSecondOutside!(next)
    };
  }

  it('useState 자식은 손자 종료 뒤에도 거부되고 루트 State는 정상 갱신된다', async () => {
    const fixture = startNestedChildHook(() => () => useState(0));

    expect(fixture.container.textContent).toBe('AB');
    expect(fixture.log).toEqual(['child', 'grandchild-end', 'caught']);
    expect(fixture.childRuns).toBe(1);
    expect(fixture.grandchildRuns).toBe(1);
    expect(fixture.counts.after).toBe(0);
    expectOutsideHooksRejected();

    fixture.setSecond('B2');
    await flushUpdates();

    expect(fixture.container.textContent).toBe('AB2');
    expect(fixture.log).toEqual([
      'child',
      'grandchild-end',
      'caught',
      'child',
      'grandchild-end',
      'caught'
    ]);
    expect(fixture.childRuns).toBe(2);
    expect(fixture.grandchildRuns).toBe(2);
    expect(fixture.counts.after).toBe(0);
    expect(fixture.firstSetters.every((setter) => setter === fixture.firstSetters[0])).toBe(true);
    expect(
      fixture.secondSetters.every((setter) => setter === fixture.secondSetters[0])
    ).toBe(true);
    expectOutsideHooksRejected();
  });

  it('useMemo 자식은 손자 종료 뒤에도 거부되고 계산은 0회다', async () => {
    const fixture = startNestedChildHook(
      (counts) => () => {
        useMemo(() => {
          counts.calculate += 1;
          return 1;
        }, []);
      }
    );

    expect(fixture.container.textContent).toBe('AB');
    expect(fixture.log).toEqual(['child', 'grandchild-end', 'caught']);
    expect(fixture.childRuns).toBe(1);
    expect(fixture.grandchildRuns).toBe(1);
    expect(fixture.counts.calculate).toBe(0);
    expect(fixture.counts.after).toBe(0);
    expectOutsideHooksRejected();

    fixture.setSecond('B2');
    await flushUpdates();

    expect(fixture.container.textContent).toBe('AB2');
    expect(fixture.log).toEqual([
      'child',
      'grandchild-end',
      'caught',
      'child',
      'grandchild-end',
      'caught'
    ]);
    expect(fixture.childRuns).toBe(2);
    expect(fixture.grandchildRuns).toBe(2);
    expect(fixture.counts.calculate).toBe(0);
    expect(fixture.counts.after).toBe(0);
    expect(fixture.firstSetters.every((setter) => setter === fixture.firstSetters[0])).toBe(true);
    expect(
      fixture.secondSetters.every((setter) => setter === fixture.secondSetters[0])
    ).toBe(true);
    expectOutsideHooksRejected();
  });

  it('useEffect 자식은 손자 종료 뒤에도 거부되고 효과는 0회다', async () => {
    const fixture = startNestedChildHook(
      (counts) => () => {
        useEffect(() => {
          counts.effect += 1;
        }, []);
      }
    );

    expect(fixture.container.textContent).toBe('AB');
    expect(fixture.log).toEqual(['child', 'grandchild-end', 'caught']);
    expect(fixture.childRuns).toBe(1);
    expect(fixture.grandchildRuns).toBe(1);
    expect(fixture.counts.effect).toBe(0);
    expect(fixture.counts.after).toBe(0);
    expectOutsideHooksRejected();

    fixture.setSecond('B2');
    await flushUpdates();

    expect(fixture.container.textContent).toBe('AB2');
    expect(fixture.log).toEqual([
      'child',
      'grandchild-end',
      'caught',
      'child',
      'grandchild-end',
      'caught'
    ]);
    expect(fixture.childRuns).toBe(2);
    expect(fixture.grandchildRuns).toBe(2);
    expect(fixture.counts.effect).toBe(0);
    expect(fixture.counts.after).toBe(0);
    expect(fixture.firstSetters.every((setter) => setter === fixture.firstSetters[0])).toBe(true);
    expect(
      fixture.secondSetters.every((setter) => setter === fixture.secondSetters[0])
    ).toBe(true);
    expectOutsideHooksRejected();
  });
});

describe('HOOK-13 오류 뒤에도 부모 문맥을 복원하고 슬롯을 오염시키지 않는다', () => {
  type ChildFailureKind = 'throw' | 'bad-return' | 'state' | 'memo' | 'effect';

  function startErrorFixture(kind: ChildFailureKind, failure: Error) {
    const errors: unknown[] = [];
    const counts = {
      renders: 0,
      childEntries: 0,
      catches: 0,
      after: 0,
      calculate: 0,
      effect: 0
    };
    const setterRefs: Array<{ first: unknown; second?: unknown }> = [];
    let setFirstOutside: ((next: string) => void) | null = null;
    let setSecondOutside: ((next: string) => void) | null = null;

    function Child(_props: unknown): unknown {
      counts.childEntries += 1;

      if (kind === 'throw') throw failure;
      if (kind === 'bad-return') return '잘못된 반환';

      if (kind === 'state') {
        useState(99);
      } else if (kind === 'memo') {
        useMemo(() => {
          counts.calculate += 1;
          return 1;
        }, []);
      } else {
        useEffect(() => {
          counts.effect += 1;
        }, []);
      }

      // Hook 다음 문장은 거부되면 실행되지 않아야 한다.
      counts.after += 1;
      return null;
    }

    function App(): VNode {
      counts.renders += 1;
      const [first, setFirst] = useState('A');
      setFirstOutside = setFirst;

      try {
        h(Child, {});
      } catch (error) {
        errors.push(error);
        counts.catches += 1;
      }

      if (kind === 'memo') {
        // useMemo를 시도한 자식과 다른 종류의 루트 Hook으로 슬롯 오염을 관찰한다.
        const [second, setSecond] = useState('B');
        setSecondOutside = setSecond;
        setterRefs.push({ first: setFirst, second: setSecond });

        return h(
          'section',
          {},
          h('span', {}, first),
          h('span', {}, second)
        );
      }

      const memo = useMemo(() => `M:${first}`, [first]);
      setterRefs.push({ first: setFirst });

      return h('section', {}, h('span', {}, first), h('span', {}, memo));
    }

    const container = createContainer();
    startApp(App, container);

    return {
      container,
      errors,
      counts,
      setterRefs,
      setFirst: (next: string) => setFirstOutside!(next),
      setSecond: (next: string) => setSecondOutside!(next)
    };
  }

  it.each(['throw', 'bad-return', 'state', 'memo', 'effect'] as const)(
    '%s 오류는 catch 1회 뒤 루트 Hook과 갱신이 정상이다',
    async (kind) => {
    const failure = new Error('child-error');
    const fixture = startErrorFixture(kind, failure);

    expect(fixture.counts.childEntries).toBe(1);
    expect(fixture.counts.catches).toBe(1);
    expect(fixture.counts.after).toBe(0);
    expect(fixture.counts.calculate).toBe(0);
    expect(fixture.counts.effect).toBe(0);
    expect(fixture.errors).toHaveLength(1);

    if (kind === 'throw') expect(fixture.errors[0]).toBe(failure);
    if (kind === 'bad-return') expect(String(fixture.errors[0])).toMatch(/반환값/);
    if (kind === 'state') expect(String(fixture.errors[0])).toMatch(/useState/);
    if (kind === 'memo') expect(String(fixture.errors[0])).toMatch(/useMemo/);
    if (kind === 'effect') expect(String(fixture.errors[0])).toMatch(/useEffect/);

    expect(fixture.container.textContent).toBe(kind === 'memo' ? 'AB' : 'AM:A');
    expectOutsideHooksRejected();

    fixture.setFirst('A2');
    await flushUpdates();

    if (kind === 'memo') {
      // 첫 갱신의 중간 화면과 시점을 확인한 뒤 두 번째 State를 갱신한다.
      expect(fixture.container.textContent).toBe('A2B');
      expect(fixture.counts.childEntries).toBe(2);
      expect(fixture.counts.catches).toBe(2);
      expect(fixture.counts.calculate).toBe(0);
      expect(fixture.counts.effect).toBe(0);
      expectOutsideHooksRejected();

      fixture.setSecond('B2');
      await flushUpdates();
      expect(fixture.container.textContent).toBe('A2B2');
    } else {
      expect(fixture.container.textContent).toBe('A2M:A2');
    }

    const expectedRenders = kind === 'memo' ? 3 : 2;
    expect(fixture.counts.childEntries).toBe(expectedRenders);
    expect(fixture.counts.catches).toBe(expectedRenders);
    expect(fixture.counts.after).toBe(0);
    expect(fixture.counts.calculate).toBe(0);
    expect(fixture.counts.effect).toBe(0);
    expect(
      fixture.setterRefs.every((refs) => refs.first === fixture.setterRefs[0]?.first)
    ).toBe(true);

    if (kind === 'memo') {
      expect(
        fixture.setterRefs.every((refs) => refs.second === fixture.setterRefs[0]?.second)
      ).toBe(true);
    }

    expectOutsideHooksRejected();
  });

  type GetterKind = 'state' | 'memo' | 'effect';

  function startGetterFixture(kind: GetterKind) {
    const errors: unknown[] = [];
    const counts = {
      renders: 0,
      getterEntries: 0,
      catches: 0,
      after: 0,
      calculate: 0,
      effect: 0
    };
    const setterRefs: Array<{ first: unknown; second?: unknown }> = [];
    let setFirstOutside: ((next: string) => void) | null = null;
    let setSecondOutside: ((next: string) => void) | null = null;

    function Child(_props: unknown): unknown {
      const paragraph = h('p', {}, 'A');
      const values: unknown[] = [paragraph];

      Object.defineProperty(values, 0, {
        enumerable: true,
        configurable: true,
        get() {
          counts.getterEntries += 1;

          if (kind === 'state') {
            useState(0);
          } else if (kind === 'memo') {
            useMemo(() => {
              counts.calculate += 1;
              return 1;
            }, []);
          } else {
            useEffect(() => {
              counts.effect += 1;
            }, []);
          }

          counts.after += 1;
          return paragraph;
        }
      });

      return values;
    }

    function App(): VNode {
      counts.renders += 1;
      const [first, setFirst] = useState('A');
      setFirstOutside = setFirst;

      try {
        h(Child, {});
      } catch (error) {
        errors.push(error);
        counts.catches += 1;
      }

      if (kind === 'memo') {
        const [second, setSecond] = useState('B');
        setSecondOutside = setSecond;
        setterRefs.push({ first: setFirst, second: setSecond });

        return h(
          'section',
          {},
          h('span', {}, first),
          h('span', {}, second)
        );
      }

      const memo = useMemo(() => `M:${first}`, [first]);
      setterRefs.push({ first: setFirst });

      return h('section', {}, h('span', {}, first), h('span', {}, memo));
    }

    const container = createContainer();
    startApp(App, container);

    return {
      container,
      errors,
      counts,
      setterRefs,
      setFirst: (next: string) => setFirstOutside!(next),
      setSecond: (next: string) => setSecondOutside!(next)
    };
  }

  it.each(['state', 'memo', 'effect'] as const)(
    '반환 정규화 getter의 %s도 차단되고 루트 Hook은 재사용된다',
    async (kind) => {
      const fixture = startGetterFixture(kind);

      expect(fixture.counts.getterEntries).toBe(1);
      expect(fixture.counts.catches).toBe(1);
      expect(fixture.counts.after).toBe(0);
      expect(fixture.counts.calculate).toBe(0);
      expect(fixture.counts.effect).toBe(0);
      expect(fixture.errors).toHaveLength(1);
      const hookName =
        kind === 'state' ? 'useState' : kind === 'memo' ? 'useMemo' : 'useEffect';
      expect(String(fixture.errors[0])).toMatch(new RegExp(hookName));
      expect(fixture.container.textContent).toBe(kind === 'memo' ? 'AB' : 'AM:A');
      expectOutsideHooksRejected();

      fixture.setFirst('A2');
      await flushUpdates();

      expect(fixture.container.textContent).toBe(kind === 'memo' ? 'A2B' : 'A2M:A2');
      expect(fixture.counts.getterEntries).toBe(2);
      expect(fixture.counts.catches).toBe(2);
      expect(fixture.counts.after).toBe(0);
      expectOutcomeCounts(fixture.counts);
      expect(
        fixture.setterRefs.every((refs) => refs.first === fixture.setterRefs[0]?.first)
      ).toBe(true);
      expectOutsideHooksRejected();

      if (kind === 'memo') {
        // useMemo 오용 입력도 일반 오류 fixture처럼 두 번째 State까지 갱신한다.
        fixture.setSecond('B2');
        await flushUpdates();

        expect(fixture.container.textContent).toBe('A2B2');
        expect(fixture.counts.getterEntries).toBe(3);
        expect(fixture.counts.catches).toBe(3);
        expect(fixture.counts.after).toBe(0);
        expectOutcomeCounts(fixture.counts);
        expect(
          fixture.setterRefs.every(
            (refs) => refs.second === fixture.setterRefs[0]?.second
          )
        ).toBe(true);
        expectOutsideHooksRejected();
      }
    }
  );

  function expectOutcomeCounts(counts: {
    calculate: number;
    effect: number;
  }): void {
    expect(counts.calculate).toBe(0);
    expect(counts.effect).toBe(0);
  }
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

describe('EFF-01 deps 생략은 매 render 실행과 매번 cleanup을 뜻한다', () => {
  it('화면이 바뀔 때마다 이전 cleanup 뒤에 다시 실행된다', async () => {
    const log: string[] = [];
    let renders = 0;

    function App() {
      const [label, setLabel] = useState('A');
      renders += 1;
      const renderNumber = renders;

      useEffect(() => {
        log.push(`run${renderNumber}`);
        return () => {
          log.push(`cleanup${renderNumber}`);
        };
      });

      return h(
        'div',
        {},
        h('span', {}, label),
        h('button', { onClick: () => setLabel('B') }, 'next')
      );
    }

    const container = createContainer();
    startApp(App, container);
    expect(log).toEqual(['run1']);

    buttonByText(container, 'next').click();
    await flushUpdates();

    expect(textNodes(container)).toEqual(['B']);
    expect(log).toEqual(['run1', 'cleanup1', 'run2']);
  });
});

describe('EFF-01 여러 효과는 호출 순서대로 각각 cleanup 후 새 효과를 실행한다', () => {
  it('첫 효과의 cleanup과 실행이 끝난 뒤 두 번째 효과를 처리한다', async () => {
    const log: string[] = [];

    function App() {
      const [count, setCount] = useState(0);

      useEffect(() => {
        log.push(`first-run${count}`);
        return () => {
          log.push(`first-cleanup${count}`);
        };
      }, [count]);

      useEffect(() => {
        log.push(`second-run${count}`);
        return () => {
          log.push(`second-cleanup${count}`);
        };
      }, [count]);

      return h('div', {}, h('button', { onClick: () => setCount(count + 1) }, 'inc'));
    }

    const container = createContainer();
    startApp(App, container);
    expect(log).toEqual(['first-run0', 'second-run0']);

    buttonByText(container, 'inc').click();
    await flushUpdates();

    expect(log).toEqual([
      'first-run0',
      'second-run0',
      'first-cleanup0',
      'first-run1',
      'second-cleanup0',
      'second-run1'
    ]);
  });
});

describe('EFF-01 useEffect deps는 배열이거나 생략해야 한다', () => {
  it.each([null, 0, 'count', { length: 1 }])(
    'deps가 배열이 아니면 오류다: %s',
    (deps) => {
      let rendered = false;

      function App() {
        useEffect(() => {}, deps as unknown as unknown[]);
        rendered = true;
        return h('div', {}, 'ok');
      }

      const container = createContainer();
      expect(() => startApp(App, container)).toThrow(/deps/);
      expect(rendered).toBe(false);
      expect(container.textContent).toBe('');
    }
  );
});

describe('EFF-01 useEffect의 반환값은 cleanup 함수 또는 undefined여야 한다', () => {
  it('async effect가 돌려주는 Promise는 등록 시점에 오류다', () => {
    function App() {
      const asyncEffect = (async () => {}) as unknown as () => void;
      useEffect(asyncEffect, []);
      return h('div', {}, 'ok');
    }

    const container = createContainer();
    expect(() => startApp(App, container)).toThrow(/cleanup/);
  });

  it('숫자 반환은 오류다', () => {
    function App() {
      const numberEffect = (() => 1) as unknown as () => void;
      useEffect(numberEffect, []);
      return h('div', {}, 'ok');
    }

    const container = createContainer();
    expect(() => startApp(App, container)).toThrow(/cleanup/);
  });

  it('효과 오류 뒤에 남은 효과는 실행하지 않는다', () => {
    let secondRuns = 0;

    function App() {
      const numberEffect = (() => 1) as unknown as () => void;
      useEffect(numberEffect, []);
      useEffect(() => {
        secondRuns += 1;
      }, []);

      return h('div', {}, 'ok');
    }

    const container = createContainer();
    expect(() => startApp(App, container)).toThrow(/cleanup/);
    expect(secondRuns).toBe(0);
  });
});

describe('EFF-01 화면 변경이 없어도 효과 판단은 생략하지 않는다', () => {
  it('고정된 화면에서 deps만 바뀌면 cleanup과 실행이 이어진다', async () => {
    const log: string[] = [];

    function App() {
      const [count, setCount] = useState(0);

      useEffect(() => {
        log.push(`run${count}`);
        return () => {
          log.push(`cleanup${count}`);
        };
      }, [count]);

      return h('div', {}, h('button', { onClick: () => setCount(count + 1) }, 'fixed'));
    }

    const container = createContainer();
    startApp(App, container);
    const button = buttonByText(container, 'fixed');

    button.click();
    await flushUpdates();

    expect(container.contains(button)).toBe(true);
    expect(container.textContent).toBe('fixed');
    expect(log).toEqual(['run0', 'cleanup0', 'run1']);
  });
});
