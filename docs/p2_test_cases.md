# Phase 2 테스트 케이스

## 1. 기준과 검증 방법

- 요구사항 원문: [resc/phase2.md](../resc/phase2.md).
- 설계 기준: [wiki/Phase2-Design-merged.md](../wiki/Phase2-Design-merged.md)의 **승인안**. 함수 이름·책임·호출 순서는 이 문서의 `function flow`와 `분업용 함수 계약`을 따른다.
- 이 문서는 테스트 명세다. 테스트 코드 작성·실행 결과를 의미하지 않는다.
- Diff·Patch·`renderChildren`·`renderNode`의 세부 계약은 Phase 1 승인 계약과 [p1_test_cases.md](p1_test_cases.md)를 재사용한다. Phase 2는 그 앞단인 Component 실행·Hook·event 갱신을 추가한다.
- 함수 이름은 승인안에서 고정한 이름만 사용한다: `startApp`, `FunctionComponent`, `mount`, `update`, `h`, `useState`, `useMemo`, `useEffect`, `diff`, `applyPatch`, `renderChildren`, `renderNode`, `syncEvents`. 나머지 helper는 구현 모듈 내부 이름이므로 테스트가 직접 호출하지 않는다.
- 각 케이스는 사전 상태, 입력·행동, 검증 시점, 기대 결과, 유지 조건을 명시한다.
- DOM 객체 동일성은 테스트 시작 전에 보관한 참조와 `===`로 비교한다. HTML 문자열이나 화면 모양이 같다는 이유로 동일 객체라고 판단하지 않는다.
- State 변경 후 갱신은 현재 동기 처리(handler·effect)가 끝난 뒤 실행된다. 테스트는 클릭·effect 처리 후 예약된 갱신이 끝나는 지점까지 기다린 뒤 확인한다. 예약 수단이 바뀌어도 이 대기 지점은 유지한다.
- "`applyPatch`를 호출하지 않는다"는 실제 DOM 객체 불변과 호출 기록 두 가지로 확인한다. 호출 기록은 실제 모듈의 spy로 확인하고, 같은 케이스에서 DOM 불변도 함께 검증한다.
- event는 요소별 직접 연결이다. 이벤트는 실제 DOM 메서드로 발생시키고(`element.click()` 등), 루트 위임을 전제한 검증은 하지 않는다.
- event prop 이름은 `onClick` 표기를 사용하고, 1차 지원 이벤트는 `click`·`input`·`change` 3개다.
- event 함수는 `VNode.events` 선택 필드에 DOM 이벤트 이름(`click`)으로 보관한다. 테스트는 이 필드를 직접 검사하지 않고 실제 클릭·입력으로 확인한다.
- 자식 컴포넌트는 `h(Child, props)`로 즉시 실행한다. 실행·반환 정규화 동안 Hook 소유자를 비우고 `finally`로 직전 소유자를 복원한다. `Child(props)` 직접 호출 자동 감지는 지원하지 않는다.
- [사용자 승인 변경계약](p2_component_boundary_plan.md)에 따라 H-08·FLOW-02를 변경하고 H-09–11·HOOK-10–13·ERR-03을 추가했다. 해당 구현·검증은 완료됐으며 실제 결과는 [진행표](p2_test_boards.md)를 따른다. 이 문서의 정책·입력·기대값은 결과에 맞추어 변경하지 않는다.
- 오류는 프레임워크가 잡지 않는다. `mount` 경로는 `startApp()` 호출자에게 전파되고, 예약된 `update` 경로는 도착 위치를 보장하지 않는다. 테스트는 두 경로를 구분한다.
- 갱신이 성공하면 현재 VDOM은 항상 다음 VDOM으로 교체된다. DOM 객체는 유지된다.

### 승인된 후속 테스트 계약 — 입력 동기화·선택 영역

[p2_input_sync_test_cases.md](p2_input_sync_test_cases.md)는 사용자 승인으로 추가한
INPUT·CARET·SELECT·GUARD·DEMO 계약이다. 기존 41개 ID의 fixture·기대값은 유지하고,
이벤트가 실제 DOM을 먼저 바꾸는 경로와 선택 영역을 추가로 검증한다. 테스트 선행 후 핵심 구현·
리뷰 회귀 보완을 완료했고 전체354개 통과를 확인했다. 기존41개 ID의 통과와 추가57개 실행·
데모4개를 구분하며, 미확정 항목은 후속 문서 §8에 남긴다.

- HOOK-09의 같은 값 setter 예약 생략은 유지한다. 이벤트가 남긴 DOM 확인 작업은 별개다.
- UPD-02의 기존 fixture는 유지한다. 실제 입력 DOM 불일치로 보정 명령이 생기는 경우는
  새 INPUT 계약의 범위이며, 모든 경우에 applyPatch를 생략한다는 뜻은 아니다.
- FLOW-03의 버튼 A/false → B/true는 유지한다. State 변경 여부와 DOM 불일치는
  INPUT-01a–e에서 독립적으로 검증한다.
- 새 계약은 임의 외부 DOM 변경의 상시 복구를 요구하지 않는다. 미확정 수치 정책과
  실브라우저 검증은 후속 문서 §8에서 미검증으로 구분한다.

### 검증 범위 밖

설계는 확정됐고, 아래 항목만 이 문서에서 케이스를 두지 않는다. 침묵을 “검증됨”으로 읽지 않기 위한 경계다.

| 항목 | 결정 | 이 문서의 검증 |
|---|---|---|
| SVG 요소 | 1차 범위에서 제외. `tagName` 대문자 규칙은 HTML 전용 | 없음 |
| batching 횟수 | 횟수를 보장하지 않고 최종 State·화면 일치만 보장한다 | UPD-06은 최종 일치만 확인. 횟수는 검증하지 않음 |
| Hook 오용 정적 분석 | 도입하지 않는다. runtime 검사만 수행한다 | HOOK-07·08 |
| HTML 번역기 | 후속 목표 | 없음 |

## 2. 시작·최초 표시 — DOM 생성·참조 보관·첫 effect

### INIT-01 — startApp이 컨테이너에 최초 화면을 만들고 event를 직접 연결한다

- **대상 / 범위:** `startApp(App, container)` 전체.
- **사전 상태:** 컨테이너는 자식이 없는 빈 Element다. `App`은 `h("button", { onClick: handler }, "0")`을 반환하고 `handler`는 호출 횟수를 기록한다.
- **입력·행동:** `startApp(App, container)`을 호출하고, 종료 후 버튼을 한 번 클릭한다.
- **검증 시점:** `startApp()` 종료 직후, 그리고 클릭 처리 후.
- **기대 결과:** 컨테이너에 button 요소 1개와 텍스트 `0`이 생성된다. 클릭하면 `handler`가 정확히 한 번 실행된다.
- **유지 조건:** 컨테이너 객체는 유지된다. `createRoot`·`AppRoot` 같은 별도 공개 계층을 만들지 않는다. 최초 표시에서 컨테이너의 기존 자식을 중복 삽입하지 않는다.

