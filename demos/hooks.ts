/**
 * Phase 2 Hook 소유 경계 재현 데모.
 *
 * 이 페이지는 정상 사용 예제가 아니다. resc/phase2.md의
 * "Hook은 최상위 컴포넌트에서만 사용할 수 있다" 제약을 어겼을 때
 * 현재 엔진이 무엇을 막고, 무엇을 막지 못하는지 실제 실행 결과로 보여준다.
 *
 * A. h(Child, props) 경로: renderChild가 activeHookOwner를 null로 비우므로
 *    자식 본문의 Hook 호출은 requireHookOwner에서 거부된다.
 * B. Child(props) 직접 호출 경로: 엔진이 자동 감지하지 않으므로 자식 본문의
 *    useState가 루트 FunctionComponent의 슬롯을 소비한다.
 *
 * 두 경로는 각각 독립 컨테이너에서 실행한다. A의 실패가 B의 실행을 막지 않는다.
 */
import { h, startApp, useEffect, useMemo, useState } from '../src/component';
import type { VNode } from '../src/vdom/types';

type AttemptProbe = {
  entered: number;
  after: number;
  calculate: number;
  effect: number;
};

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** 기존 phase2.css의 stat 카드를 그대로 재사용한다. */
function stat(label: string, value: unknown, hint?: string): VNode {
  const children: unknown[] = [
    h('span', { className: 'stat__label' }, label),
    h('strong', { className: 'stat__value' }, value)
  ];

  if (hint !== undefined) {
    children.push(h('span', { className: 'stat__hint' }, hint));
  }

  return h('article', { className: 'stat' }, ...children);
}

// ---------------------------------------------------------------------------
// A. h(Child, props) — 엔진이 거부하는 경계
// ---------------------------------------------------------------------------

/**
 * 자식 본문 진입 횟수와 Hook 다음 문장 도달 횟수를 기록한다.
 * Hook 호출 뒤의 `after += 1`이 실행되지 않아야 "본문 진입 후 즉시 거부"를
 * 오류 문자열만이 아니라 실행 횟수로 확인할 수 있다.
 */
function createStateRejectChild(probe: AttemptProbe): () => VNode {
  return function StateRejectChild() {
    probe.entered += 1;
    const [value] = useState(0);
    probe.after += 1;
    return h('p', { className: 'stat__hint' }, `value=${value}`);
  };
}

function createMemoRejectChild(probe: AttemptProbe): () => VNode {
  return function MemoRejectChild() {
    probe.entered += 1;
    const value = useMemo(() => {
      probe.calculate += 1;
      return 42;
    }, []);
    probe.after += 1;
    return h('p', { className: 'stat__hint' }, `memo=${value}`);
  };
}

function createEffectRejectChild(probe: AttemptProbe): () => VNode {
  return function EffectRejectChild() {
    probe.entered += 1;
    useEffect(() => {
      probe.effect += 1;
    }, []);
    probe.after += 1;
    return h('p', { className: 'stat__hint' }, 'effect');
  };
}

/**
 * HOOK-10 사전 상태와 같은 순서다. 루트가 useState를 먼저 소비한 뒤
 * h(Child)로 자식 실행 경계에 들어간다.
 */
function makeRoot(child: () => VNode): () => VNode {
  return function HookBoundaryRoot() {
    const [rootValue] = useState('root');
    return h(
      'div',
      {},
      h('p', { className: 'stat__hint' }, `root state = ${rootValue}`),
      h(child)
    );
  };
}

type RejectCase = {
  label: string;
  createChild: (probe: AttemptProbe) => () => VNode;
  hookName: string;
};

function createResultRow(
  title: string,
  probe: AttemptProbe,
  errorMessage: string,
  childElementCount: number
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'stat';

  const label = document.createElement('span');
  label.className = 'stat__label';
  label.textContent = title;

  const message = document.createElement('strong');
  message.className = 'stat__value';
  message.textContent = errorMessage;

  const counts = document.createElement('span');
  counts.className = 'stat__hint';
  counts.textContent =
    `entered=${probe.entered}, after=${probe.after}, ` +
    `calculate=${probe.calculate}, effect=${probe.effect}`;

  const dom = document.createElement('span');
  dom.className = 'stat__hint';
  dom.textContent = `자식 컨테이너의 요소 수=${childElementCount} (기대: 0)`;

  row.append(label, message, counts, dom);
  return row;
}

function runRejectAttempts(host: HTMLElement): void {
  const cases: RejectCase[] = [
    {
      label: '자식이 useState(0)을 호출',
      createChild: createStateRejectChild,
      hookName: 'useState'
    },
    {
      label: '자식이 useMemo(() => 42, [])를 호출',
      createChild: createMemoRejectChild,
      hookName: 'useMemo'
    },
    {
      label: '자식이 useEffect(() => {...}, [])를 호출',
      createChild: createEffectRejectChild,
      hookName: 'useEffect'
    }
  ];

  for (const item of cases) {
    const probe: AttemptProbe = {
      entered: 0,
      after: 0,
      calculate: 0,
      effect: 0
    };

    // startApp은 컨테이너를 1회용으로 표시하므로 시도마다 새 호스트를 만든다.
    const appHost = document.createElement('div');
    let errorMessage = '오류 없음 (예상과 다름)';

    try {
      startApp(makeRoot(item.createChild(probe)), appHost);
    } catch (error) {
      errorMessage = readErrorMessage(error);
    }

    host.append(
      createResultRow(
        item.label,
        probe,
        errorMessage,
        appHost.childElementCount
      )
    );
  }

  // 실패한 렌더 뒤 전역 Hook 소유자가 해제되었는지 같은 화면에서 확인한다.
  const outside = document.createElement('p');
  outside.className = 'stat__hint';

  try {
    useState(0);
    outside.textContent = '렌더 밖 useState: 오류 없음 (예상과 다름)';
  } catch (error) {
    outside.textContent = `렌더 밖 useState: ${readErrorMessage(error)}`;
  }

  host.append(outside);
}

