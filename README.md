# Mini React

> 상태가 바뀌면 컴포넌트를 다시 실행하고, 이전·다음 가상 DOM을 비교해 필요한 부분만 실제 DOM에 반영하는 미니 리액트입니다.

## 1. 프로젝트 소개

**Phase 1에서 화면을 바꾸는 엔진을 만들고, Phase 2에서 상태 변경과 자동 갱신을 연결했습니다.**

| 단계 | 구현 내용 | 확인하는 화면 |
| --- | --- | --- |
| Phase 1 | DOM → 가상 DOM 변환, 변경 계산(`diff`), 실제 반영(`patch`), 이력 이동 | HTML 편집기와 실제 영역 |
| Phase 2 | 함수형 Component, State, `useState`·`useMemo`·`useEffect`, event handler 갱신 | 카운터·고양이 동작 예제 |

두 단계는 **같은 가상 DOM과 Diff·Patch를 사용**합니다. Phase 1은 HTML을 파싱해, Phase 2는 컴포넌트를 실행해 다음 가상 DOM을 만듭니다.

```mermaid
flowchart TD
    A["Phase 1: 편집기 HTML"] --> B["parseHTML → createSnapshot"]
    C["Phase 2: 사용자 이벤트"] --> D["상태 변경 → 갱신 예약"]
    D --> E["컴포넌트 재실행 · h()"]
    B --> F["다음 가상 DOM"]
    E --> F
    F --> G["diff: 이전 가상 DOM과 비교"]
    G --> H{"변경 명령이 있는가?"}
    H -->|있음| I["applyPatch: 필요한 DOM만 변경"]
    H -->|없음| J["DOM 반영 생략"]
    I --> K["Phase 1: 이력 저장 / Phase 2: syncEvents · effect 실행 판단"]
    J --> L["Phase 1: 이력 저장 생략 / Phase 2: syncEvents · effect 실행 판단"]
```

편집기와 동작 예제는 **구현한 엔진을 실제 입력으로 확인하는 화면**입니다. 검증의 중심은 화면의 모양이 아니라 변경 계산·노드 재사용·상태 유지·실행 순서입니다.

## 2. 검증 대상과 기준

**어떤 입력에서 무엇이 바뀌고, 무엇은 유지되어야 하는가를 기준으로 검증했습니다.**

### Phase 1 — 변경을 정확히 계산하고 반영하는가?

| 검증 대상 | 확인한 질문 | 관련 테스트 케이스 |
| --- | --- | --- |
| 가상 DOM 생성 | 구조·속성·입력 상태를 옮기고 원본 DOM과 분리하는가 | [SNAP-01–06][p1-snap] |
| 변경 계산 | 텍스트·속성·삽입·삭제·교체를 정확한 명령으로 표현하는가 | [DIFF-01–09][p1-diff] |
| 정렬·이동 | 적용 순서를 지키고, 삽입·삭제에 따른 위치 변화를 이동으로 오인하지 않는가 | [ORDER-01–05][p1-order], [MOVE-01–07][p1-move] |
| 실제 반영·참조 | 유지 노드를 재사용하고 다음 가상 DOM 전체를 실제 DOM에 연결하는가 | [PATCH-01–08][p1-patch] |
| 전체 흐름·이력 | 연속 Patch와 이력 복원 뒤에도 다음 비교가 가능한가 | [FLOW-01–05][p1-flow], [HIST-01–07][p1-history], [IT-01–08][p1-it] |

### Phase 2 — 상태 변경이 올바른 갱신으로 이어지는가?

#### Component · props — 화면을 함수로 나누기

**Component는 화면을 구성하는 함수이고, props는 부모가 자식에게 넘기는 입력입니다.**

예를 들어 부모는 현재 숫자와 증가 함수를 가지고, 자식 버튼은 이를 props로 받아 숫자를 표시하고 클릭 시 증가 함수를 호출합니다. 이 프로젝트에서 자식은 자체 State 없이 props만 사용합니다.

