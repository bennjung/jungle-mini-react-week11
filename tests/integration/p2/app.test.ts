import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, startApp, useEffect, useState } from '../../../src/component';
import { applyPatch } from '../../../src/vdom/patch';
import {
  buttonByText,
  createContainer,
  flushUpdates,
  resetBody,
  textNodes
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

describe('INIT-01 startApp이 컨테이너에 최초 화면을 만들고 event를 직접 연결한다', () => {
  it('버튼 클릭이 handler를 정확히 한 번 실행한다', () => {
    let calls = 0;

    function App() {
      return h('button', { onClick: () => { calls += 1; } }, '0');
    }

    const container = createContainer();
    startApp(App, container);

    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.textContent).toBe('0');

    buttonByText(container, '0').click();
    expect(calls).toBe(1);
  });
});

describe('INIT-02 최초 표시가 비교 기준을 준비해 같은 화면 갱신에서 DOM을 유지한다', () => {
  it('기존 자식을 교체하고, 같은 출력의 갱신에서 노드 객체를 유지한다', async () => {
    function App() {
      const [, setTick] = useState(0);
      return h(
        'section',
        {},
        h('p', {}, 'A'),
        h('button', { onClick: () => setTick((prev) => prev + 1) }, 'tick')
      );
    }

    const container = createContainer();
    const placeholder = document.createElement('em');
    container.appendChild(placeholder);

    startApp(App, container);

    expect(container.querySelector('em')).toBeNull();
    const section = container.querySelector('section')!;
    const paragraph = container.querySelector('p')!;
    const text = paragraph.firstChild!;

    buttonByText(container, 'tick').click();
    await flushUpdates();

    expect(container.querySelector('section')).toBe(section);
    expect(container.querySelector('p')).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
  });
});

describe('INIT-03 최초 표시 후 effect를 commit 뒤 실행한다', () => {
  it('effect 실행 시점에 이미 DOM이 존재한다', () => {
    const log: string[] = [];

    function App() {
      useEffect(() => {
        const container = document.body.lastElementChild;
        log.push(container?.querySelector('button') ? 'dom' : 'empty');
        log.push('effect');
      }, []);

      return h('button', {}, 'A');
    }

    startApp(App, createContainer());

    expect(log).toEqual(['dom', 'effect']);
  });
});

describe('INIT-04 startApp은 container를 검증하고 반복 시작을 막는다', () => {
  it('Element가 아니거나 이미 시작한 container는 오류다', () => {
    function App() {
      return h('p', {}, 'A');
    }

    expect(() => startApp(App, null as unknown as Element)).toThrow();
    expect(() => startApp(App, 'container' as unknown as Element)).toThrow();

    const container = createContainer();
    startApp(App, container);
    const paragraph = container.querySelector('p');

    expect(() => startApp(App, container)).toThrow();
    expect(container.querySelector('p')).toBe(paragraph);
  });

  it('반복 시작이 거부된 뒤에도 첫 앱의 handler가 계속 동작한다', () => {
    let calls = 0;

    function App() {
      return h('button', { onClick: () => { calls += 1; } }, 'A');
    }

    const container = createContainer();
    startApp(App, container);

    expect(() => startApp(App, container)).toThrow();

    buttonByText(container, 'A').click();
    expect(calls).toBe(1);
  });
});

describe('INIT-01 정적 앱에서 input·change가 각각 한 번 실행된다', () => {
  it('직접 연결한 handler가 이벤트마다 한 번씩 실행된다', () => {
    const calls: string[] = [];

    function App() {
      return h('input', {
        onInput: () => calls.push('input'),
        onChange: () => calls.push('change')
      });
    }

    const container = createContainer();
    startApp(App, container);

    const input = container.querySelector('input')!;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));

    expect(calls).toEqual(['input', 'change']);
  });
});

