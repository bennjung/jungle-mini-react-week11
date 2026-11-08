# Phase 1 테스트 케이스

## 1. 요구사항·함수 흐름 기준과 함수 종료 시점별 검증 방법

- 요구사항 원문: [resc/phase1.md](../resc/phase1.md).
- 이번 재작성 기준: [p1_function_flow.md](p1_function_flow.md)의 HTML 코드 편집기 → 임시 DOM → VDOM → Diff → 실제 화면 Patch 흐름.
- 함수·타입 인터페이스는 [p1_interfaces.md](p1_interfaces.md)를 따른다.
- 참조 연결은 이후 합의한 흐름을 따른다. 이전 VDOM만 현재 실제 DOM 참조를 가진다. 다음 VDOM은 Snapshot 종료 시 `VRoot`와 모든 `VNode`의 `dom`이 null이다. Diff가 `VRoot`와 유지·이동·수정 노드를 연결하고, Patch가 insert/replace 노드를 연결해 다음 VDOM을 완성한다. 함수 흐름 문서에 남은 Snapshot 단계의 참조 연결 설명보다 이 합의를 우선한다.
- 테스트 영역은 HTML 문자열을 편집하는 공간이다. 요구사항 원문의 “테스트 영역 렌더링”은 이 HTML 문자열 편집기로 해석한다. 렌더링된 테스트 DOM을 직접 수정하는 방식이나 `testDom`·WeakMap 기반 매핑은 검증 기준에서 제외한다.
- 이 문서는 테스트 명세다. 테스트 코드 작성·실행 결과를 의미하지 않는다. Phase 2는 포함하지 않는다.
- 요소의 `attributes`에 이름이 `key`인 속성이 있으면 그 값을 식별자로 사용한다. key가 없는 요소와 텍스트 노드는 같은 부모 안의 자식 순서로 대응한다. 중복 key 오류, key 변경, 같은 key의 태그 변경 정책은 아직 미확정이며 마지막의 확인 필요 케이스에 둔다.
- `key`는 `attributes`에서 제거하지 않고 실제 DOM에도 렌더링한다. 테스트는 VDOM의 `attributes`와 실제 DOM 양쪽에서 `key`를 확인할 수 있다.
- 논리적 루트는 `childNodes`와 `dom`만 가진 `VRoot`로 표현한다. `VRoot`는 컨테이너 태그·속성을 Diff하지 않는다. 삽입·이동 명령의 `parent`는 다음 `VNode | VRoot`이며, 최상위 자식은 다음 `VRoot`를 부모로 지정한다. 기존 테스트 기대 결과는 변경하지 않는다.
- 함수명은 함수 흐름 문서의 표기를 사용한다. 각 케이스의 실행 범위에서 지정한 함수까지만 호출해 검증한다. 뒤 단계가 실행되기 전의 결과를 전체 Patch 종료 결과와 혼동하지 않는다.

각 케이스는 사전 상태, 입력·행동, 실행 범위, 검증 시점, 기대 결과, 유지 조건을 명시한다.
DOM 객체 동일성은 테스트 시작 전에 보관한 참조와 `===`로 비교한다. 화면이 같아 보이거나 HTML 문자열이 같다는 이유만으로 동일 객체라고 판단하지 않는다.
VDOM 비교는 구조·텍스트·속성·properties를 비교하며, 현재 실제 DOM 연결은 별도로 검증한다. 속성 나열 순서는 HTML 의미의 차이로 취급하지 않는다.
노드 대응이 필요한 fixture에서 key가 있는 요소는 같은 key끼리, key가 없는 요소와 텍스트 노드는 같은 부모 안의 자식 순서로 대응한다.

## 2. 초기화 — 샘플 화면·편집기·첫 이력 준비와 이벤트 연결 검증

### INIT-01 — 빈 실제 영역에 샘플을 렌더링하고 편집기·첫 이력·DOM 참조를 준비한다

- **대상 / 범위:** `initializeDOM(sampleHTML)` 전체.
- **사전 상태:** 실제 영역은 비어 있고 History에 저장된 항목이 없다. 실제 영역 컨테이너 참조를 보관한다.
- **입력·행동:** 샘플 `<section><p>A</p></section>`으로 초기화한다.
- **검증 시점:** `initializeDOM()` 종료 직후.
- **기대 결과:** 실제 화면에 section과 p가 생성된다. 편집기는 샘플 HTML 문자열을 표시한다. 샘플 상태가 첫 이력이며 현재 VDOM의 각 `dom`은 실제 영역의 대응 노드를 가리킨다.
- **유지 조건:** 컨테이너 객체는 유지한다. 빈 비교용 VDOM을 별도 이력으로 저장하거나 샘플을 중복 삽입하지 않는다.

### INIT-02 — 초기 이력 준비 후 각 버튼이 Patch·이력 이동 경로를 한 번씩 실행한다

- **대상 / 범위:** `init()`, `bindEvents()` 및 버튼별 핸들러 연결.
- **사전 상태:** 편집기·실제 영역·Patch·뒤로·앞으로 버튼이 준비된 새 페이지.
- **입력·행동:** `init()` 종료 후 편집기 코드를 변경하고 Patch를 한 번 클릭한다. 이후 뒤로·앞으로를 각각 클릭한다.
- **검증 시점:** `init()` 종료 후, 각 클릭 핸들러 종료 후.
- **기대 결과:** 첫 클릭 전에 초기 이력이 준비된다. Patch는 `handlePatch()` 경로로, 이력 이동은 `handleHistoryMove()` 경로로 처리된다. 한 번의 변경 Patch는 새 이력 한 개만 추가한다.
- **유지 조건:** 초기 페이지 로드를 Patch 클릭 이벤트로 대신 처리하지 않는다. 이력 이동은 새 변경 이력을 추가하지 않는다.

## 3. 코드 읽기·파싱 — HTML을 읽고 실제 화면 변경 없이 임시 DOM 생성

### HTML-01 — 편집기 UI 대신 입력한 HTML 원문을 변경 없이 읽는다

- **대상 / 범위:** `readEditorHTML()` 단독.
- **사전 상태:** 편집기에 줄바꿈과 들여쓰기를 포함한 `<div>\n  <p>A</p>\n</div>`가 입력되어 있다. 여기서 `\n`은 실제 줄바꿈을 뜻한다.
- **입력·행동:** HTML 문자열을 읽는다.
- **검증 시점:** `readEditorHTML()` 반환 직후.
- **기대 결과:** 편집기의 현재 HTML 원문을 반환한다. 편집기 UI 자체의 태그나 textarea 요소를 샘플로 읽지 않는다.
- **유지 조건:** 실제 영역·편집기 내용·현재 VDOM·History는 변경되지 않는다.

### HTML-02 — 중첩 HTML을 임시 DOM으로 파싱하고 실제 화면은 유지한다

- **대상 / 범위:** `parseHTML(html)` 단독.
- **사전 상태:** 실제 영역에는 `<p>기존</p>`가 표시되어 있다.
- **입력·행동:** `<section class="box"><p>A</p></section><span>B</span>`를 파싱한다.
- **검증 시점:** `parseHTML()` 반환 직후.
- **기대 결과:** 반환된 임시 루트에서 section과 span을 순서대로 조회할 수 있다. 중첩 구조·속성·텍스트가 읽힌다. 파싱한 노드는 실제 영역의 노드가 아니다.
- **유지 조건:** 실제 화면은 여전히 `기존`이며 파싱만으로 노드를 삽입하거나 이력을 저장하지 않는다.

### HTML-03 — 빈 HTML을 자식 없는 VDOM으로 변환하고 실제 화면은 아직 유지한다

- **대상 / 범위:** `parseHTML("")` → `createSnapshot()`.
- **사전 상태:** 기존 실제 영역과 현재 VDOM에 자식 노드가 있다.
- **입력·행동:** 편집기 내용을 전부 지운 문자열을 파싱하고 스냅샷으로 만든다.
- **검증 시점:** `createSnapshot()` 종료 직후.
- **기대 결과:** 다음 VDOM은 자식 없는 `VRoot`를 나타낸다. 이후 Diff에서 기존 자식 제거를 계산할 수 있다.
- **유지 조건:** 아직 Patch하지 않았으므로 실제 영역의 자식과 History는 유지된다.

## 4. 스냅샷 — DOM 데이터·입력 상태를 복사하고 실제 DOM 참조는 연결하지 않음

### SNAP-01 — 요소·텍스트의 종류·태그·속성과 중첩된 자식 순서를 보존한다

- **대상 / 범위:** `parseHTML()` → `createSnapshot()`의 데이터 추출.
- **사전 상태:** 입력은 `<div class="box">A<span>B</span>C</div>`.
- **입력·행동:** 파싱한 트리의 스냅샷을 생성한다.
- **검증 시점:** `createSnapshot()` 종료 직후.
- **기대 결과:** 요소 nodeType은 1, 텍스트 nodeType은 3이다. div·span의 tagName과 class 속성이 저장된다. div의 자식은 텍스트 A → span → 텍스트 C 순서이고 span의 자식은 텍스트 B다.
- **유지 조건:** 임시 루트를 화면 요소로 추가하지 않는다. 실제 DOM과 History는 변경하지 않는다. tagName의 대소문자는 구현에서 정한 정규화 기준에 맞춰 검증한다.

