/**
 * Phase 2 syncEvents 실패 후 DOM·VDOM 불일치 재현 데모.
 *
 * 이 페이지는 정상 사용에서 자연 발생하는 오류를 보여주는 페이지가 아니다.
 * 2단계로 넘어가는 갱신에서 [data-demo-target] 버튼 인스턴스의
 * addEventListener를 1회만 실패시킨다. 엔진 수정 없이 실제 update()의
 * applyPatch 성공 → syncEvents 실패 경로를 관찰하기 위한 최소 주입이다.
 */
import { h, startApp, useEffect, useState } from '../src/component';

const INJECTED_ERROR_NAME = 'DEMO_SYNC_EVENTS_BIND_FAILURE';

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: '1단계: 기준이 되는 최초 화면입니다. 모든 노드가 실제 DOM과 일치합니다.',
  2: '2단계: 카드에 전용 버튼과 data-demo-phase가 추가됩니다. 이 갱신의 syncEvents에서 주입 오류가 납니다.',
  3: '3단계: 1단계와 같은 구조로 돌아갑니다. 2단계 전용 노드는 사라져야 합니다.'
};

type ProbeRow = {
  label: string;
  expected: string;
  actual: string;
  match: boolean;
};

type InteractionProbe = {
  stage: number;
  actual: string;
};

type ArmedInjection = {
  error: Error;
  restore: () => void;
};

const appContainer = requireElement<HTMLElement>('#app');
const probeRows = requireElement<HTMLElement>('#probe-rows');
const probeVerdict = requireElement<HTMLElement>('#probe-verdict');
const probeTargetResult = requireElement<HTMLElement>('#probe-target-result');
const probeStaleResult = requireElement<HTMLElement>('#probe-stale-result');
const logElement = requireElement<HTMLElement>('#log');

const logLines: string[] = [];
const effectStages: number[] = [];

// 엔진 내부 currentVDOM을 노출하지 않기 위해, 검증 화면은 "마지막 render가
// 표현하려 한 단계 값"만 따로 기록한다. 실제 DOM 값은 updateProbe()가 읽는다.
let logicalStage = 1;
let activeInjectedError: Error | null = null;
let armedInjection: ArmedInjection | null = null;
let lastTargetProbe: InteractionProbe | null = null;
let lastStaleProbe: InteractionProbe | null = null;
let probeScheduled = false;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`${selector} 요소를 찾을 수 없습니다`);
  }
  return element;
}

function record(message: string): void {
  logLines.push(message);
  logElement.textContent = logLines.join('\n');
  logElement.scrollTop = logElement.scrollHeight;
  console.log(`[events-demo] ${message}`);
}

/**
 * 대상 DOM 인스턴스에만 own property로 1회 실패 래퍼를 심는다.
 * Element.prototype은 건드리지 않고, 첫 호출에서 즉시 원래 상태로 되돌린다.
 */
function armOneShotAddFailure(target: Element): void {
  disarmInjection();

  const error = new Error(
    `${INJECTED_ERROR_NAME}: [data-demo-target] addEventListener 1회 실패`
  );
  error.name = 'InjectedSyncEventsFailure';

  const descriptor =
    Object.getOwnPropertyDescriptor(target, 'addEventListener') ?? null;
  let restored = false;

  const restore = (): void => {
    if (restored) return;
    restored = true;

    if (descriptor === null) {
      Reflect.deleteProperty(target, 'addEventListener');
    } else {
      Object.defineProperty(target, 'addEventListener', descriptor);
    }

    if (armedInjection !== null && armedInjection.error === error) {
      armedInjection = null;
    }
  };

  Reflect.set(target, 'addEventListener', function (): never {
    record(
      '주입 발동: [data-demo-target].addEventListener 호출 1회 실패 → 즉시 원복'
    );
    restore();
    throw error;
  });

  activeInjectedError = error;
  armedInjection = { error, restore };
  record(
    '주입 예약: [data-demo-target] 인스턴스의 addEventListener 1회 실패 (Element.prototype 미변경)'
  );
}

