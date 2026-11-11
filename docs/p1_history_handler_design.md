# Phase 1 — History·Handler·앱 연결 설계

- 상태: 설계 확정 및 구현 완료
- 기준 브랜치: `temp/integrate-jung-patch-chan95821-diff`
- 설계 기준 커밋: `3c3d039`
- 검증: GPT-6.1 Sol subagent 교차 검증 반영
- 구현 검증: 2026-11-08 `npm run check` 22개 파일·193개 테스트 통과, skip/todo 0개, `npm run build` 통과, 실제 브라우저 흐름 확인
- 구현 범위: VDOM·Diff·Patch 위에 History, 복원, Handler, 앱 조립, 통합 검증을 완성했다.

## 1. 목표

현재 실제 앱은 `src/main.ts`에서 `init()`을 의존성 없이 호출해 즉시 예외가 발생한다. 이 설계의 목표는 다음 흐름을 실제 페이지에서 완성하는 것이다.

```text
페이지 로드
→ 샘플 HTML을 VDOM으로 변환
→ 실제 영역 렌더링
→ 편집기 수정
→ Patch
→ 변경 부분만 실제 DOM에 반영
→ History 저장
→ 뒤로·앞으로
→ 실제 영역과 편집기 동시 복원
```

## 2. 이미 확정된 결정

- 테스트 영역은 HTML 코드 편집기다.
- History는 페이지 세션 메모리에만 보관한다.
- History 최대 항목 수는 50개다.
- 상한 초과 시 가장 오래된 항목을 제거한다.
- History 인터페이스를 전체 기능으로 확장한다.
- `writeEditorHTML(editor, html)`을 추가한다.
- 브라우저 기능 검증은 처음에 수동으로 수행한다.
- History가 현재 live VDOM과 저장 항목을 함께 소유한다.
- `history.get()`은 current live VDOM을 반환한다.
- 복원은 `cloneSnapshotData` + `renderChildren` + `assertAllLinked` + `writeEditorHTML`을 재사용한다.
- `restoreSnapshot` 옵션은 `{ editor?, restoreEditor? }` 형태로 한다.
- CONF-03 정책:
  - 같은 key + 같은 태그 → matched/update
  - 같은 key + 다른 태그 → replace
  - key 변경 → remove + insert
  - 중복 key → keyless 순서 기반 대응
- ORDER-04의 기대값은 replace가 아니라 remove + insert로 수정한다.

## 3. 상태 소유권

History는 다음 세 가지를 함께 관리한다.

```text
History
├─ entries: 과거·미래 저장 항목
│  ├─ vdom: dom이 모두 null인 깊은 복사본
│  └─ html: 해당 시점의 편집기 원문
├─ index: 현재 History 위치
└─ currentLive: 현재 화면과 연결된 live VDOM
```

### 중요한 구분

```text
history.get()      → currentLive, 실제 DOM 링크 있음
history.peek()     → entries[index + direction], dom null
history.set()      → entry에는 복사본 저장, currentLive는 전달받은 live VDOM으로 교체
history.move()     → index와 currentLive만 갱신, entries는 변경하지 않음
```

`peek()`이 반환하는 entry는 저장소 내부의 읽기 전용 view다. 호출자는 `entry.vdom`의 하위 데이터를 수정하지 않는다. 실제 복원은 항상 `restoreSnapshot()`에서 `cloneSnapshotData()`를 먼저 수행한다.

## 4. 인터페이스

### 4.1 VDOM 복사

`src/vdom/create.ts`에 추가한다.

```ts
export function cloneSnapshotData(vdom: VRoot): VRoot;
```

계약:

- `VNode` 트리를 재귀 복사한다.
- `attributes`는 새 객체 배열로 복사한다.
- `properties`는 새 객체로 복사한다.
- 현재 `propertySchema`가 만드는 원시값(문자열·불리언)을 지원한다.
- 임의의 중첩 객체를 properties에 넣는 것은 이번 범위가 아니다.
- `VRoot`와 모든 `VNode`의 `dom`은 `null`로 설정한다.
- 입력 VDOM을 수정하지 않는다.

