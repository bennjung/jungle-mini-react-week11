import { h } from '../component';

// 실제 계정 생성 없이, 기존 Phase 2 엔진의 입력 갱신만 사용하는 화면이다.
export function Signup({ email, onEmailInput, onBack }: {
  email: string;
  onEmailInput: (event: Event) => void;
  onBack: () => void;
}) {
  const summary = email || '아직 입력하지 않았습니다';

  return h(
    'main',
    { className: 'app signup-app' },
    h('header', { className: 'hero' },
      h('button', { type: 'button', className: 'signup-back', onClick: onBack }, '← 고양이에게 돌아가기'),
      h('p', { className: 'eyebrow' }, '고양이 쓰다듬기'),
      h('h1', { className: 'hero__title' }, '회원가입'),
      h('p', { className: 'hero__description' }, '이메일을 입력하면 공백을 제거한 값을 State에 저장합니다.')
    ),
    h('section', { className: 'panel signup-form', 'aria-labelledby': 'signup-heading' },
      h('h2', { id: 'signup-heading' }, '이메일로 시작하기'),
      h('label', { className: 'field', for: 'signup-email' },
        h('span', { className: 'field__label' }, '이메일'),
        h('input', {
          id: 'signup-email',
          className: 'field__input',
          // email 타입은 브라우저 자체 정제와 selection API 제약이 있어 text로 관찰한다.
          type: 'text',
          inputmode: 'email',
          autocomplete: 'off',
          autocapitalize: 'none',
          spellcheck: 'false',
          placeholder: 'cat@example.com',
          'aria-describedby': 'email-help',
          value: email,
          onInput: onEmailInput
        })
      ),
      h('p', { id: 'email-help', className: 'note' }, '입력값에서 공백을 실시간으로 제거합니다. 문자열 중간도 수정해 보세요.'),
      h('p', { className: 'signup-summary' }, '가입 이메일: ', h('strong', {}, summary)),
      h('p', { className: 'note' }, '입력 시연용 화면입니다. 실제 계정은 생성하지 않습니다.')
    ),
    h('details', { className: 'panel signup-guide' },
      h('summary', {}, '발표용 입력 시나리오'),
      h('ol', {},
        h('li', {}, 'cat @example.com을 붙여넣어 공백 없는 값이 반영되는지 확인합니다.'),
        h('li', {}, '입력된 이메일 중간에 공백만 넣어 State와 실제 입력값을 비교합니다.'),
        h('li', {}, '중간에 새 문자와 공백을 함께 붙여넣고 커서 위치를 확인합니다.')
      ),
      h('p', { className: 'note' }, '엔진을 수정하거나 커서를 수동 복원하지 않았습니다. 현재 입력 처리의 경계를 관찰합니다.')
    ),
    h('span', { id: 'signup-email-state', hidden: true }, email)
  );
}

/** 관찰만 수행한다. 입력값과 커서는 보정하지 않으며, 화면 전환 시 listener를 정리한다. */
export function observeSignupInput() {
  const emailInput = document.querySelector<HTMLInputElement>('#signup-email');
  const observation = document.querySelector<HTMLOutputElement>('#email-observation');
  if (!emailInput || !observation) return;
  const readObservation = (before: number | null = null) => {
    if (!emailInput.isConnected) return;
    const state = document.querySelector('#signup-email-state')?.textContent ?? '';
    const cursor = emailInput.selectionStart;
    observation.textContent = [
      `State: ${JSON.stringify(state)}`,
      `실제 입력: ${JSON.stringify(emailInput.value)}`,
      `커서: ${cursor ?? '확인 불가'}${before === null ? '' : ` (반영 전 ${before})`}`,
      state === emailInput.value ? 'State와 입력값 일치' : 'State와 입력값 불일치'
    ].join('\n');
  };
  const onInput = () => {
    const cursorBeforeCommit = emailInput.selectionStart;
    // syncEvents의 재연결 뒤에는 관찰 listener가 엔진 handler보다 먼저 실행될 수 있다.
    // 실제 브라우저는 listener 사이에도 microtask를 비울 수 있으므로 다음 task에서 읽는다.
    // 입력값에는 손대지 않고, 제거된 화면이면 readObservation이 즉시 종료한다.
    setTimeout(() => readObservation(cursorBeforeCommit), 0);
  };
  emailInput.addEventListener('input', onInput);
  readObservation();
  return () => {
    emailInput.removeEventListener('input', onInput);
    observation.textContent = '';
  };
}
