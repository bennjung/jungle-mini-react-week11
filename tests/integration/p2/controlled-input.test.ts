import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, startApp, useEffect, useState } from '../../../src/component';
import { applyPatch } from '../../../src/vdom/patch';
import {
  captureScheduledUpdates,
  createContainer,
  flushUpdates,
  resetBody
} from '../../helpers/p2';

vi.mock('../../../src/vdom/patch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/vdom/patch')>();
  return { ...actual, applyPatch: vi.fn(actual.applyPatch) };
});

const applyPatchMock = vi.mocked(applyPatch);
type TextControl = HTMLInputElement | HTMLTextAreaElement;
type Direction = 'forward' | 'backward' | 'none';
type SetValue = (value: string | ((previous: string) => string)) => void;

type EditorOptions = {
  initial?: string;
  normalize?: (raw: string) => string;
  tag?: 'input' | 'textarea';
  type?: string;
  controlled?: boolean;
  otherInput?: boolean;
  event?: 'onInput' | 'onChange';
  properties?: () => Record<string, unknown>;
  afterInput?: (input: TextControl, setValue: SetValue) => void;
};

/** 공개 startApp/h/Hook부터 실제 DOM까지 검증한다. 위치 계산을 테스트에 재구현하지 않는다. */
function mountEditor(options: EditorOptions = {}) {
  const container = createContainer();
  const effects: { value: string; start: number | null; end: number | null }[] = [];
  let renders = 0;
  let handlerCalls = 0;
  let setValue: SetValue = () => { throw new Error('App 시작 전입니다'); };
  let refresh: () => void = () => { throw new Error('App 시작 전입니다'); };
  let normalize = options.normalize ?? ((raw: string) => raw.replace(/\s/g, ''));

  function App() {
    renders += 1;
    const [value, updateValue] = useState(options.initial ?? '');
    const [, setTick] = useState(0);
    setValue = updateValue;
    refresh = () => setTick((tick) => tick + 1);
    const normalizeAtRender = normalize;

    useEffect(() => {
      const input = container.querySelector<TextControl>('[data-input]');
      if (input) {
        effects.push({ value: input.value, start: input.selectionStart, end: input.selectionEnd });
      }
    }, [value]);

    return h('section', {},
      h(options.tag ?? 'input', {
        'data-input': '',
        type: options.type ?? 'text',
        ...(options.controlled === false ? {} : { value }),
        ...options.properties?.(),
        [options.event ?? 'onInput']: (event: Event) => {
          handlerCalls += 1;
          const input = event.target as TextControl;
          updateValue(normalizeAtRender(input.value));
          options.afterInput?.(input, updateValue);
        }
      }),
      options.otherInput ? h('input', { 'data-other': '', value: 'untouched' }) : null,
      h('span', { 'data-state': '' }, value),
      h('button', { onClick: refresh }, 'refresh')
    );
  }

  startApp(App, container);
  const input = container.querySelector<TextControl>('[data-input]')!;
  return {
    container,
    input,
    effects,
    state: () => container.querySelector('[data-state]')!.textContent,
    renders: () => renders,
    handlerCalls: () => handlerCalls,
    setValue: (value: string) => setValue(value),
    refresh: () => refresh(),
    setNormalize: (next: (raw: string) => string) => { normalize = next; }
  };
}

/** 브라우저가 먼저 편집한 상태를 만든다. 엔진의 value 쓰기 측정 전에 호출한다. */
function prepareInput(
  input: TextControl,
  raw: string,
  start: number,
  end = start,
  direction: Direction = 'none'
) {
  input.focus();
  input.value = raw;
  input.setSelectionRange(start, end, direction);
}

function dispatchInput(input: TextControl, event = 'input') {
  input.dispatchEvent(new Event(event, { bubbles: true }));
}

function expectSelection(input: TextControl, start: number, end = start) {
  expect(input.selectionStart).toBe(start);
  expect(input.selectionEnd).toBe(end);
}

beforeEach(() => {
  resetBody();
  applyPatchMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetBody();
});

