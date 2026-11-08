# Phase 1 인터페이스

기준: `p1_prd.md`, `p1_function_flow.md`, `p1_test_cases.md`, `p1_decisions.md`. History·복원·Handler의 상세 설계는 `p1_history_handler_design.md`를 따른다.

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
- `readProperties()`는 `propertySchema`에 지정된 현재 DOM 프로퍼티를 빠짐없이 읽는다. HTML 속성의 존재 여부나 값의 참·거짓으로 항목을 생략하지 않는다. 기본값을 추측해 채우지 않고 파싱된 DOM 값을 그대로 수집한다. 이 생성 계약은 P1-PROPERTY-SNAPSHOT-01을 따른다.

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
// Diff 계약. 외부 진입점 src/vdom/diff/index.ts는 diff만 내보낸다.
// AttributeUpdate는 diff/types.ts, orderChanges는 diff/orderChanges.ts의 내부 계약이다.

export interface AttributeUpdate {
  setAttributes?: VNodeAttribute[];
  removeAttributes?: string[];
}

export type UpdateData = {
  nodeValue?: string;
  setAttributes?: VNodeAttribute[];
  removeAttributes?: string[];
  setProperties?: VNodeProperties;
  removeProperties?: string[];
};

export type DiffCommand =
  | { type: 'replace'; target: VNode; node: VNode }
  | { type: 'update'; target: VNode; data: UpdateData }
  | { type: 'insert'; node: VNode; parent: VNode | VRoot; before: VNode | null }
  | { type: 'remove'; target: VNode }
  | { type: 'move'; target: VNode; parent: VNode | VRoot; before: VNode | null };

export function diff(prevRoot: VRoot, nextRoot: VRoot): DiffCommand[];

export function orderChanges(changes: DiffCommand[]): DiffCommand[];

export function findAttributeUpdates(prev: VNodeAttribute[], next: VNodeAttribute[]): AttributeUpdate;

export function findPropertyUpdates(prev: VNodeProperties, next: VNodeProperties): Pick<UpdateData, 'setProperties' | 'removeProperties'>;
```

- `target`은 이전 VDOM 노드, `node`는 다음 VDOM 노드다.
- `parent`는 다음 VDOM의 `VNode` 또는 `VRoot`다. root-level insert·move는 `VRoot`를 parent로 사용한다.
- `before`는 다음 VDOM 노드 또는 null이다. `before === null`은 맨 뒤를 뜻한다.
- `diff()`는 정렬된 명령 배열을 반환하며, 이전 VDOM과 실제 DOM을 수정하지 않는다.
- 내부 `findAttributeUpdates()`는 작업이 없는 필드를 생략한다. 변경이 없으면 `{}`를 반환해 상위 함수가 불필요한 update 명령을 만들지 않도록 한다. 이름별 조회표로 추가·변경·삭제를 계산하며 검증 범위는 `p1_diff_notes.md` §16을 따른다.
- `findPropertyUpdates()`는 다음 VDOM에 추가·변경된 값은 `setProperties`, 사라진 이름은 `removeProperties`에 담는다. 값이 없는 작업은 생략하며 실제 DOM 제거 방법은 미확정이다.
- 다음 VDOM은 비교용 데이터를 보존하고 `dom`만 연결한다. 현재 개인 구현에서는 `diff()`가 루트를, `collectNodeChanges()`가 `linkNode()`로 유지 노드를 연결한다. `findChildMatches()`의 대응을 재사용하며 전체 트리를 재매칭하지 않는다. 구현·명세 기반 검증 범위는 `p1_diff_notes.md` §14를 따른다.
- Diff 종료 시 `VRoot`와 유지·이동·수정 노드의 `dom`은 실제 DOM에 연결되고, insert/replace 노드의 `dom`은 null로 남는다.
- 노드 대응은 keyed 요소는 같은 `key`, keyless 요소와 텍스트 노드는 같은 부모 안의 자식 순서로 계산한다.
- `replace`는 제자리 교체만 담당하고, 위치 이동은 `move`가 담당한다.
- `orderChanges()`는 부모·기준 형제가 먼저 존재하도록 명령 순서를 정한다. 같은 이전 대상을 가리키는 move와 replace는 move를 먼저 실행한다. 명령의 의미적 유효성(예: `parent`가 remove 대상인지)은 검증하지 않으며, 잘못된 명령을 고치지 않는다. 명령의 유효성은 Diff의 책임이다. 단, 같은 next `VNode`를 만드는 `insert`/`replace`가 중복되거나 같은 prev `VNode`를 여러 번 `replace`하는 구조적 모순은 오류로 처리한다.

## 4. Diff 자식 매칭과 DOM 연결 — accepted

`P1-PATCH-LINK-02`의 연결 계약을 유지하고, 공용 매칭 구현은 `P1-MATCH-REMOVE-01`에 따라 `findChildMatches()` 한 경로로 통일한다. 매칭은 `src/vdom/diff/findChildMatches.ts`, 연결은 `src/vdom/link.ts`에 둔다.

```ts
// src/vdom/diff/types.ts

