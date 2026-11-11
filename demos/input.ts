import { h, startApp, useEffect, useState } from '../src/component';

/**
 * demos/input.html 전용 검증 스크립트.
 *
 * 엔진 영역은 실제 h(), startApp(), useState()로 controlled input 두 개를 그린다.
 * 관찰 패널은 엔진 컨테이너 밖에 있으며, 엔진 이벤트 prop이 아니라
 * 앱 외부에서 직접 addEventListener로 붙인 리스너와 requestAnimationFrame
 * (백그라운드 탭 대비 타이머 포함) 읽기로만 갱신한다. 관찰 갱신은 setState를
 * 호출하지 않으므로 엔진 재렌더를 만들지 않는다.
 *
 * 이 페이지는 composition 이벤트를 자동 dispatch하지 않는다. 한글 조합은
 * 실제 IME로 사람이 입력해야 검증된다.
 */

const INITIAL_NORMAL = '가나다라마';
const INITIAL_TRANSFORM = 'hello world';

type EngineStateKey = 'normal' | 'transform';

type EngineSnapshot = {
  normal: string;
  transform: string;
  renders: number;
};

/** 엔진 커밋이 끝난 뒤 관찰 패널이 읽는 값. State setter가 아니므로 재렌더를 만들지 않는다. */
const engineSnapshot: EngineSnapshot = {
  normal: INITIAL_NORMAL,
  transform: INITIAL_TRANSFORM,
  renders: 0
};

/** 렌더 횟수 진단용. 관찰 표시가 아니라 엔진 영역 안의 텍스트로만 쓰인다. */
let engineRenderTick = 0;

function App() {
  const [normal, setNormal] = useState(INITIAL_NORMAL);
  const [transform, setTransform] = useState(INITIAL_TRANSFORM);

  engineRenderTick += 1;
  const renderCount = engineRenderTick;

  // 커밋 이후 값만 관찰 패널에 노출한다. 이 효과는 State를 바꾸지 않는다.
  useEffect(() => {
    engineSnapshot.normal = normal;
    engineSnapshot.transform = transform;
    engineSnapshot.renders = renderCount;
  }, [normal, transform, renderCount]);

  return h(
    'main',
    { className: 'app app--engine' },
    h(
      'header',
      { className: 'hero' },
      h('p', { className: 'eyebrow' }, 'demos/input.html — 엔진 영역'),
      h('h1', { className: 'hero__title' }, '입력 중 커서·한글 조합 보존'),
      h(
        'p',
        { className: 'hero__description' },
        '아래 두 입력은 실제 엔진의 h(), startApp(), useState()로 그린 controlled input입니다. ',
        '커서를 문자열 중간에 두고 입력하거나, 선택 영역을 교체하거나, 한글을 조합 입력해 보세요. ',
        '입력 후 페이지 아래의 "관찰 패널"과 "이벤트 로그"에서 값·커서·조합 이벤트를 확인할 수 있습니다. ',
        '실제 증상이 확인되기 전에는 보존된다고 단정하지 않습니다.'
      )
    ),
    h(
      'section',
      { className: 'panel' },
      h('h2', { className: 'panel__title' }, '1. 일반 controlled input — 값을 그대로 setState'),
      h(
        'p',
        { className: 'meta' },
        'onInput에서 target.value를 변환 없이 그대로 State에 넣습니다.'
      ),
      h(
        'label',
        { className: 'field' },
        h('span', { className: 'field__label' }, '일반 입력'),
        h('input', {
          id: 'engine-input-normal',
          className: 'field__input',
          type: 'text',
          value: normal,
          autocomplete: 'off',
          spellcheck: 'false',
          onInput: (event: Event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            setNormal(target.value);
          }
        })
      ),
      h('p', { className: 'meta meta--mono' }, `State 값: ${JSON.stringify(normal)}`)
    ),
    h(
      'section',
      { className: 'panel' },
      h('h2', { className: 'panel__title' }, '2. 값 변환 사례 — 대문자로 setState'),
      h(
        'p',
        { className: 'meta meta--warn' },
        '이 입력은 onInput에서 값을 변환합니다. 프레임워크가 값 반영 전후의 문자 대응으로 커서를 보정합니다. ',
        '반복 문자나 전체 치환에서는 사용자의 의도를 완벽히 복원하지 않으며, 정해진 기본 규칙을 따릅니다.'
      ),
      h(
        'label',
        { className: 'field' },
        h('span', { className: 'field__label' }, '대문자 변환 입력'),
        h('input', {
          id: 'engine-input-transform',
          className: 'field__input',
          type: 'text',
          value: transform,
          autocomplete: 'off',
          spellcheck: 'false',
          onInput: (event: Event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            setTransform(target.value.toUpperCase());
          }
        })
      ),
      h('p', { className: 'meta meta--mono' }, `State 값: ${JSON.stringify(transform)}`)
    ),
    h(
      'section',
      { className: 'panel' },
      h('h2', { className: 'panel__title' }, '확인 상태'),
      h(
        'ul',
        { className: 'notes' },
        h(
          'li',
          {},
          h('strong', {}, '일반 입력: '),
          '브라우저 자동 입력(insertText)으로 중간 삽입과 선택 영역 교체를 확인한 결과, value 재기록 없이 커서가 유지되었습니다. 로그의 "커서 점검"에 "value 유지 · selection 유지"로 나타납니다. 다만 이는 사람의 한글 IME 입력 검증이 아닙니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '한글 IME 조합: '),
          '미검증 — 실제 IME 조합 입력은 사람이 직접 수행해야 합니다. 자동으로 dispatch한 composition 이벤트는 실제 IME 재현으로 간주하지 않습니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '값 변환: '),
          '이 페이지의 초기값에서 변환 입력에 중간 삽입하면 value가 재기록되고 selection이 6에서 12로 이동하는 것을 확인했습니다. 이는 toUpperCase 변환의 결과이며, 엔진의 기본 입력 처리 오류로 주장하지 않습니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '관찰 패널: '),
          '표시 갱신과 관찰 대상 전환만으로는 엔진 렌더 횟수가 늘지 않았습니다. 관찰 코드는 setState를 호출하지 않습니다.'
        )
      ),
      h(
        'p',
        { className: 'meta' },
        '로그의 "커서 점검"은 input 이벤트 직후 값과 엔진 commit 이후 관찰 시점의 값을 비교한 결과입니다. 조합 중이면 보존 판정을 보류합니다.'
      )
    ),
    h('footer', { className: 'footer' }, `엔진 렌더 횟수: ${renderCount}`)
  );
}

