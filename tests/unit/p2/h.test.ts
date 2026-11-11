import { afterEach, describe, expect, it } from 'vitest';
import { h, startApp } from '../../../src/component';
import type { VNode } from '../../../src/vdom/types';
import { createContainer, resetBody } from '../../helpers/p2';

afterEach(resetBody);

function attributeMap(node: VNode): Record<string, string> {
  return Object.fromEntries(node.attributes.map((item) => [item.name, item.value]));
}

function textOf(node: VNode): string | null {
  return node.nodeValue;
}

describe('H-01 h()는 태그·props·children으로 요소 VNode를 만든다', () => {
  it('속성·텍스트 자식을 담고 dom은 null이다', () => {
    const node = h('div', { class: 'box', title: 't' }, 'A');

    expect(node.nodeType).toBe(1);
    expect(node.tagName).toBe('DIV');
    expect(attributeMap(node)).toMatchObject({ class: 'box', title: 't' });
    expect(node.childNodes).toHaveLength(1);
    expect(node.childNodes[0]?.nodeType).toBe(3);
    expect(textOf(node.childNodes[0]!)).toBe('A');
    expect(node.dom).toBeNull();
  });
});

describe('H-02 children의 문자열·숫자를 Text VNode로 변환한다', () => {
  it('숫자는 문자열로 바뀌고 배열 안 값도 변환된다', () => {
    const spread = h('p', {}, 'A', 0, 1);
    const nested = h('p', {}, ['B', 2]);

    expect(spread.childNodes.map(textOf)).toEqual(['A', '0', '1']);
    expect(nested.childNodes.map(textOf)).toEqual(['B', '2']);
    expect(spread.childNodes.every((child) => child.nodeType === 3)).toBe(true);
  });
});

describe('H-03 중첩 배열을 펼치고 null·undefined·boolean·빈 값을 제외한다', () => {
  it('li 두 개만 남고 빈 배열·빈 문자열은 오류가 아니다', () => {
    const list = h(
      'ul',
      {},
      [h('li', {}, 'A'), [[h('li', {}, 'B')]]],
      null,
      undefined,
      true,
      false,
      [],
      ''
    );

    expect(list.childNodes.map((child) => child.tagName)).toEqual(['LI', 'LI']);
    expect(list.childNodes.map((child) => child.childNodes[0]?.nodeValue)).toEqual([
      'A',
      'B'
    ]);
  });
});

describe('H-04 Component의 원시 문자열·숫자 반환은 오류다', () => {
  it('단독 반환과 배열 안 원시값 모두 오류다', () => {
    function PrimitiveApp(): unknown {
      return '안녕';
    }

    function MixedApp(): unknown {
      return [h('p', {}, 'A'), 'B'];
    }

    const primitiveContainer = createContainer();
    const mixedContainer = createContainer();

    expect(() => startApp(PrimitiveApp, primitiveContainer)).toThrow();
    expect(primitiveContainer.textContent).toBe('');
    expect(() => startApp(MixedApp, mixedContainer)).toThrow();
    expect(mixedContainer.textContent).toBe('');
  });
});

describe('H-05 children의 허용되지 않는 값은 오류다', () => {
  it('객체·함수·DOM Node·Promise를 자식으로 받지 않는다', () => {
    expect(() => h('div', {}, { a: 1 })).toThrow();
    expect(() => h('div', {}, () => null)).toThrow();
    expect(() => h('div', {}, document.createElement('span'))).toThrow();
    expect(() => h('div', {}, Promise.resolve('A'))).toThrow();
  });
});

describe('H-06 props를 attribute·property·event·key로 분류한다', () => {
  it('key·class는 attributes, value·checked는 properties로 나뉜다', () => {
    const input = h('input', {
      key: 'n',
      class: 'box',
      value: 'A',
      checked: false
    });

    expect(attributeMap(input)).toMatchObject({ key: 'n', class: 'box' });
    expect(input.properties).toMatchObject({ value: 'A', checked: false });
    expect(attributeMap(input)).not.toHaveProperty('value');
    expect(attributeMap(input)).not.toHaveProperty('checked');
  });

  it('숫자 attribute 값은 문자열로 변환한다', () => {
    const node = h('div', { key: 1, title: 0 });

    expect(attributeMap(node)).toMatchObject({ key: '1', title: '0' });
  });
});