describe('INPUT State 변경과 실제 DOM 불일치를 독립적으로 검증한다', () => {
  const cases = [
    { id: 'INPUT-01a', initial: '', raw: ' ', at: 1, value: '', atAfter: 0, renderDelta: 0, writes: 1 },
    { id: 'INPUT-01b', initial: 'abc', raw: 'a bc', at: 2, value: 'abc', atAfter: 1, renderDelta: 0, writes: 1 },
    { id: 'INPUT-01c', initial: 'abc', raw: 'a xbc', at: 3, value: 'axbc', atAfter: 2, renderDelta: 1, writes: 1 },
    { id: 'INPUT-01d', initial: 'abc', raw: 'axbc', at: 2, value: 'axbc', atAfter: 2, renderDelta: 1, writes: 0 },
    { id: 'INPUT-01e', initial: 'abc', raw: 'abc', at: 1, value: 'abc', atAfter: 1, renderDelta: 0, writes: 0 }
  ];

  it.each(cases)('$id State·DOM·선택·재렌더·쓰기 횟수', async (testCase) => {
    const app = mountEditor({ initial: testCase.initial });
    prepareInput(app.input, testCase.raw, testCase.at);
    const write = vi.spyOn(app.input, 'value', 'set');
    const select = vi.spyOn(app.input, 'setSelectionRange');
    const renders = app.renders();
    const effects = app.effects.length;

    dispatchInput(app.input);
    await flushUpdates();

    expect(app.state()).toBe(testCase.value);
    expect(app.input.value).toBe(testCase.value);
    expectSelection(app.input, testCase.atAfter);
    expect(app.renders() - renders).toBe(testCase.renderDelta);
    expect(app.effects.length - effects).toBe(testCase.renderDelta);
    expect(app.container.querySelector('[data-input]')).toBe(app.input);
    expect(write).toHaveBeenCalledTimes(testCase.writes);
    if (testCase.writes === 0) expect(select).not.toHaveBeenCalled();
  });

  it('INPUT-02 이벤트 없는 같은 값 setter는 예약하지 않는다(HOOK-09)', async () => {
    const app = mountEditor({ initial: 'abc' });
    const queue = vi.spyOn(globalThis, 'queueMicrotask');
    app.setValue('abc');
    await flushUpdates();
    expect(queue).not.toHaveBeenCalled();
    expect(app.renders()).toBe(1);
    expect(app.effects).toHaveLength(1);
    expect(app.input.value).toBe('abc');
  });

  it('INPUT-03 같은 DOM의 최신 VDOM을 사용해 옛 값으로 되돌리지 않는다', async () => {
    const app = mountEditor({ initial: 'old' });
    app.setValue('new');
    await flushUpdates();
    const renders = app.renders();
    const effects = app.effects.length;
    prepareInput(app.input, 'n ew', 2);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.state()).toBe('new');
    expect(app.input.value).toBe('new');
    expectSelection(app.input, 1);
    expect(app.renders()).toBe(renders);
    expect(app.effects).toHaveLength(effects);
  });

  it('INPUT-04 연속 setter의 최종 값만 반영한다', async () => {
    const app = mountEditor({
      afterInput: (_input, setValue) => {
        setValue('intermediate');
        setValue('ab');
      }
    });
    prepareInput(app.input, 'a b', 2);
    const write = vi.spyOn(app.input, 'value', 'set');
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.state()).toBe('ab');
    expect(app.input.value).toBe('ab');
    expectSelection(app.input, 1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalledWith('intermediate');
  });

  it('INPUT-05 같은 task의 두 대상을 빠뜨리지 않는다', async () => {
    function App() {
      const [first, setFirst] = useState('ab');
      const [second, setSecond] = useState('xy');
      return h('section', {},
        h('input', { value: first, onInput: (event: Event) => setFirst((event.target as HTMLInputElement).value.replace(/\s/g, '')) }),
        h('input', { value: second, onInput: (event: Event) => setSecond((event.target as HTMLInputElement).value.replace(/\s/g, '')) }),
        h('span', {}, first + '/' + second)
      );
    }
    const container = createContainer();
    startApp(App, container);
    const [first, second] = [...container.querySelectorAll('input')] as [HTMLInputElement, HTMLInputElement];
    prepareInput(first, 'a b', 2);
    dispatchInput(first);
    prepareInput(second, 'x y', 2);
    dispatchInput(second);
    await flushUpdates();
    expect(first.value).toBe('ab');
    expect(second.value).toBe('xy');
    expect(container.querySelector('span')!.textContent).toBe('ab/xy');
    expectSelection(second, 1);
  });

  it('INPUT-06 같은 State 확인에서 대상 외 value를 읽거나 쓰지 않는다', async () => {
    const app = mountEditor({ initial: 'abc', otherInput: true });
    const other = app.container.querySelector<HTMLInputElement>('[data-other]')!;
    const read = vi.spyOn(other, 'value', 'get');
    const write = vi.spyOn(other, 'value', 'set');
    prepareInput(app.input, 'a bc', 2);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.input.value).toBe('abc');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('INPUT-07 다음 입력에 옛 대상 확인이나 위치를 넘기지 않는다', async () => {
    const app = mountEditor({ initial: 'abc' });
    prepareInput(app.input, 'a bc', 2);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.input.value).toBe('abc');
    expectSelection(app.input, 1);
    prepareInput(app.input, 'ab c', 3);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.state()).toBe('abc');
    expect(app.input.value).toBe('abc');
    expectSelection(app.input, 2);
    expect(app.container.querySelector('[data-input]')).toBe(app.input);
  });

  it('INPUT-08 재연결 후에도 최신 handler를 한 번만 실행한다', async () => {
    const app = mountEditor();
    prepareInput(app.input, 'a', 1);
    dispatchInput(app.input);
    await flushUpdates();
    app.setNormalize((raw) => raw.toUpperCase());
    app.refresh();
    await flushUpdates();
    prepareInput(app.input, 'ab', 1);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.handlerCalls()).toBe(2);
    expect(app.state()).toBe('AB');
    expect(app.input.value).toBe('AB');
  });

  it('INPUT-09 value 미지정 입력을 강제로 복원하지 않는다', async () => {
    const container = createContainer();
    let calls = 0;
    startApp(() => h('input', { onInput: () => { calls += 1; } }), container);
    const input = container.querySelector('input')!;
    prepareInput(input, 'a b', 2);
    const write = vi.spyOn(input, 'value', 'set');
    dispatchInput(input);
    await flushUpdates();
    expect(calls).toBe(1);
    expect(input.value).toBe('a b');
    expectSelection(input, 2);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    { id: 'INPUT-10', options: { event: 'onChange' as const }, event: 'change' },
    { id: 'INPUT-11', options: { tag: 'textarea' as const }, event: 'input' }
  ])('$id 같은 State 확인을 공통으로 처리한다', async ({ options, event }) => {
    const app = mountEditor({ initial: 'abc', ...options });
    prepareInput(app.input, 'a bc', 2);
    dispatchInput(app.input, event);
    await flushUpdates();
    expect(app.state()).toBe('abc');
    expect(app.input.value).toBe('abc');
    expectSelection(app.input, 1);
    expect(app.renders()).toBe(1);
    expect(app.effects).toHaveLength(1);
  });

  it('INPUT-12 값·선택을 각 한 번 반영하고 입력 이벤트를 재발행하지 않는다', async () => {
    const app = mountEditor();
    const listener = vi.fn();
    app.input.addEventListener('input', listener);
    prepareInput(app.input, 'a b', 2);
    const write = vi.spyOn(app.input, 'value', 'set');
    const select = vi.spyOn(app.input, 'setSelectionRange');
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.state()).toBe('ab');
    expect(app.input.value).toBe('ab');
    expectSelection(app.input, 1);
    expect(app.handlerCalls()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('INPUT-13 effect는 값·선택 반영이 끝난 DOM을 본다', async () => {
    const app = mountEditor();
    prepareInput(app.input, 'a b', 2);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.effects.at(-1)).toEqual({ value: 'ab', start: 1, end: 1 });
  });

  it('INPUT-14 서로 다른 앱의 대상·최신 값을 섞지 않는다', async () => {
    const first = mountEditor({ initial: 'abc' });
    const second = mountEditor({ initial: 'xyz' });
    prepareInput(first.input, 'a bc', 2);
    dispatchInput(first.input);
    prepareInput(second.input, 'x yz', 2);
    dispatchInput(second.input);
    await flushUpdates();
    expect(first.state()).toBe('abc');
    expect(first.input.value).toBe('abc');
    expect(second.state()).toBe('xyz');
    expect(second.input.value).toBe('xyz');
  });

  it.each([
    { id: 'INPUT-15a', property: 'checked' as const, expected: true },
    { id: 'INPUT-15b', property: 'indeterminate' as const, expected: false }
  ])('$id 지정 프로퍼티 $property도 같은 State에서 복원한다', async ({ property, expected }) => {
    const container = createContainer();
    let renders = 0;
    let effects = 0;
    function App() {
      renders += 1;
      const [value, setValue] = useState(expected);
      useEffect(() => { effects += 1; }, [value]);
      return h('section', {},
        h('input', { type: 'checkbox', [property]: value, onChange: () => setValue(expected) }),
        h('span', {}, String(value))
      );
    }
    startApp(App, container);
    const input = container.querySelector('input')!;
    input[property] = !expected;
    const select = vi.spyOn(input, 'setSelectionRange');
    dispatchInput(input, 'change');
    await flushUpdates();
    expect(input[property]).toBe(expected);
    expect(container.querySelector('span')!.textContent).toBe(String(expected));
    expect(renders).toBe(1);
    expect(effects).toBe(1);
    expect(select).not.toHaveBeenCalled();
  });

  it('INPUT-16 같은 State의 다중 선택도 기존 OPTION.selected 선언으로 복원한다', async () => {
    const container = createContainer();
    let renders = 0;
    let effects = 0;
    function App() {
      renders += 1;
      const [selected, setSelected] = useState(['a']);
      useEffect(() => { effects += 1; }, [selected]);
      return h('section', {},
        h('select', { multiple: true, onChange: () => setSelected((previous) => previous) },
          h('option', { value: 'a', selected: selected.includes('a') }, 'a'),
          h('option', { value: 'b', selected: selected.includes('b') }, 'b')
        ),
        h('span', {}, selected.join(','))
      );
    }
    startApp(App, container);
    const select = container.querySelector('select')!;
    const first = select.options[0]!;
    const second = select.options[1]!;
    first.selected = false;
    second.selected = true;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushUpdates();
    expect(first.selected).toBe(true);
    expect(second.selected).toBe(false);
    expect(select.options[0]).toBe(first);
    expect(select.options[1]).toBe(second);
    expect(container.querySelector('span')!.textContent).toBe('a');
    expect(renders).toBe(1);
    expect(effects).toBe(1);
  });
});