### SNAP-02 — 주석 노드만 제외하고 이웃 텍스트·요소의 순서를 유지한다

- **대상 / 범위:** `createSnapshot()`의 자식 순회.
- **사전 상태:** `<div>A<!-- 메모 --><span>B</span></div>`를 파싱해 두었다.
- **입력·행동:** 스냅샷을 생성한다.
- **검증 시점:** `createSnapshot()` 종료 직후.
- **기대 결과:** VDOM에 주석 노드는 없고 텍스트 A와 span은 순서를 유지한다.
- **유지 조건:** 주석을 제거하면서 이웃 텍스트나 요소를 누락하지 않는다.

### SNAP-03 — 원본 임시 DOM·편집기 수정이 이미 만든 VDOM 데이터를 바꾸지 않는다

- **대상 / 범위:** `createSnapshot()` 반환값의 데이터 복사.
- **사전 상태:** `<p class="a">A</p>`의 스냅샷을 생성했다.
- **입력·행동:** 생성 후 임시 DOM의 class·텍스트·자식 구조를 변경한다. 편집기 원문도 별도로 수정한다.
- **검증 시점:** 임시 DOM·편집기 수정 후, 다음 스냅샷 생성 전.
- **기대 결과:** 먼저 만든 VDOM의 class는 a, 텍스트는 A이며 기존 자식 구조를 유지한다.
- **유지 조건:** 스냅샷의 실제 DOM 참조는 null로 유지한다. 임시 DOM을 참조로 저장하거나 그 변경이 스냅샷 데이터에 반영되면 실패다.

### SNAP-04 — 새로운 data 속성을 포함한 일반 속성의 이름·값을 수집한다

- **대상 / 범위:** `readAttributes()`를 포함한 `createSnapshot()`.
- **사전 상태:** `<p id="title" class="a" data-extra="x" title="설명">A</p>`.
- **입력·행동:** 스냅샷을 만든다.
- **검증 시점:** `createSnapshot()` 종료 직후.
- **기대 결과:** 각 속성의 이름·값이 attributes에 저장된다. 새로운 `data-extra`를 수집하기 위한 속성별 전용 분기가 필요하지 않다.
- **유지 조건:** class·title 같은 기존 속성도 함께 유지하며, 수집 과정은 실제 DOM을 수정하지 않는다.

### SNAP-05 — 다음 VDOM은 기존·새 노드 구분 없이 Diff 전까지 실제 DOM 참조가 없다

- **대상 / 범위:** `createSnapshot()`의 참조 미연결 상태.
- **사전 상태:** 기존 `<p>A</p>`의 VDOM과 실제 p·텍스트 참조가 연결되어 있다. 이번 입력에서도 대응하는 p와 텍스트가 유지되는 상황이다.
- **입력·행동:** 별도로 파싱한 `<p>B</p><span>C</span>`에서 다음 VDOM을 만든다.
- **검증 시점:** `createSnapshot()` 종료 직후, Diff·Patch 전.
- **기대 결과:** 다음 VDOM의 p·텍스트·새 span·하위 노드와 `VRoot`까지 모든 `dom`이 null이다. 이전 VDOM의 참조를 이어받거나 임시 DOM을 실제 DOM 참조로 저장하지 않는다.
- **유지 조건:** 기존 실제 화면은 A이며 이전 VDOM의 비교용 데이터와 실제 DOM 참조도 유지한다. Snapshot 단계에서는 참조를 연결하지 않으며, 연결은 Diff와 Patch 단계에서 수행한다.

### SNAP-06 — HTML에서 입력값·체크·선택 상태를 properties로 수집한다

- **대상 / 범위:** `readProperties()`를 포함한 `createSnapshot()`.
- **사전 상태:** 아래 입력을 각각 별도 케이스로 파싱한다.
- **입력·행동:** `<input value="A">`, `<input type="checkbox" checked>`, `<textarea>메모</textarea>`, `<select><option>A</option><option selected>B</option></select>`의 스냅샷을 만든다.
- **검증 시점:** `createSnapshot()` 종료 직후.
- **기대 결과:** 각각 value A, checked true, TEXTAREA value 메모, SELECT value B와 OPTION별 selected 상태가 properties에 저장된다. checkbox의 indeterminate 기본값은 false다.
- **유지 조건:** attributes와 properties는 별도 데이터다. 실제 화면에서만 사용자가 입력한 값을 편집기 원문에 있다고 간주하지 않는다.

## 5. Diff — 비교 데이터·실제 DOM 보존, 변경 명령 계산과 다음 DOM 참조 연결

이 절은 `diff()`만 실행한다. 이전 VDOM에는 실제 DOM 참조가 있고 다음 VDOM의 `VRoot`와 모든 `VNode`의 `dom`은 null인 상태로 시작한다. Diff 종료 시 `VRoot`와 유지·이동·수정 노드는 실제 DOM 참조가 연결되고, insert/replace 노드는 null로 남는다. 실제 DOM은 변경하지 않는다. 실제 DOM 반영과 insert/replace의 참조 연결은 7절에서 검증한다. key가 있는 요소는 같은 key로, key가 없는 요소와 텍스트 노드는 같은 부모 안의 자식 순서로 대응한다.

### DIFF-01 — 같은 HTML을 다시 파싱해도 변경 명령은 없고 prev VDOM·실제 DOM은 유지된다

- **대상 / 범위:** `diff(prev, next)` 단독.
- **사전 상태:** 서로 다른 파싱 결과지만 데이터가 같은 `<p key="p1">A</p>`의 VDOM 두 개를 준비한다. prev는 현재 실제 DOM에 연결되어 있다.
- **입력·행동:** 두 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** 빈 배열을 반환한다. 파싱 때 새 DOM 객체가 만들어졌다는 이유로 replace·insert 명령을 만들지 않는다.
- **유지 조건:** prev 데이터·실제 DOM·History는 비교 전과 같다. next는 데이터가 유지되고, Diff 종료 시 유지 노드의 `dom`이 실제 DOM 참조로 연결된다.

### DIFF-02 — 텍스트만 바뀌면 요소 교체 없이 텍스트 update 명령을 반환한다

- **대상 / 범위:** `diff()` 및 텍스트 비교.
- **사전 상태:** 이전 `<p key="p1">A</p>`, 다음 `<p key="p1">B</p>`. 같은 key의 p와 텍스트가 대응한다.
- **입력·행동:** 두 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** 기존 텍스트를 대상으로 새 값 B를 전달하는 update 명령이 나온다. p 전체를 replace하지 않는다.
- **유지 조건:** 실제 화면은 여전히 A이며 기존 p·텍스트 객체도 유지된다.

### DIFF-03 — 속성 추가·변경·삭제를 update로 계산하고 속성 나열 순서는 무시한다

- **대상 / 범위:** `findAttributeUpdates()`를 포함한 `diff()`.
- **사전 상태:** 이전 `<p key="p1" class="a" title="설명">A</p>`, 다음 `<p key="p1" class="b" data-extra="x">A</p>`.
- **입력·행동:** 대응하는 p의 속성을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** class 변경·data-extra 추가·title 삭제가 update 데이터에 포함된다. 텍스트 변경이나 p 교체는 요구하지 않는다.
- **유지 조건:** 아직 실제 속성은 바뀌지 않는다. 속성 순서만 다른 입력에서는 변경을 만들지 않는다.

### DIFF-04 — 태그·노드 종류 변경은 하위 중복 명령 없이 replace로 계산한다

- **대상 / 범위:** `collectNodeChanges()`를 포함한 `diff()`.
- **사전 상태:** 같은 key를 가진 `<div key="n1">A</div>` → `<p key="n1">A</p>`를 준비한다. P1-CONF-03에 따라 같은 key의 태그 변경은 replace로 검증한다.
- **입력·행동:** 두 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** 기존 대상과 새 VDOM을 담은 replace가 나온다. 교체로 대체되는 하위 트리에 불필요한 별도 변경 명령을 만들지 않는다.
- **유지 조건:** 실제 DOM과 이전 VDOM은 수정되지 않는다. 교체 대상 next 노드의 `dom`은 null로 남는다.

### DIFF-05 — 입력·선택 프로퍼티의 변경을 false·빈 문자열까지 update에 담는다

- **대상 / 범위:** `findPropertyUpdates()`를 포함한 `diff()`.
- **사전 상태:** key가 같은 입력 요소의 이전·다음 properties를 준비한다. value A → B, checked true → false, OPTION selected false → true를 각각 검증한다.
- **입력·행동:** 두 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** 변경값이 `update`의 `data.setProperties`에 포함된다. false와 빈 문자열로의 변경도 누락하지 않는다.
- **유지 조건:** 실제 입력 요소의 프로퍼티는 아직 변경하지 않는다.