describe('H-07 boolean attribute는 true를 빈 값으로, false를 생략으로 처리한다', () => {
  it('attributes에만 규칙을 적용하고 properties는 그대로 둔다', () => {
    const off = h('button', { disabled: false }, '저장');
    const on = h('button', { disabled: true }, '저장');
    const zero = h('div', { hidden: 0 });
    const empty = h('div', { class: '' });
    const checked = h('input', { checked: false });

    expect(attributeMap(off)).not.toHaveProperty('disabled');
    expect(attributeMap(on)).toMatchObject({ disabled: '' });
    expect(attributeMap(zero)).toMatchObject({ hidden: '0' });
    expect(attributeMap(empty)).toMatchObject({ class: '' });
    expect(checked.properties).toMatchObject({ checked: false });
    expect(attributeMap(checked)).not.toHaveProperty('checked');
  });
});

describe('H-08 잘못된 첫 인자는 오류다', () => {
  it('빈 문자열·공백·null·숫자·객체를 tag로 받지 않는다', () => {
    const container = createContainer();

    expect(() => h('', {}, 'A')).toThrow();
    expect(() => h('   ', {}, 'A')).toThrow();
    expect(() => h(null as unknown as string, {}, 'A')).toThrow();
    expect(() => h(1 as unknown as string, {})).toThrow();
    expect(() => h({} as unknown as string, {})).toThrow();

    // 잘못된 첫 인자는 DOM을 만들지 않고 컨테이너도 건드리지 않는다.
    expect(container.childNodes).toHaveLength(0);
  });
});

describe('H-09 함수 분기는 즉시 실행하고 props를 그대로 전달한다', () => {
  it('Child를 한 번 실행하고 props 객체·내부 참조를 그대로 전달한다', () => {
    const log: string[] = [];
    const payload = { label: 'A' };
    const callback = () => {
      log.push('callback');
    };
    const props = { payload, onCustom: callback, children: '직접 지정' };
    let received: typeof props | undefined;
    let childCalls = 0;

    function Child(receivedProps: typeof props): VNode {
      childCalls += 1;
      received = receivedProps;
      log.push('child');
      return h('p', {}, 'A');
    }

    log.push('before');
    const nodes = h(Child, props);
    log.push('after');

    expect(childCalls).toBe(1);
    expect(log).toEqual(['before', 'child', 'after']);
    expect(received).toBe(props);
    expect(received?.payload).toBe(payload);
    expect(received?.onCustom).toBe(callback);
    expect(received?.children).toBe('직접 지정');
    expect(nodes).toHaveLength(1);

    received?.onCustom();
    expect(log).toEqual(['before', 'child', 'after', 'callback']);
  });

  it('props 생략·undefined·null은 각각 빈 객체로 전달한다', () => {
    const receivedProps: unknown[] = [];

    function EmptyChild(props?: unknown): null {
      receivedProps.push(props);
      return null;
    }

    expect(h(EmptyChild)).toEqual([]);
    expect(h(EmptyChild, undefined)).toEqual([]);
    expect(h(EmptyChild, null)).toEqual([]);
    expect(receivedProps).toHaveLength(3);

    for (const props of receivedProps) {
      expect(typeof props).toBe('object');
      expect(props).not.toBeNull();
      expect(Object.keys(props as Record<string, unknown>)).toEqual([]);
    }
  });

  it('세 번째 이후 인자는 자식 실행 전에 오류다', () => {
    const log: string[] = [];
    const payload = { label: 'A' };
    const callback = () => {
      log.push('callback');
    };
    const props = { payload, onCustom: callback, children: '직접 지정' };
    let received: typeof props | undefined;
    let childCalls = 0;

    // 정상 호출 테스트와 같은 Child/props fixture를 쓴다.
    function Child(receivedProps: typeof props): VNode {
      childCalls += 1;
      received = receivedProps;
      log.push('child');
      return h('p', {}, 'A');
    }

    // 잘못된 호출은 타입 검사 밖의 런타임 입력으로만 전달한다.
    const callWithExtra = (...args: unknown[]): unknown =>
      Reflect.apply(h as (...values: unknown[]) => unknown, undefined, args);

    expect(() => callWithExtra(Child, {}, 'A')).toThrow();
    expect(childCalls).toBe(0);

    expect(() => callWithExtra(Child, props, undefined)).toThrow();
    expect(childCalls).toBe(0);

    expect(() => callWithExtra(Child, props, [])).toThrow();
    expect(childCalls).toBe(0);
    expect(received).toBeUndefined();
    expect(log).toEqual([]);
  });
});

