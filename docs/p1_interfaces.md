# Phase 1 인터페이스

기준: `p1_prd.md`, `p1_function_flow.md`, `p1_test_cases.md`, `p1_decisions.md`.

아래 코드는 구현 코드가 아니라 타입·함수 계약이다. `accepted`와 `제안`을 구분한다. `제안` 항목은 확정 전까지 구현 기준으로 사용하지 않는다.

## 1. 공통 타입 — accepted

```ts
// src/vdom/types.ts

export type VNodeType = 1 | 3;

export interface VNodeAttribute {
  name: string;
  value: string;
}

export type VNodeProperties = Record<string, unknown>;

export interface VNode {
  nodeType: VNodeType;          // 1: Element, 3: Text
  tagName: string | null;       // element: uppercase, text: null
  attributes: VNodeAttribute[];
  nodeValue: string | null;     // text only
  childNodes: VNode[];
  properties: VNodeProperties;
  dom: Node | null;
}

export interface VRoot {
  childNodes: VNode[];
  dom: Element | null;
}
```

- `nodeType`은 DOM 표준 상수다. 요소 `1`, 텍스트 `3`만 지원하고 주석 `8`은 제외한다.
- `VRoot`는 실제 영역 컨테이너에 대응하는 논리적 루트다. 컨테이너 태그·속성을 가지지 않으며 Diff 대상이 아니다.
- `dom`은 Snapshot 종료 시 null이다. Diff 종료 시 `VRoot`와 유지·이동·수정 노드에 실제 DOM이 연결되고, insert/replace 노드는 Patch 성공 후 연결된다.
- `key`는 `attributes`에서 제거하지 않고 실제 DOM에도 렌더링한다.

## 2. VDOM create — accepted

```ts
// src/vdom/create.ts

export function parseHTML(html: string): DocumentFragment;

export function createSnapshot(parsedRoot: ParentNode): VRoot;

export function createEmptyVDOM(actualRoot: Element): VRoot;

export function snapshotNode(node: Node): VNode | null;

export function readAttributes(element: Element): VNodeAttribute[];

export function readProperties(element: Element): VNodeProperties;
```

- `parseHTML()`은 화면에 삽입하지 않는 임시 DOM을 만든다. `<template>`의 `content`를 사용한다.
- `createSnapshot()`은 주석을 제외한 `VNode`/`VRoot` 데이터를 복사한다. 모든 `dom`은 null이다.
- `createEmptyVDOM()`은 `{ childNodes: [], dom: actualRoot }`를 반환한다. 초기화의 비교 기준이다.
- `snapshotNode()`는 주석이면 null을 반환한다.
- `readAttributes()`는 `key`를 포함한 모든 속성을 `{ name, value }`로 복사한다.
- `readProperties()`는 `propertySchema`에 지정된 현재 DOM 프로퍼티만 읽는다.

```js
const propertySchema = {
  INPUT: ["value", "checked", "indeterminate"],
  TEXTAREA: ["value"],
  SELECT: ["value"],
  OPTION: ["selected"]
};
```

## 3. Diff — accepted

```ts
// src/vdom/diff.ts

export interface AttributeUpdate {
  setAttributes: VNodeAttribute[];
  removeAttributes: string[];
}

export type UpdateData = {
  nodeValue?: string;
  setAttributes?: VNodeAttribute[];
  removeAttributes?: string[];
  properties?: VNodeProperties;
};

export type DiffCommand =
  | { type: 'replace'; target: VNode; node: VNode }
  | { type: 'update'; target: VNode; data: UpdateData }
  | { type: 'insert'; node: VNode; parent: VNode | VRoot; before: VNode | null }
  | { type: 'remove'; target: VNode }
  | { type: 'move'; target: VNode; parent: VNode | VRoot; before: VNode | null };

export function diff(prevRoot: VRoot, nextRoot: VRoot): DiffCommand[];

export function orderChanges(changes: DiffCommand[]): DiffCommand[];

export function diffAttributes(prev: VNode, next: VNode): AttributeUpdate | null;

export function diffProperties(prev: VNode, next: VNode): VNodeProperties | null;
```

- `target`은 이전 VDOM 노드, `node`는 다음 VDOM 노드다.
- `parent`는 다음 VDOM의 `VNode` 또는 `VRoot`다. root-level insert·move는 `VRoot`를 parent로 사용한다.
- `before`는 다음 VDOM 노드 또는 null이다. `before === null`은 맨 뒤를 뜻한다.
- `diff()`는 정렬된 명령 배열을 반환하며, 이전 VDOM과 실제 DOM을 수정하지 않는다.
- Diff 종료 시 `VRoot`와 유지·이동·수정 노드의 `dom`은 실제 DOM에 연결되고, insert/replace 노드의 `dom`은 null로 남는다.
- 노드 대응은 keyed 요소는 같은 `key`, keyless 요소와 텍스트 노드는 같은 부모 안의 자식 순서로 계산한다.
- `replace`는 제자리 교체만 담당하고, 위치 이동은 `move`가 담당한다.
- `orderChanges()`는 부모·기준 형제가 먼저 존재하도록 명령 순서를 정한다.

## 4. Diff·Patch 공유 매칭과 연결 — accepted

`P1-PATCH-LINK-02`로 확정했다. 매칭은 `src/vdom/match.ts`, 연결은 `src/vdom/link.ts`에 둔다.