#### DIFF-05 보완 — 프로퍼티의 추가·제거와 변경 없음

이 보완의 누락 입력은 함수 단위 데이터 계약 검증이다. P1-PROPERTY-SNAPSHOT-01에 따라 생성기가 스키마 전체 항목을 읽는 같은 태그의 정상 경로에서 HTML 속성 제거는 프로퍼티 이름 제거가 아니라 값 변경이다. 기존 테스트 기대 결과는 유지하고, DOM 프로퍼티 제거·기본값 재설정 테스트를 추가하지 않는다.

- **대상 / 범위:** `findPropertyUpdates()` 단독. 생성된 VDOM에서 문자열·불리언 값을 비교한다.
- **입력·행동:** 없는 `selected`의 false 추가, 있는 `checked` 제거, 값 변경과 제거의 혼합, 값이 같고 순서만 다른 객체를 각각 비교한다.
- **기대 결과:** 추가·변경은 `setProperties`, 제거된 이름은 `removeProperties`에 담는다. 변함없으면 `{}`를 반환한다. 실제 DOM 제거 동작은 이 시험의 범위가 아니다.
- **유지 조건:** 이전·다음 입력 객체를 수정하지 않는다.

### DIFF-06 — 중첩된 텍스트 하나만 바뀌면 부모·형제 변경 명령을 만들지 않는다

- **대상 / 범위:** `collectChildChanges()` 재귀를 포함한 `diff()`.
- **사전 상태:** 이전 `<div key="d1"><section key="s1"><p key="p1">A</p><span key="sp1">유지</span></section></div>`, 다음은 같은 key를 유지한 채 p의 텍스트만 B다.
- **입력·행동:** 전체 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** p 내부 텍스트의 update를 계산한다. div·section·p·span을 교체하거나 변경 없는 span을 수정하는 명령은 없다.
- **유지 조건:** 비교 과정에서 실제 DOM을 수정하지 않는다.

### DIFF-07 — 같은 key를 가진 형제는 move로 대응하고 새로 만들지 않는다

- **대상 / 범위:** `diff()` 단독.
- **사전 상태:** 이전 `<ul><li key="a">A</li><li key="b">B</li></ul>`, 다음 `<ul><li key="b">B</li><li key="a">A2</li></ul>`. 이전 VDOM은 실제 DOM 참조를 가지고 다음 VDOM은 Diff 시작 시 모든 `dom`이 null이다.
- **입력·행동:** 두 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** key `a`·`b`로 대응한다. `b`가 `a` 앞으로 이동하는 move와 `a`의 텍스트 A→A2 update가 나온다. li를 replace·insert·remove하지 않는다.
- **유지 조건:** 이전 VDOM 데이터·실제 DOM·History는 유지한다. Diff 종료 시 다음 VDOM의 `VRoot`와 유지·이동 노드는 실제 DOM에 연결되고, insert/replace 노드는 null로 남는다.

### DIFF-08 — key 있는 형제는 key로, key 없는 형제는 순서로 대응한다

- **대상 / 범위:** `diff()` 단독.
- **사전 상태:** 이전 `<ul><li key="a">A</li><li>B</li></ul>`, 다음 `<ul><li key="a">A2</li><li>B2</li></ul>`. 이전 VDOM은 실제 DOM 참조를 가지고 다음 VDOM은 Diff 시작 시 모든 `dom`이 null이다.
- **입력·행동:** 두 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** key `a`인 li는 같은 key로 대응해 텍스트 A→A2 update가 나온다. key가 없는 두 번째 li는 같은 부모 안의 순서로 대응해 B→B2 update가 나온다. li를 replace·insert·remove하지 않는다.
- **유지 조건:** 이전 VDOM 데이터·실제 DOM·History는 유지한다. Diff 종료 시 다음 VDOM의 `VRoot`와 유지·이동 노드는 실제 DOM에 연결되고, insert/replace 노드는 null로 남는다.

### DIFF-09 — key 없는 형제의 순서 변경은 move로 보장하지 않는다

- **대상 / 범위:** `diff()` 단독.
- **사전 상태:** 이전 `<ul><li>A</li><li>B</li></ul>`, 다음 `<ul><li>B</li><li>A</li></ul>`. 이전 VDOM은 실제 DOM 참조를 가지고 다음 VDOM은 Diff 시작 시 모든 `dom`이 null이다.
- **입력·행동:** 두 VDOM을 비교한다.
- **검증 시점:** `diff()` 반환 직후.
- **기대 결과:** key가 없으므로 첫 li는 첫 li와, 둘째 li는 둘째 li와 순서로 대응한다. 텍스트는 각각 A→B, B→A update가 되며 move 명령은 요구하지 않는다. li 객체는 유지될 수 있으나 순서 변경을 move로 식별하지 않는다.
- **유지 조건:** 이전 VDOM 데이터·실제 DOM·History는 유지한다. Diff 종료 시 다음 VDOM의 `VRoot`와 유지·이동 노드는 실제 DOM에 연결되고, insert/replace 노드는 null로 남는다.

### NODE-COMMAND-01 — 현재 노드의 직접 명령과 자식에게서 받은 명령을 구분한다

- **대상 / 범위:** 이미 대응된 노드 한 쌍에 대한 `collectNodeChanges()` 단독. 미구현 속성·프로퍼티 계산과 자식 비교는 반환값을 대체해 격리한다.
- **사전 상태:** 실제 DOM에 연결된 이전 VNode와 연결되지 않은 다음 VNode를 준비한다. 대응 결정 자체는 이 검증 범위가 아니다.
- **입력·행동:** 서로 다른 노드 종류, 텍스트 변경, 요소의 속성 변경과 자식 명령, 요소 자체의 변경 없이 자식 명령만 있는 경우를 각각 검증한다.
- **검증 시점:** `collectNodeChanges()` 반환 직후.
- **기대 결과:** 현재 노드의 직접 명령은 교체 시 `replace`, 텍스트·속성 변경 시 `update`다. 요소에서는 자식이 반환한 명령을 현재 노드의 update 뒤에 그대로 합친다. 현재 노드에 변경이 없으면 자식 명령만 반환한다.
- **유지 조건:** 교체 대상 다음 노드는 미연결이며 자식을 비교하지 않는다. 유지되는 다음 노드는 이전 DOM 참조를 연결하지만 실제 DOM은 변경하지 않는다. 이 격리 테스트는 자식의 삽입·제거·이동 판단이나 명령 적용 순서의 정확성을 검증하지 않는다. 같은 key의 태그 변경은 P1-CONF-03에 따라 replace다.

### NODE-COMMAND-02 — 변경 없는 자손은 연결하고 교체 하위 트리는 순회하지 않는다

- **대상 / 범위:** 이미 대응된 노드 쌍의 `collectNodeChanges()`와 실제 자식 대응·재귀·연결. 미구현 속성·프로퍼티·이동 계산은 대체한다.
- **입력·행동:** 변경 없는 `<div><p>A<span>B</span></p></div>`를 비교하고, 별도 사례에서는 이미 대응된 div와 section의 하위 트리를 비교한다.
- **검증 시점:** `collectNodeChanges()` 반환 직후.
- **기대 결과:** 변경 없는 경우 명령은 없으며 다음 노드의 모든 자손은 각각 대응하는 이전 실제 DOM 객체에 연결된다. 교체 경우 해당 노드의 replace만 반환하고 다음 노드와 모든 자손은 연결하지 않는다.
- **유지 조건:** 실제 DOM은 변경하지 않는다. 교체 시 속성·프로퍼티·이동 계산을 실행하지 않는다. 대응 자체의 정책과 전체 Diff·Patch 완료 여부는 검증하지 않는다.

## 6. 명령 순서 — 생성·삽입·이동·제거의 참조 의존성과 중복 작업 검증

### 이동 계획 검증 추가 — MOVE-01–MOVE-07

- **승인 범위:** 사용자가 형제 이동 사례와 작은 목록의 전체 순열을 먼저 테스트한 뒤 알고리즘을 고안하도록 요청했다. DIFF-07·DIFF-09는 유지하며, 이후 승인한 upstream 통합에 따라 ORDER-05는 move → replace 순서를 따른다.
- **공통 입력:** 고유 key가 있는 같은 태그의 형제와 `findChildMatches()`의 대응 결과를 준비한다. 이전 DOM 참조와 유지되는 다음 DOM 참조는 입력 준비 단계에서 연결한다. 교체 대응 정책은 새로 정하지 않는다.
- **검증 위치:** `tests/unit/diff/vdom.collect-move-changes.test.ts`.