describe('H-10 자식 반환값은 기존 Component 규칙으로 정규화한다', () => {
  const a = h('p', {}, 'A');
  const b = h('span', {}, 'B');

  function runChild(value: unknown): { nodes: VNode[]; entries: number } {
    let entries = 0;

    function Child(_props: unknown): unknown {
      entries += 1;
      return value;
    }

    return { nodes: h(Child, {}), entries };
  }

  it('허용값은 재귀적으로 펼친 VNode[]이며 원본 참조를 유지한다', () => {
    expect(runChild(a).nodes).toEqual([a]);
    expect(runChild(a).nodes[0]).toBe(a);

    const nested = runChild([a, [[b]], null, undefined, true, false, []]);
    expect(nested.nodes).toEqual([a, b]);
    expect(nested.nodes[0]).toBe(a);
    expect(nested.nodes[1]).toBe(b);

    for (const value of [null, undefined, true, false, []]) {
      expect(runChild(value).nodes).toEqual([]);
    }
  });

  it('거부값은 자식 진입 1회 뒤 오류이고 직접·중첩 모두 Text VNode로 바꾸지 않는다', () => {
    const rejected: unknown[] = [
      '안녕',
      '',
      0,
      1,
      { a: 1 },
      () => null,
      document.createElement('span'),
      Promise.resolve(a)
    ];
    const container = createContainer();

    for (const value of rejected) {
      let directEntries = 0;
      function Child(_props: unknown): unknown {
        directEntries += 1;
        return value;
      }

      expect(() => h(Child, {})).toThrow();
      expect(directEntries).toBe(1);

      let nestedEntries = 0;
      function NestedChild(_props: unknown): unknown {
        nestedEntries += 1;
        return [a, [value]];
      }

      expect(() => h(NestedChild, {})).toThrow();
      expect(nestedEntries).toBe(1);
      expect(container.childNodes).toHaveLength(0);
    }
  });
});

describe('H-11 요소와 함수 자식을 기존 VNode로 합성한다', () => {
  it('단독 합성과 startApp 최초 표시가 깊이 우선 순서를 유지한다', () => {
    const log: string[] = [];

    function Grandchild(): VNode {
      log.push('grandchild');
      return h('i', {}, 'G');
    }

    function Child({ label }: { label: string }): unknown {
      log.push(`child:${label}`);
      return [h('span', {}, label), [h(Grandchild, {})]];
    }

    function App(): VNode {
      return h(
        'section',
        {},
        h(Child, { label: 'A' }),
        h('b', {}, 'B'),
        h(Child, { label: 'C' })
      );
    }

    const single = h(
      'section',
      {},
      h(Child, { label: 'A' }),
      h('b', {}, 'B'),
      h(Child, { label: 'C' })
    );

    expect(single.nodeType).toBe(1);
    expect(single.tagName).toBe('SECTION');
    expect(single.childNodes.map((child) => child.tagName)).toEqual([
      'SPAN',
      'I',
      'B',
      'SPAN',
      'I'
    ]);
    expect(single.childNodes[0]?.childNodes[0]?.nodeValue).toBe('A');
    expect(single.childNodes[2]?.childNodes[0]?.nodeValue).toBe('B');
    expect(log).toEqual(['child:A', 'grandchild', 'child:C', 'grandchild']);

    log.length = 0;
    const container = createContainer();
    startApp(App, container);

    expect(log).toEqual(['child:A', 'grandchild', 'child:C', 'grandchild']);
    expect(
      Array.from(container.querySelectorAll('span, i, b')).map(
        (element) => element.tagName
      )
    ).toEqual(['SPAN', 'I', 'B', 'SPAN', 'I']);
    expect(container.textContent).toBe('AGBCG');
  });

  it('루트 컴포넌트가 함수 h 결과를 그대로 반환하면 형제 요소로 표시한다', () => {
    const log: string[] = [];

    function Grandchild(): VNode {
      log.push('grandchild');
      return h('i', {}, 'G');
    }

    function Child({ label }: { label: string }): unknown {
      log.push(`child:${label}`);
      return [h('span', {}, label), [h(Grandchild, {})]];
    }

    function RootChildApp(): VNode[] {
      return h(Child, { label: 'A' });
    }

    const container = createContainer();
    startApp(RootChildApp, container);

    expect(log).toEqual(['child:A', 'grandchild']);
    expect(
      Array.from(container.children).map((element) => element.tagName)
    ).toEqual(['SPAN', 'I']);
    expect(container.textContent).toBe('AG');
  });
});

