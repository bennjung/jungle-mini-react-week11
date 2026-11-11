/**
 * SELECT의 OPTION 추가와 value 변경을 같은 State 갱신에서 수행하는 재현 페이지.
 *
 * 이 파일은 실제 src/component 공개 API(h, startApp, useState, useEffect)와
 * 실제 Phase 1 diff/patch 경로만 사용한다. 엔진을 우회하거나 가짜 DOM을 만들지 않는다.
 * 관찰 영역은 startApp 컨테이너(#app) 바깥의 별도 DOM이며 값만 읽는다.
 */
import { h, startApp, useEffect, useState } from '../src/component';

const INITIAL_SELECTED = 'A';
const INITIAL_OPTIONS: readonly string[] = ['A'];

type ObservationElements = {
  expectedSelected: HTMLElement;
  expectedOptions: HTMLElement;
  expectedIndex: HTMLElement;
  actualValue: HTMLElement;
  actualIndex: HTMLElement;
  actualSelected: HTMLElement;
  actualOptions: HTMLElement;
  verdict: HTMLElement;
  details: HTMLElement;
};

const observation: ObservationElements = {
  expectedSelected: requireElement('obs-expected-selected'),
  expectedOptions: requireElement('obs-expected-options'),
  expectedIndex: requireElement('obs-expected-index'),
  actualValue: requireElement('obs-actual-value'),
  actualIndex: requireElement('obs-actual-index'),
  actualSelected: requireElement('obs-actual-selected'),
  actualOptions: requireElement('obs-actual-options'),
  verdict: requireElement('obs-verdict'),
  details: requireElement('obs-details')
};

/** 시나리오 버튼을 한 번이라도 눌렀는지. 초기 상태와 시나리오 후 상태를 구분한다. */
let scenarioStarted = false;

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`관찰 영역의 #${id}를 찾을 수 없습니다`);
  }

  return element;
}

function formatOptions(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

/**
 * 장면은 "A만 있는 선택지에서 B를 추가하고, 동시에 선택 상태를 B로 바꾼다" 하나다.
 * 두 setter를 같은 click handler에서 호출해 하나의 microtask 갱신으로 합쳐진다.
 */
function App() {
  const [selected, setSelected] = useState<string>(INITIAL_SELECTED);
  const [options, setOptions] = useState<string[]>([...INITIAL_OPTIONS]);

  useEffect(() => {
    renderObservation(selected, options, scenarioStarted);
  }, [selected, options]);

  const addBAndSelectB = () => {
    scenarioStarted = true;
    setOptions((previous) =>
      previous.includes('B') ? previous : [...previous, 'B']
    );
    setSelected('B');
  };

  const handleSelectChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    setSelected(target.value);
  };

  return h(
    'main',
    { className: 'app' },
    h(
      'header',
      { className: 'hero' },
      h('p', { className: 'eyebrow' }, 'Phase 2 검증 데모 — SELECT'),
      h('h1', { className: 'hero__title' }, 'OPTION 추가 + value 변경'),
      h(
        'p',
        { className: 'hero__description' },
        '정상 조작 사례입니다. A가 선택된 상태에서 버튼 한 번으로 B 선택지를 추가하고 동시에 선택 상태를 B로 바꿉니다.'
      )
    ),
    h(
      'section',
      { className: 'panel' },
      h('h2', { className: 'panel__title' }, '시나리오 실행'),
      h(
        'p',
        { className: 'hero__description' },
        '시작 상태는 options=["A"], selected="A"입니다. 아래 버튼은 setOptions와 setSelected를 같은 click handler에서 호출합니다.'
      ),
      h(
        'div',
        { className: 'demo-row' },
        h(
          'label',
          { className: 'step' },
          h('span', { className: 'step__label' }, '현재 선택지'),
          h(
            'select',
            {
              className: 'demo-select',
              value: selected,
              onChange: handleSelectChange
            },
            options.map((option) =>
              h(
                'option',
                { key: option, value: option },
                option
              )
            )
          )
        ),
        h(
          'button',
          {
            className: 'button button--primary',
            type: 'button',
            onClick: addBAndSelectB
          },
          'B 선택지 추가 + B 선택'
        )
      ),
      h(
        'p',
        { className: 'demo-state' },
        'state.selected: ',
        h('strong', {}, selected),
        ' / state.options: ',
        h('strong', {}, formatOptions(options))
      ),
      h(
        'p',
        { className: 'note' },
        '버튼을 누르면 OPTION B 삽입 명령과 SELECT value 변경 명령이 같은 갱신에 들어갑니다. 화면 아래 관찰 영역은 엔진 바깥에서 commit 후 실제 DOM을 읽습니다.'
      )
    ),
    h(
      'section',
      { className: 'panel panel--notes' },
      h('h2', { className: 'panel__title' }, '사용법'),
      h(
        'ol',
        { className: 'notes' },
        h('li', {}, '페이지를 새로 열면 options=["A"], selected="A"로 시작합니다.'),
        h('li', {}, '"B 선택지 추가 + B 선택" 버튼을 한 번 누릅니다.'),
        h(
          'li',
          {},
          '아래 관찰 영역에서 기대 state 값과 실제 select.value·selectedIndex·선택지 값을 각각 비교합니다.'
        ),
        h('li', {}, '초기 상태로 되돌리려면 페이지를 새로고침합니다.')
      )
    ),
    h(
      'section',
      { className: 'panel panel--notes' },
      h('h2', { className: 'panel__title' }, '한계와 관찰 방식'),
      h(
        'ul',
        { className: 'notes' },
        h(
          'li',
          {},
          h('strong', {}, '정상 조작'),
          ' — 공개 API로 State를 바꾸는 일반적인 사용 흐름만 확인합니다. 엔진 내부 함수를 직접 호출하거나 가짜 DOM을 만들지 않습니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '관찰 격리'),
          ' — 관찰 영역은 #app 바깥의 별도 DOM입니다. commit 후 값을 읽기만 하므로 관찰이 diff/patch 흐름을 바꾸지 않습니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '범위'),
          ' — "옵션 추가와 value 변경을 같은 갱신에서 수행"하는 한 경로만 확인합니다. 옵션 추가와 선택 변경을 다른 갱신으로 나누는 경우, OPTION.selected를 직접 쓰는 경우, 다중 선택은 다루지 않습니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '직접 조작'),
          ' — SELECT를 직접 클릭해 값을 바꾸면 onChange가 State를 따라갑니다. 이 데모의 재현 시나리오는 버튼 한 번으로 실행합니다.'
        ),
        h(
          'li',
          {},
          h('strong', {}, '반복 클릭'),
          ' — 상태가 이미 options=["A","B"], selected="B"이면 같은 값이라 새 갱신이 예약되지 않습니다. 초기 상태는 새로고침으로 되돌립니다.'
        )
      )
    ),
    h(
      'footer',
      { className: 'footer' },
      '실제 src/component의 h·startApp·useState·useEffect와 실제 diff/patch 엔진을 사용합니다.'
    )
  );
}