| ID | 입력 / 동작 | 검증 결과와 시점 |
| --- | --- | --- |
| MOVE-01 | A B C → A B C | `collectMoveChanges()`가 빈 배열 반환 |
| MOVE-02 | A B C → C A B / B C A / B A C / C B A, A B C D → C A D B | 이동 계획의 대상·부모·기준 형제 확인. 실제 `orderChanges()`로 정렬 후 각 move를 DOM의 `insertBefore()`로 적용해 목표 순서와 기존 객체 동일성 확인. 최소 이동 횟수는 강제하지 않음 |
| MOVE-03 | A B → X A B, A B C → A C | 삽입·삭제로 위치가 바뀌어도 move는 빈 배열 |
| MOVE-04 | A B C → C X A B, A B C D → D A C | move 대상은 대응된 이전 노드, parent·before는 다음 트리의 유효한 객체 참조. 제거된 노드나 자신을 기준 형제로 사용하지 않음 |
| MOVE-05 | key 없는 A B → B A | 기존 DIFF-09의 순서 대응 결과를 받아 move를 만들지 않음 |
| MOVE-06 | A B C D의 24개 목표 순열 | 실제 정렬 후 move를 표준 DOM 연산으로 적용해 입력한 목표 순서와 모든 기존 DOM 객체가 유지되는지 확인. 테스트에 이동 판단 알고리즘을 복제하지 않음 |
| MOVE-07 | MOVE-04의 이동·삽입 및 이동·삭제 혼합 결과 | 실제 `orderChanges()`·`applyPatch()` 연계 후 목표 순서·기존 객체·삽입 연결·삭제 분리 검증. Patch 미구현이므로 `it.todo`로 보류 |

- 모든 이동 계획 검증은 입력 배열·VNode·대응 결과를 동결하고 실제 DOM의 구조·객체 참조를 보존하는지 확인한다. 명령 대상은 이전 VNode, 부모와 기준 형제는 다음 VDOM 객체여야 한다.
- DIFF-07의 A B → B A는 B를 다음 A 앞으로 옮기는 명령 하나를 정확히 요구한다. 그 외 사례에는 특정한 명령 배열이나 최소 횟수를 추가로 강제하지 않는다.
- MOVE-02·06의 표준 DOM 적용은 이동 명령의 효과를 확인하는 테스트 도구이며 제품 `applyPatch()`를 대신 구현하거나 완료로 간주하지 않는다. 아직 정렬 함수가 미구현이므로 이동 계획만 구현해도 최종 순서 검증은 완료되지 않는다.

기존 실제 DOM을 찾는 데 필요한 참조는 이전 VDOM에 준비한다. 다음 VDOM은 Diff 시작 시 `dom`이 null이며, Diff가 유지·이동·수정 노드를 연결하고 Patch가 insert/replace 노드를 연결한다. ORDER 테스트에서 `applyPatch()`를 직접 호출할 때는 실제 `diff()`로 Diff의 연결 상태를 준비한다. key가 있는 요소는 같은 key로, key가 없는 요소와 텍스트 노드는 같은 부모 안의 자식 순서로 대응한다. 특정한 유일 순서나 최소 명령 개수보다는 참조 유효성과 최종 결과를 확인한다.

### ORDER-01 — 새 기준 형제를 먼저 생성한 뒤 그 앞에 삽입해 목표 순서를 만든다

- **대상 / 범위:** `orderChanges()` → `applyPatch()`.
- **사전 상태:** 부모 안에 기존 C만 있다. 목표 순서는 새 A → 새 B → 기존 C다.
- **입력·행동:** A는 B 앞, B는 C 앞에 삽입하도록 지정된 명령을 A → B 순서로 정렬 함수에 전달한다.
- **검증 시점:** `orderChanges()` 반환 후 의존 순서 확인, `applyPatch()` 종료 후 실제 결과 확인.
- **기대 결과:** B 생성이 B를 기준으로 삼는 A 삽입보다 먼저 실행된다. 최종 자식은 A → B → C이고 모든 새 VDOM에 실제 DOM 참조가 연결된다.
- **유지 조건:** C와 부모 객체는 유지한다. 아직 생성되지 않은 B의 null 참조를 맨 뒤 삽입 의미로 오해하지 않는다.

### ORDER-02 — 부모·자식 생성 의존성을 지키며 새 하위 트리를 한 번만 만든다

- **대상 / 범위:** `diff()`의 명령 계획 → `orderChanges()` → `applyPatch()`.
- **사전 상태:** 실제 루트가 비어 있고 목표는 `<section><p>A</p></section>`이다.
- **입력·행동:** 새 부모와 자식을 포함하는 다음 VDOM의 변경 명령을 계산·적용한다.
- **검증 시점:** `diff()` 반환 후 중복 명령 확인, `applyPatch()` 종료 후 결과 확인.
- **기대 결과:** 새 하위 트리를 한 번만 생성한다. 부모 삽입이 자식 전체 렌더링을 포함하면 자식을 또 삽입하는 중복 명령은 없다. 별도 자식 명령을 쓰는 경우에는 부모가 먼저 존재해야 한다.
- **유지 조건:** 부모 없는 삽입이나 중복 p가 발생하지 않고 루트 컨테이너는 유지한다.

### ORDER-03 — 형제 삭제와 삽입이 겹쳐도 제거된 노드를 삽입 기준으로 쓰지 않는다

- **대상 / 범위:** `diff()` → `orderChanges()` → `applyPatch()`.
- **사전 상태:** 기존 A(key="a") → B(key="b") → C(key="c")가 있고 B는 제거 대상이다. 목표는 A(key="a") → 새 X(key="x") → C(key="c")다.
- **입력·행동:** B 제거와 X 삽입이 함께 있는 변경을 계획·적용한다.
- **검증 시점:** 계획된 명령을 확인하고, `applyPatch()` 종료 후 자식 순서를 확인한다.
- **기대 결과:** X 삽입 시 기준 형제가 해당 부모 아래에 존재한다. 제거된 B를 이후 삽입 기준으로 사용하지 않는다. 최종 순서는 A → X → C다.
- **유지 조건:** A·C 객체는 유지하고 다른 형제를 잘못 제거하지 않는다.

### ORDER-04 — 부모 제거·key 변경에 포함된 하위 트리에 중복 명령을 적용하지 않는다

- **대상 / 범위:** `diff()` → `orderChanges()` → `applyPatch()`.
- **사전 상태:** 이전 `<div key="d1"><p key="p1">A</p></div>`. 전체 div를 제거하는 경우와 key가 다른 `<section key="d2"><span key="sp1">B</span></section>`으로 바꾸는 경우를 각각 준비한다.
- **입력·행동:** 각 변경을 계산·적용한다.
- **검증 시점:** `diff()` 반환 후와 `applyPatch()` 종료 후.
- **기대 결과:** 부모 제거는 remove 하나로 처리한다. key가 다른 부모 변경은 P1-CONF-03에 따라 기존 div 제거와 새 section 삽입으로 처리하며, 상위 변경에 포함된 이전 p에 별도 remove·update를 중복 적용하지 않는다. 새 span도 중복 생성하지 않는다. 최종 트리는 목표 DOM과 일치한다.
- **유지 조건:** 분리된 노드에 다시 명령을 적용하는 오류가 없고, 명령 순서는 고정하지 않지만 최종 결과는 유지한다. 부모 replace 자체는 DIFF-04와 PATCH-04가 담당한다.

### ORDER-05 — replace는 제자리 교체만 담당하고 위치 변경은 move로 처리한다

- **대상 / 범위:** `orderChanges()` → `applyPatch()`.
- **사전 상태:** 실제 A(key="a") → B(key="b") → C(key="c"). 목표는 B(key="b") → A'(key="a", div→p) → C(key="c")다. replace·move 명령을 직접 준비한다.
- **입력·행동:** 이전 A를 C 앞으로 이동한 뒤, 이동한 위치에서 A'로 교체하는 명령을 정렬·적용한다.
- **검증 시점:** `orderChanges()` 반환 후 move가 replace보다 먼저 오는지 확인, `applyPatch()` 종료 후 자식 순서 확인.
- **기대 결과:** move는 이전 A를 C 앞으로 이동한다. replace는 이동한 위치의 A를 A'로 교체한다. 최종 순서는 B → A' → C이고 B·C 실제 객체는 유지된다.
- **유지 조건:** move.target은 이전 VNode이므로 이동 후 replace가 같은 위치에서 일어나야 한다. replace만으로 최종 위치를 맞추지 않으며, 위치 변경은 move가 담당한다.

## 7. Patch — 이전 VDOM 참조로 DOM을 변경하고 새 노드 참조 연결 완성

이 절의 PATCH-01–PATCH-05는 실제 `diff()`로 Diff의 유지 노드 연결 상태를 준비한 뒤 `applyPatch()`에 명령을 직접 전달한다. Diff의 식별 규칙과 실제 DOM 연산의 정확성을 분리해 검증한다.

### PATCH-01 — 텍스트 update는 기존 요소·텍스트 객체를 유지하며 값만 바꾼다

- **대상 / 범위:** `applyPatch()` → `updateText()`.
- **사전 상태:** 실제 `<p>A</p>`와 그 p·텍스트 노드 참조를 보관한다.
- **입력·행동:** 텍스트 값을 B로 바꾸는 update 명령을 적용한다.
- **검증 시점:** `applyPatch()` 종료 직후.
- **기대 결과:** 텍스트는 B이며 p와 텍스트 노드는 모두 기존 참조와 같다.
- **유지 조건:** 부모·형제·History는 변경하지 않는다.