describe('CARET 변환 이름이 아니라 문자 대응으로 선택을 옮긴다', () => {
  const cases = [
    { id: 'CARET-01a', raw: 'aXbXXXXc', at: 3, desired: 'abc', atAfter: 2 },
    { id: 'CARET-01b', raw: '1234567', at: 4, desired: '1,234,567', atAfter: 5 },
    { id: 'CARET-01c', raw: '123', at: 1, desired: '1,23', atAfter: 1 },
    { id: 'CARET-01d', raw: '(', at: 1, desired: '()', atAfter: 1 },
    { id: 'CARET-01e', raw: 'abc', at: 1, desired: 'ABC', atAfter: 1 },
    { id: 'CARET-01f', raw: 'aßb', at: 2, desired: 'aSSb', atAfter: 3 },
    { id: 'CARET-01g', raw: '😀 a', at: 3, desired: '😀a', atAfter: 2 },
    { id: 'CARET-01h', raw: '👩‍💻 x', at: 6, desired: '👩‍💻x', atAfter: 5 },
    { id: 'CARET-01i', raw: 'e\u0301 x', at: 3, desired: 'e\u0301x', atAfter: 2 },
    { id: 'CARET-01j', raw: 'abc', at: 2, desired: '', atAfter: 0 }
  ];

  it.each(cases)('$id $raw → $desired', async ({ raw, at, desired, atAfter }) => {
    const app = mountEditor({ normalize: () => desired });
    prepareInput(app.input, raw, at);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.state()).toBe(desired);
    expect(app.input.value).toBe(desired);
    expectSelection(app.input, atAfter);
    expect(app.container.querySelector('[data-input]')).toBe(app.input);
  });

  it.each(['forward', 'backward'] as const)('CARET-02 선택 양 끝과 방향 %s 유지', async (direction) => {
    const app = mountEditor();
    prepareInput(app.input, 'a b c', 2, 4, direction);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.input.value).toBe('abc');
    expectSelection(app.input, 1, 2);
    expect(app.input.selectionDirection).toBe(direction);
  });

  it('CARET-03 선택 시작도 삽입 문자 앞으로 대응한다', async () => {
    const app = mountEditor({ normalize: () => 'ab-cdef' });
    prepareInput(app.input, 'abcdef', 2, 4, 'backward');
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.input.value).toBe('ab-cdef');
    expectSelection(app.input, 2, 5);
    expect(app.input.selectionDirection).toBe('backward');
  });

  it('CARET-04 handler가 바꾼 쓰기 직전의 선택을 사용한다', async () => {
    const app = mountEditor({ afterInput: (input) => input.setSelectionRange(0, 0) });
    prepareInput(app.input, 'a bc', 2);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.input.value).toBe('abc');
    expectSelection(app.input, 0);
  });

  it.each([
    { raw: 'aab', desired: 'ab', at: 1 },
    { raw: 'abc', desired: 'bca', at: 1 },
    { raw: 'abc', desired: 'xy', at: 1 },
    { raw: 'ab', desired: '👩‍💻', at: 1 }
  ])('CARET-05 모호한 $raw → $desired 결과도 결정적이고 유효한 문자 경계', async ({ raw, desired, at }) => {
    const results: number[] = [];
    for (let repeat = 0; repeat < 2; repeat += 1) {
      const app = mountEditor({ normalize: () => desired });
      prepareInput(app.input, raw, at);
      dispatchInput(app.input);
      await flushUpdates();
      expect(app.state()).toBe(desired);
      expect(app.input.value).toBe(desired);
      const start = app.input.selectionStart!;
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThanOrEqual(desired.length);
      expect(app.input.selectionEnd).toBe(start);
      // 이 입력군의 표시 문자 경계를 명시한다. 구현의 위치 계산을 테스트에서 재현하지 않는다.
      const boundaries = desired === '👩‍💻' ? [0, 5] : Array.from({ length: desired.length + 1 }, (_, index) => index);
      expect(boundaries).toContain(start);
      results.push(start);
    }
    expect(results[0]).toBe(results[1]);
  });
});