/* ------------------------------------------------------------------ */
/* 관찰 전용 코드: 엔진 컨테이너 밖에서만 동작한다.                    */
/* ------------------------------------------------------------------ */

type ObserveKey = 'normal' | 'transform' | 'native';

type TrackedInput = {
  key: ObserveKey;
  label: string;
  input: HTMLInputElement;
  /** 엔진 input이면 해당 State 필드, 브라우저 기본 input이면 null. */
  stateKey: EngineStateKey | null;
};

type LogEntry = {
  time: string;
  target: string;
  type: string;
  detail: string;
};

type CaretCheck = {
  tracked: TrackedInput;
  value: string;
  start: number | null;
  end: number | null;
  composing: boolean;
};

const LOG_LIMIT = 40;

const trackedInputs: TrackedInput[] = [];
const logEntries: LogEntry[] = [];
const composingInputs = new WeakSet<HTMLInputElement>();
const lastInputComposing = new WeakMap<HTMLInputElement, boolean>();
const pendingChecks = new Map<ObserveKey, CaretCheck>();
const readoutCache = new Map<string, string>();

let checkFrame = 0;
let checkTimer = 0;
let readoutTimer = 0;

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`${selector} 요소를 찾을 수 없습니다`);
  }
  return element;
}

function requireInput(selector: string): HTMLInputElement {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`${selector} input을 찾을 수 없습니다`);
  }
  return element;
}

function requireSelect(selector: string): HTMLSelectElement {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`${selector} select를 찾을 수 없습니다`);
  }
  return element;
}

const targetSelect = requireSelect('#observe-target');
const roValue = requireElement('#ro-value');
const roState = requireElement('#ro-state');
const roSelection = requireElement('#ro-selection');
const roComposition = requireElement('#ro-composition');
const roActive = requireElement('#ro-active');
const roRenders = requireElement('#ro-renders');
const logList = requireElement('#event-log');