export type Parent = VRoot | VNode;

export type ChildMatch =
  | { kind: 'matched'; prev: VNode; next: VNode }
  | { kind: 'inserted'; next: VNode }
  | { kind: 'removed'; prev: VNode };

// src/vdom/diff/findChildMatches.ts

export function findChildMatches(
  prevChildren: VNode[],
  nextChildren: VNode[]
): ChildMatch[];
```

```ts
// src/vdom/link.ts

export function linkNode(prev: VNode, next: VNode): boolean;

export function isLinkablePair(prev: VNode, next: VNode): boolean;
```

- Diff는 `findChildMatches()` 결과를 `collectNodeChanges()`와 `collectMoveChanges()`에서 재사용한다. 전체 트리를 다시 매칭하지 않는다.
- 같은 type/tag의 `matched` pair에는 `linkNode()`를 적용해 `prev.dom`을 `next.dom`에 연결한다. type/tag가 다른 pair는 replace 대상이므로 연결하지 않는다.
- `inserted` 노드는 대응하는 이전 노드가 없으므로 Diff가 연결하지 않는다. Patch의 `renderNode()`가 새 DOM을 연결한다.
- Patch는 매칭을 실행하지 않는다. 유지·이동 노드는 Diff가 연결한 참조를 사용한다.
- 노드 식별 규칙은 P1-CONF-03으로 확정됐다. 같은 key + 같은 태그는 matched/update, 같은 key + 다른 태그는 replace, key 변경은 remove + insert다.
- 중복 key는 key 대응에서 제외하고 keyless 순서 대응 목록에 넣는다. 어느 한쪽 목록에서라도 중복된 key는 그 비교에서 식별자로 사용하지 않으며, 원본 `attributes`의 key 속성은 삭제하지 않는다.

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

## 6. App·통합 — accepted

### 6.1 History

`P1-HISTORY-STATE-01`로 확정했다. History는 저장 entry, 현재 위치, 현재 live VDOM을 함께 소유한다.

```ts
// src/app/history.ts

export type HistoryDirection = -1 | 0 | 1;

export interface HistoryEntry {
  vdom: VRoot;   // 모든 dom이 null인 저장 데이터
  html: string;
}

export interface History {
  get(): VRoot;
  set(vdom: VRoot, html: string): void;
  peek(direction: HistoryDirection): Readonly<HistoryEntry> | null;
  move(direction: HistoryDirection, liveVDOM: VRoot): void;
}

export function createHistory(): History;
```

- `get()`은 현재 화면과 연결된 live VDOM을 반환한다. 첫 `set()` 전에는 오류다.
- `peek()`은 저장 entry의 읽기 전용 view를 반환하며 위치를 바꾸지 않는다. 범위 밖이면 null이다.
- `move()`는 위치와 currentLive만 갱신한다. 새 entry를 추가하지 않으며 범위 밖에서는 완전한 no-op이다. `move(0, liveVDOM)`은 위치를 유지하고 currentLive만 교체한다.
- `set()`은 `cloneSnapshotData(vdom)`을 먼저 완료한 뒤 미래 이력을 제거하고 새 entry를 추가한다. 최대 50개를 넘으면 가장 오래된 entry를 제거한다.
- 저장 entry의 `vdom`은 DOM 참조가 없고, properties는 현재 `propertySchema`가 만드는 원시값을 복사한다.

### 6.2 복원

`P1-RESTORE-01`로 확정했다.

```ts
// src/app/restore.ts

export interface RestoreSnapshotOptions {
  editor?: HTMLTextAreaElement;
  restoreEditor?: boolean;
}

export function restoreSnapshot(
  entry: Readonly<HistoryEntry>,
  actualRoot: Element,
  options?: RestoreSnapshotOptions
): VRoot;
```

- `entry.vdom`을 `cloneSnapshotData()`로 복사한 뒤 기존 `renderChildren()`과 `renderNode()`로 전체 렌더링한다.
- 렌더링 후 `assertAllLinked()`로 전체 참조 연결을 확인한다.
- `restoreEditor !== false`이면 `editor`가 필수다. editor 검사는 실제 영역 렌더링 전에 수행한다.
- `writeEditorHTML(editor, entry.html)`은 이 복원 경로와 이력 이동·실패 복구가 공유한다.
- entry 원본은 수정하지 않는다.
- 복원 자체 실패 시 이전 화면 보존은 보장하지 않으며 오류 UI·재시작 정책은 미확정이다.

### 6.3 Handler

```ts
// src/app/handlers.ts