### PATCH-02 — 속성 추가·변경·삭제와 입력 프로퍼티 변경을 기존 요소에 적용한다

- **대상 / 범위:** `applyPatch()` → `updateAttributes()`·`updateProperties()`.
- **사전 상태:** 실제 input의 class는 a, title은 설명, value는 A, checked는 true, indeterminate는 true다.
- **입력·행동:** class b·data-extra x 설정, title 삭제, properties의 value 빈 문자열·checked false·indeterminate false 설정 명령을 적용한다.
- **검증 시점:** `applyPatch()` 종료 직후.
- **기대 결과:** 지정한 속성이 추가·변경·삭제되고 현재 DOM 프로퍼티 값이 정확히 반영된다. 프로퍼티 변경을 attribute 설정만으로 대신하지 않는다.
- **유지 조건:** input 객체는 유지한다. 변경 목록에 없는 속성은 유지한다. 이 케이스의 indeterminate는 DOM 연산 단독 검증이며 HTML 편집기 입력으로 표현한 것이 아니다.

### PATCH-03 — 지정한 처음·중간·끝 위치에 삽입·제거하고 나머지 형제는 유지한다

- **대상 / 범위:** `applyPatch()` → `insertNode()`·`removeNode()`.
- **사전 상태:** A → B → C의 실제 형제 참조와 부모 VDOM을 준비한다. 각 위치 테스트는 이 상태에서 독립적으로 시작한다.
- **입력·행동:** X를 A 앞, B 앞, `before: null` 위치에 각각 삽입한다. 별도 테스트에서는 A·B·C를 각각 제거한다.
- **검증 시점:** 각 `applyPatch()` 종료 직후.
- **기대 결과:** 삽입 시 XABC·AXBC·ABCX, 제거 시 BC·AC·AB가 된다. 새 X의 VDOM은 생성된 실제 노드를 가리킨다. 제거 노드는 부모에서 분리된다.
- **유지 조건:** 나머지 형제와 부모 객체는 유지한다. 여기서는 명령 대상을 직접 지정하므로 key 없는 Diff의 형제 유지까지 보장하는 테스트가 아니다.

### PATCH-04 — 지정한 노드만 교체하고 새 실제 DOM 참조를 연결하며 형제는 유지한다

- **대상 / 범위:** `applyPatch()` → `replaceNode()`·`renderNode()`.
- **사전 상태:** 실제 `<div>A</div><span>유지</span>`와 기존 div·span 참조를 준비한다.
- **입력·행동:** div를 `<p>B</p>`의 새 VDOM으로 교체하는 명령을 적용한다.
- **검증 시점:** `applyPatch()` 종료 직후.
- **기대 결과:** 같은 위치에 새 p가 있고 이전 div는 분리된다. 새 p와 자식 VDOM은 각각 생성된 실제 DOM을 가리킨다.
- **유지 조건:** span 객체와 그 위치는 유지한다. 새 VDOM이 이전 div나 임시 파싱 DOM을 가리키면 실패다. replace는 제자리 교체만 수행하며 위치 이동은 별도 move가 담당한다.

### PATCH-05 — 기존 노드를 기준 형제 앞·맨 뒤로 이동하고 객체 동일성을 유지한다

- **대상 / 범위:** `applyPatch()` → `moveNode()`.
- **사전 상태:** 실제 A → B → C 형제와 각 VDOM의 직접 참조를 준비한다.
- **입력·행동:** C를 A 앞으로 옮긴다. 별도 초기 상태에서는 A를 `before: null`로 옮긴다.
- **검증 시점:** 각 `applyPatch()` 종료 직후.
- **기대 결과:** 각각 C → A → B, B → C → A가 된다. 이동한 노드는 새로 생성하지 않고 기존 객체를 유지한다.
- **유지 조건:** 부모와 나머지 형제 객체를 유지한다. key로 move 명령을 찾아내는 것은 이 케이스의 범위가 아니다.

### PATCH-06 — OPTION 생성 후 단일·다중 선택 상태를 렌더링·복원한다

- **대상 / 범위:** `renderNode()`와 이력 복원의 `renderChildren()`.
- **사전 상태:** OPTION A·B를 가진 SELECT VDOM. 단일 선택 B, 다중 선택 A와 B 상태를 각각 준비한다.
- **입력·행동:** 각 VDOM을 실제 영역에 렌더링한다.
- **검증 시점:** `renderNode()` 종료 후, 별도 복원 테스트에서는 `renderChildren()` 종료 후.
- **기대 결과:** 자식 OPTION이 생성된 뒤 선택 상태가 적용된다. 단일 선택은 B, 다중 선택은 A·B 모두 선택 상태다.
- **유지 조건:** 마지막 SELECT.value 대입 때문에 다중 선택 중 하나가 해제되지 않는다.

### PATCH-07 — 삽입·삭제·이동·수정·교체를 함께 적용해 목표 트리와 참조를 완성한다

- **대상 / 범위:** `diff()` → `applyPatch()`.
- **사전 상태:** 기존 A(key="a") → B(key="b") → C(key="c") → D(key="d") 형제의 참조를 준비하고, 새 X(key="x")와 교체할 D'를 포함한 명령을 직접 준비한다. `applyPatch()` 전에 실제 `diff()`로 유지 노드의 연결 상태를 준비한다.
- **입력·행동:** B 제거, 새 X 삽입, C를 A 앞으로 이동, A 텍스트 변경, D 태그 교체를 포함해 목표 C → X → 수정된 A → 교체된 D를 만든다.
- **검증 시점:** 정렬된 명령 전체에 대한 `applyPatch()` 종료 직후.
- **기대 결과:** 구조·순서·텍스트·속성·properties가 목표 VDOM과 일치한다. 다음 VDOM의 유지·이동·수정·새 노드·교체 노드 모두 실제 DOM 참조가 연결된다.
- **유지 조건:** 이동 C·수정 A는 기존 객체다. 앞 명령 때문에 뒤 명령이 다른 형제를 수정하지 않는다. 특정 최소 명령 개수는 요구하지 않는다.

### PATCH-08 — Diff가 연결한 유지 노드를 사용하고 새 노드까지 전체 참조를 완성한다

- **대상 / 범위:** `diff()` → `applyPatch()`.
- **사전 상태:** 이전 `<div key="d1"><p key="p1">A</p><span key="sp1">유지</span></div>`의 VDOM은 실제 DOM 참조를 가진다. 다음 `<div key="d1"><p key="p1">B</p><span key="sp1">유지</span><em key="e1">추가</em></div>`의 VDOM은 `VRoot`와 모든 하위 노드의 `dom`이 null이다. 기존 div·p·span·각 텍스트 노드 참조를 보관한다.
- **입력·행동:** 실제 `diff()`로 Diff의 유지 노드 연결을 수행한 뒤, 텍스트 update와 em insert 명령을 `applyPatch()`에 적용한다.
- **검증 시점:** `diff()` 종료 직후와 Patch 종료 직후, 이력 저장 전.
- **기대 결과:** `diff()` 후 다음 VDOM의 div·p·span·각 기존 텍스트와 `VRoot`는 유지된 실제 객체에 연결되고, 새 em과 텍스트는 null이다. `applyPatch()` 후 새 em과 텍스트가 생성한 실제 객체에 연결되어 실제 화면이 목표와 일치하고, 전체 VDOM에 미연결 노드가 없다.
- **유지 조건:** 변경 명령이 없는 span·텍스트도 Diff 연결 대상이다. 참조를 채우려고 기존 DOM을 재생성하지 않으며, 다음 VDOM의 실제 DOM 참조는 임시 파싱 노드를 가리키지 않는다. `diff()`는 유지 노드를, `applyPatch(prevRoot, nextRoot, changes)`는 새 노드를 연결하며 P1-PATCH-LINK-02를 따른다.

## 8. 전체 Patch — 단계별 결과·연속 수정·변경 없음·실패 복구 검증

### FLOW-01 — 텍스트 수정의 파싱·스냅샷·Diff·DOM 반영·이력 저장을 단계별 검증한다

- **대상 / 범위:** `handlePatch()` 전체. 내부 단계의 검증은 같은 사전 상태를 새로 준비해 해당 단계까지만 실행하는 테스트로 나눈다.
- **사전 상태:** 편집기·실제 영역·현재 VDOM은 `<p key="p1">A</p>`. 기존 실제 p·텍스트 참조와 History 길이를 보관한다.
- **입력·행동:** 편집기를 `<p key="p1">B</p>`로 수정하고 Patch한다.
- **검증 시점과 기대 결과:** 아래 표를 따른다.
- **유지 조건:** 과거 이력 데이터와 변경 없는 DOM 객체를 유지한다. 편집기 원문을 임의로 다시 포맷하지 않는다.

