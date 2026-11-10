# Phase 2 테스트 진행표

기준: [p2_test_cases.md](p2_test_cases.md) §2–§8. 명세의 테스트 ID별로 한 행을 작성한다. 테스트 케이스는 INIT 4개, H 8개, HOOK 9개, UPD 6개, EFF 1개, ERR 2개, FLOW 3개로 총 **33행(테스트 ID 33개)** 이다. 실행 단위는 별도로 **77개**다. 같은 ID를 여러 입력·시나리오로 나눈 테스트와 명세 ID 밖 보강 테스트가 포함되기 때문이다. 설계 기준은 [wiki/Phase2-Design-merged.md](../wiki/Phase2-Design-merged.md)의 승인안과 [p2_decisions.md](p2_decisions.md)를 따른다.

결과는 `O` 통과, `X` 실패, 빈칸은 미실행 또는 일부만 검증됨을 뜻한다. 일부 검증만 통과한 케이스는 전체 통과로 표시하지 않는다. spy 기반 호출 기록 검증과 실제 DOM 검증의 범위를 원인 분석에 구분한다. 아래 모든 행은 2026-11-11 실행 결과로 채웠다.

| 테스트 카테고리 | 테스트 코드 | 테스트 내용 | 테스트 결과(O,X) | 원인 분석 |
| --- | --- | --- | --- | --- |
| 2. 시작·최초 표시 (INIT) | **INIT-01** | startApp이 컨테이너에 최초 화면을 만들고 event를 직접 연결한다. | O | 실행 단위 2개. 최초 button·text 생성과 click handler 1회, 정적 앱의 input·change 각 1회를 실제 DOM 이벤트로 확인했다. |
| 2. 시작·최초 표시 (INIT) | **INIT-02** | 최초 표시가 컨테이너를 교체하고 같은 화면 갱신에서 DOM을 유지한다. | O | 기존 자식 제거, section·p·텍스트 생성, 같은 출력 갱신에서 노드 객체 유지 확인. |
| 2. 시작·최초 표시 (INIT) | **INIT-03** | 최초 표시 후 실행 조건에 맞는 effect를 commit 뒤 실행한다. | O | effect 실행 시점에 이미 button이 존재하고, DOM 생성 → effect 순서가 기록됐다. |
| 2. 시작·최초 표시 (INIT) | **INIT-04** | startApp은 container를 검증하고 같은 container의 반복 시작을 막는다. | O | 실행 단위 2개. Element가 아닌 값·이미 시작한 container 오류와, 거부 후 첫 앱 handler 지속 동작 확인. |
| 3. h()·정규화 (H) | **H-01** | h()가 태그·props·children으로 요소 VNode를 만든다. | O | 요소 VNode의 attributes·Text child·`dom: null` 확인. |
| 3. h()·정규화 (H) | **H-02** | children의 문자열·숫자를 Text VNode로 변환한다. | O | 숫자가 문자열로 바뀌고 중첩 배열 안 값도 Text VNode가 됨을 확인. |
| 3. h()·정규화 (H) | **H-03** | 중첩 배열을 펼치고 null·undefined·boolean·빈 값을 제외한다. | O | 중첩 배열 펼침과 null·undefined·boolean·빈 배열·빈 문자열 제외 확인. |
| 3. h()·정규화 (H) | **H-04** | Component의 원시 문자열·숫자 반환은 오류다. | O | 단독 반환과 배열 안 원시값 모두 `renderComponent` 정규화 경로에서 오류. |
| 3. h()·정규화 (H) | **H-05** | children의 허용되지 않는 값은 오류다. | O | 객체·함수·DOM Node·Promise 자식이 각각 오류. |
| 3. h()·정규화 (H) | **H-06** | props를 attribute·property·event·key로 분류한다. | O | 실행 단위 2개. key·class는 attributes, INPUT value·checked는 properties로 분류하고 숫자 attribute 값은 문자열로 변환. |
| 3. h()·정규화 (H) | **H-07** | boolean attribute는 true를 빈 값으로, false를 생략으로 처리한다. | O | attributes에만 규칙을 적용하고 properties 값은 그대로 둠을 확인. |
| 3. h()·정규화 (H) | **H-08** | tagName이 문자열이 아니면 오류다. | O | 함수·빈 문자열·공백·null tagName 오류 확인. |
| 4. Hook (HOOK) | **HOOK-01** | useState가 mount에서 기록을 만들고 update에서 값과 setter를 유지한다. | O | 클릭마다 값이 바뀌고 setter 참조가 유지됨을 확인. |
| 4. Hook (HOOK) | **HOOK-02** | 여러 useState가 호출 순서로 분리되고 setter가 자기 기록만 바꾼다. | O | 두 번째 setter가 첫 번째 값을 바꾸지 않음 확인. |
| 4. Hook (HOOK) | **HOOK-03** | 함수형 updater가 이전 값 기준으로 다음 State를 계산한다. | O | 한 handler의 두 updater가 직전 값 기준으로 누적됨을 확인. |
| 4. Hook (HOOK) | **HOOK-04** | useMemo가 의존성이 같으면 다시 계산하지 않는다. | O | 실행 단위 2개. 다른 State 재렌더에서 계산 횟수 불변, `undefined` 결과도 캐시됨을 확인. |
| 4. Hook (HOOK) | **HOOK-05** | useMemo가 의존성이 바뀌면 다시 계산한다. | O | 실행 단위 4개. 값·deps 길이·순서·새 객체 참조 변경에서 재계산 확인. |
| 4. Hook (HOOK) | **HOOK-06** | useEffect가 commit 뒤 실행되고 의존성이 같으면 다시 실행하지 않는다. | O | 실행 단위 2개. label만 바뀌면 effect 미실행, 같은 deps면 cleanup도 미실행. |
| 4. Hook (HOOK) | **HOOK-07** | Component 실행 밖에서 Hook을 호출하면 오류다. | O | 실행 단위 2개. 일반 함수 호출과 `useMemo` 밖 호출 모두 오류. |
| 4. Hook (HOOK) | **HOOK-08** | Hook 개수나 종류가 render 사이에 바뀌면 오류다. | O | 실행 단위 3개. 개수 감소·증가·같은 위치 종류 변경 모두 오류, 화면 불변. |
| 4. Hook (HOOK) | **HOOK-09** | 같은 값을 넣는 setter는 갱신을 예약하지 않는다. | O | 실행 단위 3개. 같은 값·같은 updater·NaN 미예약, NaN 동일, +0/-0 구분·같은 참조·새 객체 구분 확인. |
| 5. 갱신 (UPD) | **UPD-01** | State 변경이 자동 재렌더와 필요한 Patch로 이어진다. | O | 바뀐 텍스트만 update되고 나머지 노드는 유지됨을 확인. |
| 5. 갱신 (UPD) | **UPD-02** | 화면 데이터가 같으면 applyPatch를 호출하지 않는다. | O | 재렌더는 실행되지만 `applyPatch` spy 호출 0회, 실제 DOM 객체 불변. |
| 5. 갱신 (UPD) | **UPD-03** | 화면이 같아도 handler가 바뀌면 새 handler가 실행된다. | O | 텍스트는 그대로이고 클릭 결과만 새 handler로 바뀜을 확인. |
| 5. 갱신 (UPD) | **UPD-04** | handler가 제거되면 이전 handler가 실행되지 않는다. | O | enabled가 false인 동안 클릭이 아무 것도 실행하지 않음 확인. |
| 5. 갱신 (UPD) | **UPD-05** | effect 안 setter가 현재 처리 후 다음 갱신으로 이어진다. | O | effect가 끝난 뒤 다음 render가 실행됨을 확인. |
| 5. 갱신 (UPD) | **UPD-06** | 연속 setter 호출 후 최종 State와 화면이 일치한다. | O | 두 값이 모두 반영된 최종 화면 확인. |
| 6. 생명주기 (EFF) | **EFF-01** | 의존성이 바뀌면 이전 cleanup이 새 effect보다 먼저 실행된다. | O | 실행 단위 11개. run→cleanup→run, deps 생략 시 매 render 실행·매번 cleanup, 여러 효과의 순서, deps 비배열 4개, cleanup 반환 오류 3개, 화면 불변에서의 효과 판단 확인. |
| 7. 실패 (ERR) | **ERR-01** | 갱신 중 render 오류는 DOM 반영 전에 중단되고 이전 화면이 유지된다. | O | render 오류 시 DOM·현재 VDOM 유지, `applyPatch`·`syncEvents` 미호출, 첫 클릭의 State 증가 유지, 다음 갱신 정상. |
| 7. 실패 (ERR) | **ERR-02** | applyPatch 실패는 마지막 성공 VDOM으로 복구하고 오류를 전파한다. | O | 실행 단위 3개. 부분 DOM 변경 후 마지막 성공 화면 재생성, 훅 슬롯 복원으로 같은 setter 재예약, `syncEvents`·effect 미실행, 다음 갱신 정상. effect setter로 시작한 갱신이 실패해도 이미 실행한 `[]` 효과가 다시 실행되지 않음을 확인. |
| 8. 통합 (FLOW) | **FLOW-01** | 카운터에서 클릭·State·화면 반영이 자동으로 이어진다. | O | 증가 3회·감소 1회 후 화면 2, 루트 요소 객체 유지 확인. |
| 8. 통합 (FLOW) | **FLOW-02** | 자식 컴포넌트가 props만 사용하고 부모 State 변경이 자식 화면에 반영된다. | O | 자식 버튼 클릭이 부모 setter까지 연결되고 새 props가 자식 텍스트에 반영됨을 확인. |
| 8. 통합 (FLOW) | **FLOW-03** | 입력 요소의 value·checked가 properties를 거쳐 화면에 반영된다. | O | 최초 value A·checked false, 갱신 후 B·true, input 요소 객체 유지 확인. |

