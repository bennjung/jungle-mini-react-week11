import { describe, expect, it } from 'vitest';
import { createHistory } from '../../src/app/history';
import type { History, HistoryDirection } from '../../src/app/history';
import type { VNode, VRoot } from '../../src/vdom/types';
import { element, root, text } from '../helpers/vdom';

function expectAllUnlinked(node: VRoot | VNode): void {
  expect(node.dom).toBeNull();
  node.childNodes.forEach(expectAllUnlinked);
}

function stateHTML(label: string): string {
  return `<p>${label}</p>`;
}

function state(label: string): VRoot {
  return root([element('P', { children: [text(label)] })]);
}

function storeStates(history: History, count: number): void {
  for (let n = 0; n < count; n += 1) {
    history.set(state(`상태${n}`), stateHTML(`상태${n}`));
  }
}

function moveBack(history: History, steps: number): void {
  for (let step = 0; step < steps; step += 1) {
    const target = history.peek(-1);
    if (!target) throw new Error('뒤로 이동할 저장 항목이 없습니다.');
    history.move(-1, target.vdom);
  }
}

function moveForward(history: History, steps: number): void {
  for (let step = 0; step < steps; step += 1) {
    const target = history.peek(1);
    if (!target) throw new Error('앞으로 이동할 저장 항목이 없습니다.');
    history.move(1, target.vdom);
  }
}

interface LinkedLive {
  live: VRoot;
  actualRoot: HTMLElement;
}

function createLinkedLive(label: string): LinkedLive {
  const actualRoot = document.createElement('div');
  actualRoot.innerHTML = `<p class="box">${label}</p><input value="${label}">`;
  document.body.append(actualRoot);

  const paragraph = actualRoot.querySelector('p');
  const paragraphText = paragraph?.firstChild ?? null;
  const input = actualRoot.querySelector('input');
  if (!paragraph || !paragraphText || !input) {
    throw new Error('연결 VDOM 테스트 픽스처를 만들 수 없습니다.');
  }

  const live = root(
    [
      element('P', {
        attributes: [{ name: 'class', value: 'box' }],
        children: [text(label)]
      }),
      element('INPUT', {
        attributes: [{ name: 'value', value: label }],
        properties: { value: label, checked: false, indeterminate: false }
      })
    ],
    actualRoot
  );
  const paragraphNode = live.childNodes[0];
  const textNode = paragraphNode?.childNodes[0];
  const inputNode = live.childNodes[1];
  if (!paragraphNode || !textNode || !inputNode) {
    throw new Error('연결 VDOM 테스트 노드를 만들 수 없습니다.');
  }
  paragraphNode.dom = paragraph;
  textNode.dom = paragraphText;
  inputNode.dom = input;

  return { live, actualRoot };
}