| 시점 | 기대 결과 |
| --- | --- |
| `readEditorHTML()` 반환 후 | 입력 문자열은 `<p key="p1">B</p>`, 실제 화면은 A |
| `parseHTML()` 반환 후 | 임시 DOM의 텍스트는 B, 실제 화면은 A |
| `createSnapshot()` 반환 후 | 다음 VDOM은 B이며 모든 dom은 null, 이전 VDOM 데이터는 A이고 실제 DOM 참조 유지 |
| `diff()` 반환 후 | 텍스트 update 명령 존재, 실제 화면은 아직 A, 다음 VDOM의 p·텍스트는 실제 DOM 참조 연결 완료, insert/replace 노드는 없음 |
| `applyPatch()` 종료 후 | 실제 텍스트는 B, p·텍스트 객체 유지, 다음 VDOM 전체에 실제 DOM 참조 연결 완료, 이력 저장 단계는 아직 실행하지 않음 |
| `handlePatch()` 종료 후 | 참조 연결이 완성된 다음 VDOM을 현재 상태로 지정하고, VDOM 데이터와 `<p key="p1">B</p>` 원문으로 새 이력 한 개 저장 |

### FLOW-02 — 첫 Patch에서 삽입·교체한 실제 노드를 다음 Patch에서 다시 생성하지 않고 수정한다

- **대상 / 범위:** 연속된 `handlePatch()` 두 번. 삽입과 교체를 별도 케이스로 실행한다.
- **사전 상태:** 삽입 케이스는 `<div></div>`, 교체 케이스는 `<div><span key="old">A</span></div>`.
- **입력·행동:** 첫 Patch에서 둘 다 `<div><p key="p1">A</p></div>`로 만든다. 두 번째 Patch에서는 p 텍스트만 B로 수정한다.
- **검증 시점:** 첫 `applyPatch()` 종료 후 참조를 보관하고, 두 번째 `handlePatch()` 종료 후 확인한다.
- **기대 결과:** 첫 Patch에서 생성한 p와 텍스트에 참조가 연결된다. 두 번째 Patch는 바로 그 실제 노드를 수정하여 B를 표시한다.
- **유지 조건:** 두 번째 Patch에서 p를 다시 생성하지 않는다. 각 변경마다 이력이 하나씩 추가된다.
- **key 변경 주의:** 교체 케이스의 `span key="old"` → `p key="p1"`은 P1-CONF-03에 따라 remove + insert로 계산된다. 이 케이스는 최종 DOM과 후속 수정의 노드 재사용을 검증하며, replace 명령 자체를 검증하지 않는다. replace는 DIFF-04·PATCH-04가 담당한다.

### FLOW-03 — 코드 변경 없이 Patch하면 DOM 변경과 이력 저장을 모두 생략한다

- **대상 / 범위:** `handlePatch()` 전체.
- **사전 상태:** 편집기·현재 VDOM·실제 화면이 동일한 상태. DOM 참조·History 길이·현재 위치를 보관한다.
- **입력·행동:** 코드를 바꾸지 않고 Patch를 클릭한다.
- **검증 시점:** `handlePatch()` 종료 직후.
- **기대 결과:** Diff는 빈 배열이며 `applyPatch()`와 `saveHistory.set()`을 실행하지 않는다.
- **유지 조건:** DOM 객체·History 길이·현재 위치는 모두 유지된다. 실제 DOM 참조를 가진 기존 현재 VDOM을 계속 사용하며, Diff가 참조를 연결한 다음 VDOM을 현재 상태로 교체하지 않는다.

### FLOW-04 — Patch에서 오류가 발생하면 이력을 추가하지 않고 현재 이력 위치를 유지한다

- **대상 / 범위:** `handlePatch()`의 `applyPatch()` 실패 경로.
- **사전 상태:** 변경이 있는 편집기 코드와 저장된 현재 상태. History 길이·현재 위치를 보관한다.
- **입력·행동:** 테스트 환경에서 `applyPatch()`가 오류를 발생시키도록 하고 핸들러를 실행한다.
- **검증 시점:** 오류가 전달되거나 처리된 직후.
- **기대 결과:** `saveHistory.set()`을 호출하지 않고 새 이력을 저장하지 않는다.
- **유지 조건:** 저장된 과거 데이터와 현재 이력 위치는 유지한다. Diff가 참조를 연결한 다음 VDOM은 현재 상태로 사용하지 않는다. 실제 DOM 롤백·오류 UI·재시도 정책은 이번 기대 결과에 포함하지 않는다.

### FLOW-05 — applyPatch 실패 시 실제 영역만 현재 이력으로 복원하고 편집기는 유지한다

- **대상 / 범위:** `handlePatch()`의 `applyPatch()` 실패 복구 경로와 후속 Patch.
- **사전 상태:** 현재 이력은 A이고 실제 영역·live VDOM도 A다. 편집기에는 실패할 B가 입력되어 있다. History 길이·현재 위치·A의 저장 데이터를 보관한다.
- **입력·행동:** 테스트 환경에서 첫 `applyPatch()`만 오류를 발생시키도록 하고 Patch를 실행한다. 이어 오류를 해제한 뒤 같은 편집기 내용으로 다시 Patch한다.
- **검증 시점:** 오류 처리 직후와 재시도 `handlePatch()` 종료 후.
- **기대 결과:** 오류 직후 실제 영역은 A로 full render 복원되고 live VDOM도 복원된 A에 연결된다. History 길이·현재 위치·저장 데이터는 유지되고 새 이력은 추가되지 않는다. 편집기 HTML은 B 그대로다. 재시도 Patch는 복원된 A를 기준으로 B를 다시 계산하며 중복 노드를 만들지 않는다.
- **유지 조건:** 과거 이력 데이터는 변하지 않는다. 실패한 Diff가 참조를 연결한 다음 VDOM은 폐기한다. 복원에는 현재 live VDOM의 낡은 `dom` 참조가 아니라 `saveHistory.peek(0)`의 이력 데이터를 사용한다. `restoreSnapshot(..., { restoreEditor: false })`로 편집기를 덮어쓰지 않고, `saveHistory.move(0, liveVDOM)`으로 위치 이동 없이 live VDOM만 교체한다. 복원 자체가 실패할 때의 오류 UI·재시작 정책은 이번 기대 결과에 포함하지 않는다.

## 9. History — 상태·HTML 저장, 50개 상한, 양쪽 영역 복원·후속 Patch 검증

History는 페이지 세션 메모리에서 최대 50개를 보관한다. 상한을 넘으면 가장 오래된 이력을 제거한다. 각 History 테스트는 저장 데이터와 currentLive가 분리되어 있는지, 위치·상한 불변식이 유지되는지 함께 확인한다.

### HIST-01 — 현재 VDOM의 DOM 참조와 저장 데이터·HTML 원문을 분리하고 과거 상태를 보존한다

- **대상 / 범위:** `saveHistory.set(vdom, html)`·`get()`·`peek()`.
- **사전 상태:** 실제 DOM에 연결된 VDOM과 HTML 원문을 준비한다.
- **입력·행동:** 두 상태를 순서대로 저장하고 현재 상태와 이전 저장 항목을 조회한다. 저장 후 원본 VDOM의 데이터와 실제 DOM을 별도로 변경한다.
- **검증 시점:** 각 저장·조회 종료 후와 원본 변경 후.
- **기대 결과:** `get()`은 현재 위치에 대응하는 렌더링용 VDOM을 반환한다. 저장 항목은 DOM 참조 없는 데이터 복사본과 HTML 원문이며, 원본 변경에도 저장 데이터는 유지된다.
- **유지 조건:** peek 조회만으로 현재 위치가 바뀌지 않는다. 복사본에 실제 DOM 객체가 섞이지 않는다.

### HIST-02 — 뒤로·앞으로 이동하면 화면·HTML 원문을 복원하고 실제 DOM 참조를 재연결한다

- **대상 / 범위:** `handleHistoryMove()` → `restoreSnapshot()` → `saveHistory.move()`.
- **사전 상태:** A·B·C 상태를 저장하고 C에 있다. 각 상태는 텍스트뿐 아니라 HTML 원문의 줄바꿈·들여쓰기도 다르게 준비한다.
- **입력·행동:** 뒤로 한 번, 앞으로 한 번 이동한다.
- **검증 시점:** 각 `handleHistoryMove()` 종료 직후.
- **기대 결과:** 각각 B·C의 실제 화면과 해당 HTML 원문이 함께 복원된다. 현재 VDOM의 모든 dom 참조는 복원된 실제 노드와 연결된다.
- **유지 조건:** History 길이와 저장된 과거 데이터는 바뀌지 않는다. 실제 영역 컨테이너 객체는 유지한다.

### HIST-03 — 처음·마지막 이력 밖으로 이동하면 화면·코드·현재 위치를 유지한다

- **대상 / 범위:** `peek(direction)`과 `handleHistoryMove(direction)`.
- **사전 상태:** 처음 상태와 마지막 상태를 각각 준비한다. 초기 이력 하나만 있는 경우도 포함한다.
- **입력·행동:** 처음에서 뒤로, 마지막에서 앞으로 이동을 요청한다.
- **검증 시점:** peek 반환 후와 핸들러 종료 후.
- **기대 결과:** 범위 밖 조회는 null이고 복원·현재 위치 갱신을 수행하지 않는다.
- **유지 조건:** 실제 화면·편집기 문자열·DOM 참조·History 길이·현재 위치는 유지한다. 버튼 비활성화 UI는 별도 합의 없이 필수로 추가하지 않는다.