`h()`는 화면을 설명하는 VNode를 만들고, `startApp()`은 루트 Component를 실행해 최초 DOM을 만듭니다. 자식은 `h(Child, props)`로 실행합니다.

→ **검증:** 최초 DOM 생성, VNode 구성, props의 값·콜백 참조 유지. [INIT-01–04][p2-init], [H-01–11][p2-h]

#### State · useState — 함수가 다시 실행되어도 값을 유지하기

**State는 클릭·입력에 따라 달라지고 다음 화면을 결정하는 값입니다.** 일반 지역변수와 달리 Component가 다시 실행되어도 이전 값을 기억해야 합니다.

`useState`·`useMemo`·`useEffect`는 함수형 Component에서 State·계산 결과·effect를 다루는 Hook입니다. `useState(0)`은 현재 값과 그 값을 바꾸는 함수인 setter를 반환합니다.

값은 `FunctionComponent`의 `hooks` 배열에 저장하고, 다음 실행에서 같은 호출 위치의 기록을 읽습니다. 그래서 Hook의 호출 순서가 유지되어야 합니다.

→ **검증:** State와 setter 참조 유지, 여러 State의 독립성, Hook 개수·종류 변경과 자식의 Hook 호출 거부. [HOOK-01–13][p2-hooks]

#### useMemo — 입력이 같으면 계산 결과 재사용하기

**Component가 다시 실행되더라도 모든 계산을 다시 할 필요는 없습니다.** `useMemo`는 계산 결과와 그 계산에 사용한 값의 목록인 `deps`를 보관합니다.

예를 들어 `useMemo(() => count * 2, [count])`는 `count`가 그대로면 이전 결과를 반환하고, `count`가 바뀌면 다시 계산합니다. 다른 State가 바뀌어도 이 계산은 반복하지 않습니다. Component 실행 자체를 생략하는 기능은 아닙니다.

→ **검증:** 같은 deps에서 계산 횟수 유지, deps 변경 시 재계산. [HOOK-04–05][p2-memo]

#### useEffect — DOM 반영 뒤에 실행할 작업 분리하기

**화면을 계산하는 일과, DOM을 조회하거나 외부 이벤트를 연결하는 일은 실행 시점이 다릅니다.** `useEffect`는 후자의 작업을 등록하고, 이 구현에서는 DOM·이벤트 반영을 마친 commit 뒤에 실행합니다.

예를 들어 현재 숫자를 브라우저 탭 제목에 반영할 수 있습니다. deps가 바뀌어 effect를 다시 실행할 때는 이전 작업을 정리하는 함수인 `cleanup`을 먼저 실행합니다. deps가 같으면 cleanup과 effect 모두 다시 실행하지 않습니다.

→ **검증:** 최초 DOM 생성 뒤 effect 실행, 같은 deps에서 재실행 생략, `이전 cleanup → 새 effect` 순서. [INIT-03][p2-first-effect], [HOOK-06][p2-effect-deps], [EFF-01][p2-effect]

#### update · event handler — State를 화면과 동작에 연결하기

**setter는 값만 바꾸는 것이 아니라 다음 화면의 render도 예약해야 합니다.** render는 Component를 실행해 다음 VDOM을 만드는 과정입니다. 이후 Phase 1의 Diff·Patch로 바뀐 부분만 실제 DOM에 반영합니다.

화면이 같아도 동작은 바뀔 수 있습니다. 버튼의 글자가 계속 `실행`이어도, 클릭 시 기록할 State가 `A → B`로 바뀌었다면 event handler도 `B`를 사용해야 합니다. 그래서 DOM 변경이 없어도 `syncEvents()`는 수행합니다.

→ **검증:** State 변경의 자동 반영, 유지 DOM의 객체 동일성, event handler 교체·제거, 연속 setter 이후 최종 State·화면 일치. [UPD-01–06][p2-update]