// ---------------------------------------------------------------------------
// B. Child(props) 직접 호출 — 엔진이 감지하지 못하는 금지된 사용
// ---------------------------------------------------------------------------

/**
 * 요구사항 위반 대상. 이 함수는 컴포넌트로 작성되었지만 아래 DirectCallRoot가
 * h()를 거치지 않고 `DirectInvocationChild({...})`로 직접 호출한다.
 * 그래서 이 함수의 useState 두 개는 루트 FunctionComponent의 슬롯을 소비한다.
 */
function DirectInvocationChild({ position }: { position: string }): VNode {
  const [childValue, setChildValue] = useState('CHILD-초기');
  const [childCount, setChildCount] = useState(0);

  return h(
    'div',
    { className: 'controls' },
    h('p', { className: 'eyebrow' }, `직접 호출된 Child 본문 (${position})`),
    stat('Child가 읽은 값', childValue, '기대: CHILD-초기'),
    stat('Child가 읽은 count', childCount, '기대: 0'),
    h(
      'div',
      { className: 'buttons' },
      h(
        'button',
        {
          type: 'button',
          className: 'button',
          onClick: () => setChildValue((prev) => `${prev}+child`)
        },
        'Child setter (값)'
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'button',
          onClick: () => setChildCount((prev) => prev + 1)
        },
        'Child setter (+1)'
      )
    )
  );
}

type RootSetter = (next: string | ((prev: string) => string)) => void;

function renderRootStates(
  rootA: string,
  rootB: string,
  setRootA: RootSetter,
  setRootB: RootSetter
): VNode {
  return h(
    'div',
    { className: 'controls' },
    h('p', { className: 'eyebrow' }, 'Root 컴포넌트 본문'),
    stat('Root가 읽은 A', rootA, '기대: ROOT-A'),
    stat('Root가 읽은 B', rootB, '기대: ROOT-B'),
    h(
      'div',
      { className: 'buttons' },
      h(
        'button',
        {
          type: 'button',
          className: 'button',
          onClick: () => setRootA((prev) => `${prev}+root`)
        },
        'Root setter A'
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'button',
          onClick: () => setRootB((prev) => `${prev}+root`)
        },
        'Root setter B'
      )
    )
  );
}

/**
 * 같은 종류(state)와 개수(5개)를 유지한 채 호출 순서만 바꾼다.
 *
 * tick=0: tick → Root A → Root B → Child 값 → Child count
 * tick=1: tick → Child 값 → Child count → Root A → Root B
 *
 * 엔진은 호출 순서를 정체성으로만 쓰고 소유자를 구분하지 않으므로,
 * 두 번째 렌더부터 슬롯 값이 서로 다른 소유자의 라벨 아래에 나타난다.
 */
function DirectCallRoot(): VNode {
  const [tick, setTick] = useState(0);
  const childFirst = tick % 2 === 1;

  let childSection: VNode;
  let rootSection: VNode;

  if (childFirst) {
    childSection = DirectInvocationChild({ position: '먼저' });
    const [rootA, setRootA] = useState('ROOT-A');
    const [rootB, setRootB] = useState('ROOT-B');
    rootSection = renderRootStates(rootA, rootB, setRootA, setRootB);
  } else {
    const [rootA, setRootA] = useState('ROOT-A');
    const [rootB, setRootB] = useState('ROOT-B');
    childSection = DirectInvocationChild({ position: '나중' });
    rootSection = renderRootStates(rootA, rootB, setRootA, setRootB);
  }

  const orderText = childFirst
    ? 'tick → Child useState ×2 → Root useState ×2'
    : 'tick → Root useState ×2 → Child useState ×2';

  return h(
    'div',
    { className: 'controls' },
    h(
      'div',
      { className: 'buttons' },
      h(
        'button',
        {
          type: 'button',
          className: 'button button--primary',
          onClick: () => setTick((prev) => prev + 1)
        },
        'Hook 호출 순서 바꾸기'
      )
    ),
    stat('이번 렌더의 Hook 호출 순서', orderText, `tick=${tick}`),
    childSection,
    rootSection
  );
}

// ---------------------------------------------------------------------------
// 페이지 시작
// ---------------------------------------------------------------------------

function boot(): void {
  const rejectHost = document.querySelector<HTMLElement>(
    '#hook-boundary-attempts'
  );
  const directHost =
    document.querySelector<HTMLElement>('#direct-call-container');
  const directError =
    document.querySelector<HTMLElement>('#direct-call-error');

  if (!rejectHost || !directHost || !directError) {
    throw new Error('데모 컨테이너를 찾을 수 없습니다');
  }

  // A: 실패가 예상되는 경계. 각 시도는 자체 try/catch로 격리한다.
  runRejectAttempts(rejectHost);

  // B: 엔진이 거부하지 않는 금지된 사용. A와 독립된 컨테이너다.
  try {
    startApp(DirectCallRoot, directHost);
  } catch (error) {
    directError.textContent = `직접 호출 데모가 오류로 중단되었습니다: ${readErrorMessage(error)}`;
  }

  const reloadButton = document.querySelector<HTMLElement>('#reload-demo');
  reloadButton?.addEventListener('click', () => {
    location.reload();
  });
}

boot();