describe('컴포넌트 오류는 startApp 호출자에게 전파된다', () => {
  it('컴포넌트가 던진 오류가 그대로 전달되고 DOM은 만들어지지 않는다', () => {
    const failure = new Error('component failure');

    function App(): never {
      throw failure;
    }

    const container = createContainer();

    expect(() => startApp(App, container)).toThrow(failure);
    expect(container.childNodes).toHaveLength(0);
  });
});

describe('UPD-01 State 변경이 자동 재렌더와 필요한 Patch로 이어진다', () => {
  it('바뀐 텍스트만 반영하고 나머지 노드는 유지한다', async () => {
    function App() {
      const [count, setCount] = useState(0);

      return h(
        'section',
        {},
        h('p', {}, count),
        h('p', {}, '고정'),
        h('button', { onClick: () => setCount(count + 1) }, 'inc')
      );
    }

    const container = createContainer();
    startApp(App, container);

    const section = container.querySelector('section')!;
    const [first, second] = Array.from(container.querySelectorAll('p'));
    const firstText = first!.firstChild!;

    buttonByText(container, 'inc').click();
    await flushUpdates();

    expect(applyPatchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('section')).toBe(section);
    expect(container.querySelectorAll('p')[0]).toBe(first);
    expect(container.querySelectorAll('p')[1]).toBe(second);
    expect(first!.firstChild).toBe(firstText);
    expect(first!.textContent).toBe('1');
  });
});

describe('UPD-02 화면 데이터가 같으면 applyPatch를 호출하지 않는다', () => {
  it('재렌더는 실행되지만 DOM과 Patch는 그대로다', async () => {
    let renders = 0;

    function App() {
      renders += 1;
      const [, setTick] = useState(0);

      return h(
        'div',
        {},
        h('span', {}, '고정'),
        h('button', { onClick: () => setTick((prev) => prev + 1) }, 'tick')
      );
    }

    const container = createContainer();
    startApp(App, container);
    const span = container.querySelector('span');

    buttonByText(container, 'tick').click();
    await flushUpdates();

    expect(renders).toBe(2);
    expect(applyPatchMock).not.toHaveBeenCalled();
    expect(container.querySelector('span')).toBe(span);
  });
});

describe('UPD-03 화면이 같아도 handler가 바뀌면 새 handler가 실행된다', () => {
  it('텍스트는 그대로이고 클릭 결과만 바뀐다', async () => {
    const calls: string[] = [];

    function App() {
      const [mode, setMode] = useState('A');

      return h(
        'div',
        {},
        h('button', { onClick: () => calls.push(mode) }, '실행'),
        h('button', { onClick: () => setMode('B') }, 'switch')
      );
    }

    const container = createContainer();
    startApp(App, container);
    const run = buttonByText(container, '실행');

    buttonByText(container, 'switch').click();
    await flushUpdates();

    expect(applyPatchMock).not.toHaveBeenCalled();
    expect(buttonByText(container, '실행')).toBe(run);

    run.click();
    expect(calls).toEqual(['B']);
  });
});

describe('UPD-04 handler가 제거되면 이전 handler가 실행되지 않는다', () => {
  it('enabled가 false면 클릭이 아무 것도 실행하지 않는다', async () => {
    let calls = 0;

    function App() {
      const [enabled, setEnabled] = useState(true);

      return h(
        'div',
        {},
        h(
          'button',
          enabled ? { onClick: () => { calls += 1; } } : {},
          enabled ? '켜짐' : '꺼짐'
        ),
        h('button', { onClick: () => setEnabled(false) }, 'off')
      );
    }

    const container = createContainer();
    startApp(App, container);

    buttonByText(container, '켜짐').click();
    expect(calls).toBe(1);

    buttonByText(container, 'off').click();
    await flushUpdates();

    const disabled = buttonByText(container, '꺼짐');
    disabled.click();
    expect(calls).toBe(1);
  });
});