이 연결은 정상 동작뿐 아니라 **실패 후 다음 갱신이 가능한지**까지 확인합니다. render 오류는 마지막 DOM을 유지하고, Patch 실패는 마지막 성공 화면과 Hook 기록을 복원하는 서로 다른 계약으로 검증했습니다. [ERR-01–03][p2-errors], [FLOW-01–03][p2-flow]

## 3. 검증 방법

### 3.1 입력·기대 결과를 먼저 정하고 구현

테스트 케이스마다 **사전 상태·정확한 입력·검증 시점·기대 결과·유지 조건**을 정한 뒤 테스트와 구현을 작성했습니다.

- 예: 한 클릭에서 함수형 상태 변경을 두 번 호출하면 최종 값이 `2`여야 합니다. → [P2 HOOK-03][p2-updater]
- 구현 전 실패는 **모듈이 없어 실행되지 않은 경우**와 **실행 결과가 기대와 다른 경우**로 구분했습니다.
- 기대 결과를 구현에 맞추지 않았습니다. 테스트 입력 자체의 결함은 별도로 확인하고 승인된 수정을 기록했습니다.

### 3.2 단위 검증과 전체 연결 검증을 구분

| 범위 | 확인한 내용 | 근거 |
| --- | --- | --- |
| 단위 | 변경 명령 계산, Hook 값·deps 비교 | [P1 DIFF][p1-diff], [P2 HOOK][p2-hooks] |
| 격리 | 하위 결과를 대신 제공해 취합 함수의 인자·반환·오류 전달만 확인 | [취합 함수 격리 테스트](./tests/unit/diff/vdom.collect-child-changes.isolated.test.ts) |
| 통합 | 파싱부터 실제 DOM 반영까지, 클릭부터 상태·자식 화면 갱신까지 연결 | [P1 IT][p1-it], [P2 FLOW-02][p2-child-flow] |

**격리 테스트 통과를 전체 엔진의 정상 동작 근거로 사용하지 않았습니다.** 실패 경로에서는 오류를 의도적으로 발생시키고 이후 DOM과 호출 기록을 함께 확인했습니다.

### 3.3 화면이 같아도 객체와 실행 순서를 확인

- **노드 재사용:** 텍스트가 바뀌어도 기존 요소·텍스트 노드가 같은 객체인지 확인했습니다. → [P1 PATCH-01][p1-patch], [P2 UPD-01][p2-update]
- **상태 유지:** 두 상태가 서로의 값을 바꾸지 않고, 같은 setter를 계속 반환하는지 확인했습니다. → [P2 HOOK-01–02][p2-hooks]
- **effect 순서:** DOM이 만들어진 뒤 effect가 실행되고, deps 변경 시 `이전 cleanup → 새 effect` 순서인지 확인했습니다. → [P2 INIT-03][p2-first-effect], [P2 EFF-01][p2-effect]
- **변경 없음:** Phase 1은 Patch와 이력 저장을 생략합니다. Phase 2는 Patch만 생략하고 `syncEvents()`와 effect 실행 조건 판단은 수행합니다. → [P1 FLOW-03][p1-no-change], [P2 UPD-02–03][p2-no-change]

### 3.4 실제 DOM에 적용하고 다음 갱신까지 확인

명령 배열이나 호출 횟수만 보지 않고 **DOM 구조·값·객체 동일성·후속 갱신**을 확인했습니다.

- 삽입·교체한 노드를 다음 Patch에서 다시 생성하지 않고 수정하는가? → [P1 IT-06–07][p1-reuse]
- 자식 버튼이 부모 상태를 바꾸고 같은 버튼 DOM에 새 값을 표시하는가? → [P2 FLOW-02][p2-child-flow]
- Patch 실패 후 같은 setter를 다시 호출해도 정상 갱신되는가? → [P2 ERR-02][p2-patch-error]

### 3.5 결함을 넣었을 때 테스트가 실패하는지도 확인

**테스트 통과만으로는 필요한 방어 로직을 검사한다고 단정할 수 없습니다.**