### INIT-02 — 최초 표시가 컨테이너를 교체하고 같은 화면 갱신에서 DOM을 유지한다

- **대상 / 범위:** `startApp()` → `mount()`와 후속 `update()`.
- **사전 상태:** 컨테이너에 `<em>` 자식이 있다. `App`은 `h("section", {}, h("p", {}, "A"), tick 버튼)`을 반환하고 tick은 화면에 쓰이지 않는 State다.
- **입력·행동:** `startApp(App, container)`을 호출하고, 이어서 tick 버튼을 클릭한다.
- **검증 시점:** `startApp()` 종료 직후, 그리고 tick 갱신 완료 후.
- **기대 결과:** 기존 `<em>`이 사라지고 section·p·텍스트가 생성된다. 같은 출력의 갱신 후에도 section·p·텍스트 노드 객체가 그대로다.
- **유지 조건:** 비교 기준이 준비되지 않으면 같은 출력에서도 노드가 교체된다. 컨테이너 객체는 유지된다.

### INIT-03 — 최초 표시 후 실행 조건에 맞는 effect를 commit 뒤 실행한다

- **대상 / 범위:** `startApp()`의 mount 이후 effect 처리.
- **사전 상태:** `App`은 `useEffect(effect, [])`를 호출한다. `effect`는 실행 시점에 컨테이너의 DOM을 조회해 기록한다.
- **입력·행동:** `startApp(App, container)`을 호출한다.
- **검증 시점:** `startApp()` 종료 직후.
- **기대 결과:** effect가 한 번 실행되고, 실행 시점에 이미 컨테이너에 button이 존재한다. 기록된 순서는 `DOM 생성 → effect`다.
- **유지 조건:** effect를 DOM 반영 전에 실행하지 않는다. deps `[]`이므로 같은 mount에서 다시 실행하지 않는다.

### INIT-04 — startApp은 container를 검증하고 같은 container의 반복 시작을 막는다

- **대상 / 범위:** `startApp(App, container)`의 인자·시작 경계.
- **사전 상태:** 정상 container와, 이미 `startApp`으로 앱을 시작한 container를 준비한다.
- **입력·행동:** `startApp(App, null)`, `startApp(App, "container")`, `startApp(App, 이미_시작한_container)`를 각각 호출한다.
- **검증 시점:** 각 호출 직후.
- **기대 결과:** 세 호출 모두 오류다. 이미 시작한 container의 기존 화면과 event 연결은 변경되지 않는다.
- **유지 조건:** `startApp`은 `void`를 반환한다. 반환값으로 앱을 제어하는 handle을 제공하지 않는다. container별 1회 시작을 전제한다.

## 3. h()와 구조 정규화 — VNode 생성·텍스트 변환·잘못된 값

### H-01 — h()가 태그·props·children으로 요소 VNode를 만든다

- **대상 / 범위:** `h(tagName, props, ...children)` 단독.
- **사전 상태:** 없음.
- **입력·행동:** `h("div", { class: "box", title: "t" }, "A")`를 호출한다.
- **검증 시점:** 반환 직후.
- **기대 결과:** 요소 VNode 1개를 반환한다. `nodeType`은 1, `tagName`은 **`DIV`(대문자)**, 속성은 `class="box"`·`title="t"`, 자식은 텍스트 `A` 하나다. `dom`은 null이다.
- **유지 조건:** `h()`는 실제 DOM을 만들거나 컨테이너를 변경하지 않는다. tagName은 Phase 1 `createSnapshot`과 같은 대문자 표기로 저장한다(HTML 전용).

### H-02 — children의 문자열·숫자를 Text VNode로 변환한다

- **대상 / 범위:** `h()`의 children 처리.
- **사전 상태:** 없음.
- **입력·행동:** `h("p", {}, "A", 0, 1)`과 `h("p", {}, ["B", 2])`를 각각 호출한다.
- **검증 시점:** 각 반환 직후.
- **기대 결과:** 두 호출 모두 자식이 Text VNode다. 값은 각각 `A`, `0`, `1`과 `B`, `2`이고 숫자는 문자열로 변환된다. 사용자가 별도 텍스트 생성 함수를 호출하지 않아도 된다.
- **유지 조건:** 요소 자식과 텍스트 자식의 순서를 입력 순서대로 유지한다.

### H-03 — 중첩 배열을 펼치고 null·undefined·boolean·빈 값을 제외한다

- **대상 / 범위:** `h()`의 children 구조 정리.
- **사전 상태:** 없음.
- **입력·행동:** `h("ul", {}, [h("li", {}, "A"), [[h("li", {}, "B")]]], null, undefined, true, false, [], "")`를 호출한다.
- **검증 시점:** 반환 직후.
- **기대 결과:** 자식 요소는 `li` 2개이고 순서는 A, B다. `null`·`undefined`·boolean은 자식 목록에 없다. 빈 배열은 빈 목록으로 처리하고, 빈 문자열 `""`은 Text VNode를 만들지 않는다. 모두 오류가 아니다.
- **유지 조건:** 중첩 배열을 끝까지 펼치고 배열을 자식으로 남기지 않는다. 제외 대상(H-03)과 오류 대상(H-05)을 섞지 않는다.

### H-04 — Component의 원시 문자열·숫자 반환은 오류다

- **대상 / 범위:** Component 실행 결과 처리(`mount()`·`update()` 경로).
- **사전 상태:** `App`이 `"안녕"`을 반환한다. 별도 사전 상태로 `App`이 `[h("p", {}, "A"), "B"]`를 반환한다.
- **입력·행동:** 각 사전 상태에서 `startApp(App, container)`을 호출한다.
- **검증 시점:** 호출이 오류로 중단된 직후.
- **기대 결과:** 두 경우 모두 오류가 전달된다. 컨테이너에 `안녕`이나 `B`가 표시되지 않는다.
- **유지 조건:** Component 반환값의 문자열·숫자를 Text VNode로 자동 변환하지 않는다. `h("p", {}, "안녕")`처럼 `h()`를 거친 텍스트는 정상이다(H-02).

### H-05 — children의 허용되지 않는 값은 오류다

- **대상 / 범위:** `h()`의 children 검증.
- **사전 상태:** 없음.
- **입력·행동:** `h("div", {}, { a: 1 })`, `h("div", {}, () => null)`, `h("div", {}, document.createElement("span"))`, `h("div", {}, Promise.resolve("A"))`를 각각 호출한다.
- **검증 시점:** 각 호출 직후.
- **기대 결과:** 네 호출 모두 오류가 전달되고 요소 VNode를 만들지 않는다.
- **유지 조건:** `null`·`undefined`·boolean처럼 조용히 제외하는 값과 구분한다. DOM Node를 자식으로 붙이는 편의 동작을 제공하지 않는다. 오류를 무시하고 나머지 자식만으로 VNode를 만들지 않는다.

