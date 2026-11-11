import { h, startApp, useEffect, useMemo, useState } from '../component';
import { observeSignupInput, Signup } from './signup';

type MoodKey = 'shy' | 'happy' | 'purr';

type Mood = {
  key: MoodKey;
  label: string;
  speech: string;
};

type Heart = {
  id: number;
  slot: number;
};

let nextHeartId = 0;

/** 고양이 그림. props만 받는 순수 자식 컴포넌트다. */
function Cat({ mood, onPet }: { mood: MoodKey; onPet: () => void }) {
  return h(
    'button',
    {
      type: 'button',
      className: `cat cat--${mood}`,
      onClick: onPet,
      'aria-label': '고양이 쓰다듬기'
    },
    h('span', { className: 'cat__tail' }),
    h('span', { className: 'cat__body' }),
    h(
      'span',
      { className: 'cat__head' },
      h('span', { className: 'cat__ear cat__ear--left' }),
      h('span', { className: 'cat__ear cat__ear--right' }),
      h('span', { className: 'cat__eye cat__eye--left' }),
      h('span', { className: 'cat__eye cat__eye--right' }),
      h('span', { className: 'cat__nose' }),
      h('span', { className: 'cat__mouth' }),
      h('span', { className: 'cat__whisker cat__whisker--l1' }),
      h('span', { className: 'cat__whisker cat__whisker--l2' }),
      h('span', { className: 'cat__whisker cat__whisker--r1' }),
      h('span', { className: 'cat__whisker cat__whisker--r2' })
    )
  );
}

type StatProps = {
  label: string;
  value: number | string;
  hint: string;
};

function Stat({ label, value, hint }: StatProps) {
  return h(
    'article',
    { className: 'stat' },
    h('span', { className: 'stat__label' }, label),
    h('strong', { className: 'stat__value' }, value),
    h('span', { className: 'stat__hint' }, hint)
  );
}

function PurrMeter({ value }: { value: number }) {
  const filled = Math.ceil(value / 10);
  const dots = Array.from({ length: 10 }, (_, index) =>
    h('span', {
      className: `purr__dot${index < filled ? ' is-filled' : ''}`
    })
  );

  return h(
    'div',
    { className: 'purr' },
    h(
      'div',
      { className: 'purr__head' },
      h('span', {}, '골골 게이지'),
      h('strong', {}, `${value}%`)
    ),
    h('div', { className: 'purr__dots' }, dots)
  );
}

