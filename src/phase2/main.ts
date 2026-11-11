import { h, startApp, useEffect, useMemo, useState } from '../component';

type CounterButtonProps = {
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'ghost';
  disabled?: boolean;
};

/** props만 받는 순수 자식 컴포넌트. Hook도 State도 없다. */
function CounterButton({
  label,
  onClick,
  tone = 'ghost',
  disabled = false
}: CounterButtonProps) {
  return h(
    'button',
    {
      type: 'button',
      className: `button button--${tone}`,
      onClick,
      disabled
    },
    label
  );
}

type StatProps = {
  label: string;
  value: number | string;
  hint: string;
};

/** 값을 표시만 하는 순수 자식 컴포넌트. */
function Stat({ label, value, hint }: StatProps) {
  return h(
    'article',
    { className: 'stat' },
    h('span', { className: 'stat__label' }, label),
    h('strong', { className: 'stat__value' }, value),
    h('span', { className: 'stat__hint' }, hint)
  );
}

function App() {
  const [count, setCount] = useState(0);
  const [step, setStep] = useState(1);

  const doubled = useMemo(() => count * 2, [count]);
  const status = useMemo(
    () => (count === 0 ? '아직 갱신 없음' : `${count}회 갱신됨`),
    [count]
  );

  useEffect(() => {
    document.title = `Phase 2 — count ${count}`;
    console.log(`[Phase 2 effect] count = ${count}`);
  }, [count]);

  const increase = () => setCount((prev) => prev + step);
  const decrease = () => setCount((prev) => prev - step);
  const reset = () => setCount(0);

  return h(
    'main',
    { className: 'app' },
    h(
      'header',
      { className: 'hero' },
      h('p', { className: 'eyebrow' }, 'Phase 2 — Component / State / Hooks'),
      h('h1', { className: 'hero__title' }, '작은 React를 직접 실행해보기'),
      h(
        'p',
        { className: 'hero__description' },
        '이 화면은 h(), useState, useMemo, useEffect, h(Child, props)만으로 만들어졌습니다.'
      )
    ),
    h(
      'section',
      { className: 'panel panel--counter' },
      h(
        'div',
        { className: 'counter' },
        h('p', { className: 'counter__label' }, '현재 count'),
        h('p', { className: 'counter__value' }, count),
        h('p', { className: 'counter__hint' }, status)
      ),
      h(
        'div',
        { className: 'controls' },
        h(
          'label',
          { className: 'step' },
          h('span', { className: 'step__label' }, `step: ${step}`),
          h('input', {
            className: 'step__range',
            type: 'range',
            min: 1,
            max: 10,
            value: step,
            onInput: (event: Event) => {
              const target = event.target as HTMLInputElement;
              setStep(Number(target.value));
            }
          })
        ),
        h(
          'div',
          { className: 'buttons' },
          h(CounterButton, {
            label: `- ${step}`,
            onClick: decrease
          }),
          h(CounterButton, {
            label: 'reset',
            onClick: reset,
            disabled: count === 0
          }),
          h(CounterButton, {
            label: `+ ${step}`,
            onClick: increase,
            tone: 'primary'
          })
        )
      )
    ),
    h(
      'section',
      { className: 'stats' },
      h(Stat, {
        label: '2배',
        value: doubled,
        hint: 'useMemo(() => count * 2)'
      }),
      h(Stat, {
        label: 'step',
        value: step,
        hint: 'range input의 value property'
      }),
      h(Stat, {
        label: 'effect',
        value: count,
        hint: 'document.title 갱신'
      })
    ),
    h(
      'section',
      { className: 'panel panel--notes' },
      h('h2', { className: 'panel__title' }, '이 화면에서 확인할 수 있는 것'),
      h(
        'ul',
        { className: 'notes' },
        h(
          'li',
          {},
          h('strong', {}, 'State'),
          ' — count와 step은 루트 컴포넌트에서만 관리합니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Memo'),
          ' — count가 바뀔 때만 2배 값을 다시 계산합니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Effect'),
          ' — count가 바뀐 commit 뒤에 탭 제목을 갱신합니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Child'),
          ' — 버튼과 카드는 props만 받는 순수 자식 컴포넌트입니다.'
        )
      )
    ),
    h(
      'footer',
      { className: 'footer' },
      'Phase 1 편집기 데모는 npm run dev (main.html)에서 그대로 유지됩니다.'
    )
  );
}

const container = document.querySelector<HTMLElement>('#app');

if (!container) {
  throw new Error('#app 컨테이너를 찾을 수 없습니다');
}

startApp(App, container);