describe('h() props 인자를 생략하거나 null·undefined로 넘길 수 있다', () => {
  it('모두 빈 attributes·properties로 처리하고 events 필드를 만들지 않는다', () => {
    const nodes = [h('div'), h('div', null), h('div', undefined)];

    for (const node of nodes) {
      expect(node.attributes).toEqual([]);
      expect(node.properties).toEqual({});
      expect(node.events).toBeUndefined();
    }
  });
});

describe('h()는 tagName을 trim한 뒤 대문자로 저장한다', () => {
  it('앞뒤 공백을 제거한 이름을 쓴다', () => {
    expect(h(' div ', {}, 'A').tagName).toBe('DIV');
  });
});

describe('h()는 className을 class로 정규화한다', () => {
  it('className prop은 class attribute로 저장된다', () => {
    const node = h('div', { className: 'box' });

    expect(attributeMap(node)).toEqual({ class: 'box' });
  });
});

describe('h()는 style·dataset 객체 props를 오류로 처리한다', () => {
  it('객체 값을 attribute로 변환하지 않는다', () => {
    expect(() => h('div', { style: { color: 'red' } })).toThrow();
    expect(() => h('div', { dataset: { id: 'a' } })).toThrow();
  });
});

describe('h()는 태그별 propertySchema를 재사용한다', () => {
  it('INPUT의 value는 properties, DIV의 value는 attributes로 분류한다', () => {
    const input = h('input', { value: 'A' });
    const div = h('div', { value: 'A' });

    expect(input.properties).toEqual({ value: 'A' });
    expect(attributeMap(input)).toEqual({});
    expect(div.properties).toEqual({});
    expect(attributeMap(div)).toEqual({ value: 'A' });
  });

  it('properties 값은 받은 그대로 저장한다', () => {
    const input = h('input', { value: 0, checked: false });

    expect(input.properties).toEqual({ value: 0, checked: false });
  });
});

describe('h()는 onClick·onInput·onChange를 events에 원본 함수로 담는다', () => {
  it('DOM 이벤트 이름으로 저장하고 wrapper로 감싸지 않는다', () => {
    const click = () => {};
    const input = () => {};
    const change = () => {};
    const node = h('input', {
      onClick: click,
      onInput: input,
      onChange: change
    });

    expect(node.events).toEqual({ click, input, change });
    expect(node.events?.click).toBe(click);
    expect(node.events?.input).toBe(input);
    expect(node.events?.change).toBe(change);
  });
});

describe('h()는 null·undefined 이벤트를 연결하지 않는다', () => {
  it('이벤트가 없으면 events 필드를 만들지 않는다', () => {
    const node = h('button', { onClick: null, onInput: undefined }, '저장');

    expect(node.events).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(node, 'events')).toBe(false);
  });
});

describe('Text VNode에는 events 필드가 없다', () => {
  it('문자열 자식은 이벤트를 갖지 않는다', () => {
    const text = h('p', {}, 'A').childNodes[0]!;

    expect(text.nodeType).toBe(3);
    expect(Object.prototype.hasOwnProperty.call(text, 'events')).toBe(false);
  });
});

describe('h()는 지원 밖 on* prop과 함수가 아닌 이벤트 값을 오류로 처리한다', () => {
  it('onBlur·onClick 문자열을 받지 않는다', () => {
    expect(() => h('div', { onBlur: () => {} })).toThrow();
    expect(() => h('div', { onClick: 'handler' })).toThrow();
  });
});