function App() {
  const [catName, setCatName] = useState('나비');
  const [strokes, setStrokes] = useState(0);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [screen, setScreen] = useState<'cat' | 'signup'>('cat');
  const [email, setEmail] = useState('');

  const displayName = useMemo(() => catName.trim() || '고양이', [catName]);
  const mood = useMemo<Mood>(() => {
    if (strokes === 0) {
      return { key: 'shy', label: '낯가림', speech: '…' };
    }
    if (strokes < 10) {
      return { key: 'happy', label: '기분 좋음', speech: '골골…' };
    }
    return { key: 'purr', label: '골골송', speech: '골골골! 더 쓰다듬어 줘!' };
  }, [strokes]);
  const purrPercent = useMemo(() => Math.min(100, strokes * 5), [strokes]);

  const pet = () => {
    const heart = {
      id: nextHeartId,
      slot: Math.floor(Math.random() * 8)
    };
    nextHeartId += 1;

    setStrokes((prev) => prev + 1);
    setHearts((prev) => [...prev.slice(-11), heart]);
  };

  const reset = () => {
    setStrokes(0);
    setHearts([]);
  };

  useEffect(() => {
    document.title = screen === 'signup'
      ? '회원가입 — 고양이 쓰다듬기'
      : `${displayName} 쓰다듬기 — ${strokes}회`;
    console.log(`[cat] ${displayName} / strokes=${strokes}`);
  }, [displayName, strokes, screen]);

  // 프레임워크의 h()는 click/input/change만 지원한다. 문지르기 동작은
  // useEffect로 실제 DOM에 pointer 이벤트를 붙여서 만든다.
  useEffect(() => {
    if (screen !== 'cat') return;
    const cat = document.querySelector<HTMLElement>('.cat');
    if (!cat) return;

    let lastX: number | null = null;
    let lastY: number | null = null;
    let distance = 0;

    const handleDown = (event: PointerEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      distance = 0;
    };

    const handleMove = (event: PointerEvent) => {
      // 누른 채로 문지를 때만 쓰다듬기로 인정한다.
      if (event.buttons !== 1) return;

      if (lastX === null || lastY === null) {
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }

      distance += Math.hypot(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;

      if (distance >= 48) {
        distance = 0;
        pet();
      }
    };

    const resetDistance = () => {
      lastX = null;
      lastY = null;
      distance = 0;
    };

    cat.addEventListener('pointerdown', handleDown);
    cat.addEventListener('pointermove', handleMove);
    cat.addEventListener('pointerup', resetDistance);
    cat.addEventListener('pointerleave', resetDistance);

    return () => {
      cat.removeEventListener('pointerdown', handleDown);
      cat.removeEventListener('pointermove', handleMove);
      cat.removeEventListener('pointerup', resetDistance);
      cat.removeEventListener('pointerleave', resetDistance);
    };
  }, [screen]);

  useEffect(() => {
    if (screen === 'signup') return observeSignupInput();
  }, [screen]);

  // Hook 개수와 순서는 두 화면에서 동일하다. 자식은 props만 사용한다.
  if (screen === 'signup') {
    return h(Signup, {
      email,
      onBack: () => setScreen('cat'),
      onEmailInput: (event: Event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement) {
          setEmail(input.value.replace(/\s/g, ''));
        }
      }
    });
  }

  return h(
    'main',
    { className: 'app' },
    h(
      'header',
      { className: 'hero' },
      h('p', { className: 'eyebrow' }, 'Phase 2 — Cat Petting Demo'),
      h('h1', { className: 'hero__title' }, '고양이를 쓰다듬어 보세요'),
      h('button', { type: 'button', className: 'signup-link', onClick: () => setScreen('signup') }, '회원가입 →'),
      h(
        'p',
        { className: 'hero__description' },
        '클릭하거나, 고양이를 누른 채로 위아래로 문질러 보세요.'
      )
    ),
    h(
      'section',
      { className: 'layout' },
      h(
        'section',
        { className: 'panel panel--stage' },
        h('p', { className: 'cat-name' }, displayName),
        h('div', { className: 'bubble' }, mood.speech),
        h(
          'div',
          { className: 'stage' },
          h(
            'div',
            { className: 'hearts', 'aria-hidden': 'true' },
            hearts.map((heart) =>
              h(
                'span',
                {
                  key: String(heart.id),
                  className: `heart heart--${heart.slot}`
                },
                '♥'
              )
            )
          ),
          h(Cat, { mood: mood.key, onPet: pet })
        ),
        h(
          'p',
          { className: 'hint' },
          '고양이를 클릭하거나, 누른 채로 위아래로 문질러 보세요.'
        )
      ),
      h(
        'section',
        { className: 'panel panel--control' },
        h(
          'label',
          { className: 'field' },
          h('span', { className: 'field__label' }, '고양이 이름'),
          h('input', {
            className: 'field__input',
            type: 'text',
            value: catName,
            placeholder: '예: 나비',
            onInput: (event: Event) => {
              const target = event.target as HTMLInputElement;
              setCatName(target.value);
            }
          })
        ),
        h(
          'div',
          { className: 'stats' },
          h(Stat, {
            label: '쓰다듬은 횟수',
            value: strokes,
            hint: 'click + pointermove'
          }),
          h(Stat, {
            label: '현재 기분',
            value: mood.label,
            hint: 'useMemo(() => …)'
          }),
          h(Stat, {
            label: '골골 지수',
            value: `${purrPercent}%`,
            hint: '0% → 100%'
          })
        ),
        h(PurrMeter, { value: purrPercent }),
        h(
          'button',
          {
            className: 'reset',
            type: 'button',
            onClick: reset,
            disabled: strokes === 0
          },
          '처음부터 쓰다듬기'
        ),
        h(
          'p',
          { className: 'note' },
          '이름을 바꾸면 탭 제목과 말풍선에 반영됩니다.'
        )
      )
    ),
    h(
      'section',
      { className: 'panel panel--notes' },
      h('h2', { className: 'panel__title' }, '이 페이지에서 사용한 Phase 2 기능'),
      h(
        'ul',
        { className: 'notes' },
        h('li', {}, h('strong', {}, 'useState'), ' — 이름·횟수·하트'),
        h('li', {}, h('strong', {}, 'useMemo'), ' — 기분·골골 지수'),
        h('li', {}, h('strong', {}, 'useEffect'), ' — 제목·pointermove'),
        h('li', {}, h('strong', {}, 'h(Child, props)'), ' — Cat·Stat·PurrMeter'),
        h('li', {}, h('strong', {}, 'key'), ' — 하트 목록')
      )
    ),
    h(
      'footer',
      { className: 'footer' },
      'Phase 1 편집기 데모는 npm run dev:phase1 (main.html)에서 확인할 수 있습니다.'
    )
  );
}

const container = document.querySelector<HTMLElement>('#app');

if (!container) {
  throw new Error('#app 컨테이너를 찾을 수 없습니다');
}

startApp(App, container);