describe('UPD-05 effect 안 setter가 현재 처리 후 다음 갱신으로 이어진다', () => {
  it('effect가 끝난 뒤 render가 실행된다', async () => {
    const log: string[] = [];

    function App() {
      const [count, setCount] = useState(0);
      log.push(`render${count}`);

      useEffect(() => {
        log.push('effect-start');
        setCount((prev) => prev + 1);
        log.push('effect-end');
      }, []);

      return h('span', {}, count);
    }

    const container = createContainer();
    startApp(App, container);
    expect(log).toEqual(['render0', 'effect-start', 'effect-end']);

    await flushUpdates();

    expect(log).toEqual(['render0', 'effect-start', 'effect-end', 'render1']);
    expect(container.textContent).toBe('1');
  });
});

describe('UPD-06 연속 setter 호출 후 최종 State와 화면이 일치한다', () => {
  it('두 값이 모두 반영된 화면이 남는다', async () => {
    function App() {
      const [first, setFirst] = useState(0);
      const [second, setSecond] = useState(0);

      return h(
        'div',
        {},
        h('span', {}, `${first}:${second}`),
        h(
          'button',
          {
            onClick: () => {
              setFirst((prev) => prev + 1);
              setSecond((prev) => prev + 1);
            }
          },
          'both'
        )
      );
    }

    const container = createContainer();
    startApp(App, container);

    buttonByText(container, 'both').click();
    await flushUpdates();

    expect(textNodes(container)).toEqual(['1:1']);
  });
});

describe('FLOW-01 카운터에서 클릭·State·화면 반영이 자동으로 이어진다', () => {
  it('증가 3회와 감소 1회가 최종 2로 모인다', async () => {
    function App() {
      const [count, setCount] = useState(0);

      return h(
        'section',
        {},
        h('span', {}, count),
        h('button', { onClick: () => setCount((prev) => prev + 1) }, 'inc'),
        h('button', { onClick: () => setCount((prev) => prev - 1) }, 'dec')
      );
    }

    const container = createContainer();
    startApp(App, container);
    const section = container.querySelector('section');

    buttonByText(container, 'inc').click();
    await flushUpdates();
    buttonByText(container, 'inc').click();
    await flushUpdates();
    buttonByText(container, 'inc').click();
    await flushUpdates();
    buttonByText(container, 'dec').click();
    await flushUpdates();

    expect(container.querySelector('span')?.textContent).toBe('2');
    expect(container.querySelector('section')).toBe(section);
  });
});

describe('FLOW-03 입력 요소의 value·checked가 properties를 거쳐 화면에 반영된다', () => {
  it('초기 값과 갱신 값이 실제 DOM 프로퍼티에 적용된다', async () => {
    function App() {
      const [value, setValue] = useState('A');
      const [checked, setChecked] = useState(false);

      return h(
        'div',
        {},
        h('input', { value, checked }),
        h(
          'button',
          {
            onClick: () => {
              setValue('B');
              setChecked(true);
            }
          },
          'change'
        )
      );
    }

    const container = createContainer();
    startApp(App, container);

    const input = container.querySelector('input')!;
    expect(input.value).toBe('A');
    expect(input.checked).toBe(false);

    buttonByText(container, 'change').click();
    await flushUpdates();

    expect(container.querySelector('input')).toBe(input);
    expect(input.value).toBe('B');
    expect(input.checked).toBe(true);
  });
});

describe('FLOW-02 자식이 props만 사용하고 부모 State 변경이 자식에 반영된다', () => {
  it('자식 버튼 클릭이 부모 setter까지 연결된다', async () => {
    function Child({ count, onIncrease }: { count: number; onIncrease: () => void }) {
      return h('button', { onClick: onIncrease }, count);
    }

    function App() {
      const [count, setCount] = useState(0);

      return h(
        'div',
        {},
        Child({ count, onIncrease: () => setCount((prev) => prev + 1) })
      );
    }

    const container = createContainer();
    startApp(App, container);

    buttonByText(container, '0').click();
    await flushUpdates();
    buttonByText(container, '1').click();
    await flushUpdates();

    expect(container.textContent).toBe('2');
  });
});
