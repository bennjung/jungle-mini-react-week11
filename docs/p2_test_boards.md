# Phase 2 테스트 진행표

기준: [p2_test_cases.md](p2_test_cases.md) §2–§8. 명세의 테스트 ID별로 한 행을 작성한다. 테스트 케이스는 INIT 4개, H 8개, HOOK 9개, UPD 6개, EFF 1개, ERR 2개, FLOW 3개로 총 33행이다. 이 중 ERR-02는 승인안에 정책이 없어 판정 대상이 아니다. 설계 기준은 [wiki/Phase2-Design-merged.md](../wiki/Phase2-Design-merged.md)의 승인안을 따른다.

결과는 `O` 통과, `X` 실패, 빈칸은 미실행 또는 일부만 검증됨을 뜻한다. 일부 검증만 통과한 케이스는 전체 통과로 표시하지 않는다. spy 기반 호출 기록 검증과 실제 DOM 검증의 범위를 원인 분석에 구분한다.

| 테스트 카테고리 | 테스트 코드 | 테스트 내용 | 테스트 결과(O,X) | 원인 분석 |
| --- | --- | --- | --- | --- |
| 2. 시작·최초 표시 (INIT) | **INIT-01** | startApp이 컨테이너에 최초 화면을 만들고 event를 직접 연결한다. | | |
| 2. 시작·최초 표시 (INIT) | **INIT-02** | 최초 표시가 컨테이너를 교체하고 같은 화면 갱신에서 DOM을 유지한다. | | |
| 2. 시작·최초 표시 (INIT) | **INIT-03** | 최초 표시 후 실행 조건에 맞는 effect를 commit 뒤 실행한다. | | |
| 2. 시작·최초 표시 (INIT) | **INIT-04** | startApp은 container를 검증하고 같은 container의 반복 시작을 막는다. | | |
| 3. h()·정규화 (H) | **H-01** | h()가 태그·props·children으로 요소 VNode를 만든다. | | |
| 3. h()·정규화 (H) | **H-02** | children의 문자열·숫자를 Text VNode로 변환한다. | | |
| 3. h()·정규화 (H) | **H-03** | 중첩 배열을 펼치고 null·undefined·boolean·빈 값을 제외한다. | | |
| 3. h()·정규화 (H) | **H-04** | Component의 원시 문자열·숫자 반환은 오류다. | | |
| 3. h()·정규화 (H) | **H-05** | children의 허용되지 않는 값은 오류다. | | |
| 3. h()·정규화 (H) | **H-06** | props를 attribute·property·event·key로 분류한다. | | |
| 3. h()·정규화 (H) | **H-07** | boolean attribute는 true를 빈 값으로, false를 생략으로 처리한다. | | |
| 3. h()·정규화 (H) | **H-08** | tagName이 문자열이 아니면 오류다. | | |
| 4. Hook (HOOK) | **HOOK-01** | useState가 mount에서 기록을 만들고 update에서 값과 setter를 유지한다. | | |
| 4. Hook (HOOK) | **HOOK-02** | 여러 useState가 호출 순서로 분리되고 setter가 자기 기록만 바꾼다. | | |
| 4. Hook (HOOK) | **HOOK-03** | 함수형 updater가 이전 값 기준으로 다음 State를 계산한다. | | |
| 4. Hook (HOOK) | **HOOK-04** | useMemo가 의존성이 같으면 다시 계산하지 않는다. | | |
| 4. Hook (HOOK) | **HOOK-05** | useMemo가 의존성이 바뀌면 다시 계산한다. | | |
| 4. Hook (HOOK) | **HOOK-06** | useEffect가 commit 뒤 실행되고 의존성이 같으면 다시 실행하지 않는다. | | |
| 4. Hook (HOOK) | **HOOK-07** | Component 실행 밖에서 Hook을 호출하면 오류다. | | |
| 4. Hook (HOOK) | **HOOK-08** | Hook 개수나 종류가 render 사이에 바뀌면 오류다. | | |
| 4. Hook (HOOK) | **HOOK-09** | 같은 값을 넣는 setter는 갱신을 예약하지 않는다. | | |
| 5. 갱신 (UPD) | **UPD-01** | State 변경이 자동 재렌더와 필요한 Patch로 이어진다. | | |
| 5. 갱신 (UPD) | **UPD-02** | 화면 데이터가 같으면 applyPatch를 호출하지 않는다. | | |
| 5. 갱신 (UPD) | **UPD-03** | 화면이 같아도 handler가 바뀌면 새 handler가 실행된다. | | |
| 5. 갱신 (UPD) | **UPD-04** | handler가 제거되면 이전 handler가 실행되지 않는다. | | |
| 5. 갱신 (UPD) | **UPD-05** | effect 안 setter가 현재 처리 후 다음 갱신으로 이어진다. | | |
| 5. 갱신 (UPD) | **UPD-06** | 연속 setter 호출 후 최종 State와 화면이 일치한다. | | |
| 6. 생명주기 (EFF) | **EFF-01** | 의존성이 바뀌면 이전 cleanup이 새 effect보다 먼저 실행된다. | | |
| 7. 실패 (ERR) | **ERR-01** | 갱신 중 render 오류는 DOM 반영 전에 중단되고 이전 화면이 유지된다. | | |
| 7. 실패 (ERR) | **ERR-02** | applyPatch 실패는 마지막 성공 VDOM으로 복구하고 오류를 전파한다. | | |
| 8. 통합 (FLOW) | **FLOW-01** | 카운터에서 클릭·State·화면 반영이 자동으로 이어진다. | | |
| 8. 통합 (FLOW) | **FLOW-02** | 자식 컴포넌트가 props만 사용하고 부모 State 변경이 자식 화면에 반영된다. | | |
| 8. 통합 (FLOW) | **FLOW-03** | 입력 요소의 value·checked가 properties를 거쳐 화면에 반영된다. | | |