자식 실행 중 Hook 소유자를 비우는 코드를 임시로 제거했을 때 [P2 HOOK-10][p2-child-hook]의 세 테스트가 실패했고, 복원 후 모두 통과했습니다. 단순 예외 발생뿐 아니라 **자식 진입·Hook 다음 문장 미실행·계산과 effect 0회**를 함께 확인합니다.

이 확인은 일회성 변이 검사입니다. 모든 코드에 대해 수행한 것은 아닙니다. → [실행 기록](./docs/p2_test_boards.md#실행-기록)

## 4. 검증 과정에서 드러난 문제와 대응

### 4.1 Phase 1 — 같은 노드 대응을 두 번 계산하고 있었다

- **발견:** 다음 가상 DOM은 새 객체이므로 변경 명령이 없는 노드도 실제 DOM 참조를 받아야 합니다. 처음에는 Patch에서 노드 대응을 다시 계산했습니다.
- **원인:** Diff와 Patch의 대응 규칙이 중복되어 중복 `key`에서 다른 결과가 나올 수 있었습니다.
- **수정:** Diff의 대응 결과로 유지·이동·수정 노드를 연결하고, Patch는 삽입·교체 노드 생성과 DOM 변경을 맡겼습니다.
- **검증:** 유지 노드부터 새 노드까지 전체 연결을 확인했습니다. → [P1 PATCH-08][p1-link]

### 4.2 Phase 1 — key 정책이 확정되지 않은 경계가 있었다

검증 중 정책을 확정하고 테스트 기준에 반영했습니다.

| 경우 | 확정한 처리 |
| --- | --- |
| 같은 `key` + 같은 태그 | 노드를 유지하고 내부 갱신 |
| 같은 `key` + 다른 태그 | 제자리 교체 |
| `key` 변경 | 제거 + 삽입 |
| 같은 부모의 중복 `key` | 해당 비교에서 `key` 대신 순서 대응 |

태그 변경의 보류 검증을 해소하고, `key` 변경의 기대 결과를 교체가 아닌 제거·삽입으로 정리했습니다. → [P1 정책 확정 기록](./docs/p1_test_cases.md#10-확정된-노드-식별-규칙--같은-key-태그-변경key-변경중복-key)

### 4.3 Phase 2 — 자식이 부모의 Hook 기록을 사용할 수 있었다

- **발견:** 루트 실행 중 자식을 바로 호출하면 자식도 루트의 Hook 소유자를 사용할 수 있었습니다.
- **수정:** `h(Child, props)`의 자식 실행·반환값 정규화 동안 소유자를 비우고, 정상·오류 경로 모두 `finally`에서 직전 소유자를 복원합니다.
- **검증:** 자식의 세 Hook을 거부하고, 정상·중첩·오류 자식 뒤에도 부모 State와 setter가 유지되는지 확인했습니다. → [P2 HOOK-10–13][p2-child-hook]

별도 자식 인스턴스나 Component 트리는 도입하지 않았습니다. **State·Hook은 루트만 소유하고 자식은 props만 사용한다**는 과제 제약을 지키는 경계입니다.

### 4.4 Phase 2 — 화면이 같아도 클릭 동작은 달라질 수 있었다

- **문제:** DOM 변경이 없다는 이유로 갱신을 끝내면, 이전 상태를 참조하는 클릭 함수가 남습니다.
- **대응:** Patch와 `syncEvents()`를 분리했습니다. 변경 명령이 없어도 event handler 갱신과 effect 실행 조건 판단은 진행합니다.
- **검증:** 같은 버튼 DOM에서 이전 값 `A`가 아닌 새 값 `B`가 기록되는지, 제거한 이벤트가 실행되지 않는지 확인했습니다. → [P2 UPD-03–04][p2-event]

### 4.5 Phase 2 — 실패 복원은 화면만 되돌리면 부족했다

- **발견:** Patch 실패 후 화면만 복구하면 내부 상태가 새 값으로 남아 다음 setter가 갱신을 생략할 수 있었습니다.
- **수정:** 마지막 성공 화면과 Hook 기록을 함께 복원하되 기존 setter가 참조하는 슬롯 객체는 유지했습니다.
- **추가 발견:** effect 안에서 State 변경을 요청하는 순간 전체 Hook을 복사하면, 아직 끝나지 않은 effect가 복사되어 복구 후 다시 실행됐습니다.
- **수정:** State의 이전 값은 setter 호출 시점에, 전체 Hook 기록은 다음 갱신 시작 시점에 보관합니다.
- **검증:** 수정 전 effect 기록이 `['effect', 'effect']`로 실패했고, 수정 후 `['effect']`로 통과했습니다. → [P2 ERR-02][p2-patch-error], [원인·수정 기록](./docs/p2_decisions.md#p2-fail-03--복원-스냅샷은-갱신-시작-시점-state-이전-값은-setter-시점-61)

이 복원은 **Patch 실패에만 적용**합니다. 렌더 오류에서는 마지막 화면을 유지하지만 이미 변경된 상태를 되돌리지 않습니다. → [P2 ERR-01·03][p2-errors]

### 4.6 테스트 자체의 오류와 미완성 검증도 구분했다

- **테스트 입력 오류 수정:** Phase 1은 `ul`과 실제 영역 루트의 `key`를 혼동한 입력을 수정했습니다. Phase 2는 버튼 라벨까지 포함한 전체 텍스트 대신 대상 `span`을 검사하도록 승인받아 수정했습니다. → [수정 기록](./docs/p2_decisions.md#p2-test-01--승인된-테스트-수정-2건-60)
- **가짜 통과 확인:** Phase 2 최초 실행의 통과 4개는 미구현 함수가 항상 예외를 던져 발생했습니다. 기능 구현 완료의 증거로 보지 않았습니다. → [실행 기록](./docs/p2_test_boards.md#실행-기록)
- **미뤄둔 검증 완료:** Phase 1 명령 정렬 5개와 이동 연계 2개는 실제 Diff·Patch 연결로 실행 가능한 검증으로 바꿨습니다. → [테스트 진행표](./docs/p1_test_boards.md)

### 4.7 발견했지만 이번에 수정하지 않은 것은 이유를 남겼다

**수정 완료와 남아 있는 문제를 같은 결과로 묶지 않았습니다.**

- **명세 문서 충돌:** Phase 1 테스트 문서 앞부분에는 `key` 정책이 미확정으로 남아 있지만 뒤에는 확정 기록이 있습니다. 프로퍼티 제거 정책도 문서와 구현 사이에 차이가 있습니다. 해당 명세 문서는 별도 수정 요청이 있어야 변경할 수 있어 이번 README 작업에서는 고치지 않았습니다. → [충돌과 영향 기록](./docs/p2_decisions.md#남은-문서-충돌)
- **복구 자체가 실패하는 경우:** 현재 계약은 원래 Patch 오류를 전파하고 이후 동작을 보장하지 않습니다. 사용자 오류 표시·재시작 정책은 미확정이므로 임의로 추가하지 않았습니다. → [P2 ERR-02 유지 조건][p2-patch-error]
- **syncEvents 실패:** DOM 반영 뒤 오류를 전파하고 effect는 실행하지 않지만, 화면과 현재 VDOM의 이후 일관성은 보장하지 않습니다. 기존 결정에서 보장하지 않는 경계이며, 이번 문서 수정으로 복구 정책을 새로 정하지 않았습니다. → [실패 경계 기록](./docs/p2_decisions.md#p2-fail-01--렌더-오류와-applypatch-실패의-분리-60)

## 5. 검증 결과와 한계

### 5.1 자동 검증
Phase 1, Phase 2 예제는 개발 서버에서 실행합니다.

### 5.2 화면에서 확인한 것과 아직 확인하지 않은 것

**Phase 1 — 기존 수동 검증 기록**

- 편집기 수정 → Patch → 변경분만 반영.
- 뒤로·앞으로 → 화면과 HTML 원문 복원.
- 복원 후 연속 Patch, 폼 값·체크·선택 상태 유지.
- 당시 페이지·콘솔 오류 0건(`favicon` 404 제외). 이번 작업에서 브라우저 검증을 다시 수행한 것은 아닙니다.

**Phase 2 — 동작 예제 제공, 실화면 검증은 별도**

- 카운터: 상태·증감 폭 변경, 계산 결과 재사용, 탭 제목 갱신.
- 고양이: 이름·횟수·하트 목록, 파생 값 계산, effect에서 pointer 이벤트 연결.
- 자동 테스트의 DOM 관찰은 **jsdom 환경**입니다. 이 결과를 두 예제의 실제 브라우저 조작·시각 검증 완료로 해석하지 않습니다.

### 5.3 검증하지 못한 범위

- **성능:** 계산 비용과 DOM 반영 비용을 측정하지 않았으므로 성능 향상을 주장하지 않습니다.
- **최소 이동 횟수:** 형제 6개의 720개 순열 비교는 일회성 확인이며 회귀 테스트로 고정하지 않았습니다.
- **브라우저 자동화:** 실제 브라우저의 입력·포커스·화면 배치까지 자동 검증하지 않았습니다.
- **effect deps 전환:** deps 생략과 배열 사용은 각각 검증했지만, 생략 ↔ 배열 전환 전용 테스트는 없습니다. → [검증 경계](./docs/p2_decisions.md#p2-effect-02--deps-생략배열-전환-시-다음-렌더-1회-실행-59)
- **복원 범위:** Patch 실패 복구는 전체 DOM 재생성과 얕은 상태 복사입니다. 포커스·스크롤·비제어 입력 상태와 상태 객체의 제자리 변경은 보존하지 않습니다.
- **Batching:** 연속 setter를 묶도록 구현했지만 테스트 계약은 갱신 횟수가 아닌 최종 State·화면 일치입니다. → [P2 UPD-06][p2-batch]

### 5.4 실제 React와 구분해야 할 구현 범위

**React 전체를 재현한 것이 아니라 과제 범위의 갱신 원리를 구현했습니다.**

- State·Hook은 루트만 사용하고, 자식은 props만 받는 순수 함수입니다. 자식별 State·Component 인스턴스는 없습니다.
- Phase 1은 HTML 파싱, Phase 2는 `h()`로 가상 DOM을 생성합니다. JSX 변환기는 없습니다.
- `h(Child, props)`는 자식을 즉시 실행합니다. `Child(props)` 직접 호출의 Hook 오용은 자동 감지하지 않습니다.
- effect는 DOM·이벤트 반영 뒤 실행하며, unmount와 unmount 시 cleanup 실행은 구현하지 않았습니다.
- Fiber·우선순위 스케줄링·동시성 기능은 없습니다. 갱신을 예약한 뒤 Patch는 동기적으로 적용합니다.
- `key`를 실제 DOM 속성에도 남깁니다.

## 6. 실행 방법

```bash
npm install
```

각 예제는 아래 명령 중 하나로 실행합니다. 포트가 이미 사용 중이면 개발 서버가 출력한 주소를 확인합니다.

| 화면 | 실행 명령 | 기본 주소 |
| --- | --- | --- |
| Phase 1 편집기 | `npm run dev` | `http://localhost:5173/main.html` |
| Phase 2 고양이 | `npm run dev:phase2` | `http://localhost:5174/phase2-cat.html` |
| Phase 2 카운터 | `npm run dev:phase2:counter` | `http://localhost:5174/phase2.html` |

| 검증 | 명령 |
| --- | --- |
| 전체 테스트 | `npm test` |
| 타입 검사 + 전체 테스트 | `npm run check` |
| 타입 검사 + Phase 1 배포용 빌드 | `npm run build` |

[p1-snap]: ./docs/p1_test_cases.md#4-스냅샷--dom-데이터입력-상태를-복사하고-실제-dom-참조는-연결하지-않음
[p1-diff]: ./docs/p1_test_cases.md#diff-01--같은-html을-다시-파싱해도-변경-명령은-없고-prev-vdom실제-dom은-유지된다
[p1-order]: ./docs/p1_test_cases.md#order-01--새-기준-형제를-먼저-생성한-뒤-그-앞에-삽입해-목표-순서를-만든다
[p1-move]: ./docs/p1_test_cases.md#이동-계획-검증-추가--move-01move-07
[p1-patch]: ./docs/p1_test_cases.md#patch-01--텍스트-update는-기존-요소텍스트-객체를-유지하며-값만-바꾼다
[p1-flow]: ./docs/p1_test_cases.md#flow-01--텍스트-수정의-파싱스냅샷diffdom-반영이력-저장을-단계별-검증한다
[p1-history]: ./docs/p1_test_cases.md#hist-01--현재-vdom의-dom-참조와-저장-데이터html-원문을-분리하고-과거-상태를-보존한다
[p1-it]: ./docs/p1_test_cases.md#it-01--빈-실제-영역에-snapshot--diff--patch로-초기-렌더링한다
[p1-no-change]: ./docs/p1_test_cases.md#flow-03--코드-변경-없이-patch하면-dom-변경과-이력-저장을-모두-생략한다
[p1-reuse]: ./docs/p1_test_cases.md#it-06--첫-patch에서-삽입한-노드를-다음-patch에서-재사용한다
[p1-link]: ./docs/p1_test_cases.md#patch-08--diff가-연결한-유지-노드를-사용하고-새-노드까지-전체-참조를-완성한다
[p2-init]: ./docs/p2_test_cases.md#init-01--startapp이-컨테이너에-최초-화면을-만들고-event를-직접-연결한다
[p2-h]: ./docs/p2_test_cases.md#h-01--h가-태그propschildren으로-요소-vnode를-만든다
[p2-hooks]: ./docs/p2_test_cases.md#hook-01--usestate가-mount에서-기록을-만들고-update에서-값과-setter를-유지한다
[p2-memo]: ./docs/p2_test_cases.md#hook-04--usememo가-의존성이-같으면-다시-계산하지-않는다
[p2-effect-deps]: ./docs/p2_test_cases.md#hook-06--useeffect가-commit-뒤-실행되고-의존성이-같으면-다시-실행하지-않는다
[p2-effect]: ./docs/p2_test_cases.md#eff-01--의존성이-바뀌면-이전-cleanup이-새-effect보다-먼저-실행된다
[p2-update]: ./docs/p2_test_cases.md#upd-01--state-변경이-자동-재렌더와-필요한-patch로-이어진다
[p2-errors]: ./docs/p2_test_cases.md#err-01--갱신-중-render-오류는-dom-반영-전에-중단되고-이전-화면이-유지된다
[p2-flow]: ./docs/p2_test_cases.md#flow-01--카운터에서-클릭state화면-반영이-자동으로-이어진다
[p2-updater]: ./docs/p2_test_cases.md#hook-03--함수형-updater가-이전-값-기준으로-다음-state를-계산한다
[p2-child-flow]: ./docs/p2_test_cases.md#flow-02--자식-컴포넌트가-props만-사용하고-부모-state-변경이-자식-화면에-반영된다
[p2-first-effect]: ./docs/p2_test_cases.md#init-03--최초-표시-후-실행-조건에-맞는-effect를-commit-뒤-실행한다
[p2-no-change]: ./docs/p2_test_cases.md#upd-02--화면-데이터가-같으면-applypatch를-호출하지-않는다
[p2-patch-error]: ./docs/p2_test_cases.md#err-02--applypatch-실패는-마지막-성공-vdom으로-복구하고-오류를-전파한다
[p2-child-hook]: ./docs/p2_test_cases.md#hook-10--자식-실행-중-세-hook을-모두-거부한다
[p2-event]: ./docs/p2_test_cases.md#upd-03--화면이-같아도-handler가-바뀌면-새-handler가-실행된다
[p2-batch]: ./docs/p2_test_cases.md#upd-06--연속-setter-호출-후-최종-state와-화면이-일치한다