### H-06 — props를 attribute·property·event·key로 분류한다

- **대상 / 범위:** `h()`의 props 분류.
- **사전 상태:** 없음.
- **입력·행동:** `h("input", { key: "n", class: "box", value: "A", checked: false })`와 `h("div", { key: 1, title: 0 })`를 각각 호출한다.
- **검증 시점:** 각 반환 직후.
- **기대 결과:** 첫 호출에서 `key`·`class`는 attributes(`key="n"`, `class="box"`), `value`·`checked`는 properties(`"A"`, `false`)다. 두 번째 호출에서 `key`는 attributes `"1"`, `title`은 attributes `"0"`이다. 숫자는 문자열로 변환된다.
- **유지 조건:** `key`를 attributes에서 제거하지 않는다(Phase 1 Diff가 attributes에서 key를 읽는다). properties 값을 attributes로 중복 저장하지 않는다.

### H-07 — boolean attribute는 true를 빈 값으로, false를 생략으로 처리한다

- **대상 / 범위:** `h()`의 attribute 값 변환.
- **사전 상태:** 없음.
- **입력·행동:** `h("button", { disabled: false }, "저장")`, `h("button", { disabled: true }, "저장")`, `h("div", { hidden: 0 })`, `h("div", { class: "" })`, `h("input", { checked: false })`를 각각 호출한다.
- **검증 시점:** 각 반환 직후.
- **기대 결과:** `disabled: false`는 attributes에 없다. `disabled: true`는 `{ name: "disabled", value: "" }`다. `hidden: 0`은 `"0"`, `class: ""`은 `""`로 유지된다. `checked: false`는 properties에 `false`로 남고 attribute로 옮기지 않는다.
- **유지 조건:** boolean 처리 규칙은 attributes에만 적용한다. 숫자 `0`과 빈 문자열은 boolean이 아니므로 그대로 문자열화한다. 이 규칙이 없으면 `disabled="false"`가 실제로 비활성화되는 오동작이 생긴다.

### H-08 — 잘못된 첫 인자는 오류다

- **대상 / 범위:** 공개 `h()`의 첫 인자 검증.
- **사전 상태:** 빈 컨테이너를 준비하며 실행 중인 루트는 없다.
- **입력·행동:** `h("", {}, "A")`, `h("   ", {}, "A")`, `h(null, {}, "A")`, `h(1, {})`, `h({}, {})`를 각각 호출한다. 타입 밖 입력은 런타임 검증 경로로만 전달한다.
- **검증 시점:** 각 호출 직후.
- **기대 결과:** 다섯 호출 모두 오류가 전달되고 컨테이너는 비어 있다.
- **유지 조건:** 함수 첫 인자는 더 이상 전체 거부하지 않는다. 기존 `h(Child, {}, "A")`의 오류 기대는 H-09의 **여분 인자 선거부**로 별도 유지한다. 함수 정상 호출과 구분한다.

### H-09 — 함수 분기는 즉시 실행하고 props를 그대로 전달한다

- **대상 / 범위:** 공개 `h(Child, props)`의 실행·인자·타입 경계. 내부 helper를 직접 호출하지 않는다.
- **사전 상태:** `payload = { label: "A" }`, `callback = () => log.push("callback")`, `props = { payload, onCustom: callback, children: "직접 지정" }`를 준비한다. `Child`는 받은 인자를 `received`에 저장하고 `log.push("child")` 후 `h("p", {}, "A")`를 반환한다. 별도로 `EmptyChild`는 받은 props를 기록하고 null을 반환한다. DOM 컨테이너는 비어 있다.
- **입력·행동:** `log.push("before")`, `h(Child, props)`, `log.push("after")`를 순서대로 실행한다. 이어 기록된 `received.onCustom()`을 호출한다. 별도 기록으로 `h(EmptyChild)`, `h(EmptyChild, undefined)`, `h(EmptyChild, null)`을 각각 실행한다. 마지막으로 호출 횟수를 초기화하고 `h(Child, {}, "A")`, `h(Child, props, undefined)`, `h(Child, props, [])`를 각각 런타임 입력으로 실행한다.
- **검증 시점:** 정상 호출 반환 직후, 콜백 실행 직후, 생략값 각 반환 직후, 각 여분 인자 오류 직후.
- **기대 결과:** 정상 호출에서 `before → child → after`이며 Child는 정확히 1회 실행된다. `received === props`, `received.payload === payload`, `received.onCustom === callback`; `children`은 `"직접 지정"` 그대로다. `onCustom`을 DOM 이벤트로 분류·거부하지 않으며 콜백을 실행하면 `callback` 기록 1개가 생긴다. 세 생략값은 각각 빈 객체를 받는다(객체 참조의 상호 동일성은 보장하지 않음). 여분 인자 세 입력은 모두 오류이며 각 Child 진입 횟수는 0이다.
- **타입 검증:** `(props: { count: number; onIncrease: () => void }) => unknown`인 자식에 정상 객체를 넘기는 호출은 컴파일된다. 필수 props 생략·null·`{}`·`{ count: "0", onIncrease: callback }`·필수 callback 누락은 각각 `@ts-expect-error`로 컴파일 오류를 고정한다. 잘못된 호출은 컴파일 전용 함수 안에 두고 그 함수를 실행하지 않는다. 런타임의 생략/null→빈 객체는 필수 props 타입을 선택형으로 바꾸는 근거가 아니다.
- **유지 조건:** 함수 props는 복제·속성 분류·자동 children 병합하지 않는다. 전달된 콜백 실행 자체를 금지하지 않는다. 문자열 분기 props 규칙은 H-06·07 그대로이며, 렌더 도중 setter 정책은 변경하지 않는다.

### H-10 — 자식 반환값은 기존 Component 규칙으로 정규화한다

- **대상 / 범위:** 공개 `h(Child, {})`의 자식 실행 후 반환 정규화.
- **사전 상태:** `a = h("p", {}, "A")`, `b = h("span", {}, "B")`를 만들고 각 Child는 호출 횟수를 기록한 뒤 아래 값 하나를 반환하도록 독립적으로 준비한다. 컨테이너는 비어 있다.
- **입력·행동:** 허용값 `a`, `[a, [[b]], null, undefined, true, false, []]`, `null`, `undefined`, `true`, `false`, `[]` 각각에 대해 `h(Child, {})`를 호출한다. 거부값 `"안녕"`, `""`, `0`, `1`, `{ a: 1 }`, `() => null`, `document.createElement("span")`, `Promise.resolve(a)` 각각의 직접 반환과 `[a, [거부값]]` 반환도 호출한다.
- **검증 시점:** 각 반환 직후 또는 오류 직후.
- **기대 결과:** 허용값은 각각 `[a]`, `[a, b]`, 나머지는 `[]`다. 반환 목록의 VNode는 원본과 동일 참조이고 배열은 재귀적으로 펼쳐진다. 거부 입력은 모두 Child 진입 1회 후 오류이며 원시값을 Text VNode로 바꾸지 않는다. 어떤 호출도 DOM을 생성하지 않는다.
- **유지 조건:** 기존 `normalizeComponentResult` 규칙 재사용이며 별도 반환 체계를 만들지 않는다. 루트 원문 입력은 H-04 그대로 유지한다. 문자열 h의 함수 children 오류는 H-05 그대로다.