describe('SELECT 선언한 선택을 자동 계산보다 우선한다', () => {
  it('SELECT-01 초기 위치를 속성이 아니라 선택 영역으로 반영한다', () => {
    const app = mountEditor({ initial: 'abcdef', properties: () => ({ selectionStart: 2, selectionEnd: 2 }) });
    expectSelection(app.input, 2);
    expect(app.input.hasAttribute('selectionStart')).toBe(false);
    expect(app.input.hasAttribute('selectionEnd')).toBe(false);
  });

  it('SELECT-02 명시적 위치를 최종 위치로 한 번만 적용한다', async () => {
    const app = mountEditor({ initial: 'abc', properties: () => ({ selectionStart: 1, selectionEnd: 1 }) });
    prepareInput(app.input, 'a xbc', 3);
    const select = vi.spyOn(app.input, 'setSelectionRange');
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.state()).toBe('axbc');
    expect(app.input.value).toBe('axbc');
    expectSelection(app.input, 1);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('SELECT-03 value가 같아도 위치 지정 변경을 반영한다', async () => {
    let position = 1;
    const app = mountEditor({ initial: 'abcdef', properties: () => ({ selectionStart: position, selectionEnd: position }) });
    const write = vi.spyOn(app.input, 'value', 'set');
    position = 3;
    app.container.querySelector('button')!.click();
    await flushUpdates();
    expect(app.input.value).toBe('abcdef');
    expectSelection(app.input, 3);
    expect(write).not.toHaveBeenCalled();
  });

  it('SELECT-04 새 값을 쓴 다음 위치를 적용한다', async () => {
    let position = 0;
    const app = mountEditor({ initial: 'abc', properties: () => ({ selectionStart: position, selectionEnd: position }) });
    position = 1;
    app.setValue('xy');
    await flushUpdates();
    expect(app.input.value).toBe('xy');
    expectSelection(app.input, 1);
  });

  it('SELECT-05 범위와 역방향을 명시한다', () => {
    const app = mountEditor({
      initial: 'abcdef',
      properties: () => ({ selectionStart: 1, selectionEnd: 4, selectionDirection: 'backward' })
    });
    expectSelection(app.input, 1, 4);
    expect(app.input.selectionDirection).toBe('backward');
  });

  it('SELECT-06 지정 위치를 실제 문자열 범위로 제한한다', () => {
    const app = mountEditor({ initial: 'abc', properties: () => ({ selectionStart: -2, selectionEnd: 99 }) });
    expectSelection(app.input, 0, 3);
  });

  it('SELECT-07 지정을 생략하면 과거 위치 지정을 남기지 않는다', async () => {
    let explicit = true;
    const app = mountEditor({ initial: 'abc', properties: () => explicit ? { selectionStart: 0, selectionEnd: 0 } : {} });
    explicit = false;
    app.container.querySelector('button')!.click();
    await flushUpdates();
    prepareInput(app.input, 'a xbc', 3);
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.input.value).toBe('axbc');
    expectSelection(app.input, 2);
  });

  it('SELECT-08 클래스만 바뀌면 과거 선택 지정을 재적용하지 않는다', async () => {
    let className = 'first';
    const app = mountEditor({
      initial: 'abcdef',
      properties: () => ({ className, selectionStart: 1, selectionEnd: 1 })
    });
    prepareInput(app.input, 'abcdef', 4);
    const write = vi.spyOn(app.input, 'value', 'set');
    const select = vi.spyOn(app.input, 'setSelectionRange');
    className = 'second';
    app.refresh();
    await flushUpdates();
    expect(app.input.className).toBe('second');
    expectSelection(app.input, 4);
    expect(write).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });
});

