# Phase 1 PRD

## 0. Process

> 현재 VDOM 조회 → 편집기 HTML 읽기 → 임시 DOM 파싱 → 참조 없는 다음 VDOM 생성 → Diff(변경 계산·유지 노드 참조 연결) → Patch(변경 적용·새 노드 참조 연결) → 현재 상태 갱신·History 저장

`main.html`을 기준으로 상위 이벤트 흐름에서 Patch → Diff → VDOM 순서로 하위 역할을 설계한다.
테스트 영역은 HTML 코드 편집기, 실제 영역은 렌더링 화면이다. 요구사항 원문의 “테스트 영역 렌더링”은 HTML 문자열 편집기로 해석한다. 아래 내용은 설계 명세이며 구현 코드는 아니다.
요구사항 원문은 `resc/phase1.md`, 함수 흐름은 `p1_function_flow.md`, 검증 기준은 `p1_test_cases.md`를 따른다.
구현 환경과 확정된 결정은 `p1_decisions.md`를, 함수·타입 인터페이스는 `p1_interfaces.md`를 따른다.

합의한 참조 연결 시점은 다음과 같다.

| 단계 | 이전 VDOM | 다음 VDOM |
| --- | --- | --- |
| Snapshot 종료 | 현재 실제 DOM 참조 유지 | VRoot와 모든 VNode의 dom이 null |
| Diff 종료 | 현재 실제 DOM 참조 유지 | VRoot와 유지·이동·수정 노드는 실제 DOM 참조 연결, insert/replace 노드는 null |
| Patch 성공 | 변경 전 비교 기준 | insert/replace를 포함해 실제 DOM 참조 연결 완료 |
| 현재 상태 지정·이력 저장 | 이전 상태 | 완성된 다음 VDOM을 현재 상태로 사용 |

아래 내용은 호출 흐름을 설명한다. Patch는 `applyPatch(prevRoot, nextRoot, changes)`로 호출하며, `changes`는 정렬된 명령 배열이고 완성된 `nextRoot`를 반환한다. 유지 노드의 참조 연결은 `p1_decisions.md`의 P1-PATCH-LINK-02를 따른다.

## 1. main.html → 진입점

```text
main.html
└─ init()
   ├─ getElements()                     HTML 편집기·실제 영역·버튼 조회
   ├─ createHistory()                   저장 배열 + 현재 위치 관리
   ├─ getSampleHTML()                   초기 샘플 HTML 확보
   ├─ initializeDOM(sampleHTML)         빈 실제 영역에 샘플 반영·첫 이력 저장
   └─ bindEvents()
      ├─ Patch 클릭 → handlePatch()
      ├─ 뒤로 클릭  → handleHistoryMove(-1)
      └─ 앞으로 클릭 → handleHistoryMove(1)
```

`init()` 안에서 편집기·실제 영역·History를 만들고 핸들러가 클로저로 접근한다. 별도 전역 `curVDOM`은 두지 않는다.
초기화는 빈 VDOM과 샘플 VDOM을 비교하는 방식으로 통일한다. 빈 VDOM은 초기화의 비교 기준이며, 샘플이 반영된 상태를 첫 이력으로 저장한다.

Phase 1 화면은 좌우 2분할이다. 왼쪽은 HTML 코드 편집기, 오른쪽은 실제 영역이며 실제 영역 컨테이너는 `#actual`이다. Patch·뒤로·앞으로 버튼은 하단 푸터에 둔다. `init()`은 `createEmptyVDOM(#actual)`로 초기 `VRoot.dom`을 연결한다.

## 2. 이벤트 핸들러

### Patch

```text
handlePatch()
├─ saveHistory.get()                    실제 DOM 참조를 가진 현재 VDOM 조회
├─ readEditorHTML()                     HTML 원문 읽기
├─ parseHTML(html)                      임시 DOM 트리 생성
├─ createSnapshot(parsedRoot)           실제 DOM 참조 없는 다음 VDOM 생성
├─ diff(curVDOM, nextVDOM)               변경 명령 계산 + 유지 노드의 실제 DOM 참조 연결
├─ 변경 없음 → 종료                    기존 현재 VDOM과 이력 유지
├─ try
│  └─ applyPatch()
│     ├─ 이전 VDOM의 참조로 실제 DOM 변경
│     └─ insert/replace 노드의 실제 DOM 생성·연결, 전체 연결 검증
├─ catch
│  ├─ entry = saveHistory.peek(0)         현재 이력 데이터 조회
│  ├─ liveVDOM = restoreSnapshot(entry, actualRoot, { restoreEditor: false })
│  ├─ saveHistory.move(0, liveVDOM)       위치 이동 없이 live VDOM만 교체
│  └─ rethrow
└─ saveHistory.set(nextVDOM, html)       성공한 경우만 현재 상태 갱신·이력 저장
```