/** update가 대상에 도달하기 전에 끝났다면 주입을 남기지 않는다. */
function disarmInjection(): void {
  const armed = armedInjection;
  if (armed === null) return;

  armed.restore();
  armedInjection = null;

  if (activeInjectedError === armed.error) {
    activeInjectedError = null;
    record('주입 미발동: addEventListener 호출 전에 원복했습니다.');
  }
}

window.addEventListener('error', (event: ErrorEvent) => {
  const error = event.error;
  const expected =
    activeInjectedError !== null &&
    (error === activeInjectedError ||
      event.message.includes(INJECTED_ERROR_NAME));
  const description =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : `${event.message}`;

  if (expected) {
    record(`예상 오류 포착(window error): ${description}`);
    activeInjectedError = null;
    // 이 데모가 주입한 오류만 브라우저 기본 보고에서 제외한다.
    event.preventDefault();
    scheduleProbe();
    return;
  }

  // 예상 밖 오류는 기록만 하고 preventDefault하지 않는다.
  record(`예상 밖 오류(숨기지 않음): ${description}`);
});

function scheduleProbe(): void {
  if (probeScheduled) return;

  probeScheduled = true;
  queueMicrotask(() => {
    probeScheduled = false;
    updateProbe();
  });
}

function createStat(
  label: string,
  value: string,
  hint: string,
  match: boolean
): HTMLElement {
  const article = document.createElement('article');
  article.className = 'stat';

  const labelElement = document.createElement('span');
  labelElement.className = 'stat__label';
  labelElement.textContent = label;

  const valueElement = document.createElement('strong');
  valueElement.className = 'stat__value';
  valueElement.textContent = value;
  if (!match) valueElement.style.color = 'var(--accent)';

  const hintElement = document.createElement('span');
  hintElement.className = 'stat__hint';
  hintElement.textContent = hint;

  article.append(labelElement, valueElement, hintElement);
  return article;
}

function updateProbe(): void {
  const expectedStage = logicalStage;
  const stageLabel =
    appContainer.querySelector('[data-demo-stage-label]')?.textContent ??
    '(없음)';
  const staleCount = appContainer.querySelectorAll('[data-demo-stale]').length;
  const phaseAttribute =
    appContainer
      .querySelector('[data-demo-card]')
      ?.getAttribute('data-demo-phase') ?? '(없음)';

  const expectedLabel = `${expectedStage}단계`;
  const expectedStaleCount = expectedStage === 2 ? 1 : 0;
  const expectedPhase = expectedStage === 2 ? '2' : '(없음)';
  const effectRan = effectStages.includes(expectedStage);

  const rows: ProbeRow[] = [
    {
      label: '단계 라벨',
      expected: expectedLabel,
      actual: stageLabel,
      match: stageLabel === expectedLabel
    },
    {
      label: '2단계 전용 노드 수',
      expected: String(expectedStaleCount),
      actual: String(staleCount),
      match: staleCount === expectedStaleCount
    },
    {
      label: '카드 data-demo-phase',
      expected: expectedPhase,
      actual: phaseAttribute,
      match: phaseAttribute === expectedPhase
    },
    {
      label: 'stage effect',
      expected: `stage ${expectedStage} 실행됨`,
      actual: effectRan ? '실행됨' : '없음',
      match: effectRan
    }
  ];

  probeRows.replaceChildren(
    ...rows.map((row) =>
      createStat(
        row.label,
        row.actual,
        `기대: ${row.expected}`,
        row.match
      )
    )
  );

  const mismatches = rows.filter((row) => !row.match).map((row) => row.label);
  if (mismatches.length === 0) {
    probeVerdict.textContent = `일치: ${expectedStage}단계가 요청한 구조와 실제 DOM이 같습니다.`;
    probeVerdict.style.color = '';
  } else {
    probeVerdict.textContent =
      `불일치 ${mismatches.length}개: ${mismatches.join(', ')}. ` +
      '이전 VDOM 기준 비교가 실제 DOM과 어긋났다는 관찰 증거입니다.';
    probeVerdict.style.color = 'var(--accent)';
  }

  renderInteractionProbes();
}