export function createHandlers(
  elements: AppElements,
  history: History
): AppHandlers;
```

`handlePatch()`:

```ts
const prev = history.get();
const html = readEditorHTML(elements.editor);
const next = createSnapshot(parseHTML(html));
const changes = diff(prev, next); // 유지 노드의 dom 참조 연결 포함

if (changes.length === 0) return;

const completed = applyPatch(prev, next, changes); // insert/replace 새 DOM 연결
history.set(completed, html);
```

- `diff()` 예외는 DOM·History를 변경하지 않으므로 복구 catch 범위가 아니다.
- `applyPatch()` 예외는 `peek(0)` → `restoreSnapshot(..., { editor, restoreEditor: false })` → `move(0, liveVDOM)`으로 현재 화면만 복구한 뒤 원래 오류를 다시 던진다.
- 복원도 실패하면 원래 Patch 오류와 복원 오류를 `AggregateError`로 보존한다.
- `history.set()` 실패를 Patch 실패와 같은 복구 범위에 넣는 것은 미확정이다.
- `handleHistoryMove(direction)`은 `peek()`이 null이면 종료하고, entry가 있으면 `restoreSnapshot(..., { editor })` 후 `move(direction, liveVDOM)`을 호출한다. 새 이력을 저장하지 않는다.

### 6.4 App·초기화

```ts
// src/app/init.ts

export interface AppElements {
  editor: HTMLTextAreaElement;
  actualRoot: HTMLElement;
  patchButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
}

export interface InitDependencies extends InitializerDependencies {
  createHistory(): History;
  getSampleHTML(): string;
  createHandlers(elements: AppElements, history: History): AppHandlers;
}

export function getElements(): AppElements;

export function init(dependencies?: InitDependencies): { elements: AppElements; root: VRoot };
```

- `InitializationHistory`는 초기화가 쓰는 `Pick<History, 'get' | 'set'>` 최소 계약으로 유지한다.
- `InitializerDependencies.applyPatch()`는 `VRoot`를 반환하고, `initializeDOM()`은 그 반환값을 `history.set()`에 전달한다.
- `init()`의 반환 `root`는 초기 VDOM 참조다. 이후 현재 상태 조회는 `history.get()`을 사용한다.
- 실제 호출에는 `parseHTML`, `createSnapshot`, `diff`, `applyPatch`, `createHistory`, `getSampleHTML`, `createHandlers`가 필요하다.

```ts
// src/app/editor.ts

export function readEditorHTML(editor: HTMLTextAreaElement): string;
export function writeEditorHTML(editor: HTMLTextAreaElement, html: string): void;
```

- `readEditorHTML()`과 `writeEditorHTML()` 모두 accepted다. `writeEditorHTML`은 복원·실패 복구·이력 이동에서 사용한다.

## 7. 상태 요약

| 인터페이스 | 상태 | 근거 |
| --- | --- | --- |
| `VNode`, `VRoot`, `DiffCommand` | accepted | P1-VDOM-ROOT-01, PRD §9 |
| VDOM create 함수 | accepted | PRD §5, 함수 흐름 §5 |
| Diff 함수·명령 | accepted | PRD §4, §9.2 |
| `findChildMatches`, `ChildMatch` | accepted | P1-MATCH-REMOVE-01 |
| `linkNode`, `isLinkablePair` | accepted | P1-MATCH-REMOVE-01 |
| Patch 함수·연결 방식 | accepted | P1-PATCH-LINK-02 |
| `History`, `HistoryEntry`, `createHistory` | accepted | P1-HISTORY-STATE-01 |
| `cloneSnapshotData`, `restoreSnapshot` | accepted | P1-RESTORE-01 |
| `createHandlers`, `handlePatch`, `handleHistoryMove` | accepted | P1-HISTORY-STATE-01, P1-RESTORE-01 |
| `AppElements`, `init(dependencies?)` | accepted | P1-UI-01, P1-INIT-TDD-01 |
| `InitializationHistory` | accepted | P1-INIT-TDD-01, P1-HISTORY-STATE-01 |
| `readEditorHTML`, `writeEditorHTML` | accepted | P1-HTML-01, P1-RESTORE-01 |