### 4.2 History

`src/app/history.ts`

```ts
export type HistoryDirection = -1 | 0 | 1;

export interface HistoryEntry {
  vdom: VRoot; // 모든 dom null
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

History 최대 항목 수는 내부 상수 `50`으로 둔다. `createHistory()`는 옵션을 받지 않는다.

### 4.3 편집기 쓰기

`src/app/editor.ts`

```ts
export function writeEditorHTML(editor: HTMLTextAreaElement, html: string): void;
```

### 4.4 복원

`src/app/restore.ts`

```ts
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

### 4.5 Handler

`src/app/handlers.ts`

```ts
export function createHandlers(
  elements: AppElements,
  history: History
): AppHandlers;
```

### 4.6 앱 의존성

`src/app/init.ts`의 `CreateHistory`와 `createHandlers`는 전체 `History`를 사용한다.

```ts
export interface InitDependencies extends InitializerDependencies {
  createHistory(): History;
  getSampleHTML(): string;
  createHandlers(elements: AppElements, history: History): AppHandlers;
}
```

`src/app/initialize.ts`의 `InitializationHistory`는 최소 계약으로 유지한다.

```ts
export type InitializationHistory = Pick<History, 'get' | 'set'>;
```

`InitializerDependencies.applyPatch()`의 반환형은 실제 계약에 맞춰 `VRoot`로 수정한다. `initializeDOM()`은 반환된 완성 VDOM을 History에 저장한다.

## 5. History 동작 계약

### 5.1 초기 상태

```text
entries.length = 0
index = -1
currentLive = null
```

### 5.2 set(vdom, html)

순서:

1. `cloneSnapshotData(vdom)`을 먼저 완료한다. 복사가 실패하면 이후 상태를 변경하지 않는다.
2. 현재 index 뒤의 미래 항목을 제거한다.
3. 새 `{ vdom: clone, html }` 항목을 추가한다.
4. 항목 수가 50을 넘으면 가장 오래된 항목을 제거하고 index를 1 감소한다.
5. index를 마지막 항목으로 이동한다.
6. `currentLive = vdom`으로 설정한다.

`vdom`은 Patch 성공 후 실제 DOM 링크가 완성된 VDOM을 전달받는 것을 전제로 한다.

### 5.3 get()

- 현재 `currentLive`를 반환한다.
- 첫 `set()` 전에는 오류를 발생시킨다.
- 반환값은 Patch에서 사용하는 변경 가능한 실행 상태다.

### 5.4 peek(direction)

- `index + direction`이 범위 안이면 해당 entry를 반환한다.
- 범위 밖이거나 초기 상태면 `null`을 반환한다.
- index, entries, currentLive를 변경하지 않는다.
- 반환된 entry는 읽기 전용 view로 취급한다.

### 5.5 move(direction, liveVDOM)

- `index + direction`이 범위 안이면 index를 이동하고 `currentLive = liveVDOM`으로 교체한다.
- 범위 밖이면 아무것도 변경하지 않는다.
- 새 entry를 추가하지 않는다.
- 저장된 entry를 수정하지 않는다.
- `move(0, liveVDOM)`은 index를 유지하고 currentLive만 교체한다.
- 빈 History의 `move(0, liveVDOM)`도 no-op이다.

### 5.6 50개 상한 불변식

```text
0 <= entries.length <= 50
-1 <= index < entries.length
get()은 currentLive가 null이면 오류
peek()은 범위 밖에서 null
move()는 범위 밖에서 완전한 no-op
set() 후 currentLive는 항상 유효한 VDOM
```

예:

