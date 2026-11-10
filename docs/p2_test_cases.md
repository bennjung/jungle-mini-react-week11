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
- Hook을 호출하지 않는 자식 컴포넌트는 `Child(props)`로 직접 호출한다. 테스트 fixture도 이 방식으로 작성한다.
- 오류는 프레임워크가 잡지 않는다. `mount` 경로는 `startApp()` 호출자에게 전파되고, 예약된 `update` 경로는 도착 위치를 보장하지 않는다. 테스트는 두 경로를 구분한다.
- 갱신이 성공하면 현재 VDOM은 항상 다음 VDOM으로 교체된다. DOM 객체는 유지된다.

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

### H-08 — tagName이 문자열이 아니면 오류다

- **대상 / 범위:** `h()`의 tagName 검증.
- **사전 상태:** `Child`는 VNode를 반환하는 자식 컴포넌트다.
- **입력·행동:** `h(Child, {}, "A")`, `h("", {}, "A")`, `h("   ", {}, "A")`, `h(null, {}, "A")`를 각각 호출한다.
- **검증 시점:** 각 호출 직후.
- **기대 결과:** 네 호출 모두 오류가 전달되고 VNode를 만들지 않는다.
- **유지 조건:** 함수 tag를 Component로 해석하지 않는다. 자식 컴포넌트는 `Child(props)`로 직접 호출한다(FLOW-02).

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
- **유지 조건:** Hook은 Component 실행 중에만 호출할 수 있다. 전역 상태로 마지막 인스턴스를 재사용하지 않는다.

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
- **기대 결과:** 오류가 전파된다. 컨테이너는 화면 A의 데이터로 다시 그려진다. `renderChildren()`이 자식을 새로 만들므로 노드 객체 동일성은 비교하지 않고 구조·텍스트로 확인한다. `syncEvents()`와 effect는 실행되지 않는다. 재시도 갱신은 화면 A를 기준으로 정상 동작한다.
- **유지 조건:** 현재 VDOM은 마지막 성공 VDOM을 유지한다. 복구는 전체 재생성이므로 포커스·스크롤·비제어 입력 상태는 보존하지 않는다. 복구 중 오류가 나면 원래 오류를 전파하고 이후 동작을 보장하지 않는다.

## 8. 통합 — 사용자 흐름

### FLOW-01 — 카운터에서 클릭·State·화면 반영이 자동으로 이어진다

- **대상 / 범위:** `startApp()`부터 event·`update()`까지 전체.
- **사전 상태:** `App`은 `useState(0)`과 증가·감소 버튼을 가진다.
- **입력·행동:** 증가 3회, 감소 1회 클릭한다.
- **검증 시점:** 모든 클릭의 갱신이 끝난 뒤.
- **기대 결과:** 화면은 `2`다. 매 클릭마다 자동 반영되고 적용 버튼이 필요 없다. 루트 요소 객체는 유지된다.
- **유지 조건:** 각 클릭의 갱신이 이전 갱신과 겹쳐 순서가 뒤집히지 않는다.

### FLOW-02 — 자식 컴포넌트가 props만 사용하고 부모 State 변경이 자식 화면에 반영된다

- **대상 / 범위:** `startApp()` → 부모 Component → 직접 호출한 자식 → `update()`.
- **사전 상태:** 부모 `App`이 `count` State를 갖고 `Child({ count, onIncrease })`를 직접 호출한다. `Child`는 `h("button", { onClick: onIncrease }, count)`를 반환하며 Hook을 호출하지 않는다.
- **입력·행동:** 자식 버튼을 클릭한다.
- **검증 시점:** 갱신 완료 후.
- **기대 결과:** 부모 State가 바뀌고 자식에 새 props가 전달되어 텍스트가 갱신된다. 자식은 State를 저장하지 않는다.
- **유지 조건:** 자식 함수는 render마다 다시 호출되지만 State는 부모에만 있다. 자식 event가 부모 setter까지 연결된다.

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
| h()·정규화 | H-01 ~ H-08 | `h` |
| Hook | HOOK-01 ~ HOOK-09 | `useState`, `useMemo`, `useEffect` |
| 갱신 | UPD-01 ~ UPD-06 | `update`, `diff`, `applyPatch`, `syncEvents` |
| 생명주기 | EFF-01 | `useEffect` |
| 실패 | ERR-01, ERR-02 | `update`, `applyPatch`, `renderChildren` |
| 통합 | FLOW-01 ~ FLOW-03 | `startApp` 전체 흐름 |

작성된 케이스는 **33개**다. 정책이 미정인 자리는 남아 있지 않다. 이 문서는 테스트 코드 작성·실행 결과를 포함하지 않는다.