describe('GUARD 안전성과 실패 후 처리', () => {
  it('GUARD-01 선택 API 미지원이어도 값은 동기화한다', async () => {
    const app = mountEditor({ initial: 'abc', type: 'email' });
    app.input.focus();
    app.input.value = 'a bc';
    const select = vi.spyOn(app.input, 'setSelectionRange');
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.state()).toBe('abc');
    expect(app.input.value).toBe('abc');
    expect(app.input.selectionStart).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it.each([
    { id: 'GUARD-02a', raw: 'a bc', at: 2 },
    { id: 'GUARD-02b', raw: 'a xbc', at: 3 }
  ])('$id 조합 중인 입력을 State 변경 여부와 무관하게 덮어쓰지 않는다', async ({ raw, at }) => {
    const app = mountEditor({ initial: 'abc' });
    prepareInput(app.input, raw, at);
    const write = vi.spyOn(app.input, 'value', 'set');
    app.input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
    await flushUpdates();
    expect(app.input.value).toBe(raw);
    expectSelection(app.input, at);
    expect(write).not.toHaveBeenCalled();
  });

  it('GUARD-03 조합 종료 후 비조합 input에서 동기화를 재개한다', async () => {
    const app = mountEditor({ initial: 'abc' });
    prepareInput(app.input, 'a bc', 2);
    app.input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    await flushUpdates();
    app.input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    app.input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: false }));
    await flushUpdates();
    expect(app.input.value).toBe('abc');
    expectSelection(app.input, 1);
  });

  it('GUARD-04 포커스 이동 후 옛 입력의 선택을 복원하지 않는다', async () => {
    const other = document.createElement('input');
    document.body.appendChild(other);
    const app = mountEditor({ initial: 'abc', afterInput: () => other.focus() });
    prepareInput(app.input, 'a bc', 2);
    const select = vi.spyOn(app.input, 'setSelectionRange');
    dispatchInput(app.input);
    await flushUpdates();
    expect(app.input.value).toBe('abc');
    expect(document.activeElement).toBe(other);
    expect(select).not.toHaveBeenCalled();
  });

  it.each(['remove', 'replace'] as const)('GUARD-05/06 %s된 옛 대상에는 쓰지 않는다', async (action) => {
    const container = createContainer();
    function App() {
      const [value, setValue] = useState('ab');
      const [changed, setChanged] = useState(false);
      return h('section', {},
        action === 'remove' && changed ? null : h('input', {
          key: changed ? 'new' : 'old', value,
          onInput: (event: Event) => {
            setValue((event.target as HTMLInputElement).value.replace(/\s/g, ''));
            setChanged(true);
          }
        })
      );
    }
    startApp(App, container);
    const oldInput = container.querySelector('input')!;
    prepareInput(oldInput, 'a b', 2);
    const write = vi.spyOn(oldInput, 'value', 'set');
    const select = vi.spyOn(oldInput, 'setSelectionRange');
    dispatchInput(oldInput);
    await flushUpdates();
    expect(oldInput.isConnected).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    if (action === 'replace') {
      expect(container.querySelector('input')!.value).toBe('ab');
      expect(container.querySelector('input')).not.toBe(oldInput);
    } else {
      expect(container.querySelector('input')).toBeNull();
    }
  });

  it('GUARD-07 handler 제거 후 옛 listener를 호출하지 않는다', async () => {
    let calls = 0;
    const container = createContainer();
    function App() {
      const [enabled, setEnabled] = useState(true);
      const [value, setValue] = useState('abc');
      return h('input', {
        value,
        ...(enabled ? {
          onInput: () => { calls += 1; setValue('abc'); setEnabled(false); }
        } : {})
      });
    }
    startApp(App, container);
    const input = container.querySelector('input')!;
    prepareInput(input, 'a bc', 2);
    dispatchInput(input);
    await flushUpdates();
    expect(calls).toBe(1);
    dispatchInput(input);
    await flushUpdates();
    expect(calls).toBe(1);
  });

  it('GUARD-08 render 실패 후 옛 대상을 뒤늦게 보정하지 않는다', () => {
    const container = createContainer();
    let effects = 0;
    function App() {
      const [bad, setBad] = useState(false);
      useEffect(() => { effects += 1; });
      if (bad) throw new Error('render-failure');
      return h('input', { value: 'abc', onInput: () => setBad(true) });
    }
    startApp(App, container);
    const input = container.querySelector('input')!;
    prepareInput(input, 'a bc', 2);
    const write = vi.spyOn(input, 'value', 'set');
    const select = vi.spyOn(input, 'setSelectionRange');
    const capture = captureScheduledUpdates();
    try {
      dispatchInput(input);
      expect(capture.scheduled.length).toBeGreaterThan(0);
      const errors: unknown[] = [];
      // 예약 함수의 추가 순서를 가정하지 않고, 실패 뒤 남은 확인 작업도 실행해 본다.
      while (capture.scheduled.length > 0) {
        try { capture.scheduled.shift()!(); } catch (error) { errors.push(error); }
      }
      expect(errors).toHaveLength(1);
      expect(errors[0]).toHaveProperty('message', 'render-failure');
      expect(container.querySelector('input')).toBe(input);
      expect(input.value).toBe('a bc');
      expect(write).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
      expect(effects).toBe(1);
    } finally {
      capture.restore();
    }
  });

  it('GUARD-09 Patch 실패 복원 후 옛 대상에 쓰지 않고 재시도한다', async () => {
    const app = mountEditor({ initial: 'abc' });
    prepareInput(app.input, 'a xbc', 3);
    const write = vi.spyOn(app.input, 'value', 'set');
    const effects = app.effects.length;
    const capture = captureScheduledUpdates();
    applyPatchMock.mockImplementationOnce(() => { throw new Error('patch-failure'); });
    try {
      dispatchInput(app.input);
      expect(capture.scheduled.length).toBeGreaterThan(0);
      const errors: unknown[] = [];
      while (capture.scheduled.length > 0) {
        try { capture.scheduled.shift()!(); } catch (error) { errors.push(error); }
      }
      expect(errors).toHaveLength(1);
      expect(errors[0]).toHaveProperty('message', 'patch-failure');
      expect(app.input.isConnected).toBe(false);
      expect(app.container.querySelector('input')!.value).toBe('abc');
      expect(app.state()).toBe('abc');
      expect(write).not.toHaveBeenCalled();
      expect(app.effects).toHaveLength(effects);
    } finally {
      capture.restore();
    }
    const restored = app.container.querySelector('input')!;
    prepareInput(restored, 'a xbc', 3);
    dispatchInput(restored);
    await flushUpdates();
    expect(app.state()).toBe('axbc');
    expect(restored.value).toBe('axbc');
  });
});