- 50개 상태에서 새 상태 저장 → 가장 오래된 1개 제거, 길이 50 유지
- 50개 상태에서 index 20으로 이동 후 새 상태 저장 → 미래 21~49 제거 후 22개 유지, 오래된 이력은 추가 제거하지 않음
- 상한 초과는 set에서만 발생하며 peek·move·no-op Patch는 상한 계산에 영향을 주지 않는다.

### 5.7 새 테스트

`HIST-07 — History 상한 초과 시 가장 오래된 이력 제거`

검증:

- 51번째 set 후 가장 오래된 항목이 사라짐
- index가 새 마지막 항목을 가리킴
- 과거로 이동할 수 있는 최소 상태가 유지됨
- future truncation과 상한 제거가 함께 일어날 때 index 보정
- 빈 History와 범위 밖 move가 상한 로직에 영향을 주지 않음

## 6. 복원 계약

### 호출 순서

```text
restoreSnapshot(entry, actualRoot, options)
1. options.restoreEditor !== false이면 options.editor 필수 검사
2. cloneSnapshotData(entry.vdom)
3. renderChildren(clonedRoot, actualRoot)
4. assertAllLinked(clonedRoot, actualRoot)
5. restoreEditor !== false이면 writeEditorHTML(editor, entry.html)
6. clonedRoot 반환
```

편집기 필수 검사는 렌더링 전에 해야 한다. 그래야 편집기 누락 오류로 실제 DOM만 먼저 바뀌는 상태를 피할 수 있다.

### 보장

- `entry.vdom`과 `entry.html`은 수정되지 않는다.
- 실제 영역 컨테이너 객체는 유지된다.
- 반환된 VDOM은 `VRoot.dom === actualRoot`다.
- 반환된 VDOM의 모든 `VNode`가 실제 DOM에 연결된다.
- `restoreEditor: false`이면 편집기 문자열은 한 글자도 바뀌지 않는다.
- `restoreEditor` 기본값은 true다.

### 한계

- `renderChildren()`은 기존 자식을 먼저 제거하므로 렌더링 도중 실패하면 이전 화면 보존을 보장하지 않는다.
- `assertAllLinked()`는 포함 관계를 검증하지만 정확한 부모·형제 순서와 properties 전체를 증명하지 않는다.
- 복원 실패의 UI·재시작 정책은 이번 범위가 아니다.

## 7. Handler 계약

### 7.1 handlePatch

```text
1. prev = history.get()
2. html = readEditorHTML(elements.editor)
3. parsed = parseHTML(html)
4. next = createSnapshot(parsed)
5. changes = diff(prev, next)
6. changes.length === 0이면 return
7. completed = applyPatch(prev, next, changes)
8. history.set(completed, html)
```

예외 경계:

- `diff()` 예외는 DOM과 History를 변경하지 않으므로 Patch 복구 catch에서 제외한다.
- `applyPatch()` 예외는 현재 History entry로 복구한다.
- `history.set()`은 성공한 Patch 뒤에 호출한다. 저장 실패까지 applyPatch 실패와 같은 복구 범위에 넣을지는 별도 미확정으로 둔다.

Patch 실패 복구:

```text
entry = history.peek(0)
entry가 null이면 원래 오류를 전파하고 복구 불가 상태로 기록
live = restoreSnapshot(entry, actualRoot, {
  editor,
  restoreEditor: false
})
history.move(0, live)
원래 Patch 오류를 다시 throw
```

복원 자체가 실패하면 원래 Patch 오류와 복원 오류를 모두 보존하기 위해 `AggregateError`를 사용한다. 복원 실패 UI와 재시작 정책은 미확정으로 남긴다.

### 7.2 handleHistoryMove

```text
entry = history.peek(direction)
entry가 null이면 return
live = restoreSnapshot(entry, actualRoot, { editor })
history.move(direction, live)
```

- 새 History를 저장하지 않는다.
- 범위 밖 이동은 no-op이다.
- 복원 실패는 호출자에게 전파한다.

### 7.3 Handler가 공유하는 것