`readEditorHTML()`은 HTML 코드 편집기의 문자열을 읽는다.

History의 초기 상태는 이벤트 연결 전에 준비한다. 변경 없는 Patch는 DOM 반영·이력 저장을 생략하고 기존 현재 VDOM을 유지한다. 실패한 Patch는 저장하지 않는다. applyPatch 실패 시 현재 이력 데이터로 실제 영역만 복원하고 편집기 HTML은 유지하며, History의 길이·현재 위치·저장 데이터는 변경하지 않는다. 오류는 호출자에게 전달한다. 일반 Patch에서는 편집 내용을 그대로 두고 실제 영역의 변경 부분만 갱신한다.

### 뒤로가기·앞으로가기

```js
function handleHistoryMove(direction) {
  const entry = saveHistory.peek(direction);
  if (entry === null) return;

  const liveVDOM = restoreSnapshot(entry, actualRoot);
  saveHistory.move(direction, liveVDOM);
}
```

`entry`는 DOM 참조 없는 VDOM 데이터와 해당 시점의 HTML 원문을 담는다. 이력 이동은 실제 화면과 코드 편집기를 함께 복원하며, 저장하지 않은 편집 내용은 선택한 이력의 HTML로 교체한다. 범위를 벗어나면 이동하지 않는다.

## 3. applyPatch() → 실제 DOM 변경과 새 노드 참조 연결

```text
applyPatch(prevRoot, nextRoot, changes) 이전·다음 VDOM과 변경 명령을 이용하는 Patch 단계
├─ replaceNode(target, node)            제자리 교체, 이동은 move
│  ├─ renderNode(node)                  새 실제 DOM 생성·참조 연결
│  └─ 기존 DOM 교체
├─ updateNode(target, data)
│  ├─ updateText()                      텍스트 nodeValue 변경
│  ├─ updateAttributes()                속성 추가·변경·삭제
│  └─ updateProperties()                입력·선택 상태 변경
├─ insertNode(node, parent, before)
│  ├─ renderNode(node)
│  └─ 부모 DOM의 기준 형제 앞에 삽입
├─ removeNode(target)
│  └─ 대상 DOM 제거
├─ moveNode(target, parent, before)
│  └─ 기존 DOM을 기준 형제 앞으로 이동
├─ insert/replace 노드의 하위 트리까지 실제 DOM 참조 연결 완료
└─ assertAllLinked(nextRoot, actualRoot) 전체 연결 확인
```

`applyPatch()`는 `diff()`가 유지·이동·수정 노드와 `VRoot`의 실제 DOM 참조를 이미 연결했다고 전제한다. Patch는 insert/replace 노드에 대해서만 `renderNode()`로 새 실제 DOM을 생성하고 연결한다.

명령은 VDOM 객체를 직접 참조한다. Patch 시작 시 유지 노드의 실제 DOM은 이전 VDOM의 `dom`으로 찾으며, insert/replace 노드의 `dom`은 null이다. 부모·기준 형제의 실제 DOM 참조도 Patch에서 해석한다. 이 참조는 편집기나 파싱용 임시 DOM을 가리키지 않는다.
`before === null`은 맨 뒤를 뜻한다. insert와 move는 `insertBefore()`로 위치를 적용하며, update와 move는 기존 DOM 객체를 유지한다.

유지·이동·수정 노드의 연결은 `diff()`가 수행한다. `renderNode()`는 insert/replace의 새 실제 DOM을 생성할 때 해당 다음 VDOM 노드와 하위 트리에 연결한다.

변경 명령이 없는 노드와 그 하위 트리도 diff의 연결 대상이다. Patch 성공 시 `VRoot`를 포함한 다음 VDOM 전체가 실제 DOM을 가리켜야 한다. 참조를 연결하려고 변경 없는 실제 DOM을 재생성하지 않는다.