### H-11 — 요소와 함수 자식을 기존 VNode로 합성한다

- **대상 / 범위:** 공개 `h()` 함수·문자열 분기 합성과 `startApp()` 최초 표시.
- **사전 상태:** `Grandchild`는 `h("i", {}, "G")`를 반환하고, `Child({ label })`는 `[h("span", {}, label), [h(Grandchild, {})]]`를 반환한다. 각각 진입 순서를 기록한다. `App`은 `h("section", {}, h(Child, { label: "A" }), h("b", {}, "B"), h(Child, { label: "C" }))`를 반환한다. 빈 container다.
- **입력·행동:** 우선 같은 요소 합성식을 단독 실행해 결과를 검사한다. 기록을 비운 뒤 `startApp(App, container)`을 호출한다. 별도 빈 컨테이너에는 `RootChildApp = () => h(Child, { label: "A" })`를 `startApp(RootChildApp, rootChildContainer)`으로 시작한다.
- **검증 시점:** 단독 반환 직후와 최초 표시 종료 직후.
- **기대 결과:** 단독 출력은 section 요소 VNode 하나이며 자식 순서는 `SPAN(A), I(G), B(B), SPAN(C), I(G)`다. 각 Child·Grandchild는 깊이 우선으로 `Child A → Grandchild → Child C → Grandchild` 순서로 1회씩 실행된다. 최초 표시의 실제 DOM도 같은 순서·텍스트 `AGBCG`다. 별도 루트 함수 반환의 컨테이너는 감싸기 요소 없이 `SPAN(A), I(G)` 형제와 텍스트 `AG`를 가진다.
- **유지 조건:** 함수 h는 VNode[]만 반환하므로 기존 문자열 h의 배열 펼침으로 합성한다. `ComponentVNode`·resolve·자식 인스턴스·key 식별을 만들지 않는다. 함수 자체를 children에 넘기는 H-05와 혼동하지 않는다.

## 4. Hook — 기록 생성·호출 순서·의존성 비교

### HOOK-01 — useState가 mount에서 기록을 만들고 update에서 값과 setter를 유지한다

- **대상 / 범위:** `useState(initialValue)`, `mount()`, `update()`.
- **사전 상태:** `App`은 `const [count, setCount] = useState(0)`을 호출하고 `h("button", { onClick: () => setCount(count + 1) }, count)`를 반환한다.
- **입력·행동:** `startApp()`을 호출하고 버튼을 한 번 클릭한다.
- **검증 시점:** 최초 종료 직후, 그리고 갱신 완료 후.
- **기대 결과:** 최초 화면 텍스트는 `0`이고 클릭 후 `1`이다. 갱신 후에도 State 기록 수가 늘지 않는다. setter 참조는 render 사이에 같다.
- **유지 조건:** 갱신마다 새 State 기록을 만들지 않는다. 값은 기록에 저장되고 화면은 그 값을 읽는다.

### HOOK-02 — 여러 useState가 호출 순서로 분리되고 setter가 자기 기록만 바꾼다

- **대상 / 범위:** `useState()` 두 개와 각 setter.
- **사전 상태:** `const [first, setFirst] = useState("A")`, `const [second, setSecond] = useState("B")`. 화면은 두 값을 나란히 표시하고, 두 번째 버튼이 `setSecond("B2")`만 호출한다.
- **입력·행동:** 두 번째 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 첫 번째 값은 `A`를 유지하고 두 번째 값만 `B2`가 된다. 화면은 `A B2`다.
- **유지 조건:** 두 setter가 서로의 기록을 바꾸지 않는다. Hook 호출 순서가 같은 한 같은 기록을 참조한다.

### HOOK-03 — 함수형 updater가 이전 값 기준으로 다음 State를 계산한다

- **대상 / 범위:** setter의 함수형 updater 경로.
- **사전 상태:** `count`는 0이다. 한 버튼의 handler가 `setCount(prev => prev + 1)`을 두 번 호출한다.
- **입력·행동:** 버튼을 한 번 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 최종 화면은 `2`다. 값 `0`을 캡처한 `setCount(0 + 1)` 두 번이 아니라 각 호출이 직전 값 기준으로 계산된다.
- **유지 조건:** 두 호출이 한 번의 갱신으로 합쳐지거나 두 번 갱신되더라도 최종 값은 `2`다. 갱신 횟수는 이 케이스의 판정 기준이 아니다.

### HOOK-04 — useMemo가 의존성이 같으면 다시 계산하지 않는다

- **대상 / 범위:** `useMemo(calculate, deps)`의 비교·재사용 경로.
- **사전 상태:** `useMemo(calculate, [count])`. `calculate`는 호출 횟수를 기록한다. 화면에는 `count`와 별도 State `label`이 함께 표시된다.
- **입력·행동:** `label`만 바꾸는 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 재렌더가 발생하고 `label`이 화면에 반영된다. `calculate` 호출 횟수는 늘지 않고 이전 결과가 재사용된다.
- **유지 조건:** 의존성 비교는 `Object.is`를 사용한다. 의존성이 같다는 이유로 재렌더 자체를 생략하지 않는다.

### HOOK-05 — useMemo가 의존성이 바뀌면 다시 계산한다

- **대상 / 범위:** `useMemo(calculate, deps)`의 재계산 경로.
- **사전 상태:** HOOK-04와 같은 구성.
- **입력·행동:** `count`를 바꾸는 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** `calculate`가 한 번 더 호출되고 새 결과가 화면에 반영된다.
- **유지 조건:** 이전 결과를 그대로 쓰지 않는다. 의존성 배열의 길이와 순서를 비교 대상에 포함한다.

### HOOK-06 — useEffect가 commit 뒤 실행되고 의존성이 같으면 다시 실행하지 않는다

- **대상 / 범위:** `useEffect(effect, deps)`의 실행 조건 판단.
- **사전 상태:** `useEffect(effect, [count])`. `effect`는 호출 횟수를 기록한다. `label` State를 바꾸는 버튼이 있다.
- **입력·행동:** `label`만 바꾸는 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 화면은 갱신되지만 `effect`는 추가 실행되지 않는다. 최초 mount에서 1회 실행된 상태가 유지된다.
- **유지 조건:** effect는 DOM 반영 후 실행된다(INIT-03). 의존성이 같다는 이유로 화면 갱신까지 생략하지 않는다. deps를 생략하면 매 render 실행한다.