```text
handlePatch
├─ readEditorHTML
├─ parseHTML
├─ createSnapshot
├─ diff
├─ applyPatch
└─ history.get/set

handleHistoryMove
├─ history.peek
├─ restoreSnapshot
└─ history.move

handlePatch 실패
├─ history.peek(0)
├─ restoreSnapshot (restoreEditor: false)
├─ history.move(0, live)
└─ 오류 전파
```

`handlePatch` 자체를 복원에 재사용하지 않는다. 복원은 새 상태를 만드는 Patch가 아니라 저장 데이터를 full render하는 별도 경로다.

## 8. 앱 조립

### getSampleHTML

`src/sample.ts`에 추가한다.

```ts
export function getSampleHTML(): string {
  return SAMPLE_HTML;
}
```

### main.ts

실제 구현을 묶어 `init()`에 전달한다.

```ts
const app = init({
  parseHTML,
  createSnapshot,
  diff,
  applyPatch,
  createHistory,
  getSampleHTML,
  createHandlers
});
```

기존 Tab 입력 처리는 유지한다.

`init()`이 반환하는 `root`는 초기 VDOM 참조이며 이후 현재 VDOM 조회용 API가 아니다. 이후 상태는 `history.get()`으로 얻는다.

### 초기화 계약

- `initializeDOM()`은 빈 실제 영역과 빈 History에서 한 번 호출한다.
- 초기화에서는 변경 배열이 비어도 `applyPatch()`를 호출해 루트와 전체 VDOM 연결을 준비한다.
- `applyPatch()`가 반환한 완성 VDOM을 `history.set()`에 전달한다.
- 재초기화는 이번 범위에서 지원하지 않는다.

## 9. 파일 배치

```text
src/vdom/create.ts
  cloneSnapshotData 추가

src/app/history.ts
  HistoryDirection
  HistoryEntry
  History
  createHistory

src/app/editor.ts
  writeEditorHTML 추가

src/app/restore.ts
  RestoreSnapshotOptions
  restoreSnapshot

src/app/handlers.ts
  createHandlers
  handlePatch
  handleHistoryMove

src/app/initialize.ts
  InitializationHistory를 Pick<History, 'get' | 'set'>로 정리
  applyPatch 반환형 VRoot 및 반환값 저장

src/app/init.ts
  InitDependencies/createHandlers를 전체 History로 연결

src/sample.ts
  getSampleHTML

src/main.ts
  실제 의존성 조립
```

## 10. 테스트 계획

### History 단위

- `HIST-01`: 저장·조회·peek·데이터 복사
- `HIST-03`의 History 조회 부분: 범위 밖 null
- `HIST-04`: 미래 이력 제거
- `HIST-07`: 50개 상한·가장 오래된 이력 제거
- 추가 경계:
  - 빈 History `get()` 오류
  - 빈 History `peek()` null
  - 범위 밖 `move()` no-op
  - `move(0)` index 유지·live만 교체
  - 저장 후 원본 VDOM·실제 DOM 변경에도 entry 불변

### 복원 단위

- `HIST-02`: 화면·HTML·DOM 참조 복원
- `HIST-05`: 복원 후 후속 Patch가 새로 생성된 노드를 수정
- `restoreEditor: true/false`
- editor 누락 오류가 렌더링 전에 발생
- entry 원본 불변
- 복원 후 `assertAllLinked`

### Handler 통합

- `FLOW-01`: 단계별 텍스트 수정
- `FLOW-02`: 연속 Patch의 객체 재사용
- `FLOW-03`: 변경 없음의 Patch·저장 생략
- `FLOW-04`: Patch 오류 시 새 이력 미저장
- `FLOW-05`: 실제 DOM 일부 변경 후 오류 복구·재시도
- `HIST-02·03·04·06`: 실제 History·Handler 연계
- 실제 의존성 기반 `INIT-01·02`
- `main.ts` 조립 및 Tab 동작 유지