applyPatch 실행 중 예외가 발생하면 applyPatch 자체는 롤백하지 않는다. 호출자인 handlePatch가 현재 이력 데이터로 실제 영역만 복원하고, 다음 VDOM은 현재 상태로 사용하지 않는다.

## 4. diff() → 변경 명령 배열

```text
diff(prevRoot, nextRoot)
├─ nextRoot.dom = prevRoot.dom        VRoot 참조 연결
├─ compareNode(prev, next)
│  ├─ 노드 종류·태그 변경 → replace (제자리 교체, 이동은 move, DOM 연결 안 함)
│  ├─ 같은 type/tag → linkNode()       prev.dom을 next.dom에 연결
│  ├─ 텍스트 변경 → update
│  ├─ diffAttributes() → update의 속성 데이터
│  ├─ diffProperties() → update의 properties 데이터
│  └─ diffChildren()
│     ├─ matchChildren()               key attribute 우선, key 없는 노드는 부모 안 순서로 대응
│     ├─ 새 노드 → insert
│     ├─ 사라진 노드 → remove
│     ├─ 식별된 기존 형제 순서 변경 → move
│     └─ 대응하는 자식 → compareNode() 재귀
└─ orderChanges() → 적용 순서가 보장된 명령 배열
```

Diff는 실제 DOM과 이전 VDOM을 수정하지 않는다. attributes와 properties는 필드 이름·값을 비교한다. 변경이 없으면 빈 배열을 반환한다. Diff 종료 시 `VRoot`와 유지·이동·수정 노드의 `dom`은 실제 DOM에 연결되고, insert/replace 노드의 `dom`은 null로 남는다. 즉 Diff는 VDOM 비교와 유지 노드의 실제 DOM 참조 연결을 함께 담당한다.

### 노드 식별 규칙

요소의 `attributes`에 이름이 `key`인 속성이 있으면 그 값을 해당 요소의 식별자로 사용한다. 예: `<li key="a">`.
key가 없는 요소와 텍스트 노드는 같은 부모 안의 자식 순서로 대응한다. key가 있는 요소는 위치가 바뀌어도 key로 대응한다. keyed/unkeyed가 섞여도 각각의 규칙을 적용한다.
코드 파싱 때마다 임시 DOM 객체가 새로 생성되므로, 임시 DOM 객체의 직접 참조로 이전·다음 노드를 식별하지 않는다.
key가 없는 노드의 순서 변경은 move로 보장하지 않는다. 같은 부모 안의 중복 key, 같은 key의 태그 변경, key 값 자체가 바뀌는 경우의 대응은 아직 확정하지 않는다. 이 항목은 테스트 문서의 CONF-03에 대응한다.

### 명령 적용 순서

`orderChanges()`는 Patch에서 부모와 기준 형제가 생성된 뒤 사용되도록 명령 순서를 정한다. 제거된 노드를 이후 명령의 기준으로 사용하지 않으며, 교체·제거되는 하위 트리에 중복 명령을 만들지 않는다. replace는 제자리 교체이므로 위치 변경이 필요하면 move 명령을 별도로 정렬한다. 정렬 자체는 DOM을 생성하거나 다음 VDOM에 실제 DOM 참조를 연결하지 않는다.

## 5. HTML → 임시 DOM → VDOM

```text
readEditorHTML()                        편집기의 HTML 문자열 읽기
└─ parseHTML(html)                      화면에 삽입하지 않는 임시 DOM 트리
   └─ createSnapshot(parsedRoot)
      └─ snapshotNode(domNode)
         ├─ 주석 노드 → 제외
         ├─ readNodeData()              nodeType, tagName, nodeValue
         ├─ readAttributes()            속성 배열 복사
         ├─ readProperties()            propertySchema의 현재 값 복사
         ├─ dom = null                  기존·새 노드 모두 실제 DOM 참조 없음
         └─ 자식 snapshotNode() 재귀    childNodes 순서 보존
```

`parseHTML()`은 `<template>` 같은 브라우저 파싱 기능을 사용한다. 임시 DOM은 VDOM 데이터 추출용이며 실제 화면에 직접 삽입하지 않는다. 브라우저가 보정한 HTML 구조를 기준으로 스냅샷을 만든다.