function renderInteractionProbes(): void {
  if (lastTargetProbe === null) {
    probeTargetResult.textContent =
      '이벤트 대상 클릭: 아직 실행하지 않았습니다.';
  } else {
    const expected = `${lastTargetProbe.stage}단계 handler 기록`;
    const match = lastTargetProbe.actual.includes(
      `${lastTargetProbe.stage}단계`
    );
    probeTargetResult.textContent =
      `이벤트 대상 클릭 — 기대: ${expected} / 실제: ${lastTargetProbe.actual}`;
    probeTargetResult.style.color = match ? '' : 'var(--accent)';
  }

  if (lastStaleProbe === null) {
    probeStaleResult.textContent =
      '2단계 전용 버튼 클릭: 아직 실행하지 않았습니다.';
  } else {
    const expected =
      lastStaleProbe.stage === 2
        ? 'stale handler 실행: 2단계'
        : '기록 없음 (3단계에는 노드가 없음)';
    const match =
      lastStaleProbe.stage === 2
        ? lastStaleProbe.actual.includes('stale handler')
        : !lastStaleProbe.actual.includes('stale handler');
    probeStaleResult.textContent =
      `2단계 전용 버튼 클릭 — 기대: ${expected} / 실제: ${lastStaleProbe.actual}`;
    probeStaleResult.style.color = match ? '' : 'var(--accent)';
  }
}

function resetInteractionProbes(): void {
  lastTargetProbe = null;
  lastStaleProbe = null;
  probeTargetResult.style.color = '';
  probeStaleResult.style.color = '';
}

requireElement<HTMLButtonElement>('#probe-dom').addEventListener('click', () => {
  updateProbe();
});

requireElement<HTMLButtonElement>('#probe-target').addEventListener(
  'click',
  () => {
    const before = logLines.length;
    appContainer
      .querySelector<HTMLButtonElement>('[data-demo-target]')
      ?.click();
    const actual =
      logLines.length > before
        ? logLines[logLines.length - 1] ?? '(로그 없음)'
        : '기록 없음 (handler 미연결)';

    lastTargetProbe = { stage: logicalStage, actual };
    updateProbe();
  }
);

requireElement<HTMLButtonElement>('#probe-stale').addEventListener(
  'click',
  () => {
    const before = logLines.length;
    const stale = appContainer.querySelector<HTMLButtonElement>(
      '[data-demo-stale]'
    );
    stale?.click();
    const actual =
      logLines.length > before
        ? logLines[logLines.length - 1] ?? '(로그 없음)'
        : stale === null
          ? '기록 없음 (버튼 없음)'
          : '기록 없음 (handler 미연결)';

    lastStaleProbe = { stage: logicalStage, actual };
    updateProbe();
  }
);

requireElement<HTMLButtonElement>('#reload').addEventListener('click', () => {
  window.location.reload();
});

