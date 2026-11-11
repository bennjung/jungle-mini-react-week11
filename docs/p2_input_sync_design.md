# 입력 동기화·선택 영역 구현 설계

상태: 핵심 구현·독립 코드 리뷰·회귀 보완 완료. [테스트 계약](p2_input_sync_test_cases.md)을 우선한다.
전체354개 통과·실브라우저 확인·남은 한계는 [진행표](p2_test_boards.md#입력-동기화선택-영역-테스트-선행)를 따른다.
관련 이슈: [#64](https://github.com/bennjung/jungle-mini-react-week11/issues/64).
이번 작업은 미확정 경계 정책을 남긴 채 기존 테스트가 규정한 범위부터 구현한다.

## 1. 확정 범위

- 기존 `h`·`setState` 사용법 유지. 커서 지정은 선택적 `selectionStart`·`selectionEnd`·`selectionDirection`.
- 실제 DOM에 대한 값 쓰기는 기존 Patch 경로에서 수행한다. 일반 Diff는 이전·다음 VDOM을 비교한다.
- 이벤트 대상만 추가 확인한다. 이벤트 없는 동일값 setter는 기존처럼 예약하지 않는다.
- 같은 State 확인은 Component 재실행·effect 없이 수행한다. 정상 재렌더의 effect는 보정 후 실행한다.
- `FunctionComponent`별 WeakMap·대상 Set. 이벤트 함수에는 해당 인스턴스에 요청할 콜백을 연결한다.
  부모 DOM·전체 VDOM에서 인스턴스를 다시 찾지 않는다.
- 기존 352개 테스트의 기대값은 동결한다. 신규 helper를 테스트 대신 호출하지 않는다.

## 2. 변경 전 실행 기록

- 기준 커밋: `d2e284c27a56bf0566af214363b0e9af31f9a8b2`.
- 테스트·문서의 미커밋 변경은 앞선 사용자 요청 작업이며 그대로 유지한다.
- `npx vitest run --reporter=json --outputFile=/tmp/opencode/input-sync-before-implementation.json`:
  기존 엔진에서 값·커서·선택 지정의 실패를 확인했다. 결과 수치는 진행표에 기록한다.
- 코드 리뷰는 위 HEAD 대비 작업 변경과 새 파일을 함께 읽는다. 커밋·push는 요청 범위가 아니다.

## 3. 병렬 구현 경계와 공유 인터페이스

같은 파일을 여러 에이전트가 수정하지 않는다. 모든 인터페이스는 내부용이며 public component API를 늘리지 않는다.

### A. 이벤트·대상 비교

담당 파일: `src/vdom/events.ts`, 새 `src/vdom/input.ts`.

`events.ts`에서 아래 타입과 상태 조회를 export한다.

```ts
export type EventContext = {
  recordVNode: (node: VNode) => void;
  requestInputCheck: (target: Element) => void;
};
export function isComposing(element: Element): boolean;
export function bindEvents(element: Element, events: VNodeEventMap, context?: EventContext): void;
export function syncEvents(root: VRoot, context?: EventContext): void;
```

- `renderNode`는 `context.recordVNode(vnode)`를 직접 호출한다. `syncEvents`도 기존 순회에서 기록한다.
- 입력/change handler를 실제 연결 함수로 감싸고, 원본 handler와 연결 함수를 구분한다.
  정상 handler 종료 후 저장해 둔 target으로 `requestInputCheck`를 호출한다.
- 안정된 요청 콜백이 같고 원본 handler도 같으면 불필요한 재연결을 하지 않는다.
- 조합 여부는 DOM 요소 기준 약한 기록으로 관리한다. 조합 중 입력을 인식하고 종료 시 해제한다.
  compositionend 단독의 실제 브라우저 동작 보장은 미검증으로 남긴다.
- context 없는 Phase 1 호출은 기존 handler 연결 의미를 유지한다.

`input.ts`는 다음을 export한다.

```ts
export function collectInputChanges(
  targets: ReadonlySet<Element>,
  nodes: WeakMap<Element, VNode>,
  changes: DiffCommand[]
): DiffCommand[];
```

- 현재 VNode properties에 해당 요소의 이번 update 명령(set/removeProperties)을 반영해 원하는 값을 얻는다.
- 제거·교체되는 요소 및 하위 대상은 제외한다. 실제 DOM 변경은 수행하지 않는다.
- 앱이 지정한 프로퍼티만 비교한다. `value` 전용 분기가 아니라 checked/indeterminate도 다룬다.
  다만 value의 문자열 변환·selection API 지원 여부 등 DOM 고유 의미는 지킨다.
- 같은 요소의 update 명령에 setProperties를 합쳐 중복 쓰기를 막는다. 같은 값이면 추가 명령 없음.
- selection 명시값은 값 반영 후 적용할 선언이다. 범위 제한·자동 계산은 Patch에서 담당한다.
- 대상이 없으면 기존 changes를 유지한다. 대상 조회는 WeakMap으로 하고 전체 VDOM 검색은 하지 않는다.

### B. 순수 위치 대응

담당 파일: 새 `src/vdom/selection.ts`만 수정한다.

```ts
export type SelectionRange = {
  start: number;
  end: number;
  direction: 'forward' | 'backward' | 'none';
};
export function mapSelection(
  previousValue: string,
  nextValue: string,
  selection: SelectionRange
): SelectionRange;
```

- 내부 함수는 `findUnchangedEdges`, `alignChangedText`, `mapSelection` 순서로 이해할 수 있게 나눈다.
- 문자 종류별 삭제/대문자 등의 예외를 추가하지 않는다. 표시 문자 단위의 대응으로 양 끝을 같이 옮긴다.
- 편집 수 → 유지 문자 수 → 위치 이동량 → 고정 동률 순서의 결정적 대응을 사용한다.
  이 순서의 수학적 세부와 반올림은 내부 기본값을 기록하되 공개된 정확성 보장으로 승격하지 않는다.
- 삽입 경계는 앞, 삭제 구간은 남은 경계, 연속 치환 내부는 상대 위치에 대응한다.
- UTF-16 선택 오프셋을 사용자 표시 문자 경계로 대응한다. 이모지·결합 문자를 분리하지 않는다.
- 계산량 상한 후보는 중간 정렬표 40,000칸이다. 초과 시 공통 앞뒤를 유지하고 가운데를
  하나의 치환 구간으로 처리한다. 이 수치는 잠정 내부 방어값이며 측정·경계 검증은 남긴다.
- 원래 의도·재배열 의미 복원은 보장하지 않는다. 앱에 위치 매핑 함수를 요구하지 않는다.

### C. Component·Patch·h 연결

담당 파일: `src/component/index.ts`, `src/component/h.ts`, `src/vdom/patch.ts`.

- 기존 FunctionComponent에 대상 Set·성공 WeakMap·재렌더 필요 여부를 둔다.
- 동일값 setter의 조기 반환은 유지한다. `scheduleUpdate`는 이벤트 확인과 State 재렌더를 합류한다.
  재렌더 필요 플래그는 기존 예약이 있어도 합쳐야 한다.
- 실행 시작에 이번 대상 Set과 재렌더 여부를 분리하고 예약 플래그를 내린다.
  처리 중 추가된 요청은 다음 예약으로 남긴다. finally는 이번 작업 기록만 정리한다.
- 재렌더 경로: 기존 render/diff → collectInputChanges → applyPatchOrRestore → syncEvents
  → 성공 VDOM·WeakMap 확정 → 기존 효과 판단. render 전 Hook 스냅샷 계약 유지.
- 확인만인 경로: collectInputChanges(현재 root, 빈 changes) → 필요 시 기존 applyPatchOrRestore.
  Component·diff·syncEvents·effect 재실행 없이 대상만 반영한다.
- WeakMap은 작업용으로 새로 채운 뒤 성공 시 교체한다. 생성·syncEvents의 기존 순회를 재사용한다.
  실패 복구로 생성한 노드도 새로운 기록을 받아야 한다.
- 아래 함수에 마지막 선택적 `context?: EventContext`를 추가하고 내부 생성 호출에 전파한다.

```ts
renderChildren(root, container, context?)
renderNode(vnode, context?)
applyPatch(prevRoot, nextRoot, changes, context?)
```

- applyChange → insertNode/replaceNode와 restoreLastCommittedRoot → renderChildren도 전달한다.
- h의 classifyProp에서 명시적 선택을 기존 properties에 분류한다. 자동으로 읽은 선택은 VDOM에 넣지 않는다.
  propertySchema(스냅샷 대상)는 변경하지 않는다.
- Patch는 같은 DOM 값에 불필요한 value 대입을 하지 않는다. 값 쓰기 직전 선택을 읽고,
  쓰기 후 실제 반영 문자열을 기준으로 mapSelection을 사용한다. 명시값이 있으면 자동 계산 대신 적용한다.
- 명시값은 초기 생성·위치만 변경에도 적용한다. 여러 선택 프로퍼티를 각각 쓰지 않고 최종 한 번
  setSelectionRange로 처리한다. 삭제된 선택 선언을 native property delete로 해석하지 않는다.
- 자동 복원은 여전히 활성·연결된 요소에만 한다. selection 미지원은 값만 쓴다.
  조합 중에는 value 쓰기·선택 보정을 막되 다른 State 갱신 계약을 무단 변경하지 않는다.
- context가 없으면 기존 P1 테스트의 호출·반환은 호환한다. 새 optional 인자와 선택 보정 의미는
  P1 인터페이스 문서와 차이가 있으므로 아래 제한 기록을 유지한다.

## 4. 남긴 항목과 비용

- 리뷰 재현 INPUT-16은 이벤트 대상 multiple select의 OPTION.selected를 같은 State에서도
  확인한다. 기존 OPTION 선언을 사용하고 대상 select의 options만 확장하므로 전체 VDOM 검색은
  추가하지 않는다. 비용에는 대상의 option 수가 추가된다.
- 리뷰 재현 SELECT-08은 class 같은 속성만 바뀌면 과거 선택 선언을 재적용하지 않도록 한다.
  선택의 초기 생성·값 반영·위치 선언 변경이라는 기존 적용 경계를 유지하는 수정이다.

- [테스트 계약 §8](p2_input_sync_test_cases.md#8-숫자-기대값을-임의-확정하지-않은-항목)을 그대로 유지한다.
  handler 예외·중첩 이벤트·syncEvents 실패의 확대된 보장은 이번 완료 조건에 추가하지 않는다.
- 콜백 참조 전달은 요소당 O(1), 같은 State 확인은 대상 수와 프로퍼티 읽기 비용에 비례한다.
  문자열 비교·위치 계산 비용은 별도다. 일반 재렌더의 기존 diff 순회는 유지한다.
- **applyPatch의 assertAllLinked는 전체 VDOM을 순회한다.** 대상 검색·값 비교의 추가 전체 순회는
  없지만, 기존 연결 검증 O(N)이 남는다. 이번에는 이 안전 검증을 제거하지 않는다.
- P1 수정 제한 문서 네 개는 별도 명시적 수정 요청 전까지 변경하지 않는다. optional 인자·
  Patch의 선택 보정 확장으로 생기는 문서 차이를 결정 기록에 남긴다.
- 실제 브라우저 IME·undo/redo·다중 브라우저·대량 입력 성능은 통과했다고 하지 않는다.

## 5. 구현·검토 순서

1. 기존 실패 기록 확인 → 위 파일 경계로 3개 에이전트 병렬 구현.
2. 통합 타입 검사·352개 테스트 실행. 테스트 기대를 구현에 맞춰 바꾸지 않는다.
3. 독립 에이전트가 명세 충족과 코드 규칙을 각각 리뷰한다.
4. 재현 가능한 결함 수정 → 같은 검사 재실행 → 진행표·README·현재 흐름 동기화.
5. 미확정 항목·실브라우저 미검증과 코드 리뷰의 남은 지적을 구분해 보고한다.

## 6. 구현된 내부 기본값과 리뷰 보완

- 순수 위치 대응의 내부 기본값: 편집 수 최소, 유지 문자 최대, 유지된 쌍의 중간 구간 위치차
  `Σ|i-j|` 최소, 최종 동률은 대각선 → 삭제 → 삽입. 치환 상대 위치는 `Math.round`다.
- `Intl.Segmenter`의 grapheme 단위로 대응하고 선택 API에는 UTF-16 오프셋을 반환한다.
  표시 문자 내부의 자동 위치는 시작 경계로 맞춘다. Intl.Segmenter 지원 런타임을 전제로 한다.
- 중간표 `(m+1)*(n+1)>40,000`은 잠정 내부 방어값이다. 상한 밖 위치 품질·대량 입력 지연을
  보장하지 않는다. 입력 전체 분절·앞뒤 비교의 선형 비용은 남는다.
- 명시 위치가 한쪽만 있으면 다른 쪽을 보완하고 방향만 있으면0..0을 기본값으로 사용한다.
  비숫자·undefined·역전 범위의 정책은 공개 계약으로 확정하지 않았고 기존 §4 한계를 유지한다.
- 공통 프로퍼티 의미가 실제 세 소비자에서 반복돼 리뷰 후 properties.ts로 집중한다.
  선택 이름·다중 select value 예외·DOM 동등 비교를 공유하고 propertySchema는 늘리지 않는다.
- 독립 [코드 리뷰](p2_input_sync_review.md)와 신규 회귀 INPUT-16·SELECT-08의 원인·수정 기록을 따른다.

### 국소 비용 측정 — 전체 브라우저 성능 보장 아님

Node 환경에서 mapSelection만 직접 호출했다. 입력·DOM·화면 그리기 시간은 포함하지 않는다.

| 입력 | 샘플 | 중앙값 | 최대값 |
|---|---:|---:|---:|
| 이메일 공백 제거 | 100 | 0.019ms | 4.429ms |
| 서로 다른 중간 구간199×199 | 10 | 1.173ms | 4.436ms |
| 서로 다른 중간 구간200×200, 상한 초과 대체 경로 | 10 | 0.072ms | 1.212ms |
| 20만 문자 끝 삽입 | 3 | 64.463ms | 80.761ms |

수치는 이 실행 환경의 소수 측정이며 초기 실행 비용·잡음이 포함된다. 특히 20만 문자에서는
정렬표를 작게 만들어도 전체 분절 비용이 남아 한 프레임 예산을 넘을 수 있다. 상한은
정렬 계산량만 제한하며 대량 입력의 즉시 반응·정확한 위치를 보장하지 않는다.