VDOM은 `VRoot`와 `VNode`로 구성한다. `VRoot`는 `childNodes`와 `dom`만 가지며, `VNode`는 `nodeType`, `tagName`, `attributes`, `nodeValue`, `childNodes`, `properties`, `dom`을 가진다. Snapshot에서는 `VRoot`와 모든 `VNode`의 `dom`을 null로 둔다. 이전 VDOM이나 임시 DOM 참조를 실제 DOM 참조로 연결하지 않는다. 요소의 `key` attribute는 `attributes`에서 제거하지 않고 실제 DOM에도 렌더링하며, 같은 attribute 값을 식별자로 사용한다. key가 없는 요소와 텍스트 노드는 부모 안의 자식 순서로 대응한다.

### 입력·선택 상태

`readProperties()`는 기존 `propertySchema`를 따라 파싱된 요소의 값을 읽는다. HTML의 value·checked·selected 속성과 TEXTAREA 내용이 초기 상태의 입력값이 된다.
실제 화면에서 사용자가 바꾼 입력 상태는 HTML 원문에 자동 반영되지 않으며, 코드 편집기에서 만드는 스냅샷에는 포함되지 않는다.
`indeterminate`는 HTML만으로 지정할 수 없어 기본값을 읽는다. 실제 화면의 입력까지 이력에 담는 양방향 동기화는 이 흐름에 포함하지 않는다.

## 6. 초기 렌더링·이력 복원

```text
initializeDOM(sampleHTML)
├─ createEmptyVDOM(actualRoot)          자식 없는 VRoot, 실제 컨테이너 연결
├─ parseHTML(sampleHTML)                샘플 코드 → 임시 DOM
├─ createSnapshot(parsedRoot)           샘플 VDOM 전체의 dom은 null
├─ diff(emptyVDOM, sampleVDOM)
├─ applyPatch()                         실제 화면 생성·샘플 VDOM 전체의 dom 연결
├─ writeEditorHTML(sampleHTML)          편집기에 HTML 문자열 표시
└─ saveHistory.set(sampleVDOM, sampleHTML)

restoreSnapshot(entry, actualRoot, options = {})
├─ root = cloneSnapshotData(entry.vdom)  데이터 복사, dom 참조 초기화
├─ renderChildren(root, actualRoot)      실제 영역 내용 교체·dom 재연결
├─ if (options.restoreEditor !== false) writeEditorHTML(entry.html)
└─ return root

renderChildren(root, actualRoot)
├─ 실제 영역 컨테이너 유지, 기존 자식 제거
└─ 각 자식 renderNode() 후 순서대로 삽입

renderNode(vnode)
├─ 요소 또는 텍스트 노드 생성
├─ vnode.dom에 생성한 실제 DOM 연결
├─ 속성 적용
├─ 자식 renderNode() 재귀·삽입
└─ properties 적용
```

`restoreSnapshot()`의 `restoreEditor` 기본값은 true다. applyPatch 실패 복구는 false로 호출해 실제 영역만 복원하고 편집기 HTML은 유지한다.

초기화는 빈 이전 VDOM을 비교 기준으로 사용하므로 Diff가 연결할 유지 노드가 없고, 샘플 `VRoot`와 모든 `VNode`의 `dom`은 Patch 성공 후에 전체 연결된다. 빈 이전 VDOM의 `VRoot`는 작업 대상인 실제 컨테이너를 가리킨다.

초기 실제 영역은 비어 있다는 전제다. 이미 샘플 DOM이 있는 페이지에서는 이를 빈 루트로 간주하면 중복 생성되므로 초기화 경로를 혼용하지 않는다.
최상위 VDOM은 실제 영역 컨테이너에 대응하는 `VRoot`이며, 컨테이너 자체의 태그·속성은 Diff하지 않는다. 이력 복원 시 `VRoot.dom`도 현재 `actualRoot`로 연결한다.

코드 편집기는 HTML 문자열을 표시한다. `renderChildren()`이나 `renderNode()`로 편집기 내부에 샘플 DOM을 만들지 않는다. 이력 복원은 실제 영역을 전체 렌더링하고 DOM 참조를 새로 연결한다.

SELECT의 상태는 OPTION 생성 후 적용한다. 다중 선택은 OPTION.selected를 기준으로 복원하며, file INPUT의 비어 있지 않은 value는 복원할 수 없다.

## 7. History