```ts
// src/vdom/match.ts

export interface ChildMatchPlan {
  pairs: Array<{ prev: VNode; next: VNode }>;          // next 순서
  inserts: Array<{ next: VNode; before: VNode | null }>;
  removals: VNode[];                                   // prev 순서
  moves: Array<{ prev: VNode; next: VNode; before: VNode | null }>;
}

export function matchChildren(
  prevChildren: VNode[],
  nextChildren: VNode[]
): ChildMatchPlan;
```

```ts
// src/vdom/link.ts

export function linkNode(prev: VNode, next: VNode): boolean;

export function linkMatchedDom(prev: VRoot, next: VRoot): void;

export function isLinkablePair(prev: VNode, next: VNode): boolean;
```

- Diff는 이 계획으로 `insert`·`remove`·`move`·재귀 대상을 만들고, 같은 type/tag의 pair에 `linkNode()`를 적용해 `prev.dom`을 `next.dom`에 연결한다.
- Patch는 `matchChildren()`을 실행하지 않는다. 유지·이동 노드는 Diff가 연결한 참조를 사용한다.
- `pairs`는 replace 대상도 포함할 수 있다. Diff의 연결 단계에서는 type/tag가 다른 쌍을 건너뛴다.
- `inserts`의 노드는 대응하는 이전 노드가 없으므로 `dom`을 연결하지 않는다. Patch의 `renderNode()`가 새 DOM을 연결한다.
- `linkMatchedDom()`은 전체 트리를 한 번에 연결하는 유틸리티다. Diff 구현은 매칭을 한 번만 수행하기 위해 `linkNode()`를 매칭 계획의 pair마다 호출한다.
- 중복 key는 현재 등장 순서대로 대응하는 잠정 동작이며, CONF-03 확정 시 함께 조정한다.

## 5. Patch — accepted

`P1-PATCH-LINK-02`로 확정했다. 구현은 `src/vdom/patch.ts`에 둔다.

```ts
// src/vdom/patch.ts

export function applyPatch(
  prevRoot: VRoot,
  nextRoot: VRoot,
  changes: DiffCommand[]
): VRoot;

export function renderNode(vnode: VNode): Node;

export function renderChildren(root: VRoot, container: Element): void;

export function assertAllLinked(root: VRoot, actualRoot: Element): void;
```

내부 DOM 연산:

```ts
function updateText(target: VNode, nodeValue: string): void;
function updateAttributes(target: VNode, data: UpdateData): void;
function updateProperties(target: VNode, properties: VNodeProperties): void;
function replaceNode(target: VNode, node: VNode): void;
function insertNode(node: VNode, parent: VNode | VRoot, before: VNode | null): void;
function removeNode(target: VNode): void;
function moveNode(target: VNode, parent: VNode | VRoot, before: VNode | null): void;
```

확정된 `applyPatch()` 계약:

- `changes`는 `diff()` 또는 `orderChanges()`가 정렬한 명령 배열이다.
- `diff()`가 유지·이동·수정 노드와 `VRoot`의 `prev.dom`을 `next.dom`에 이미 연결했다고 전제한다.
- 변경 명령을 적용한다. insert/replace 노드는 `renderNode()`가 실제 DOM을 생성하고 하위 트리까지 연결한다.
- `assertAllLinked(nextRoot, actualRoot)`로 `VRoot`와 모든 `VNode`의 연결을 확인한다.
- 완성된 `nextRoot`를 반환한다.
- History 저장은 하지 않는다. 저장 여부는 `handlePatch()`가 결정한다.

`diff()`는 `DiffCommand[]`를 반환하며, 매칭 결과를 별도 반환값으로 넘기지 않는다. 매칭과 유지 노드 연결은 `diff()` 내부에서 한 번 수행한다.

## 6. App·통합 — accepted (I/O 제안)

```ts
// src/app/init.ts

export interface AppElements {
  editor: HTMLTextAreaElement;
  actualRoot: HTMLElement;
  patchButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
}

export function getElements(): AppElements;

export function init(): { elements: AppElements; root: VRoot };
```

```ts
// src/app/editor.ts (제안)

export function readEditorHTML(editor: HTMLTextAreaElement): string;
export function writeEditorHTML(editor: HTMLTextAreaElement, html: string): void;
```

`handlePatch()` 연결:

```ts
const prev = history.get();
const html = readEditorHTML(editor);
const next = createSnapshot(parseHTML(html));
const changes = diff(prev, next); // 유지 노드의 dom 참조 연결 포함

if (changes.length === 0) return;

const completed = applyPatch(prev, next, changes); // insert/replace 새 DOM 연결
history.set(completed, html);
```

- `readEditorHTML`/`writeEditorHTML`의 인자 형태는 앱 통합 단계에서 확정한다.

## 7. 상태 요약

| 인터페이스 | 상태 | 근거 |
| --- | --- | --- |
| `VNode`, `VRoot`, `DiffCommand` | accepted | P1-VDOM-ROOT-01, PRD §9 |
| VDOM create 함수 | accepted | PRD §5, 함수 흐름 §5 |
| Diff 함수·명령 | accepted | PRD §4, §9.2 |
| `matchChildren`, `ChildMatchPlan` | accepted | P1-PATCH-LINK-02 |
| `linkNode`, `linkMatchedDom`, `isLinkablePair` | accepted | P1-PATCH-LINK-02 |
| Patch 함수·연결 방식 | accepted | P1-PATCH-LINK-02 |
| `AppElements`, `init` | accepted | P1-UI-01 |
| `readEditorHTML`, `writeEditorHTML` | 제안 | 앱 통합 단계 |