### HIST-04 — 과거로 돌아가 새 상태를 저장하면 미래 이력만 제거한다

- **대상 / 범위:** `handleHistoryMove(-1)` 후 `handlePatch()`와 `saveHistory.set()`.
- **사전 상태:** A·B·C가 저장된 상태에서 B로 돌아왔다.
- **입력·행동:** 편집기를 새로운 D 상태로 바꾸고 Patch한다. 이어 앞으로가기를 시도한다.
- **검증 시점:** 새 Patch 종료 후와 앞으로가기 핸들러 종료 후.
- **기대 결과:** 이력은 A·B·D이며 현재는 D다. 과거 미래 항목 C는 제거되고 앞으로가기로 접근할 수 없다.
- **유지 조건:** A·B 데이터는 유지한다. 삭제되는 것은 현재 뒤쪽의 이력이며 앞쪽 과거 이력이 아니다.

### HIST-05 — 삭제·교체 전 상태를 복원한 뒤 현재 화면에 재생성된 노드를 수정한다

- **대상 / 범위:** Patch → 이력 복원 → 후속 Patch.
- **사전 상태:** A 상태에 `<div><p key="p1">처음</p></div>`가 있다. B 상태에서 p를 삭제하거나 `<span key="s1">처음</span>`으로 교체해 저장한다. 두 경우를 따로 실행한다.
- **입력·행동:** A로 돌아간 뒤 편집기에서 p 텍스트를 `다시`로 바꾸고 Patch한다.
- **검증 시점:** `restoreSnapshot()` 종료 후, 후속 `handlePatch()` 종료 후.
- **기대 결과:** A 복원 시 p를 새로 생성해 현재 실제 DOM에 연결한다. 후속 Patch는 화면에 붙어 있는 그 p의 텍스트를 바꾼다.
- **유지 조건:** 삭제·교체 전에 사용하던 분리된 DOM 참조를 복원 후 수정 대상으로 재사용하지 않는다. 과거 A 데이터는 변하지 않는다.
- **key 변경 주의:** B 상태의 `p key="p1"` → `span key="s1"`은 P1-CONF-03에 따라 remove + insert로 계산된다. 복원 후 A 상태의 p를 새로 만드는 흐름과 replace 명령 검증을 혼동하지 않는다.

### HIST-06 — 속성 순서만 바꾸면 저장하지 않고 이력 이동 시 미저장 코드를 저장 원문으로 바꾼다

- **대상 / 범위:** `handlePatch()`의 변경 없음 처리와 `handleHistoryMove()`.
- **사전 상태:** `<p key="p1" class="a" title="b">A</p>` 등 최소 두 상태가 저장되어 있다.
- **입력·행동:** 현재 코드의 속성 나열 순서만 바꾸어 `<p key="p1" title="b" class="a">A</p>`로 만든 뒤 Patch한다. 이어 저장하지 않은 텍스트 변경을 입력하고 이전 이력으로 이동한다.
- **검증 시점:** 변경 없는 Patch 종료 후, 이력 이동 종료 후.
- **기대 결과:** 속성 순서만 바꾼 Patch는 새 이력을 저장하지 않는다. 이력 이동 시 미저장 코드는 선택한 항목에 저장된 원문으로 교체된다.
- **유지 조건:** 속성 순서 변경은 DOM 의미의 차이가 아니다. 실제 텍스트 노드를 추가할 수 있는 들여쓰기 변경을 무조건 변경 없음으로 취급하지 않는다.

### HIST-07 — 50개 상한을 넘으면 가장 오래된 이력을 제거한다

- **대상 / 범위:** `saveHistory.set()`의 상한·퇴거와 `peek()`·`move()`의 위치 불변식.
- **사전 상태:** 작은 VDOM과 HTML로 History를 채운다. 50개 경계, 50개를 넘긴 직후, 과거 위치에서 새 상태를 저장하는 분기를 각각 준비한다.
- **입력·행동:** 51번째 상태를 저장한다. 별도 사례에서는 50개 상태에서 과거 위치로 이동한 뒤 새 상태를 저장한다.
- **검증 시점:** 각 `set()` 종료 직후와 이후 `peek()`·`move()` 실행 직후.
- **기대 결과:** 길이는 50을 넘지 않는다. 가장 오래된 이력이 제거되고 현재 위치는 새 마지막 항목을 가리킨다. 과거 위치에서 새 상태를 저장하면 미래 이력을 먼저 제거한 뒤 새 항목을 추가하며, 아직 상한에 도달하지 않았다면 오래된 이력을 추가로 버리지 않는다. 범위 밖 `peek()`은 null이고 범위 밖 `move()`는 완전한 no-op이다.
- **유지 조건:** 저장 항목의 VDOM에는 실제 DOM 참조가 없고, currentLive는 유효한 VDOM이다. `peek()`은 위치를 바꾸지 않는다. 상한·퇴거 과정에서 저장 데이터가 변하지 않는다.

## 10. 확정된 노드 식별 규칙 — 같은 key 태그 변경·key 변경·중복 key

key가 없는 요소와 텍스트 노드의 순서 대응은 확정했다. 같은 부모 안의 중복 key, 같은 key의 태그 변경, key 값 자체 변경은 P1-CONF-03으로 확정했다.

| ID | 대상 함수·검증 시점 | 상황·입력 | 확정된 기대 결과 |
| --- | --- | --- | --- |
| CONF-03 | 노드 식별 단계 종료 또는 오류 발생 후 | 같은 부모에 중복 key, 같은 key의 태그 변경, key 값 자체 변경 | 같은 key + 같은 태그는 matched/update, 같은 key + 다른 태그는 replace, key 변경은 remove + insert, 중복 key는 keyless 순서 기반 대응으로 처리한다. 중복된 key 값은 그 비교에서 식별자로 사용하지 않으며 원본 key 속성은 삭제하지 않는다. |

이 확정에 따라 DIFF-04는 같은 key의 태그 변경 replace를 검증하고, ORDER-04의 key 변경(`d1` → `d2`)은 replace가 아니라 remove + insert를 기대한다. FLOW-02·HIST-05의 key 변경 “교체” 입력은 최종 DOM 결과를 검증하며 replace 명령 자체를 검증하지 않는다.

## 11. 기존 테스트 ID와 재작성한 케이스의 대응표

기존 ID는 아래 새 케이스로 대체한다. 이 표는 다른 문서의 S·D·H 참조를 추적하기 위한 것이며 다른 문서의 내용을 자동 수정하지 않는다.

| 기존 ID | 새 케이스 |
| --- | --- |
| S01·S02 | HTML-02, SNAP-01 |
| S03 | SNAP-05 |
| S04·S05 | SNAP-03, SNAP-04 |
| D01 | DIFF-01, FLOW-03 |
| D02·D03 | DIFF-02·DIFF-03, PATCH-01·PATCH-02 |
| D04 | DIFF-04, PATCH-04 |
| D05·D06 | PATCH-03 |
| D07 | DIFF-07, DIFF-09, PATCH-05 |
| D08 | DIFF-06 |
| D09 | ORDER-01–ORDER-05, PATCH-07 |
| D10 | FLOW-02 |
| H01·H02 | INIT-01·INIT-02, FLOW-01 |
| H03·H04 | HIST-02·HIST-03 |
| H05·H06 | HIST-04·HIST-01 |

## 12. 통합 테스트 — Snapshot → Diff → Patch 실제 연결

이 절은 모듈별 함수를 mock으로 분리하지 않고 실제 `parseHTML()`, `createSnapshot()`, `diff()`, `applyPatch()`를 연결해 검증한다. 실행 위치는 `tests/integration/vdom-snapshot-diff-patch.test.ts`다.

공통 원칙:

- 테스트가 `DiffCommand`를 직접 만들지 않고 실제 `diff()` 결과를 사용한다.
- Snapshot 직후 다음 VDOM의 `VRoot`와 모든 `VNode`의 `dom`은 null이다.
- Diff 직후 실제 DOM은 변경되지 않는다.
- Diff는 유지·이동·수정 노드를 연결하고 insert/replace 노드는 null로 둔다.
- Patch 후 실제 DOM 구조와 전체 `dom` 연결이 완성된다.
- 유지·이동 노드는 이전과 같은 실제 DOM 객체를 사용한다.
- History·편집기·버튼·`handlePatch()`는 이 절의 범위가 아니다. 해당 흐름은 FLOW·HIST에서 검증한다.

### IT-01 — 빈 실제 영역에 Snapshot → Diff → Patch로 초기 렌더링한다