### 남은 Diff/ORDER/MOVE

- `DIFF-04`: 같은 key + 다른 태그 replace 검증
- `ORDER-04`: key 변경 입력은 remove + insert 기대로 수정
- `ORDER-01~05`의 Patch 적용 todo
- `MOVE-07`의 Patch 연계 todo
- `FLOW-02`·`HIST-05`의 key 변경은 replace가 아니라 remove + insert가 될 수 있음을 문서화

### 브라우저 수동 시나리오

```text
npm run dev:phase1
→ main.html 로드
→ 샘플이 실제 영역에 1회 표시되는지 확인
→ 편집기 수정
→ Patch
→ 실제 영역과 편집기 확인
→ 뒤로
→ 화면과 편집기 복원 확인
→ 앞으로
→ 복원 후 다시 Patch
```

## 11. 문서 변경 계획

구현 전 또는 각 단위 완료 시 다음을 갱신한다.

### 결정 기록

- History 최대 50개와 oldest eviction
- History가 currentLive를 소유하는 계약
- `writeEditorHTML` accepted 승격
- `restoreSnapshot` editor 옵션
- CONF-03 정책
- ORDER-04 기대값 변경
- HIST-07 추가

### 인터페이스

- `History`, `HistoryEntry`, `HistoryDirection`
- `restoreSnapshot`
- `writeEditorHTML`
- `createHandlers`
- `InitDependencies.createHistory(): History`
- `InitializerDependencies.applyPatch(): VRoot`

### 테스트 명세

- HIST-07 추가
- ORDER-04 기대값 replace → remove + insert
- DIFF-04 skip 해소
- FLOW-02·HIST-05의 교체 용어와 실제 명령 구분
- 테스트 진행표 행 수와 상태 갱신

### 제한

- PRD·함수 흐름·테스트 명세·인터페이스는 수정 제한 문서다. 구현 중 변경은 사용자 승인을 받은 뒤 함께 갱신한다.
- 결정 기록과 진행표만으로 부족한 명세 변경은 별도 승인 없이 반영하지 않는다.

## 12. 구현 순서

```text
1. 결정 기록 반영
2. cloneSnapshotData + HistoryEntry/History 타입
3. createHistory
4. History 단위 테스트
5. writeEditorHTML
6. restoreSnapshot
7. 복원 단위 테스트
8. handleHistoryMove
9. handlePatch 정상·no-op
10. handlePatch 실패 복구
11. Handler 통합 테스트
12. getSampleHTML + applyPatch 반환형 + main.ts 조립
13. 실제 INIT 통합 테스트
14. 남은 ORDER/MOVE/CONF-03 테스트
15. 수동 브라우저 검증
16. 문서·진행표 최종 동기화
```

## 13. 완료 판정

- 페이지가 예외 없이 초기화된다.
- 샘플이 실제 영역에 한 번만 표시되고 편집기에 원문이 표시된다.
- 첫 History 항목이 하나다.
- Patch 성공마다 상태가 한 번만 저장된다.
- 변경 없는 Patch는 DOM과 History를 바꾸지 않는다.
- 뒤로·앞으로가 실제 영역과 편집기를 함께 복원한다.
- 범위 밖 이동은 아무것도 바꾸지 않는다.
- 50개 상한과 oldest eviction 후 index·이동 경계가 정확하다.
- Patch 실패 시 새 이력이 없고 실제 영역만 복원되며 editor는 유지된다.
- History 저장본은 후속 Patch·복원·조회로 변하지 않는다.
- 테스트의 기대 결과 변경은 승인된 ORDER-04·HIST-07에 한정한다.
- 타입 검사·전체 테스트·빌드·수동 브라우저 결과를 각각 기록한다.
- 복원 자체 실패 UI·재시작 정책과 단일 초대형 Snapshot의 메모리 한계는 완료로 포장하지 않는다.