### HOOK-07 — Component 실행 밖에서 Hook을 호출하면 오류다

- **대상 / 범위:** Hook 소유 인스턴스 검사.
- **사전 상태:** `useState`를 호출하는 일반 함수 `outside()`를 준비한다. 정상 앱은 아직 시작하지 않았다.
- **입력·행동:** `outside()`를 호출한다.
- **검증 시점:** 호출 직후.
- **기대 결과:** 오류가 전달되고 State 기록을 만들지 않는다.
- **유지 조건:** Hook은 루트 Component 실행 중에만 호출할 수 있다. 함수 h의 자식 경계는 HOOK-10–13을 따른다. 전역 상태로 마지막 인스턴스를 재사용하지 않는다.

### HOOK-08 — Hook 개수나 종류가 render 사이에 바뀌면 오류다

- **대상 / 범위:** Hook 기록의 종류·개수 검사.
- **사전 상태:** 개수 변화는 `if (flag) useState(0)`으로, 종류 변화는 첫 render의 `useState`를 다음 render에서 `useMemo`로 바꾸는 fixture로 준비한다. `mount`에서는 정상 통과해야 한다.
- **입력·행동:** `flag`를 `false`로 바꾸는 setter를 실행한다. 종류 변화는 다음 render를 유발한다.
- **검증 시점:** 갱신 시도가 끝난 뒤.
- **기대 결과:** 두 경우 모두 DOM은 마지막 정상 화면을 유지한다. 오류 전파 위치는 보장하지 않는다(ERR-01과 같은 규칙).
- **유지 조건:** 조건문·반복문에 따른 Hook 호출 변화는 오류로 처리한다. 개수 증가·감소와 같은 위치의 종류 변경을 모두 포함한다.

### HOOK-09 — 같은 값을 넣는 setter는 갱신을 예약하지 않는다

- **대상 / 범위:** setter의 `Object.is` 비교.
- **사전 상태:** `count`가 0이고 `App` 호출 횟수를 기록한다. `label` State도 함께 둔다.
- **입력·행동:** `setCount(0)`을 실행한다. 이어서 `setCount(prev => prev)`와 `setCount(NaN)`을 각각 별도 사전 상태에서 실행한다. `NaN` 케이스는 초기값을 `NaN`으로 둔다.
- **검증 시점:** 각 실행 후 갱신이 끝날 때까지 기다린 뒤.
- **기대 결과:** 세 경우 모두 `App` 호출 횟수가 늘지 않고 갱신이 예약되지 않는다. `label`을 바꾸는 setter는 정상적으로 재렌더를 만든다.
- **유지 조건:** 비교는 `===`가 아니라 `Object.is`를 쓴다. `NaN`은 같은 값으로, `+0`과 `-0`은 다른 값으로 판정한다. 새 객체 참조는 다른 값이다.

### HOOK-10 — 자식 실행 중 세 Hook을 모두 거부한다

- **대상 / 범위:** `startApp(App, container)` → `h(Child, {})` → `useState`·`useMemo`·`useEffect`의 소유자 검사.
- **사전 상태:** 세 독립 fixture에서 App은 먼저 `useState("root")`를 호출한 뒤 `h(Child, {})`를 반환한다. Child는 `entered += 1` 후 각각 `useState(0)`, `useMemo(calculate, [])`, `useEffect(effect, [])` 중 하나를 호출하고 그 다음 `after += 1` 뒤 null을 반환한다. `entered`, `after`, `calculate`, `effect` 횟수는 모두 0, container는 비어 있다.
- **입력·행동:** 각 fixture의 `startApp(App, container)`을 호출한다. 종료 뒤 각각 `useState(0)`, `useMemo(calculate, [])`, `useEffect(effect, [])`를 바깥에서 호출한다.
- **검증 시점:** 각 최초 표시 오류 직후와 바깥 Hook 호출 직후.
- **기대 결과:** 세 최초 표시는 Hook 오류로 중단되며 **entered=1, after=0, calculate=0, effect=0**과 빈 DOM을 함께 만족한다. 바깥 세 Hook도 오류이고 계산·효과 횟수는 여전히 0이다.
- **유지 조건:** 단순 `toThrow`만으로 통과시키지 않는다. 기존 함수 태그 거부라면 entered=0으로 실패해야 한다. 부모 슬롯 비오염의 외부 검증은 HOOK-13을 따른다. 자식만을 위한 Hook 슬롯은 만들지 않는다.

### HOOK-11 — 정상 자식 뒤 부모 Hook 문맥을 복원한다

- **대상 / 범위:** `startApp()`과 후속 갱신에서 함수 h 전후의 루트 `useState`.
- **사전 상태:** App은 `useState("A")`, `h(Child, {})`, `useState("B")` 순서로 실행한다. Child는 Hook 없이 `h("em", {}, "child")`를 반환한다. 두 State와 자식 결과를 section에 표시하고 각 setter 참조를 render마다 기록한다. 바깥에서 호출할 부모 setter를 보관한다.
- **입력·행동:** `startApp(App, container)` 후 `setSecond("B2")`를 실행해 예약 갱신을 완료한다. 이어 `setFirst("A2")`로 갱신한다. 최초 표시와 각 갱신 종료 뒤 바깥에서 세 Hook도 각각 호출한다(계산·효과 spy 사용).
- **검증 시점:** 최초 종료와 각 갱신 완료 직후.
- **기대 결과:** 두 State는 순서대로 `A/B → A/B2 → A2/B2`다. setter 각각의 참조는 모든 render에서 같으며 서로 다른 State를 변경한다. 자식은 render마다 다시 실행된다. 바깥 세 Hook은 항상 오류이며 그 계산·효과는 실행되지 않는다.
- **유지 조건:** 자식 실행 때문에 부모 cursor나 phase를 초기화하지 않는다. 화면 모양뿐 아니라 State 값·setter 재사용을 확인하며 비공개 슬롯을 노출하지 않는다.

### HOOK-12 — 중첩 자식은 직전의 빈 소유자로 복원한다

- **대상 / 범위:** `startApp()` → `h(Child, {})` → `h(Grandchild, {})` 중첩 경계와 후속 갱신.
- **사전 상태:** App은 `useState("A")` → Child 호출 → `useState("B")` 순서다. Child는 `log.push("child")`, `h(Grandchild, {})`, `log.push("grandchild-end")` 뒤 세 Hook 중 하나를 호출하고 오류를 잡아 `log.push("caught")`, null 반환한다. Grandchild는 Hook 없이 null 반환한다. 세 Hook별 독립 fixture이며 Hook 다음 문장 횟수와 계산·효과 횟수는 0이다.
- **입력·행동:** 각 App을 시작하고 두 번째 루트 State를 `"B2"`로 갱신한다. 종료 후 바깥의 세 Hook도 호출한다.
- **검증 시점:** 최초 표시와 갱신 완료, 각 바깥 호출 직후.
- **기대 결과:** 매 render의 순서는 `child → grandchild-end → caught`이고 손자 종료 후 Child의 Hook은 계속 거부된다. Hook 다음 문장은 실행되지 않으며 계산·효과는 0회다. 루트 값은 `A/B → A/B2`로 정상 재사용되고 setter 참조는 유지된다. 바깥 세 Hook은 모두 오류다.
- **유지 조건:** 손자 종료 시 루트 소유자를 잘못 복원하지 않는다. 직전 소유자인 null로 돌아온 뒤 Child 종료 시에만 루트를 복원한다. 자식에 beginHooks/endHooks를 적용하지 않는다.