/**
 * commit 이후 실제 DOM을 읽어 기대 State와 나란히 표시한다.
 * 이 함수는 #app 안의 DOM을 수정하지 않는다.
 */
function renderObservation(
  selected: string,
  options: readonly string[],
  started: boolean
): void {
  const select = document.querySelector<HTMLSelectElement>('#app .demo-select');
  if (select === null) {
    observation.verdict.textContent = '관찰 실패 — #app 안에서 SELECT를 찾지 못했습니다.';
    observation.verdict.dataset['state'] = 'mismatch';
    observation.details.textContent = 'SELECT가 아직 렌더링되지 않았거나 엔진 시작이 실패했습니다.';
    return;
  }

  const expectedIndex = options.indexOf(selected);
  const actualValue = select.value;
  const actualIndex = select.selectedIndex;
  const actualOptionValues = Array.from(select.options, (option) => option.value);
  const actualSelectedValues = Array.from(
    select.selectedOptions,
    (option) => option.value
  );
  const actualSelectedOption =
    actualIndex === -1 ? '없음' : actualOptionValues[actualIndex] ?? '없음';

  observation.expectedSelected.textContent = JSON.stringify(selected);
  observation.expectedOptions.textContent = formatOptions(options);
  observation.expectedIndex.textContent = String(expectedIndex);

  observation.actualValue.textContent = JSON.stringify(actualValue);
  observation.actualIndex.textContent = String(actualIndex);
  observation.actualSelected.textContent = formatOptions(actualSelectedValues);
  observation.actualOptions.textContent = formatOptions(actualOptionValues);

  const optionsMatch =
    actualOptionValues.length === options.length &&
    actualOptionValues.every((value, index) => value === options[index]);
  const matches =
    optionsMatch &&
    actualValue === selected &&
    actualIndex === expectedIndex &&
    actualSelectedOption === selected;

  if (matches) {
    observation.verdict.textContent = started
      ? '일치 — 버튼 시나리오 후에도 실제 DOM이 기대 State와 같습니다. 이 환경에서는 증상이 재현되지 않았습니다.'
      : '초기 상태 일치 — 아직 시나리오를 실행하지 않았습니다. 버튼을 눌러 확인하세요.';
    observation.verdict.dataset['state'] = 'match';
  } else if (started) {
    observation.verdict.textContent = `불일치 — 증상 재현됨: state.selected=${JSON.stringify(selected)}를 기대하지만 실제 select.value=${JSON.stringify(actualValue)}, selectedIndex=${actualIndex}입니다.`;
    observation.verdict.dataset['state'] = 'mismatch';
  } else {
    observation.verdict.textContent = '초기 상태부터 불일치 — 예상 밖의 상태입니다.';
    observation.verdict.dataset['state'] = 'mismatch';
  }

  observation.details.textContent = [
    `관찰 시점: ${started ? '시나리오 버튼 이후 commit' : '최초 mount commit'}`,
    `기대: selected=${JSON.stringify(selected)}, options=${formatOptions(options)}, selectedIndex=${expectedIndex}`,
    `실제: select.value=${JSON.stringify(actualValue)}, selectedIndex=${actualIndex}`,
    `실제 option 값: ${formatOptions(actualOptionValues)}`,
    `실제 선택된 option 값: ${formatOptions(actualSelectedValues)}`,
    `select.options.length=${select.options.length}`,
    '',
    '이 영역은 #app 바깥에서 읽기만 했습니다. 값 비교를 위해 DOM을 변경하지 않았습니다.'
  ].join('\n');
}

function reportUnexpectedError(error: unknown): void {
  observation.verdict.textContent = `엔진 실행 오류: ${String(error)}`;
  observation.verdict.dataset['state'] = 'mismatch';
  observation.details.textContent = String(error);
}

window.addEventListener('error', (event) => {
  reportUnexpectedError(event.error ?? event.message);
});

const container = document.querySelector<HTMLElement>('#app');

if (container === null) {
  throw new Error('#app 컨테이너를 찾을 수 없습니다');
}

try {
  startApp(App, container);
} catch (error) {
  reportUnexpectedError(error);
}