describe('History — HIST', () => {
  it('HIST-01: get은 현재 live VDOM을, peek은 DOM 참조 없는 복사본과 HTML 원문을 반환한다', () => {
    const history = createHistory();
    const { live, actualRoot } = createLinkedLive('A');
    const firstHTML = '<p class="box">A</p><input value="A">';

    history.set(live, firstHTML);

    expect(history.get()).toBe(live);
    const firstEntry = history.peek(0);
    if (!firstEntry) throw new Error('첫 저장 항목이 없습니다.');
    expect(firstEntry.html).toBe(firstHTML);
    expect(firstEntry.vdom).not.toBe(live);
    expectAllUnlinked(firstEntry.vdom);

    const liveParagraph = live.childNodes[0];
    const liveText = liveParagraph?.childNodes[0];
    const liveInput = live.childNodes[1];
    if (!liveParagraph || !liveText || !liveInput) {
      throw new Error('원본 VDOM 노드가 없습니다.');
    }
    const savedParagraph = firstEntry.vdom.childNodes[0];
    const savedInput = firstEntry.vdom.childNodes[1];
    if (!savedParagraph || !savedInput) throw new Error('저장된 VDOM 노드가 없습니다.');

    expect(savedParagraph).not.toBe(liveParagraph);
    expect(savedParagraph.attributes).not.toBe(liveParagraph.attributes);
    expect(savedParagraph.attributes[0]).not.toBe(liveParagraph.attributes[0]);
    expect(savedParagraph.childNodes[0]).not.toBe(liveText);
    expect(savedInput.properties).not.toBe(liveInput.properties);
    expect(savedInput.properties).toEqual({ value: 'A', checked: false, indeterminate: false });

    // 원본 VDOM과 실제 DOM을 별도로 변경한다.
    liveParagraph.attributes[0] = { name: 'class', value: 'changed' };
    liveText.nodeValue = 'B';
    liveInput.properties.value = 'B';
    const liveParagraphDom = actualRoot.querySelector('p');
    const liveTextDom = liveParagraphDom?.firstChild ?? null;
    const liveInputDom = actualRoot.querySelector('input');
    if (!liveParagraphDom || !liveTextDom || !liveInputDom) {
      throw new Error('실제 DOM 픽스처가 없습니다.');
    }
    liveParagraphDom.className = 'changed';
    liveTextDom.nodeValue = 'B';
    liveInputDom.value = 'B';

    // 저장 데이터와 HTML 원문은 원본 변경에 영향받지 않는다.
    expect(firstEntry.html).toBe(firstHTML);
    expect(savedParagraph.attributes).toEqual([{ name: 'class', value: 'box' }]);
    expect(savedParagraph.childNodes[0]?.nodeValue).toBe('A');
    expect(savedInput.properties).toEqual({ value: 'A', checked: false, indeterminate: false });
    expectAllUnlinked(firstEntry.vdom);
    expect(history.peek(0)?.html).toBe(firstHTML);

    // get()은 변경 가능한 현재 live VDOM을 그대로 반환한다.
    expect(history.get()).toBe(live);
    expect(live.childNodes[0]?.attributes[0]).toEqual({ name: 'class', value: 'changed' });

    const secondLive = state('B');
    history.set(secondLive, stateHTML('B'));

    expect(history.get()).toBe(secondLive);
    expect(history.peek(-1)?.html).toBe(firstHTML);
    expect(history.peek(0)?.html).toBe(stateHTML('B'));
    expect(history.peek(-1)?.vdom.childNodes[0]?.childNodes[0]?.nodeValue).toBe('A');
    expectAllUnlinked(history.peek(-1)!.vdom);
  });

  it('HIST-01: set은 복사에 실패하면 기존 entries·index·currentLive를 변경하지 않는다', () => {
    const history = createHistory();
    const live = state('A');
    history.set(live, stateHTML('A'));

    const broken = { childNodes: null, dom: null } as unknown as VRoot;
    expect(() => history.set(broken, stateHTML('깨짐'))).toThrow();

    expect(history.get()).toBe(live);
    expect(history.peek(0)?.html).toBe(stateHTML('A'));
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(1)).toBeNull();
  });

  it('HIST-03: 범위 밖 peek은 null이고 조회만으로 현재 위치가 바뀌지 않는다', () => {
    const history = createHistory();
    const only = state('A');
    history.set(only, stateHTML('A'));

    expect(history.peek(-1)).toBeNull();
    expect(history.peek(1)).toBeNull();
    expect(history.peek(0)?.html).toBe(stateHTML('A'));
    expect(history.get()).toBe(only);

    const a = state('A');
    const b = state('B');
    const secondHistory = createHistory();
    secondHistory.set(a, stateHTML('A'));
    secondHistory.set(b, stateHTML('B'));

    expect(secondHistory.peek(-1)?.html).toBe(stateHTML('A'));
    expect(secondHistory.peek(0)?.html).toBe(stateHTML('B'));
    expect(secondHistory.peek(-1)?.html).toBe(stateHTML('A'));
    expect(secondHistory.peek(0)?.html).toBe(stateHTML('B'));
    expect(secondHistory.peek(1)).toBeNull();
  });

  it('HIST-03: 처음에서 뒤로, 마지막에서 앞으로 이동 요청은 완전한 no-op이다', () => {
    const history = createHistory();
    const a = state('A');
    const b = state('B');
    history.set(a, stateHTML('A'));
    history.set(b, stateHTML('B'));

    const liveAtB = history.get();
    const attempted = state('시도');

    history.move(1, attempted);
    expect(history.get()).toBe(liveAtB);
    expect(history.peek(0)?.html).toBe(stateHTML('B'));
    expect(history.peek(1)).toBeNull();

    const liveAtA = state('A-live');
    history.move(-1, liveAtA);
    expect(history.get()).toBe(liveAtA);
    expect(history.peek(0)?.html).toBe(stateHTML('A'));
    expect(history.peek(1)?.html).toBe(stateHTML('B'));
    expect(history.peek(-1)).toBeNull();

    history.move(-1, attempted);
    expect(history.get()).toBe(liveAtA);
    expect(history.peek(0)?.html).toBe(stateHTML('A'));
    expect(history.peek(-1)).toBeNull();
    expect(history.peek(1)?.html).toBe(stateHTML('B'));
  });

  it('HIST-04: 과거로 돌아가 새 상태를 저장하면 미래 이력만 제거한다', () => {
    const history = createHistory();
    history.set(state('A'), stateHTML('A'));
    history.set(state('B'), stateHTML('B'));
    history.set(state('C'), stateHTML('C'));

    const liveAtB = state('B-live');
    history.move(-1, liveAtB);
    expect(history.get()).toBe(liveAtB);
    expect(history.peek(0)?.html).toBe(stateHTML('B'));

    const liveD = state('D');
    history.set(liveD, stateHTML('D'));

    expect(history.get()).toBe(liveD);
    expect(history.peek(0)?.html).toBe(stateHTML('D'));
    expect(history.peek(-1)?.html).toBe(stateHTML('B'));
    expect(history.peek(1)).toBeNull();

    moveBack(history, 2);
    expect(history.peek(0)?.html).toBe(stateHTML('A'));
    expect(history.peek(-1)).toBeNull();

    const pastEntry = history.peek(0);
    if (!pastEntry) throw new Error('A 저장 항목이 없습니다.');
    expect(pastEntry.vdom.childNodes[0]?.childNodes[0]?.nodeValue).toBe('A');
    expectAllUnlinked(pastEntry.vdom);

    // C는 제거되어 A → B → D 순서로만 이동한다.
    moveForward(history, 2);
    expect(history.peek(0)?.html).toBe(stateHTML('D'));
    expect(history.peek(1)).toBeNull();

    const liveAtD = history.get();
    const attempted = state('앞으로-시도');
    history.move(1, attempted);
    expect(history.get()).toBe(liveAtD);
    expect(history.peek(0)?.html).toBe(stateHTML('D'));
  });

  it('move(0)은 index와 저장 항목을 유지하고 currentLive만 교체한다', () => {
    const history = createHistory();
    history.set(state('A'), stateHTML('A'));
    history.set(state('B'), stateHTML('B'));

    const nextLive = state('B-live');
    history.move(0, nextLive);

    expect(history.get()).toBe(nextLive);
    expect(history.peek(0)?.html).toBe(stateHTML('B'));
    expect(history.peek(-1)?.html).toBe(stateHTML('A'));
    expect(history.peek(1)).toBeNull();
  });

  it('빈 History는 get에서 오류를 내고 peek·move를 안전하게 no-op 처리한다', () => {
    const history = createHistory();
    const directions: HistoryDirection[] = [-1, 0, 1];

    expect(() => history.get()).toThrow();
    for (const direction of directions) {
      expect(history.peek(direction)).toBeNull();
    }

    history.move(0, state('live'));
    history.move(-1, state('live'));
    history.move(1, state('live'));

    expect(() => history.get()).toThrow();
    for (const direction of directions) {
      expect(history.peek(direction)).toBeNull();
    }
  });

  it('HIST-07: 51번째 저장에서 가장 오래된 이력을 제거하고 길이 50과 마지막 위치를 유지한다', () => {
    const history = createHistory();
    storeStates(history, 50);

    expect(history.peek(0)?.html).toBe(stateHTML('상태49'));
    expect(history.peek(1)).toBeNull();

    // 49번 뒤로 이동해 정확히 50개가 저장되어 있음을 확인한다.
    moveBack(history, 49);
    expect(history.peek(0)?.html).toBe(stateHTML('상태0'));
    expect(history.peek(-1)).toBeNull();
    moveForward(history, 49);

    const live50 = state('상태50');
    history.set(live50, stateHTML('상태50'));

    expect(history.get()).toBe(live50);
    expect(history.peek(0)?.html).toBe(stateHTML('상태50'));
    expect(history.peek(1)).toBeNull();

    // 가장 오래된 상태0이 사라져 상태1이 최소 상태가 된다.
    moveBack(history, 49);
    expect(history.peek(0)?.html).toBe(stateHTML('상태1'));
    expect(history.peek(-1)).toBeNull();

    const oldestRemaining = history.peek(0);
    if (!oldestRemaining) throw new Error('남은 가장 오래된 항목이 없습니다.');
    expect(oldestRemaining.vdom.childNodes[0]?.childNodes[0]?.nodeValue).toBe('상태1');
    expectAllUnlinked(oldestRemaining.vdom);
  });

  it('HIST-07: 50개에서 과거로 이동 후 저장하면 미래만 제거하고 오래된 이력은 추가로 버리지 않는다', () => {
    const history = createHistory();
    storeStates(history, 50);

    moveBack(history, 30);
    expect(history.peek(0)?.html).toBe(stateHTML('상태19'));

    const liveNew = state('새상태');
    history.set(liveNew, stateHTML('새상태'));

    expect(history.get()).toBe(liveNew);
    expect(history.peek(0)?.html).toBe(stateHTML('새상태'));
    expect(history.peek(1)).toBeNull();

    // 상태0~19 + 새 상태 = 21개만 남고 상태0은 유지된다.
    moveBack(history, 20);
    expect(history.peek(0)?.html).toBe(stateHTML('상태0'));
    expect(history.peek(-1)).toBeNull();

    moveForward(history, 20);
    expect(history.peek(0)?.html).toBe(stateHTML('새상태'));
    expect(history.peek(1)).toBeNull();
  });

  it('HIST-07: 빈 History와 범위 밖 이동은 상한·위치 계산에 영향을 주지 않는다', () => {
    const history = createHistory();
    const unused = state('unused');

    history.move(-1, unused);
    history.move(1, unused);
    history.move(0, unused);
    expect(() => history.get()).toThrow();

    storeStates(history, 50);
    const liveAtLast = history.get();
    history.move(1, unused);

    expect(history.get()).toBe(liveAtLast);
    expect(history.peek(0)?.html).toBe(stateHTML('상태49'));
    expect(history.peek(1)).toBeNull();

    moveBack(history, 49);
    expect(history.peek(0)?.html).toBe(stateHTML('상태0'));
    expect(history.peek(-1)).toBeNull();
  });
});