## 실행 단위 구성

테스트 ID 33개와 실행 단위 77개를 구분한다. 77개는 다음 네 파일의 실제 실행 단위 합이다.

| 파일 | 실행 단위 | 구성 |
| --- | --- | --- |
| [tests/unit/p2/h.test.ts](../tests/unit/p2/h.test.ts) | 19 | H-01–H-08 직접 검증 9개 + 같은 규칙의 보강 10개 |
| [tests/unit/p2/hooks.test.ts](../tests/unit/p2/hooks.test.ts) | 35 | HOOK-01–HOOK-09, EFF-01 직접 검증 20개 + deps·cleanup·여러 효과 보강 15개 |
| [tests/integration/p2/app.test.ts](../tests/integration/p2/app.test.ts) | 16 | INIT·UPD·FLOW 직접 검증 15개 + 컴포넌트 오류 전파 보강 1개 |
| [tests/integration/p2/errors.test.ts](../tests/integration/p2/errors.test.ts) | 7 | ERR-01·ERR-02 직접 검증 4개 + `syncEvents`·effect·cleanup 오류 보강 3개 |
| **합계** | **77** | 테스트 ID 33개를 여러 입력·시나리오로 나눈 실행 단위와 보강 테스트 포함 |

## 테스트 코드 위치