| 함수 | 역할 |
| --- | --- |
| `createHistory()` | 저장 배열·현재 위치·현재 연결된 VDOM을 클로저 안에서 관리 |
| `saveHistory.get()` | 현재 위치의 상태에 대응하며 실제 DOM에 연결된 VDOM 반환 |
| `saveHistory.set(vdom, html)` | 현재 위치 뒤 이력 제거, VDOM 데이터와 코드 원문 저장, 현재 위치·VDOM 갱신 |
| `saveHistory.peek(direction)` | 이동할 위치의 `{ vdom, html }` 조회. `0`이면 현재 위치, 범위 밖이면 null |
| `saveHistory.move(direction, liveVDOM)` | 새 이력 추가 없이 현재 위치와 연결된 VDOM 갱신. `0`이면 위치 이동 없이 live VDOM만 교체 |

저장 배열에는 DOM 참조를 제외한 VDOM 데이터 복사본과 HTML 원문을 보관한다. 원문을 함께 저장해 들여쓰기 등 코드 표현도 복원한다. 현재 렌더링용 VDOM만 DOM 참조를 포함하고, 과거 데이터는 수정하지 않는다.
applyPatch 실패 복구는 `peek(0)`으로 현재 이력 데이터를 읽고, `restoreSnapshot(..., { restoreEditor: false })`로 실제 영역만 복원한 뒤 `move(0, liveVDOM)`으로 live VDOM만 교체한다.
현재 위치와 렌더링용 VDOM의 갱신은 History 내부에서 함께 처리한다. 새 상태 저장은 Patch 성공으로 다음 VDOM의 참조 연결이 완성된 뒤 수행한다. 변경 없는 경우에는 Diff가 참조를 연결한 다음 VDOM으로 현재 상태를 바꾸지 않는다. 속성 나열 순서처럼 DOM 데이터가 같으면 새 이력을 추가하지 않으며, 실제 텍스트 노드가 달라지는 공백 변경은 별도로 비교한다.

## 8. 테스트 연결

| 함수 영역 | 검증 케이스 |
| --- | --- |
| 초기화·버튼 연결 | INIT-01–INIT-02 |
| HTML 읽기·파싱 | HTML-01–HTML-03 |
| 스냅샷 데이터·실제 DOM 참조 없음 | SNAP-01–SNAP-06 |
| 순수한 변경 계산 | DIFF-01–DIFF-09 |
| 명령 의존성·중복 방지 | ORDER-01–ORDER-05 |
| 유지 노드 참조 연결 | DIFF-01–DIFF-09 |
| 실제 DOM 연산·새 노드 참조 연결 | PATCH-01–PATCH-08 |
| 단계별·연속 Patch·변경 없음·실패 복구 | FLOW-01–FLOW-05 |
| History 저장·복원·복원 후 Patch | HIST-01–HIST-06 |
| 중복 key·key 변경·태그 변경 규칙 | CONF-03 |

## 9. Data Structures

### 9.1 VDOM

요소·텍스트 노드는 `VNode`, 실제 영역 컨테이너에 대응하는 논리적 루트는 `VRoot`로 분리한다.

| VNode 필드 | 내용 |
| --- | --- |
| `nodeType` | 노드 종류 정수. 요소 1, 텍스트 3을 지원하고 주석 8은 제외 |
| `tagName` | 요소 태그 이름. 텍스트 노드는 null |
| `attributes` | `{ name, value }` 원소의 배열. 텍스트 노드는 빈 배열 |
| `nodeValue` | 텍스트 노드의 문자열 값. 요소 노드는 null |
| `childNodes` | 자식 `VNode` 배열. 순서 보존 |
| `properties` | 스키마에 지정된 DOM 프로퍼티의 현재 값 객체 |
| `dom` | 실제 DOM 객체 직접 참조. 다음 VDOM의 `VNode`는 Snapshot 종료 시 null이고, Diff 종료 시 유지·이동·수정 노드는 연결되며 insert/replace 노드는 Patch 성공 후 연결 |

| VRoot 필드 | 내용 |
| --- | --- |
| `childNodes` | 실제 영역 컨테이너의 자식 `VNode` 배열. 순서 보존 |
| `dom` | 실제 영역 컨테이너 참조. Snapshot에서는 null, Diff·초기화·이력 복원 후에는 `actualRoot` |

