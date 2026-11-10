/** 테스트마다 body를 비워 이전 앱의 DOM·listener가 남지 않게 한다. */
export function resetBody(): void {
  document.body.replaceChildren();
}

export function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

/**
 * 예약된 갱신이 끝날 때까지 기다린다.
 * 예약 수단(microtask·macro task·rAF)이 바뀌어도 같은 대기 지점을 유지한다.
 */
export async function flushUpdates(): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function buttonByText(container: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === label
  );

  if (!button) {
    throw new Error(`button not found: ${label}`);
  }

  return button;
}

export function textNodes(container: ParentNode): string[] {
  return Array.from(container.querySelectorAll('span')).map(
    (span) => span.textContent ?? ''
  );
}
