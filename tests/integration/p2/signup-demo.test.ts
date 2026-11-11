import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushUpdates, resetBody } from '../../helpers/p2';

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div><output id="email-observation"></output>';
});

afterEach(resetBody);

async function openSignup() {
  await import('../../../src/phase2/cat');
  const signupButton = [...document.querySelectorAll('button')].find((button) => button.textContent === '회원가입 →');
  if (!signupButton) throw new Error('고양이 화면의 회원가입 버튼이 없습니다');
  signupButton.click();
  await flushUpdates();
  const input = document.querySelector<HTMLInputElement>('#signup-email');
  if (!input) throw new Error('회원가입 이메일 입력이 없습니다');
  return input;
}

describe('회원가입 데모 — 기존 엔진으로 이메일 공백 제거를 관찰한다', () => {
  it('같은 루트에서 회원가입을 표시하고 뒤로 가면 고양이 상태를 유지한다', async () => {
    const container = document.querySelector('#app');
    const url = window.location.href;
    await openSignup();
    expect(document.body.textContent).toContain('실제 계정은 생성하지 않습니다');
    expect(document.querySelector('#app')).toBe(container);
    expect(window.location.href).toBe(url);
    document.querySelector<HTMLButtonElement>('.signup-back')!.click();
    await flushUpdates();
    document.querySelector<HTMLButtonElement>('.cat')!.click();
    await flushUpdates();
    expect(document.querySelector('.stat__value')?.textContent).toBe('1');
    document.querySelector<HTMLButtonElement>('.signup-link')!.click();
    await flushUpdates();
    document.querySelector<HTMLButtonElement>('.signup-back')!.click();
    await flushUpdates();
    expect(document.querySelector('.stat__value')?.textContent).toBe('1');
    expect(document.querySelector('#app')).toBe(container);
  });

  it('새 이메일을 붙여넣으면 공백 없는 State와 입력값을 반영한다', async () => {
    const input = await openSignup();
    input.value = ' cat @example.com ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushUpdates();
    expect(document.querySelector('#signup-email-state')?.textContent).toBe('cat@example.com');
    expect(input.value).toBe('cat@example.com');
    expect(document.querySelector('#signup-email')).toBe(input);
  });

  it('빈 값에서는 공백 제거 결과가 같은 State라 실제 입력에 공백이 남는 현재 경계를 드러낸다', async () => {
    const input = await openSignup();
    input.value = ' ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushUpdates();
    expect(document.querySelector('#signup-email-state')?.textContent).toBe('');
    expect(input.value).toBe(' ');
    expect(document.querySelector('#email-observation')?.textContent).toContain('불일치');
  });

  it('중간에 새 문자와 공백을 넣으면 변환 뒤 커서가 끝으로 이동하는 현재 경계를 드러낸다', async () => {
    const input = await openSignup();
    input.value = 'cat@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushUpdates();
    input.focus();
    input.value = 'ca x t@example.com';
    input.setSelectionRange(5, 5);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushUpdates();
    expect(input.value).toBe('caxt@example.com');
    expect(input.selectionStart).toBe(input.value.length);
    expect(document.querySelector('#email-observation')?.textContent).toContain('커서');
    expect(document.querySelector('#email-observation')?.textContent).toContain('State: "caxt@example.com"');
    expect(document.querySelector('#email-observation')?.textContent).toContain('실제 입력: "caxt@example.com"');
  });
});