### HOOK-13 — 오류 뒤에도 부모 문맥을 복원하고 슬롯을 오염시키지 않는다

- **대상 / 범위:** 공개 함수 `h`의 실행·반환 정규화 예외 경계, 루트에서 catch 후 Hook 계속 실행 및 갱신.
- **사전 상태:** 독립 fixture별 Child는 진입 횟수를 올린 뒤 (a) 준비한 `Error("child-error")`를 던짐, (b) `"잘못된 반환"` 반환, (c) `useState(99)`, (d) `useMemo(calculate, [])`, (e) `useEffect(effect, [])` 중 하나를 실행한다. (c)–(e)의 Hook 다음 문장·계산·효과 횟수는 0이다. App은 `useState("A")` 후 `try { h(Child, {}) } catch (error) { errors.push(error) }`, 이어 루트 Hook을 호출하고 정상 VNode를 반환한다.
- **입력·행동:** 각 fixture를 시작한 뒤 첫 State를 `"A2"`로 갱신한다. 뒤의 루트 Hook은 (a)–(c)는 `useMemo(() => "M:" + first, [first])`, (d)는 `useState("B")`, (e)는 `useMemo(() => "M:" + first, [first])`로 둔다. (d)는 두 번째 State도 `"B2"`로 갱신한다. 각 최초 표시·갱신 종료 뒤 바깥에서 세 Hook을 호출한다.
- **검증 시점:** App 내부 catch 직후의 오류 기록, 각 성공 commit 직후, 바깥 Hook 호출 직후.
- **기대 결과:** 각 render에서 Child 진입 1회·catch 1회다. (a)는 동일 Error 객체, (b)는 반환 정규화 오류, (c)–(e)는 해당 Hook 오류다. (c)–(e)의 다음 문장·계산·효과는 항상 0회다. 루트의 다른 종류 Hook이 mount와 update에서 정상이고 (a)–(c)/(e)의 메모 값은 `M:A → M:A2`, (d)의 두 State는 `A/B → A2/B → A2/B2`다. 루트 setter 참조는 유지된다. 바깥 세 Hook은 오류이며 계산·효과는 실행되지 않는다.
- **정규화 전체의 차단 증거:** 별도 fixture의 Child는 `a = h("p", {}, "A")`를 준비하고 `[a]` 배열의 인덱스 0 getter에서 진입을 기록한 뒤 세 Hook 중 하나를 시도한다(각 독립 입력). App은 같은 catch·다른 종류 루트 Hook·갱신 절차를 사용한다. getter 진입 1회 후 Hook 오류, 다음 문장·계산·효과 0회, 루트 Hook 정상 재사용을 확인한다. 이는 반환 정규화 전에 소유자를 너무 일찍 복원하는 구현을 검출하기 위한 입력이며 별도 렌더 값 정책을 추가하지 않는다.
- **유지 조건:** 자식 오용이 부모 슬롯을 차지했다면 다음의 다른 종류 Hook 또는 다음 갱신에서 실패하도록 설계한다. 슬롯·cursor를 테스트에 공개하지 않는다. 정상 반환만이 아니라 일반 예외·정규화·Hook 모든 경로에 finally 복원을 요구한다. 직접 Child(props) 자동 감지는 범위 밖이다.

## 5. 갱신 — 자동 재렌더·필요한 Patch·event 갱신

### UPD-01 — State 변경이 자동 재렌더와 필요한 Patch로 이어진다

- **대상 / 범위:** `update()` 전체.
- **사전 상태:** `App`은 `h("section", {}, h("p", {}, count), h("p", {}, "고정"))`을 반환하고 버튼으로 `count`를 1 올린다. 최초 표시 후 section·첫 p·둘째 p·텍스트 참조를 보관한다.
- **입력·행동:** 버튼을 한 번 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 첫 번째 p의 텍스트만 새 값으로 바뀐다. section과 두 p 요소 객체는 보관한 참조와 동일하다. 별도 적용 버튼 없이 자동 반영된다.
- **유지 조건:** 화면 전체를 다시 만들지 않는다. 변경 없는 노드의 실제 DOM 객체를 교체하지 않는다.

### UPD-02 — 화면 데이터가 같으면 applyPatch를 호출하지 않는다

- **대상 / 범위:** `update()`의 Diff·Patch 분기.
- **사전 상태:** 화면에 사용하지 않는 State `tick`이 있다. 화면 DOM 참조를 모두 보관한다.
- **입력·행동:** `setTick(t => t + 1)`을 실행한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 재렌더는 실행되지만 `diff()` 결과에 변경 명령이 없고 `applyPatch()`를 호출하지 않는다. 보관한 DOM 객체는 모두 동일하다. 재렌더 여부는 `App` 호출 횟수가 1 증가한 것으로 확인한다.
- **유지 조건:** effect 실행 조건 판단과 event 갱신은 생략하지 않는다(UPD-03·HOOK-06). 갱신이 성공하면 현재 VDOM은 다음 VDOM으로 교체된다. VDOM 교체 자체는 외부에서 관찰할 수 없으므로 이 케이스는 DOM 객체 동일성만 판정한다.

### UPD-03 — 화면이 같아도 handler가 바뀌면 새 handler가 실행된다

- **대상 / 범위:** `update()`의 `syncEvents()` 경로.
- **사전 상태:** `mode` State가 `A`다. 버튼 텍스트는 `실행`으로 고정하고 `onClick: () => record(mode)`로 연결한다. `record`는 인자를 기록한다. 버튼 요소 참조를 보관한다.
- **입력·행동:** `mode`를 `B`로 바꾼 뒤 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후, 그리고 클릭 처리 후.
- **기대 결과:** `diff()`에 DOM 변경 명령이 없고 버튼 요소 객체는 보관한 참조와 동일하다. 클릭하면 `record("B")`가 실행되고 `record("A")`는 실행되지 않는다.
- **유지 조건:** DOM 변경이 없다는 이유로 `syncEvents()`를 생략하지 않는다. event 갱신은 `applyPatch()` 이후, effect 실행 전에 완료된다.

### UPD-04 — handler가 제거되면 이전 handler가 실행되지 않는다