공개 경계는 `src/component/index.ts`다. `h`, `startApp`, `useState`, `useMemo`, `useEffect`를 여기서 내보낸다. `h`의 구현은 `src/component/h.ts`에 있고 `index.ts`가 re-export한다.

| 범위 | 파일 |
| --- | --- |
| INIT, UPD, FLOW | [tests/integration/p2/app.test.ts](../tests/integration/p2/app.test.ts) |
| ERR | [tests/integration/p2/errors.test.ts](../tests/integration/p2/errors.test.ts) |
| H | [tests/unit/p2/h.test.ts](../tests/unit/p2/h.test.ts) |
| HOOK, EFF | [tests/unit/p2/hooks.test.ts](../tests/unit/p2/hooks.test.ts) |
| 공통 대기·fixture | [tests/helpers/p2.ts](../tests/helpers/p2.ts) |

## 실행 기록

- 2026-11-10: `tests/unit/p2/*`, `tests/integration/p2/*` 작성. 구현 전이므로 `npx vitest run tests/unit/p2 tests/integration/p2` 결과는 **32 실패 / 4 통과**(테스트 36개)였다. 통과 4개는 `H-04`·`H-05`·`H-08`·`HOOK-07`이며, 미구현 stub이 항상 예외를 던져 생긴 가짜 통과였다. 이후 구현·보강과 회귀 테스트 추가로 실행 단위가 77개가 됐다.
- 2026-11-11: `npx vitest run tests/unit/p2 tests/integration/p2 --reporter=json` → **4개 파일, 75개 통과, exit 0**. 파일별 19 + 35 + 16 + 5.
- 2026-11-11: `npm test` → **26개 파일, 268개 통과, exit 0, unhandled error 0**. Phase 1 회귀는 22개 파일 193개 통과다.
- 2026-11-11: `npm run check` → 타입 검사와 전체 테스트 통과, exit 0.
- 2026-11-11: ERR-02 effect setter 복원 회귀 1개와 effect cleanup 오류 1개를 `tests/integration/p2/errors.test.ts`에 추가. `npx vitest run tests/integration/p2/errors.test.ts`는 수정 전 **1 실패 / 6 통과, exit 1**(`['effect','effect']` ≠ `['effect']`), 수정 후 **7 통과, exit 0**이었다.
- 2026-11-11: `npx vitest run tests/unit/p2 tests/integration/p2 --reporter=dot` → **4개 파일, 77개 통과, exit 0**. 파일별 19 + 35 + 16 + 7.
- 2026-11-11: `npm test` → **26개 파일, 270개 통과, exit 0, unhandled error 0**. Phase 1 회귀는 22개 파일 193개 통과다.
- 2026-11-11: `npm run check` → 타입 검사와 전체 테스트 통과, exit 0.
- 수치 주의: #61 본문의 "실행 단위 36개"는 최초 테스트 작성 시점의 수치다. 구현·보강 후 실제 실행 단위는 **77개**이며, 테스트 ID는 **33개**다. 두 수를 같게 기록하지 않는다.