- **기존 명세 연결:** INIT-01의 렌더링 부분, ORDER-02, PATCH-08.
- **사전 상태:** 실제 영역은 비어 있고 `createEmptyVDOM()`의 `dom`만 연결되어 있다.
- **입력·행동:** `<section key="s"><p key="p">A</p><span key="sp">B</span></section>`을 Snapshot으로 만들고 Diff → Patch를 실행한다.
- **검증 시점:** Snapshot 직후, Diff 직후, Patch 종료 직후.
- **기대 결과:** Snapshot의 모든 `dom`은 null이다. Diff 직후 실제 영역은 비어 있고 새 하위 트리를 중복 계획하지 않는다. Patch 후 section → p → span 구조와 텍스트가 목표와 일치하고 모든 VNode의 `dom`이 실제 DOM에 연결된다.
- **유지 조건:** 실제 영역 컨테이너 객체를 유지하고 샘플을 중복 삽입하지 않는다.

### IT-02 — 텍스트·속성·프로퍼티 변경을 같은 실제 DOM에 반영한다

- **기존 명세 연결:** FLOW-01의 History 제외 부분, DIFF-02·DIFF-03·DIFF-05, PATCH-01·PATCH-02.
- **사전 상태:** `<article key="root" class="a" title="설명"><h1 key="title">A</h1><input key="field" value="A"></article>`가 실제 DOM에 렌더링되어 있다.
- **입력·행동:** 다음 HTML에서 h1 텍스트를 B로, article class를 b로, `data-extra="x"`를 추가하고 title을 제거하며 input value를 B로 바꾼다. Snapshot → Diff → Patch를 실행한다.
- **검증 시점:** Diff 직후와 Patch 종료 직후.
- **기대 결과:** Diff 직후 화면은 A와 기존 속성을 유지한다. article·h1·텍스트의 `dom`은 기존 실제 DOM과 같다. Patch 후 같은 article·h1·텍스트 객체에 최종 텍스트·속성·프로퍼티가 반영되고 insert/replace 명령은 없다.
- **유지 조건:** 실제 DOM에 연결된 유지 노드를 재생성하지 않고 전체 VDOM 참조를 완성한다.

### IT-03 — 삽입·삭제·이동·수정을 실제 Diff 명령으로 함께 적용한다

- **기존 명세 연결:** PATCH-07, DIFF-07, ORDER-03, MOVE-04, MOVE-07의 복합 경로.
- **사전 상태:** `<ul key="list"><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>`가 렌더링되어 있다.
- **입력·행동:** 다음 HTML을 `<ul key="list"><li key="c" class="moved">C</li><li key="a">A2</li><li key="x">X</li></ul>`로 수정하고 Snapshot → Diff → Patch를 실행한다.
- **검증 시점:** Diff 직후와 Patch 종료 직후.
- **기대 결과:** Diff 직후 실제 DOM은 A → B → C를 유지한다. c·a의 `dom`은 기존 객체와 같고 x의 `dom`은 null이다. Patch 후 최종 순서는 c → a → x이고 c에 class가 적용되며 a의 텍스트는 A2가 된다. b는 실제 DOM에서 분리되고 x와 하위 텍스트가 연결된다.
- **유지 조건:** 이동한 c·수정한 a는 기존 객체를 유지하고 전체 VDOM 참조를 완성한다.

### IT-04 — 새 형제 삽입 의존성을 지켜 기존 형제 앞에 생성한다

- **기존 명세 연결:** ORDER-01, ORDER-02.
- **사전 상태:** `<ul key="list"><li key="c">C</li></ul>`만 렌더링되어 있다.
- **입력·행동:** 목표를 `<ul key="list"><li key="a">A</li><li key="b">B</li><li key="c">C</li></ul>`로 두고 Snapshot → Diff → Patch를 실행한다.
- **검증 시점:** Diff 직후와 Patch 종료 직후.
- **기대 결과:** Diff 직후 실제 DOM은 C만 유지한다. Patch 후 최종 순서는 A → B → C이고 새 노드가 부모 없이 삽입되지 않으며 c의 실제 DOM 객체는 유지된다.
- **유지 조건:** 중복 li를 생성하지 않고 Diff가 반환한 순서를 그대로 사용해 Patch가 성공한다.

### IT-05 — keyless 노드의 replace와 새 하위 트리 연결을 검증한다

- **기존 명세 연결:** DIFF-04의 keyless replace 사례, PATCH-04.
- **사전 상태:** `<div key="d"><div>A</div><span>유지</span></div>`가 렌더링되어 있다.
- **입력·행동:** 첫 번째 keyless 자식을 `<p>B</p>`로 바꾸고 Snapshot → Diff → Patch를 실행한다.
- **검증 시점:** Diff 직후와 Patch 종료 직후.
- **기대 결과:** Diff는 같은 위치의 div → p를 replace로 계산하고 새 p의 `dom`은 null로 둔다. 실제 DOM은 Diff 직후 유지된다. Patch 후 같은 위치에 p가 생성되고 새 p와 텍스트가 연결되며 span 객체와 위치는 유지된다.
- **유지 조건:** 같은 key의 태그 변경은 P1-CONF-03에 따라 replace이며 이 케이스는 그 경로를 사용하지 않는다. 이전 div는 실제 DOM에서 분리되고 전체 VDOM 참조를 완성한다.

### IT-06 — 첫 Patch에서 삽입한 노드를 다음 Patch에서 재사용한다

- **기존 명세 연결:** FLOW-02의 삽입 케이스, History 횟수 제외.
- **사전 상태:** `<div key="d"></div>`가 렌더링되어 있다.
- **입력·행동:** 첫 번째 Patch에서 `<div key="d"><p key="p1">A</p></div>`로 만들고, 이어 `<p key="p1">B</p>`로 텍스트를 수정한다. 두 번 모두 Snapshot → Diff → Patch를 실행한다.
- **검증 시점:** 첫 Patch 종료 후 참조를 보관하고 두 번째 Patch 종료 후 확인한다.
- **기대 결과:** 첫 Patch가 만든 p·텍스트에 실제 DOM 참조가 연결된다. 두 번째 Patch는 같은 p·텍스트 객체를 수정하고 p를 다시 생성하지 않는다. 최종 DOM에 p가 하나만 존재한다.
- **유지 조건:** 두 번째 Patch 후 전체 VDOM 참조를 완성한다. History 저장 횟수는 이 케이스의 범위가 아니다.

### IT-07 — 첫 Patch에서 교체한 노드를 다음 Patch에서 재사용한다

- **기존 명세 연결:** FLOW-02의 교체 케이스, DIFF-04, PATCH-04.
- **사전 상태:** `<div><span>A</span></div>`가 렌더링되어 있다.
- **입력·행동:** 첫 번째 Patch에서 `<div><p>A</p></div>`로 교체한 뒤, 두 번째 Patch에서 텍스트를 B로 수정한다. 두 번 모두 Snapshot → Diff → Patch를 실행한다.
- **검증 시점:** 첫 Patch 종료 후 p·텍스트 참조를 보관하고 두 번째 Patch 종료 후 확인한다.
- **기대 결과:** 첫 Patch에서 교체된 p·텍스트에 참조가 연결된다. 두 번째 Patch는 같은 p·텍스트 객체를 수정하며 교체 노드를 다시 생성하지 않는다.
- **유지 조건:** 최종 실제 DOM과 VDOM 참조가 목표와 일치한다. History 저장 횟수는 이 케이스의 범위가 아니다.

### IT-08 — 변경 없음에서는 빈 명령을 반환하고 Patch를 생략한다

- **기존 명세 연결:** DIFF-01, FLOW-03의 handler 제외 부분.
- **사전 상태:** `<section key="s"><p key="p">A</p></section>`가 Snapshot과 실제 DOM에 일치하게 렌더링되어 있다.
- **입력·행동:** 같은 HTML로 새 Snapshot을 만들고 `diff()`까지만 실행한다.
- **검증 시점:** Diff 직후와 Patch 생략 판단 직후.
- **기대 결과:** Diff는 빈 배열을 반환하고 실제 DOM 구조·텍스트·객체 동일성은 유지된다. 다음 VDOM의 유지 노드는 기존 DOM에 연결되지만 현재 상태로 교체하지 않는다.
- **유지 조건:** `applyPatch()`를 실행하지 않고 실제 DOM과 현재 VDOM 객체를 유지한다.

### IT 추적표

| 통합 테스트 | 기존 명세 연결 | 남은 전체 검증 |
| --- | --- | --- |
| IT-01 | INIT-01 렌더링, ORDER-02, PATCH-08 | History·편집기 저장 |
| IT-02 | FLOW-01, DIFF-02·03·05, PATCH-01·02 | History 저장 단계 |
| IT-03 | PATCH-07, DIFF-07, ORDER-03, MOVE-04 | MOVE-07의 개별 fixture |
| IT-04 | ORDER-01·02 | 없음 |
| IT-05 | DIFF-04 일부, PATCH-04 | 없음 |
| IT-06 | FLOW-02 삽입 | History 저장 횟수 |
| IT-07 | FLOW-02 교체 | History 저장 횟수 |
| IT-08 | DIFF-01, FLOW-03 | 실제 handler의 Patch 생략 |