## 테스트 코드 위치

공개 경계는 `src/component/index.ts`다. `h`, `startApp`, `useState`, `useMemo`, `useEffect`를 여기서 내보낸다.

| 범위 | 파일 |
| --- | --- |
| INIT, UPD, FLOW | [tests/integration/p2/app.test.ts](../tests/integration/p2/app.test.ts) |
| ERR | [tests/integration/p2/errors.test.ts](../tests/integration/p2/errors.test.ts) |
| H | [tests/unit/p2/h.test.ts](../tests/unit/p2/h.test.ts) |
| HOOK, EFF | [tests/unit/p2/hooks.test.ts](../tests/unit/p2/hooks.test.ts) |
| 공통 대기·fixture | [tests/helpers/p2.ts](../tests/helpers/p2.ts) |

## 현재 실행 기록

- 2026-11-10: `tests/unit/p2/*`, `tests/integration/p2/*` 작성. 구현 전이므로 `npx vitest run tests/unit/p2 tests/integration/p2` 결과는 **32 실패 / 4 통과**다(테스트 36개).
- 통과 4개는 `H-04`·`H-05`·`H-08`·`HOOK-07`이다. 모두 “오류가 난다”를 기대하는 케이스라, 미구현 stub이 항상 예외를 던져 생긴 **가짜 통과**다. 구현 후 다시 판정한다.
- `npm run typecheck`는 통과한다.
- 실행 기록은 `npm run test` 결과와 함께 갱신한다. typecheck·build 결과는 별도로 적는다.

## 확정된 경계

- `ERR-02`: `applyPatch()` 실패 시 마지막 성공 VDOM으로 재구성하는 것으로 정했다. 롤백·재시도 정책은 두지 않는다.
- `ERR-01`: 오류를 잡지 않는 것으로 정했다. 예약된 `update`의 오류 도착 위치는 보장하지 않고, `finally`로 Hook 문맥을 해제한다.
- `UPD-02`: 갱신 성공 시 항상 다음 VDOM으로 교체하는 것으로 정했다. VDOM 교체는 외부에서 관찰할 수 없어 DOM 객체 동일성만 판정한다.