- **대상 / 범위:** `update()`의 handler 제거 경로.
- **사전 상태:** `enabled` State가 `true`다. `enabled`일 때만 `onClick: handler`를 넣고 `false`면 `onClick` prop을 넣지 않는다. 버튼 요소 참조를 보관한다.
- **입력·행동:** `enabled`를 `false`로 바꾼 뒤 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후, 그리고 클릭 처리 후.
- **기대 결과:** `handler` 호출 횟수가 늘지 않는다. 버튼 요소 객체는 보관한 참조와 동일하다. 클릭 처리에서 예외가 발생하지 않는다.
- **유지 조건:** 이전 listener를 남겨두고 내부에서 무시하는 방식이 아니라 연결을 최신 VNode에 맞춘다. 판정은 호출 횟수와 요소 동일성으로 한다.

### UPD-05 — effect 안 setter가 현재 처리 후 다음 갱신으로 이어진다

- **대상 / 범위:** `update()`의 effect 처리와 후속 갱신 연결.
- **사전 상태:** `App`은 `useEffect(() => { log.push("effect-start"); setCount(c => c + 1); log.push("effect-end") }, [])`를 호출하고 화면은 `count`를 표시한다.
- **입력·행동:** `startApp(App, container)`을 호출한다.
- **검증 시점:** 최초 표시와 후속 갱신이 모두 끝난 뒤.
- **기대 결과:** 최초 commit 후 effect가 실행되고 그 안의 setter로 후속 갱신이 이어진다. 최종 화면은 `1`이다. 기록 순서는 `effect-start → effect-end → 다음 update 시작`이다.
- **유지 조건:** effect 처리 중에 update를 중첩 실행하지 않는다. deps `[]`이므로 effect가 다시 실행되지 않고 무한 갱신이 발생하지 않는다.

### UPD-06 — 연속 setter 호출 후 최종 State와 화면이 일치한다

- **대상 / 범위:** `update()`의 갱신 연결과 최종 반영.
- **사전 상태:** 한 버튼 handler가 `setFirst(v => v + 1)`, `setSecond(v => v + 1)`을 연속 호출한다. 두 값을 화면에 표시한다.
- **입력·행동:** 버튼을 한 번 클릭한다.
- **검증 시점:** 갱신이 모두 끝난 뒤.
- **기대 결과:** 최종 화면이 두 값 모두 증가한 상태와 일치한다. 중간 상태만 반영된 화면이 남지 않는다.
- **유지 조건:** 갱신을 몇 번 수행했는지는 판정 기준이 아니다. 최종 State와 최종 화면이 다르면 실패다.

## 6. 생명주기 — cleanup과 effect 실행 순서

### EFF-01 — 의존성이 바뀌면 이전 cleanup이 새 effect보다 먼저 실행된다

- **대상 / 범위:** `useEffect`의 cleanup·재실행 경로.
- **사전 상태:** `useEffect(() => { log.push("run" + count); return () => log.push("cleanup" + count) }, [count])`. `count`를 올리는 버튼이 있다.
- **입력·행동:** 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 기록 순서는 `run0 → cleanup0 → run1`이다. cleanup이 새 effect보다 먼저 실행된다.
- **유지 조건:** 의존성이 같으면 cleanup도 실행하지 않는다(HOOK-06). cleanup을 반환하지 않은 effect는 실행 단계만 남는다.

## 7. 실패 — DOM 반영 전 중단

### ERR-01 — 갱신 중 render 오류는 DOM 반영 전에 중단되고 이전 화면이 유지된다

- **대상 / 범위:** `update()`의 Component 실행·구조 정규화 단계.
- **사전 상태:** 정상 화면이 이미 표시되어 있고 DOM 참조를 보관했다. `App`은 `bad` State가 `true`일 때 원시 문자열을 반환한다. `App` 호출 횟수를 기록한다.
- **입력·행동:** `bad`를 `true`로 바꾸는 setter를 실행한다. 이어서 `bad`를 `false`로 되돌리는 setter를 실행한다.
- **검증 시점:** 첫 갱신 시도가 끝난 뒤, 그리고 두 번째 갱신 완료 후.
- **기대 결과:** 첫 갱신에서 `App`은 다시 호출되지만 실제 DOM은 보관한 참조와 동일하고 이전 화면을 유지한다. `applyPatch()`를 호출하지 않는다. 두 번째 갱신은 정상 동작한다.
- **유지 조건:** 오류를 잡지 않으므로 예약된 `update` 경로의 도착 위치는 보장하지 않는다. 이 케이스는 “잘못된 결과가 화면에 반영되지 않음”과 “Hook 실행 문맥이 `finally`로 해제되어 다음 갱신이 동작함”을 판정한다. 자동 복구·재시도와 Phase 1의 History 복구는 포함하지 않는다.

### ERR-02 — applyPatch 실패는 마지막 성공 VDOM으로 복구하고 오류를 전파한다

- **대상 / 범위:** `update()`의 `applyPatch()` 실패 경로.
- **사전 상태:** 정상 화면 A가 표시되어 있고, 화면 B로 바꾸는 갱신을 준비한다. 테스트에서 `applyPatch()`가 오류를 던지도록 하고 `syncEvents()`·effect 호출 기록을 준비한다.
- **입력·행동:** 화면 B로 바꾸는 setter를 실행한다. 오류 처리 후 같은 앱에서 화면 B 갱신을 다시 시도한다.
- **검증 시점:** 오류 처리 직후, 그리고 재시도 갱신 완료 후.
- **기대 결과:** 오류가 전파된다. 컨테이너는 화면 A의 데이터로 다시 그려진다. `renderChildren()`이 자식을 새로 만들므로 노드 객체 동일성은 비교하지 않고 구조·텍스트로 확인한다. `syncEvents()`와 effect는 실행되지 않는다. 실패한 갱신의 State와 훅 슬롯은 갱신 전으로 복원되어, 같은 setter를 다시 호출하면 새 변경으로 예약된다. 재시도 갱신은 화면 A를 기준으로 정상 동작한다.
- **유지 조건:** 현재 VDOM은 마지막 성공 VDOM을 유지한다. 복구는 전체 재생성이므로 포커스·스크롤·비제어 입력 상태는 보존하지 않는다. 복구 중 오류가 나면 원래 오류를 전파하고 이후 동작을 보장하지 않는다. 복원은 얕은 복사이며 State 값을 제자리에서 변경하는 사용은 지원하지 않는다. 이 복원은 `applyPatch` 실패에만 적용하며, 렌더 오류는 State를 되돌리지 않는다(ERR-01).

### ERR-03 — 갱신 중 자식 Hook 오류는 이전 DOM과 증가한 State를 유지한다