function formatTime(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function describeSelection(input: HTMLInputElement): string {
  if (input.selectionStart === null || input.selectionEnd === null) {
    return 'n/a (selectionStart 없음)';
  }

  const direction = input.selectionDirection ?? 'none';
  return `${input.selectionStart} / ${input.selectionEnd} / ${direction}`;
}

function describeElement(input: HTMLInputElement): string {
  return `value=${JSON.stringify(input.value)} selection=${describeSelection(input)}`;
}

function renderLog(): void {
  logList.replaceChildren(
    ...logEntries.map((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.time} · [${entry.target}] ${entry.type} · ${entry.detail}`;
      return item;
    })
  );
}

function pushLog(target: string, type: string, detail: string): void {
  logEntries.unshift({ time: formatTime(new Date()), target, type, detail });
  if (logEntries.length > LOG_LIMIT) {
    logEntries.length = LOG_LIMIT;
  }
  renderLog();
}

function track(
  key: ObserveKey,
  label: string,
  input: HTMLInputElement,
  stateKey: EngineStateKey | null
): void {
  const tracked: TrackedInput = { key, label, input, stateKey };
  trackedInputs.push(tracked);

  input.addEventListener('compositionstart', (event) => {
    composingInputs.add(input);
    pushLog(label, event.type, `data=${JSON.stringify(event.data)} ${describeElement(input)}`);
    scheduleReadoutSync();
  });

  input.addEventListener('compositionupdate', (event) => {
    pushLog(label, event.type, `data=${JSON.stringify(event.data)} ${describeElement(input)}`);
    scheduleReadoutSync();
  });

  input.addEventListener('compositionend', (event) => {
    composingInputs.delete(input);
    pushLog(label, event.type, `data=${JSON.stringify(event.data)} ${describeElement(input)}`);
    scheduleReadoutSync();
  });

  input.addEventListener('input', (event) => {
    const inputEvent = event as InputEvent;
    const isComposing = inputEvent.isComposing === true;
    const inputType =
      typeof inputEvent.inputType === 'string' && inputEvent.inputType !== ''
        ? inputEvent.inputType
        : 'n/a';

    lastInputComposing.set(input, isComposing);
    pushLog(
      label,
      'input',
      `isComposing=${isComposing} inputType=${inputType} ${describeElement(input)}`
    );

    scheduleCaretCheck(tracked, isComposing);
  });

  input.addEventListener('focus', scheduleReadoutSync);
  input.addEventListener('blur', scheduleReadoutSync);
}

/**
 * input 이벤트 시점의 값·선택을 기록하고, 엔진의 microtask 갱신이 끝난 다음
 * 프레임에서 다시 읽어 비교한다. 비교는 관찰일 뿐이며 DOM을 수정하지 않는다.
 * rAF는 백그라운드 탭에서 멈출 수 있으므로 타이머를 함께 두고, 먼저 온 쪽이
 * 한 번만 처리한다. 두 경로 모두 microtask 이후에 실행된다.
 */
function scheduleCaretCheck(tracked: TrackedInput, composing: boolean): void {
  pendingChecks.set(tracked.key, {
    tracked,
    value: tracked.input.value,
    start: tracked.input.selectionStart,
    end: tracked.input.selectionEnd,
    composing
  });

  if (checkFrame === 0) {
    checkFrame = requestAnimationFrame(flushCaretChecks);
  }

  if (checkTimer === 0) {
    checkTimer = window.setTimeout(flushCaretChecks, 50);
  }

  scheduleReadoutSync();
}

function flushCaretChecks(): void {
  if (checkFrame !== 0) {
    cancelAnimationFrame(checkFrame);
    checkFrame = 0;
  }

  if (checkTimer !== 0) {
    window.clearTimeout(checkTimer);
    checkTimer = 0;
  }

  const checks = Array.from(pendingChecks.values());
  pendingChecks.clear();

  for (const check of checks) {
    const input = check.tracked.input;
    const valueChanged = input.value !== check.value;

    const parts: string[] = [
      valueChanged
        ? `value 재기록 ${JSON.stringify(check.value)} → ${JSON.stringify(input.value)}`
        : 'value 유지'
    ];

    if (input.selectionStart !== check.start || input.selectionEnd !== check.end) {
      parts.push(
        `selection ${check.start}–${check.end} → ${input.selectionStart}–${input.selectionEnd}`
      );
    } else {
      parts.push('selection 유지');
    }

    if (check.composing || composingInputs.has(input)) {
      parts.push('조합 중이므로 보존 판정 보류');
    }

    pushLog(check.tracked.label, '커서 점검', parts.join(' · '));
  }

  syncReadout();
}

function selectedTracked(): TrackedInput | null {
  return trackedInputs.find((tracked) => tracked.key === targetSelect.value) ?? null;
}

function stateTextFor(tracked: TrackedInput): string {
  if (tracked.stateKey === 'normal') return JSON.stringify(engineSnapshot.normal);
  if (tracked.stateKey === 'transform') return JSON.stringify(engineSnapshot.transform);
  return '— (엔진 미사용)';
}

function describeActive(): string {
  const active = document.activeElement;
  if (active === null) return '없음';

  const tracked = trackedInputs.find((item) => item.input === active);
  if (tracked !== undefined) {
    return tracked.stateKey === null
      ? `${tracked.label} (엔진 미사용)`
      : `${tracked.label} (엔진 영역)`;
  }

  if (active instanceof HTMLInputElement) {
    return `다른 input${active.id === '' ? '' : `#${active.id}`}`;
  }

  return `${active.tagName.toLowerCase()}${active.id === '' ? '' : `#${active.id}`}`;
}

function setReadout(element: HTMLElement, key: string, text: string): void {
  if (readoutCache.get(key) === text) return;

  readoutCache.set(key, text);
  element.textContent = text;
}

/** 관찰 표시를 즉시 한 번 읽어 갱신한다. 읽기와 textContent 쓰기만 한다. */
function syncReadout(): void {
  const tracked = selectedTracked();

  if (tracked !== null) {
    const input = tracked.input;

    setReadout(roValue, 'value', JSON.stringify(input.value));
    setReadout(roState, 'state', stateTextFor(tracked));
    setReadout(roSelection, 'selection', describeSelection(input));
    setReadout(
      roComposition,
      'composition',
      composingInputs.has(input)
        ? '조합 중 (compositionstart 이후)'
        : `아니오 (마지막 input.isComposing=${lastInputComposing.get(input) ?? '기록 없음'})`
    );
  }

  setReadout(roActive, 'active', describeActive());
  setReadout(roRenders, 'renders', String(engineSnapshot.renders));
}

/** 엔진 commit 이후에 읽도록 다음 타이머로 미룬다. 표시 갱신은 State를 건드리지 않는다. */
function scheduleReadoutSync(): void {
  if (readoutTimer !== 0) return;

  readoutTimer = window.setTimeout(() => {
    readoutTimer = 0;
    syncReadout();
  }, 0);
}

/** 관찰 표시 갱신 루프. 탭이 보일 때 입력 중 변화를 계속 반영한다. */
function tick(): void {
  syncReadout();
  requestAnimationFrame(tick);
}

/* 엔진 마운트가 끝난 뒤에만 엔진 input이 DOM에 존재한다. */
const engineContainer = document.querySelector<HTMLElement>('#engine-root');

if (engineContainer === null) {
  throw new Error('#engine-root 컨테이너를 찾을 수 없습니다');
}

startApp(App, engineContainer);

track('normal', '엔진 일반 input', requireInput('#engine-input-normal'), 'normal');
track(
  'transform',
  '엔진 변환 input',
  requireInput('#engine-input-transform'),
  'transform'
);
track('native', '브라우저 기본 input', requireInput('#native-input'), null);

targetSelect.addEventListener('change', syncReadout);
document.addEventListener('selectionchange', scheduleReadoutSync);
document.addEventListener('visibilitychange', syncReadout);

requireElement('#clear-log').addEventListener('click', () => {
  logEntries.length = 0;
  renderLog();
});

requireElement('#reload').addEventListener('click', () => {
  window.location.reload();
});

requireElement('#select-range').addEventListener('click', () => {
  const tracked = selectedTracked();
  if (tracked === null) return;

  const input = tracked.input;
  input.focus();

  if (input.value.length < 4) {
    pushLog(tracked.label, '보조', '값이 4자 미만이라 2–4 선택을 건너뜀');
    return;
  }

  input.setSelectionRange(2, 4);
  pushLog(tracked.label, '보조', `2–4 선택 지정(값 변경 없음) ${describeElement(input)}`);
});

requestAnimationFrame(tick);