## 확정된 경계

- `ERR-02`: `applyPatch()` 실패 시 마지막 성공 화면을 `renderChildren()`으로 재생성하고, **훅 슬롯도 갱신 시작 전으로 함께 복원**한다(원자적 복원). 원래 오류를 전파하고 `syncEvents()`·effect는 실행하지 않는다. 현재 VDOM은 마지막 성공 VDOM을 유지한다. 복원은 얕은 복사이며 State 값 객체의 제자리 변경은 지원하지 않는다.
- `ERR-01`: render 오류에는 상태 복원을 적용하지 않는다. setter가 이미 쓴 State 증가는 유지되고, DOM·현재 VDOM은 마지막 성공 상태다. 예약된 `update`의 오류는 잡지 않고, `finally`로 Hook 문맥만 해제한다.
- `UPD-02`: 갱신 성공 시 항상 다음 VDOM으로 교체하는 것으로 정했다. VDOM 교체는 외부에서 관찰할 수 없어 DOM 객체 동일성만 판정한다.
- `syncEvents` 오류: DOM Patch가 끝난 뒤 오류를 전파하고 effect를 실행하지 않는다. 현재 VDOM은 마지막 성공 상태를 유지하므로 이후 일관성은 보장하지 않는다.

| 구분 | ERR-01 — render 오류 | ERR-02 — applyPatch 실패 |
| --- | --- | --- |
| 실패 지점 | Component 실행·정규화 | 실제 DOM 명령 적용 |
| State·Hook 슬롯 | 유지한다. setter가 쓴 값이 남는다 | 갱신 시작 전으로 복원한다 |
| 실제 DOM | 마지막 성공 화면 그대로 | 마지막 성공 화면을 재생성한다 |
| `syncEvents`·effect | 실행하지 않는다 | 실행하지 않는다 |
| 현재 VDOM | 마지막 성공 VDOM | 마지막 성공 VDOM |
