# Phase 2 입력 동기화·선택 영역 테스트 계약

상태: 사용자 승인 방향에서 도출한 테스트 선행 계약. **핵심 구현·리뷰 회귀 보완 완료**.
[구현 설계와 남긴 항목](p2_input_sync_design.md)을 따르며, 실행 결과는
[진행표](p2_test_boards.md#입력-동기화선택-영역-테스트-선행)를 따른다.

## 1. 근거와 경계

- 요구사항: [Phase 1](../resc/phase1.md), [Phase 2](../resc/phase2.md).
- 기존 계약: [HOOK-09, UPD-02–06, ERR-01/02, FLOW-03](p2_test_cases.md).
- 승인: 사용자는 값 동기화·자동 커서 보정·선택적 명시 위치 지정, DOM → 최신 VDOM
  정보의 WeakMap, 이벤트 대상 한정 확인, 기존 Patch를 통한 반영을 선택하고 테스트
  문서·코드 작성을 요청했다. 새 엔진 API나 내부 helper 이름은 확정하지 않는다.
- 공개 호출 범위: `startApp(App, container)`, `h()`, `useState()`, `useEffect()`와
  실제 요소의 `dispatchEvent()`, `click()`. 내부 함수 대신 다른 함수로 검증을 대체하지 않는다.
- 테스트 파일: [controlled-input.test.ts](../tests/integration/p2/controlled-input.test.ts).
  기존 데모는 [signup-demo.test.ts](../tests/integration/p2/signup-demo.test.ts).
- Phase 1 수정 제한 문서 네 개와 엔진 코드는 이번 작업에서 변경하지 않는다.

### 기존 계약과의 관계

- HOOK-09: **입력 이벤트 없이** 같은 값 setter만 호출하면 예약·재렌더하지 않는 원문 계약 유지.
  입력 이벤트가 남긴 대상 확인 작업은 별개의 책임이다. 같은 State의 확인은 effect를 실행하지 않는다.
- UPD-02: 기존 tick fixture는 그대로다. VDOM 변경과 실제 DOM 불일치가 모두 없으면 Patch 생략.
  입력 대상 DOM이 달라 보정 명령이 생기는 경우까지 Patch 미호출을 보장하지 않는다.
- FLOW-03: 기존 버튼 A/false → B/true 검증 유지. 이 계약은 실제 입력 후 같은 State와 DOM 불일치를 추가한다.
- UPD-06의 특정 연속 setter 사례를 모든 외부 DOM 변경의 자동 복구 보장으로 확대하지 않는다.
- P2-DEMO-SIGNUP-01의 불일치·커서 끝 이동 기대는 아래 DEMO-03/04로 대체한다.
  과거 통과 기록은 당시 결과이고 기능 구현 완료 근거가 아니다.

## 2. 공통 사전 상태·입력·검증 시점

각 테스트는 새 컨테이너에서 시작하고 종료 시 DOM과 spy를 정리한다. 기본 `App`은
`useState(initial)`의 문자열을 입력 `value`와 별도 `[data-state]` 텍스트에 표시한다.
effect는 `[value]`를 사용하며 실행 시 실제 입력값·선택을 기록한다. 입력 요소와
State 텍스트를 함께 판정하며, 관찰 텍스트만으로 실제 DOM 상태를 대신하지 않는다.

1. `startApp()` 후 실제 입력 요소를 보관하고 필요하면 focus한다.
2. 브라우저의 입력 완료 상태를 재현하기 위해 `element.value = raw`와
   `setSelectionRange(start, end, direction)`를 수행한다. 이 대입은 **검사 대상인 엔진 쓰기가 아니다**.
3. 그 뒤 value setter·선택 API에 spy를 설치하고 `input` 또는 `change` 이벤트를 발생시킨다.
4. `flushUpdates()`로 기존 예약 경계까지 기다린 뒤 State 텍스트·실제 DOM·선택·참조·횟수를 검증한다.
   effect 내부 관찰은 실행 순간에 수집한다. 오류 사례는 `captureScheduledUpdates()`로
   콜백을 직접 실행해 오류와 후속 작업을 검사한다.

현재 코드화한 실행 단위는 INPUT 21개, CARET 18개, SELECT 8개, GUARD 10개로
새 파일 **57개**다. 최초55개에 코드 리뷰 재현 INPUT-16·SELECT-08을 추가했다.
DEMO-03/04는 기존 데모 파일 안의 기대값 변경 2개다.

`normalize(raw)`는 테스트 입력일 뿐 엔진에 전달되는 커서 규칙이 아니다. 실제 브라우저 키 입력,
클립보드, undo 이력, IME를 jsdom 합성 이벤트로 검증했다고 주장하지 않는다.

## 3. 값 동기화 — INPUT

아래 정확한 기대값은 구현 결과로 변경하지 않는다. 별도 표시가 없으면 input/type=text,
handler는 `setValue(raw.replace(/\s/g, ''))`, 이벤트는 input, 검증은 flush 이후다.
같은 State 사례는 최초 대비 render·effect 증가 0, DOM 객체 동일성을 함께 검사한다.

| ID | 사전 상태 / 입력·행동 | 기대 결과·유지 조건 |
|---|---|---|
| INPUT-01a | State `''`, raw `' '`, 선택 1..1 | State·DOM `''`, 선택 0..0. 재렌더·effect 없음 |
| INPUT-01b | State `abc`, raw `a bc`, 선택 2..2 | State·DOM `abc`, 선택 1..1. 재렌더·effect 없음 |
| INPUT-01c | State `abc`, raw `a xbc`, 선택 3..3 | State·DOM `axbc`, 선택 2..2. render·effect 각 1회 증가 |
| INPUT-01d | State `abc`, raw `axbc`, 선택 2..2 | State·DOM `axbc`, 선택 2..2. 엔진 value 쓰기 0 |
| INPUT-01e | State `abc`, raw `abc`, 선택 1..1 | State·DOM·선택 유지. 재렌더·effect·value 쓰기 0 |
| INPUT-02 | State `abc`, 이벤트 없이 setter(`abc`) 호출 | queueMicrotask 예약 0, render·effect 증가 0. HOOK-09 유지 |
| INPUT-03 | 초기 `old`, 공개 setter로 `new` 갱신·flush. raw `n ew`, 선택 2..2 입력 | 최신 `new`로 복원, 선택 1..1. 두 번째 render·effect 없음 |
| INPUT-04 | 초기 `''`, raw `a b`, 선택 2..2. 기본 setter(`ab`) 뒤 같은 handler에서 setter(`intermediate`) → setter(`ab`) | 최종 State·DOM `ab`, 선택 1..1. 중간 값 잔류 없음 |
| INPUT-05 | 같은 task에 서로 다른 두 입력 raw `a b`/`x y`, 각 선택 2..2 이벤트 | 두 입력 State·DOM 각각 `ab`/`xy`. 한 대상을 덮어써 누락하지 않음 |
| INPUT-06 | 같은 App에 State `abc` 입력과 비대상 value=`untouched` 입력. 대상 raw `a bc`, 선택 2..2 | 대상 `abc`로 복원. 같은 트리의 비대상 value getter/setter 호출 0 |
| INPUT-07 | State `abc`, 첫 raw `a bc` 확인 후 두 번째 raw `ab c`, 각 선택 2..2/3..3 | 두 번 모두 DOM `abc`, 마지막 선택 2..2. 참조 유지·이전 기록 재사용 없음 |
| INPUT-08 | 초기 `''`, 첫 입력 `a` 후 handler의 동작을 uppercase로 바꾸도록 App 재렌더. 다음 raw `ab`, 선택 1..1 | 최신 handler만 실행, 최종 `AB`, handler 호출 이벤트당1 |
| INPUT-09 | value 미지정, handler는 호출 횟수만 기록. raw `a b`, 선택 2..2 | DOM·선택 유지, value 쓰기 0. 비제어 값 강제 복원 금지 |
| INPUT-10 | 기본 fixture의 이벤트를 change로 바꾸고 INPUT-01b 입력 | 같은 State에서도 `abc`, 선택 1..1. input과 같은 확인 책임 |
| INPUT-11 | 기본 fixture를 textarea로 바꾸고 INPUT-01b 입력 | `abc`, 선택 1..1. 요소 유지 |
| INPUT-12 | 같은 입력에 엔진 밖 input 관찰 listener 추가, raw `a b`, 선택 2..2 | 이벤트 1회·사용자 handler 1회, value 쓰기 1회, 선택 적용 1회. 재발행·중복 반영 없음 |
| INPUT-13 | State `''`, raw `a b`, 선택 2..2 | effect 마지막 관찰이 DOM `ab`, 선택 1..1. 보정 전 DOM을 보지 않음 |
| INPUT-14 | 별도 startApp 두 개, 각각 State `abc`/`xyz`. raw `a bc`/`x yz` 입력 | 각 앱의 최신 값으로 복원. 값·대상 혼선 없음 |
| INPUT-15a/b | checkbox의 지정 프로퍼티 `checked=true`/`indeterminate=false` 각 독립. 실제 DOM만 반대로 바꾸고 change handler가 같은 State setter 호출 | 지정 프로퍼티 복원, State·DOM 일치. 재렌더·effect 증가0, 선택 API 호출0. value 전용 예외 구현 금지 |
| INPUT-16 | multiple select, State 배열은 `['a']`이고 OPTION a/b의 selected를 각각 true/false로 지정. 실제 selected만 false/true로 바꾸고 change handler에서 setter(prev => prev) | a/b selected를 true/false로 복원, State `a`, 재렌더·effect 증가0. 이벤트 대상 select가 관리하는 OPTION만 추가 확인 |

## 4. 자동 위치 대응 — CARET

자동 보정의 기준은 **쓰기 직전 실제 문자열 → 최종 실제 반영 문자열**이다.
유지/삽입/삭제/치환을 포함하는 하나의 대응을 선택하고 커서·양 끝에 공통 적용한다.
편집 수가 적은 대응 → 유지 문자가 많은 대응 → 대응 위치 이동이 적은 대응 순으로 선호한다.
삽입 경계는 삽입 문자 앞, 삭제 구간은 남은 경계, 치환 내부는 상대 위치로 대응한다.
동일 길이라는 이유만으로 항등을 강제하거나 공백·괄호만 특별 취급하지 않는다.

아래는 **App 초기값 `''`**, `normalize`가 표의 최종 문자열을 반환하는 각 독립 fixture다.
명시적 선택 지정을 주지 않는다. 검증은 flush 이후 값·위치·참조·유효 범위다.
문자 위치는 DOM API와 같은 UTF-16 오프셋이며 문자열의 `|`는 설명용이다.

| ID | raw / 선택 | 최종 문자열 / 기대 선택 |
|---|---|---|
| CARET-01a | `aXbXXXXc`, 3..3 | `abc`, 2..2 — 여러 구간 삭제 |
| CARET-01b | `1234567`, 4..4 | `1,234,567`, 5..5 — 여러 구간 삽입 |
| CARET-01c | `123`, 1..1 | `1,23`, 1..1 — 삽입 문자 앞 |
| CARET-01d | `(`, 1..1 | `()`, 1..1 — 문자 종류와 무관한 동일 경계 규칙 |
| CARET-01e | `abc`, 1..1 | `ABC`, 1..1 — 치환 구간 상대 위치 |
| CARET-01f | `aßb`, 2..2 | `aSSb`, 3..3 — 길이가 다른 치환의 끝 경계 |
| CARET-01g | `😀 a`, 3..3 | `😀a`, 2..2 — 이모지 뒤 공백 제거 |
| CARET-01h | `👩‍💻 x`, 6..6 | `👩‍💻x`, 5..5 — 하나의 표시 문자 보존 |
| CARET-01i | `e\u0301 x`, 3..3 | `e\u0301x`, 2..2 — 결합 문자 보존 |
| CARET-01j | `abc`, 2..2 | `''`, 0..0 — 전체 삭제 |
| CARET-02 | `a b c`, 2..4, direction forward/backward 각 독립 | `abc`, 1..2, 원래 방향. 시작·끝에 같은 대응 사용 |
| CARET-03 | `abcdef`, 2..4, backward → 최종 `ab-cdef` | 2..5, backward. 삽입 시작 경계는 앞에 두므로 `-cd` 선택 |
| CARET-04 | raw `a bc`, 처음 선택 2..2. handler가 setState 후 선택을 0..0으로 변경 | 최종 `abc`, 0..0. 이벤트 진입 시 옛 선택으로 되돌리지 않음 |
| CARET-05 | 각 `aab`→`ab`(1), `abc`→`bca`(1), `abc`→`xy`(1), `ab`→`👩‍💻`(1) | 독립 앱 두 개에서 결과 동일. 값 정확, 접힌 선택 유지, 범위·표시 문자 경계 유효 |

CARET-05는 자동 계산의 **결정성·안전성 검사**다. 이것만 통과했다고 모호한 위치의
품질까지 검증했다고 하지 않는다. 정확한 숫자는 아래 미확정 항목을 결정한 뒤 추가한다.

## 5. 명시적 선택 — SELECT

`h('input', { value, selectionStart, selectionEnd, selectionDirection })`를 사용한다.
위치는 선언형이다. 명시적 위치가 있으면 자동 보정 대신 적용하고, 생략하면 자동 보정한다.
기본 초기 value는 `abcdef`, 위치 좌표는 UTF-16이다. 범위 제한은 0..실제 문자열 길이다.

| ID | 사전 상태 / 입력·행동 | 기대 결과·검증 시점 |
|---|---|---|
| SELECT-01 | 최초 props start=2,end=2 | startApp 직후 2..2. 선택 지정을 HTML attributes로 출력하지 않음 |
| SELECT-02 | 초기 `abc`, 지정1..1, raw `a xbc` 선택3..3 입력 | flush 후 `axbc`, 1..1. 자동 위치2보다 지정 우선·선택 적용1회 |
| SELECT-03 | 초기 `abcdef`, 지정1..1. 버튼으로 지정만3..3 변경 | flush 후 값은 그대로, 선택3..3. value 재대입0 |
| SELECT-04 | 초기 `abc`, 외부 setter로 value=`xy`, 지정1..1 함께 변경 | flush 후 `xy`, 1..1. 값 대입의 기본 끝 위치2로 통과할 수 없음 |
| SELECT-05 | 최초 start=1,end=4,direction=backward | startApp 직후 1..4, backward |
| SELECT-06 | 초기 `abc`, 최초 start=-2,end=99 | startApp 직후 0..3. 예외 없음 |
| SELECT-07 | 초기 `abc`, 지정0..0. 버튼으로 선택 props 생략 후 raw `a xbc`, 선택3..3 입력 | flush 후 `axbc`, 자동2..2. 과거 지정 잔류 금지 |
| SELECT-08 | 초기 `abcdef`, 선택 선언1..1. 사용자가 커서를4..4로 옮긴 뒤 className만 first→second로 바꾸는 tick setter 실행 | className=second, 선택4..4 유지. value·선택 API 쓰기0. 값·선택과 무관한 속성 변경이 과거 지정을 재적용하지 않음 |

## 6. 안전성·실패·범위 — GUARD

| ID | 대상 / 사전 상태·행동 | 기대 결과·유지 조건 |
|---|---|---|
| GUARD-01 | type=email, State `abc`, raw `a bc`, input | flush 후 State·DOM `abc`. selection API 호출0. 값 확인은 생략하지 않음 |
| GUARD-02a/b | State `abc`, isComposing=true의 raw `a bc`(선택2)/`a xbc`(선택3) input 각 독립 | flush 후 raw·선택 유지, 엔진 value 쓰기0. State가 같거나 달라도 조합 도중 덮어쓰기 금지 |
| GUARD-03 | GUARD-02 후 compositionend, 이어 같은 raw의 isComposing=false input | flush 후 `abc`, 선택1..1. 실제 조합 종료만 발생한 경우는 별도 실브라우저 미검증 |
| GUARD-04 | raw `a bc` 선택2..2 입력, handler가 다른 input으로 focus 이동 | flush 후 value=`abc`, 다른 input focus 유지. 옛 요소 setSelectionRange 호출0 |
| GUARD-05 | raw `a b` 입력 handler가 대상 표시를 false로 변경 | flush 후 옛 input 분리. 옛 value·selection 쓰기0 |
| GUARD-06 | raw `a b` 입력 handler가 key를 변경해 새 input 생성 | flush 후 옛 input 분리, 새 input 값 `ab`. 옛 value·selection 쓰기0 |
| GUARD-07 | handler가 같은 값 setter 후 다음 render에서 자신을 제거하도록 갱신. 이후 input | 제거된 handler 호출 증가 없음. 이전 wrapper를 남겨 내부 무시하는 것으로 대체하지 않음 |
| GUARD-08 | input setter로 render 오류 유발, 예약 콜백 직접 실행 | 원래 render 오류 전달. 사용자 입력 이후의 DOM에 후속 보정 쓰기 없음. effect 추가0 |
| GUARD-09 | input setter 후 applyPatch가 Error('patch-failure')로 실패, 예약 콜백 직접 실행 | 원래 오류 전달. 이전 정상 화면·State 복구. 옛 target 분리, 후속 보정 쓰기0. 재시도 정상 |

비연결·포커스 가드와 unsupported/type 가드는 자동 위치 계산과 별개의 안전 전제다.
조합 중 값을 담아 둔 State를 어떤 정책으로 재처리할지, compositionend만 있고 뒤 input이
없는 브라우저의 처리 시점은 실제 브라우저 검사 후 결정한다. GUARD-03은 이를 대신하지 않는다.

## 7. 회원가입 데모의 변경 계약 — DEMO

호출 대상은 기존 `openSignup()`가 실제 `src/phase2/cat.ts`를 시작하는 전체 흐름이다.
기존 같은 루트·URL·고양이 상태 유지와 붙여넣기 테스트는 유지한다.

- DEMO-03: 새 회원가입의 빈 State에서 focus → raw `' '` → 선택1..1 → input.
  flush 후 State·DOM `''`, 선택0..0, 관찰 패널 `State와 입력값 일치`, 같은 input 객체.
- DEMO-04: `cat@example.com` 입력·flush 후 raw `ca x t@example.com` → 선택5..5 → input.
  flush 후 State·DOM `caxt@example.com`, 선택3..3, 관찰 패널의 State·DOM·커서 일치.

## 8. 숫자 기대값을 임의 확정하지 않은 항목

다음은 테스트 **코드 없음/미검증**이다. skip/todo를 통과 수에 넣지 않는다.

- 대응 위치 이동량의 수학적 정의, 마지막 동률 순서. CARET-05의 정확 숫자 기대는 이것을 결정한 뒤 추가.
- 치환 내부 상대 위치의 반올림, 선택 역전 입력(start > end)의 명시적 지정 정책.
- 계산량 상한·상한 직전/직후 결과. 테스트를 위해 임의의 길이·상수를 계약으로 만들지 않는다.
- compositionend 단독 시점, 실제 IME/undo/redo/autofill/드래그 입력, 실제 Chromium/Safari/Firefox.
- WeakMap의 성공 시 교체는 구현했다. syncEvents 실패 중간 상태 전용 검증,
  handler 자체 예외·중첩 dispatch의 확대된 상세 정책은 미확정이다.
- scrollTop/scrollLeft, 포커스 강제 복원, 이벤트 없는 외부 DOM 변경 상시 감시.

이번 테스트 코드는 통일 알고리즘을 테스트 안에 재구현하지 않는다. 대표 수치 사례와 불변식으로
검사하며, 구현을 본 뒤 기대값을 바꾸지 않는다. 미구현 모듈 import 오류가 아니라 실제
공개 경로의 assertion 실패를 먼저 확인한다.