`VRoot`는 컨테이너 자체의 태그·속성을 가지지 않으며 Diff 대상이 아니다.

속성은 이름·값 인터페이스로 처리한다. 신규 HTML 속성이 추가되어도 Diff·Patch에 속성별 전용 로직을 추가하지 않는다.

```js
const propertySchema = {
  INPUT: ["value", "checked", "indeterminate"],
  TEXTAREA: ["value"],
  SELECT: ["value"],
  OPTION: ["selected"]
};
```

- 스냅샷은 현재 값을 `attributes`와 별도로 `properties`에 저장한다.
- Diff는 `properties`의 변경값을 찾아 `update` 명령에 담는다.
- 렌더링·Patch·이력 복원 시 해당 값을 실제 DOM 프로퍼티에 적용한다.

요소의 `key` attribute를 식별자로 사용한다. `key`는 `attributes`에서 제거하지 않고 실제 DOM에도 렌더링한다. key가 없는 요소와 텍스트 노드는 부모 안의 자식 순서로 대응한다. 편집기의 HTML 원문은 History의 html로 함께 저장하며 VDOM의 실제 DOM 참조와 구분한다.

### 9.2 Diff 명령

`diff()`는 아래 명령들의 배열을 반환한다.
예시의 `"<...>"`는 VDOM 객체 참조를 표시하는 자리표시자다. 실제 실행에서는 문자열이 아닌 객체 직접 참조를 사용한다. 기존 변경 대상은 이전 VDOM으로 찾고, 삽입·교체할 node는 다음 VDOM에 속한다. 유지·이동 노드의 실제 DOM 참조는 Diff가 연결하고, 삽입·교체 노드의 parent·before는 Patch에서 해석한다. root-level insert·move의 `parent`는 `VRoot`다.

변경 명령 배열과 별개로, Diff는 변경 없는 유지 노드를 포함한 다음 VDOM의 참조 연결을 완료하고, Patch는 삽입·교체 노드의 참조 연결을 완료한다. `applyPatch(prevRoot, nextRoot, changes)`는 완성된 `nextRoot`를 반환하며, 연결 역할은 `p1_decisions.md`의 P1-PATCH-LINK-02를 따른다.

#### replace

`target`을 제자리에서 새 `node`로 교체한다. 위치 이동이 필요하면 `move` 명령을 별도로 만든다.

```json
{
  "type": "replace",
  "target": "<기존 VDOM 객체>",
  "node": "<새 VDOM 객체>"
}
```

#### update — 텍스트

`target` 텍스트 노드의 값을 변경한다.

```json
{
  "type": "update",
  "target": "<기존 텍스트 VDOM 객체>",
  "data": {
    "nodeValue": "새 텍스트"
  }
}
```

#### update — 속성

`setAttributes`는 추가·변경할 속성, `removeAttributes`는 삭제할 속성 이름이다. 해당 작업이 없으면 빈 배열을 사용한다.

```json
{
  "type": "update",
  "target": "<기존 요소 VDOM 객체>",
  "data": {
    "setAttributes": [
      { "name": "class", "value": "active" }
    ],
    "removeAttributes": ["title"]
  }
}
```

#### update — 입력·선택 상태

변경된 값을 실제 DOM 프로퍼티에 적용한다.

```json
{
  "type": "update",
  "target": "<기존 요소 VDOM 객체>",
  "data": {
    "properties": {
      "value": "사용자 입력"
    }
  }
}
```

#### insert

`parent`의 자식으로 새 `node`를 `before` 앞에 삽입한다. `before`가 `null`이면 맨 뒤에 삽입한다.

```json
{
  "type": "insert",
  "node": "<새 VDOM 객체>",
  "parent": "<부모 VDOM 객체: VNode 또는 VRoot>",
  "before": "<기준 형제 VDOM 객체 또는 null>"
}
```

#### remove

`target`을 제거한다.

```json
{
  "type": "remove",
  "target": "<기존 VDOM 객체>"
}
```

#### move

기존 `target`을 `parent`의 자식인 `before` 앞으로 이동한다. `before`가 `null`이면 맨 뒤로 이동한다.

```json
{
  "type": "move",
  "target": "<기존 VDOM 객체>",
  "parent": "<부모 VDOM 객체: VNode 또는 VRoot>",
  "before": "<기준 형제 VDOM 객체 또는 null>"
}
```