function App() {
  const [stage, setStage] = useState(1);
  logicalStage = stage;

  useEffect(() => {
    effectStages.push(stage);
    record(`effect 실행: stage ${stage}`);
    document.title = `syncEvents 실패 데모 — ${stage}단계`;
  }, [stage]);

  const advance = (): void => {
    resetInteractionProbes();
    record('다음 단계 요청: setStage(prev => min(3, prev + 1))');
    setStage((prev) => Math.min(3, prev + 1));
    scheduleProbe();
  };

  const injectAndAdvance = (): void => {
    if (stage !== 1) return;

    const target = appContainer.querySelector<HTMLButtonElement>(
      '[data-demo-target]'
    );
    if (target === null) {
      record('주입 중단: [data-demo-target] 버튼을 찾지 못했습니다.');
      return;
    }

    resetInteractionProbes();
    armOneShotAddFailure(target);
    setStage(2);
    scheduleProbe();

    // 대상에 도달하지 못한 채 update가 끝난 경우에도 주입을 남기지 않는다.
    queueMicrotask(() => {
      if (armedInjection !== null) {
        disarmInjection();
        scheduleProbe();
      }
    });
  };

  const targetHandler = (): void => {
    record(`target handler 실행: ${stage}단계`);
    scheduleProbe();
  };

  const cardProps: Record<string, unknown> = {
    className: 'counter',
    'data-demo-card': ''
  };
  if (stage === 2) {
    cardProps['data-demo-phase'] = '2';
  }

  return h(
    'main',
    { className: 'app' },
    h(
      'header',
      { className: 'hero' },
      h('p', { className: 'eyebrow' }, 'Phase 2 — 실패 경계 재현'),
      h(
        'h1',
        { className: 'hero__title' },
        'syncEvents 실패 뒤에 남는 화면'
      ),
      h(
        'p',
        { className: 'hero__description' },
        '정상 사용에서 자연 발생하는 오류가 아닙니다. 2단계 갱신에서 이벤트 대상 버튼의 addEventListener를 1회만 실패시켜, applyPatch는 성공하고 syncEvents는 실패하는 경로를 관찰합니다.'
      )
    ),
    h(
      'section',
      { className: 'panel panel--counter' },
      h(
        'div',
        cardProps,
        h('p', { className: 'counter__label' }, '현재 단계'),
        h(
          'p',
          { className: 'counter__value', 'data-demo-stage-label': '' },
          `${stage}단계`
        ),
        h(
          'p',
          { className: 'counter__hint' },
          STAGE_DESCRIPTIONS[stage] ?? ''
        ),
        h(
          'button',
          {
            className: 'button',
            type: 'button',
            'data-demo-target': '',
            onClick: targetHandler
          },
          '이벤트 대상 버튼'
        ),
        stage === 2
          ? h(
              'button',
              {
                className: 'button',
                type: 'button',
                'data-demo-stale': '',
                onClick: () => {
                  record('stale handler 실행: 2단계');
                  scheduleProbe();
                }
              },
              '2단계 전용 버튼 (3단계에는 없어야 함)'
            )
          : null
      ),
      h(
        'div',
        { className: 'controls' },
        h(
          'div',
          { className: 'buttons' },
          h(
            'button',
            {
              className: 'button button--primary',
              type: 'button',
              onClick: advance
            },
            '다음 단계'
          ),
          h(
            'button',
            {
              className: 'button',
              type: 'button',
              'data-demo-inject': '',
              disabled: stage !== 1,
              onClick: injectAndAdvance
            },
            '2단계로 (syncEvents 실패 주입)'
          )
        ),
        h(
          'p',
          { className: 'counter__hint' },
          '정상 경로는 새로고침 후 "다음 단계"만 누르면 됩니다. 주입 경로는 2단계에서 실패한 뒤 "다음 단계"를 한 번 더 눌러 3단계로 진행합니다.'
        )
      )
    ),
    h(
      'section',
      { className: 'panel panel--notes' },
      h('h2', { className: 'panel__title' }, '재현 절차'),
      h(
        'ol',
        { className: 'notes' },
        h(
          'li',
          {},
          h('strong', {}, '1단계'),
          ' — 최초 VDOM과 실제 DOM이 같습니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '2단계 (주입)'),
          ' — applyPatch가 2단계 화면을 만든 뒤 syncEvents가 실패합니다. 이때 엔진의 currentVDOM은 1단계에 머뭅니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '3단계'),
          ' — 다음 갱신이 1단계 VDOM과 비교됩니다. 2단계에서 추가된 노드와 속성이 실제 DOM에 남습니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '검증'),
          ' — 아래 패널의 기대값과 실제 DOM 값을 비교하고, 2단계 전용 버튼이 3단계에서도 동작하는지 확인합니다.'
        )
      )
    ),
    h(
      'footer',
      { className: 'footer' },
      '주입은 대상 DOM 인스턴스의 addEventListener만 1회 대체하고 즉시 복원합니다. Element.prototype은 바꾸지 않습니다. 새로고침하면 1단계로 초기화됩니다.'
    )
  );
}

startApp(App, appContainer);
updateProbe();