- **대상 / 범위:** `startApp()` 이후 예약된 `update()` → `h(Child, { count })`의 자식 Hook 오류.
- **사전 상태:** App은 `useState(0)`와 `useEffect(effect, [count])` 후 `h("section", {}, h(Child, { count }), h("button", { onClick: () => setCount(c => c + 1) }, "tick"))`를 반환한다. Child는 `entered.push(count)` 후 count가 1일 때만 `useState(99)`를 호출하고, 그 다음 문장 횟수를 기록한다. 정상 반환은 `h("span", {}, count)`다. 최초 표시의 span 텍스트는 `0`, effect 1회이며 section·span·텍스트·버튼 참조를 보관한다. 실제 applyPatch·syncEvents 호출 기록을 관찰하고 최초 표시 이후 기준으로 초기화한다.
- **입력·행동:** 기존 오류 테스트의 `captureScheduledUpdates()`로 queueMicrotask 콜백을 모은다. 버튼을 한 번 클릭하고 수집된 첫 콜백을 오류 assertion으로 직접 실행한다. 같은 버튼을 다시 클릭하고 두 번째 콜백을 실행한다. 각 콜백 종료 후 바깥의 세 Hook도 호출한다.
- **검증 시점:** 첫 예약 콜백 오류 직후, 두 번째 정상 갱신 완료 직후.
- **기대 결과:** 첫 갱신에서 Child는 count=1로 실제 진입하고 Hook 다음 문장은 실행되지 않는다. 오류는 예약 콜백 assertion으로 포착된다. span은 `0`이고 보관한 모든 DOM 참조는 동일하다. applyPatch·syncEvents 호출 0회, effect는 mount의 1회에서 늘지 않는다. 두 번째 갱신은 count=2로 Child에 진입하고 span은 `2`가 되며 DOM 참조는 유지된다. effect는 총 2회(0·2)다. 진입 기록은 `[0, 1, 2]`; 바깥 세 Hook은 항상 오류다.
- **유지 조건:** 실패한 render의 State 1을 0으로 복원하지 않는다. 마지막 성공 VDOM 기준으로 다음 정상 갱신이 이어진다. 클릭 자체의 toThrow나 단순 flush로 비동기 오류를 놓치지 않는다. 함수 태그 오류가 아니라 Child 진입 후 Hook 오류인지 함께 확인한다. 자동 복구·재시도·렌더 도중 setter 정책 변경은 포함하지 않는다.

## 8. 통합 — 사용자 흐름

### FLOW-01 — 카운터에서 클릭·State·화면 반영이 자동으로 이어진다

- **대상 / 범위:** `startApp()`부터 event·`update()`까지 전체.
- **사전 상태:** `App`은 `useState(0)`과 증가·감소 버튼을 가진다.
- **입력·행동:** 증가 3회, 감소 1회 클릭한다.
- **검증 시점:** 모든 클릭의 갱신이 끝난 뒤.
- **기대 결과:** 화면은 `2`다. 매 클릭마다 자동 반영되고 적용 버튼이 필요 없다. 루트 요소 객체는 유지된다.
- **유지 조건:** 각 클릭의 갱신이 이전 갱신과 겹쳐 순서가 뒤집히지 않는다.

### FLOW-02 — 자식 컴포넌트가 props만 사용하고 부모 State 변경이 자식 화면에 반영된다

- **대상 / 범위:** `startApp()` → 부모 Component → `h(Child, props)` → `update()`.
- **사전 상태:** 부모 `App`이 `useState(0)`와 `onIncrease = () => setCount(c => c + 1)`를 갖고 `h("div", {}, h(Child, { count, onIncrease }))`를 반환한다. 기존 fixture의 div는 유지하고 자식 호출 방식만 변경한다. `Child`는 받은 count·callback 참조를 기록하고 `h("button", { onClick: onIncrease }, count)`를 반환하며 Hook을 호출하지 않는다. 최초 표시 후 버튼·텍스트 참조를 보관한다.
- **입력·행동:** 자식 버튼을 클릭한다.
- **검증 시점:** 최초 표시 직후와 한 번 클릭의 갱신 완료 후.
- **기대 결과:** 최초 텍스트 `0`에서 `1`로 갱신되며 버튼·텍스트 DOM 참조는 동일하다. Child 진입은 count 0·1 각각 1회이며 전달받은 콜백은 해당 render에서 부모가 넘긴 함수와 동일 참조다. 자식은 State를 저장하지 않는다.
- **유지 조건:** 자식 함수는 함수 h 경계에서 render마다 즉시 다시 실행되지만 State는 부모에만 있다. 자식 event가 부모 setter까지 연결된다. 함수 props의 콜백 실행 금지가 아니며, 별도 자식 인스턴스·resolve를 만들지 않는다.

### FLOW-03 — 입력 요소의 value·checked가 properties를 거쳐 화면에 반영된다

- **대상 / 범위:** `h()`의 properties 분류부터 `mount()`·`update()`의 실제 DOM 반영까지.
- **사전 상태:** `App`이 `value`와 `checked` State를 갖고 `h("input", { value, checked })`를 반환한다. 값을 `A`/`false`에서 `B`/`true`로 바꾸는 버튼이 있다.
- **입력·행동:** `startApp()` 후 버튼을 클릭한다.
- **검증 시점:** 최초 표시 직후, 그리고 갱신 완료 후.
- **기대 결과:** 최초 `input.value`는 `A`, `input.checked`는 `false`다. 갱신 후 `input.value`는 `B`, `input.checked`는 `true`이고 요소 객체는 유지된다.
- **유지 조건:** `value`·`checked`는 attributes가 아니라 properties로 전달된다(H-06). 세부 Patch 규칙은 Phase 1 `PATCH-06`을 그대로 따른다.

## 9. ID 요약

| 그룹 | ID | 대상 함수 |
|---|---|---|
| 시작·최초 표시 | INIT-01 ~ INIT-04 | `startApp`, `mount`, `renderChildren`, `renderNode` |
| h()·정규화 | H-01 ~ H-11 | `h` |
| Hook | HOOK-01 ~ HOOK-13 | `useState`, `useMemo`, `useEffect`, `h` |
| 갱신 | UPD-01 ~ UPD-06 | `update`, `diff`, `applyPatch`, `syncEvents` |
| 생명주기 | EFF-01 | `useEffect` |
| 실패 | ERR-01 ~ ERR-03 | `update`, `applyPatch`, `renderChildren`, `h` |
| 통합 | FLOW-01 ~ FLOW-03 | `startApp` 전체 흐름 |

이 문서 본문의 기존 케이스는 **41개**다(INIT 4, H 11, HOOK 13, UPD 6, EFF 1, ERR 3, FLOW 3).
후속 입력 동기화 계약은 [별도 명세](p2_input_sync_test_cases.md)에 있으며 41개 완료 표시에
포함하지 않는다. 자식 경계 변경 구현·검증은 완료됐다. 명세 ID 수와 실제 실행 단위 수는
구분하며 현재 결과·검증 한계는 [진행표](p2_test_boards.md)를 따른다. 이전 Phase 2 77개는
변경 전 기준선이다. 이 문서의 검증 정책은 그대로 유지한다.
