# Phase 1 결정 기록

## P1-SNAP-01 — Snapshot 데이터 변환과 검증 범위

- **상태:** 구현·단위 검증 완료 — 실제 Diff·Patch 통합은 별도
- **날짜:** 2026-11-07
- **합의:** 기존 VNode·VRoot·propertySchema 계약으로 SNAP-01~06 테스트 함수 6개를 먼저 작성하고 실패 확인 후 구현한다. SNAP-06의 입력 4종은 한 테스트 안에서 각각 검증한다. HTML-03도 같은 실제 Snapshot 구현으로 재검증한다. INIT mock과 실제 Diff·Patch 연결은 이번에 변경하지 않는다.
- **명세 확인:** SNAP-01은 `<div class="box">A<span>B</span>C</div>` 구조·종류·속성·자식 순서, SNAP-02는 `<div>A<!-- 메모 --><span>B</span></div>`의 주석 제외, SNAP-03은 `<p class="a">A</p>` 원본 DOM·편집기 수정 후 복사 데이터 유지, SNAP-04는 `<p id="title" class="a" data-extra="x" title="설명">A</p>` 속성 복사와 별도 key 보존, SNAP-05는 이전 `<p>A</p>`의 데이터·참조 유지와 다음 `<p>B</p><span>C</span>` 전체의 `dom: null`, SNAP-06은 명세의 INPUT 2종·TEXTAREA·SELECT/OPTION properties를 검증한다.
- **실행 경계:** 실제 `parseHTML()` → `createSnapshot()`까지만 실행한다. Snapshot 반환 직후 검증하고 SNAP-03은 그 반환 데이터에 원본 DOM·편집기 변경이 반영되지 않는지 확인한다. 기존 실제 화면·History 유지 조건은 필요한 사전 상태와 승인된 History mock으로 확인한다.
- **구현:** `src/vdom/create.ts`에 `createSnapshot`, `snapshotNode`, `readAttributes`, `readProperties`를 추가했다. 지원하는 요소·텍스트를 재귀 복사하고 주석은 제외한다. 요소 tagName은 대문자로 저장하며 루트와 모든 노드의 `dom`은 null이다. 속성은 key를 포함해 새 이름·값 객체로 복사하고, properties는 기존 스키마의 현재 값만 읽는다.
- **구현 선택·이유:** 루트와 요소의 자식 순회를 내부 `snapshotChildren()`으로 공유해 같은 순서·주석 제외 규칙을 적용한다. 노드 종류는 `nodeType`으로 확인해 파싱용 문서에서 나온 노드도 처리한다. 일반 속성을 열거하고 스키마의 프로퍼티만 조회해 속성별 분기나 실제 DOM 변경을 추가하지 않는다. 기존 공개 타입·함수 계약은 유지한다.
- **실패 확인:** 테스트를 먼저 작성해 6개 모두 `createSnapshot is not a function`으로 대상 호출에서 중단되는 것을 확인했다. 이는 assertion 실패와 구분한다. 실제 구현 후 동일한 기대 결과를 유지하며 6개 모두 통과했다.
- **최종 검증:** `npm run check`에서 타입 검사와 전체 13개 테스트가 통과했다. SNAP은 테스트 함수 6개이며 SNAP-06 안에서 입력 4종을 검증한다. 보류했던 HTML-03도 빈 VRoot·기존 화면·현재 VDOM·History mock 유지 assertion까지 통과했다. `npm run build`도 통과했다.
- **검증 한계:** 실제 Snapshot 구현을 검증했다. Snapshot 테스트의 History 유지 조건은 승인된 mock으로 확인하며 실제 History 알고리즘은 HIST 범위다. INIT은 계속 mock 기반이고 `main.ts`의 실제 의존 함수 조립은 미완료 상태다.
- **문서 범위:** 결정 기록·테스트 진행표만 갱신한다. 수정 제한된 PRD·함수 흐름·테스트 케이스·인터페이스 문서는 변경하지 않는다.

## P1-HTML-01 — HTML 테스트 범위와 편집기 읽기 계약

- **상태:** accepted — 사용자 합의. 테스트 결과는 별도 기록한다.
- **날짜:** 2026-11-07
- **결정:** `readEditorHTML(editor: HTMLTextAreaElement): string`으로 편집기 요소를 인자로 전달한다. HTML-01·02는 테스트를 먼저 작성해 실패를 확인한 뒤 구현한다. HTML-03은 테스트만 먼저 작성하고 Snapshot 구현 후 통과를 확인한다. HTML 구현 당시에는 INIT의 연결 대기 주석을 유지했으며, 이후 INIT 변경은 P1-INIT-TDD-01을 따른다.
- **명세 확인:** HTML-01은 `readEditorHTML(editor)` 단독으로 `<div>\n  <p>A</p>\n</div>`의 실제 줄바꿈·들여쓰기를 그대로 읽는다. HTML-02는 `parseHTML()` 단독으로 `<section class="box"><p>A</p></section><span>B</span>`를 파싱하고 기존 `<p>기존</p>` 화면을 유지한다. HTML-03은 기존 실제 영역·현재 VDOM에 자식이 있는 상태에서 `parseHTML("")` → `createSnapshot()`까지만 실행하고 `{ childNodes: [], dom: null }`과 기존 화면·상태 유지를 검증한다.
- **검증 시점:** 각 대상 함수 반환 직후. 대상 함수 실행 중에는 Diff·Patch·렌더링·이력 저장을 호출하지 않는다. History 유지 조건 검증을 위한 사전 상태 준비에서는 아래 mock 초기화를 수행한다.
- **구현:** `src/app/editor.ts`는 `editor.value`를 그대로 반환한다. `src/vdom/create.ts`의 `parseHTML()`은 화면에 붙이지 않은 `<template>`에 HTML을 파싱하고 `content`를 반환한다. HTML 구현 당시 보류한 `createSnapshot()`은 이후 P1-SNAP-01에서 실제 구현했다.
- **실패 확인:** HTML-01은 구현 파일 부재로 테스트 수집이 중단됐고, HTML-02는 `parseHTML is not a function`으로 호출 시 중단됐다. 둘 다 assertion 실패가 아닌 미구현 오류임을 구분한다. 구현 후 두 테스트의 assertion은 통과했다.
- **보류 해소:** HTML-03은 최초에 `createSnapshot(parseHTML(''))` 호출에서 중단됐으나, P1-SNAP-01의 실제 Snapshot 구현 후 기존 assertion을 그대로 실행해 통과했다. 미구현 export 참조로 발생하던 TS2305도 해소됐다. skip이나 기대값 변경은 하지 않았다.
- **History mock 검증:** 사용자 요청에 따라 `tests/helpers/html.context.ts`에서 실제 `init()`에 History mock과 초기화용 Snapshot·Diff·Patch 대역을 주입해 `<p>기존</p>` 사전 상태를 준비한다. 준비 단계의 저장 호출 1회를 기준으로, 대상 함수 실행 후 `set` 호출 기록이 추가·변경되지 않고 `move`가 호출되지 않았는지 확인한다. mock의 `get()`이 반환하는 현재 VDOM의 데이터·DOM 참조 유지도 검사한다.
- **선택 이유:** 앱과 연결되지 않은 별도 mock을 확인하는 대신, 초기화에 실제 전달한 History mock을 사용한다. mock은 조회값과 호출 기록만 제공하며 이력 복사·저장 배열·위치 이동 알고리즘을 구현하지 않는다. 이력 자체의 정확성은 HIST 범위로 남긴다.
- **검증 한계:** HTML-01~03 모두 기존 화면·현재 VDOM·History mock 유지 assertion이 통과했다. 실제 History 모듈의 데이터 보존·복원 검증은 HIST 및 통합 테스트에서 수행한다.
- **최종 실행:** Snapshot 구현 후 HTML 3개 모두 통과했고, 전체 13개 테스트와 타입 검사도 통과했다. 결과는 P1-SNAP-01과 테스트 진행표를 따른다.
- **영향 범위:** 편집기 읽기, HTML 파싱, HTML-03 테스트 및 관련 명세·진행표. `writeEditorHTML()` 계약은 이번에 확정하지 않는다.

## P1-INIT-TDD-01 — INIT 함수 분리와 mock 기반 단위 검증

- **상태:** 단위 검증 통과 — 실제 함수 통합 검증은 대기
- **날짜:** 2026-11-07
- **변경된 합의:** 이전의 의존 함수 연결 대기·주석 처리 방식에서, 사용자 요청으로 초기화 함수를 분리하고 mock을 주입하는 방식으로 변경한다. 실제 History 모듈은 이번에 구현하지 않는다. FLOW-01은 계속 보류한다.
- **공개 경계:** `createInitializer(elements, history, dependencies)`가 `initializeDOM(sampleHTML): void`를 반환한다. INIT-01은 이 함수에 명세의 `<section><p>A</p></section>`을 직접 전달한다. `init(dependencies)`도 같은 팩터리로 만든 초기화 함수를 호출한다.
- **구현:** 요소 조회 → History 생성 → 샘플 확보 → 초기화 → 핸들러 생성·버튼 연결 → 현재 VDOM 조회 순서다. 초기화는 빈 VDOM 생성 → 파싱 → Snapshot → Diff → Patch → 편집기 표시 → 첫 이력 저장을 수행한다. 임시 빈 루트 반환과 기존 연결 대기 주석은 제거했다.
- **주입 계약:** `InitializerDependencies`는 `parseHTML`, `createSnapshot`, `diff`, `applyPatch`를 제공한다. `InitDependencies`는 여기에 `createHistory`, `getSampleHTML`, `createHandlers`를 추가한다. `InitializationHistory`는 초기화에서 사용하는 `set(vdom, html)`·`get()`만 표현하며 History 전체 API·저장 방식·빈 상태 정책을 확정하지 않는다.
- **핸들러 경계:** `createHandlers(elements, history)`가 반환한 `handlePatch`·`handleHistoryMove`를 `bindEvents()`로 연결한다. 이벤트 연결 함수는 알고리즘·이력 복원 로직을 구현하지 않는다.
- **구현 선택:** `init()`에 의존 함수 없이 진입하면 미연결 오류를 발생시킨다. 실제 의존성이 없는데 초기화 완료로 보이는 빈 루트를 반환하지 않기 위해서다. `src/main.ts`는 아직 인자 없는 `init()` 호출이므로 현재 기본 페이지 실행은 이 오류에서 중단된다. 실제 앱 연결이 완료된 상태가 아니다.
- **테스트:** `tests/unit/app.init.test.ts`는 INIT-01 2개·INIT-02 1개로 총 3개다. 파싱은 실제 `parseHTML`을 `vi.fn`으로 감싸고, Snapshot·Diff·Patch·History·이벤트 핸들러는 테스트 파일의 mock을 사용한다. 테스트 대역은 앱 런타임에 포함하지 않는다.
- **검증 내용:** INIT-01은 인자 전달·빈 비교 기준·Snapshot/Diff 시점의 참조 미연결·Patch 후 전체 참조·편집기 원문·첫 저장 1회·컨테이너 유지·샘플 중복 방지를 확인한다. INIT-02는 클릭 전 첫 이력, Patch 콜백 1회·추가 저장 1회, 뒤로 -1·앞으로 1 콜백 각 1회와 이동 시 추가 저장 없음을 확인한다.
- **실패 확인:** 테스트를 먼저 작성했을 때는 `initialize` 모듈 부재로 수집이 중단됐다. 팩터리 구현 후 INIT-01 2개는 통과했고, INIT-02는 `createHistory` 호출 0회로 assertion이 실패했다. `init()`과 버튼 연결 구현 후 INIT 3개가 통과했다.
- **검증 한계:** mock Patch가 테스트용 DOM을 만들고 mock History가 저장 호출을 기록한다. 실제 변경 명령 계산·DOM 연산 알고리즘·이력 데이터 복사·화면 복원·실제 핸들러의 저장 횟수를 검증한 것은 아니다. 이 부분은 실제 함수 통합 테스트로 확인한다.
- **Patch 호출:** `applyPatch(prevRoot, nextRoot, changes)`는 현재 연결용 초안이며 반환값은 사용하지 않는다. `P1-PATCH-LINK-01`의 최종 Patch 인자·반환 계약은 pending으로 유지한다.
- **영향 범위:** `src/app/initialize.ts`, `src/app/init.ts`, `tests/unit/app.init.test.ts`와 관련 PRD·함수 흐름·인터페이스·테스트 명세·진행표.

### 통합 테스트 전 실제 함수 연결 위치

이제 주석 해제 대신 `init(dependencies)`에 실제 구현을 주입한다. 테스트 파일의 mock을 앱에 복사하지 않는다.

| 주입 위치 | 실제로 연결할 함수 | 역할 |
| --- | --- | --- |
| `dependencies.parseHTML` | `src/vdom/create.ts`의 `parseHTML` | HTML 파싱. 실제 구현 있음 |
| `dependencies.createSnapshot` | Snapshot 구현 | DOM 참조 없는 VDOM 생성. 구현 대기 |
| `dependencies.diff` | 팀원의 Diff 구현 | 이전·다음 VDOM의 변경 명령 계산 |
| `dependencies.applyPatch` | 팀원의 Patch 구현 | 실제 DOM 반영과 다음 VDOM 전체 참조 연결 |
| `dependencies.createHistory` | 실제 History 생성 함수 | 저장 데이터와 현재 live VDOM 관리. 구현 대기 |
| `dependencies.getSampleHTML` | 기존 `SAMPLE_HTML`을 반환하는 함수 | 초기 샘플 원문 공급 |
| `dependencies.createHandlers` | 실제 `handlePatch`·`handleHistoryMove`를 만드는 함수 | 전달받은 요소·History로 변경 처리·화면 복원 |

- 연결 진입점은 `src/main.ts`의 `init()` 호출이다. 실제 함수를 조립해 `init(dependencies)`로 전달한다.
- 팩터리의 빈 비교 VDOM 생성·편집기 표시·첫 이력 저장과 `bindEvents()`의 버튼 연결은 이미 실행 코드다. 주석 해제나 임시 루트 제거 작업은 더 이상 필요하지 않다.
- Patch는 `P1-PATCH-LINK-01` 확정 후 실제 계약에 맞춘다. 완성된 VDOM을 반환하는 계약이면 초기화의 저장 대상도 그 계약에 맞춰 연결한다.
- 통합 테스트는 실제 VDOM 생성·Diff·Patch·History·핸들러를 사용한다. Snapshot/Diff 후 전체 `dom: null`, Patch 후 전체 참조 연결, 초기 이력 1개, 실제 버튼 변경·복원과 이력 추가 횟수를 확인한다.

## P1-VDOM-PARENT-01 — 명령의 부모 타입에 VRoot 반영

- **상태:** accepted
- **날짜:** 2026-11-07
- **결정:** insert·move 명령 및 관련 함수 설명의 `parent`를 `VNode | VRoot`로 동기화한다. 최상위 자식의 부모는 다음 `VRoot`다.
- **이유:** 기존 VRoot 도입 결정과 최상위 삽입 시나리오를 타입 계약에 일치시킨다. 사용자가 부모 타입과 관련 공용 문서의 동기화를 승인했다.
- **영향 범위:** `src/vdom/types.ts`, `p1_interfaces.md`, `p1_function_flow.md`, `p1_prd.md`, `p1_test_cases.md`, 개인 Diff 작업 문서.
- **유지:** 명령의 의미·노드 참조 방향과 기존 테스트 기대 결과, Patch의 미확정 내부 연결 방식은 변경하지 않는다.

## P1-ROLLBACK-01 — applyPatch 실패 시 C1 복구

- **상태:** accepted
- **날짜:** 2026-11-07
- **결정:** `applyPatch()` 실행 중 예외가 발생하면 현재 이력 데이터로 실제 영역만 full render 복원하고, 편집기 HTML은 실패한 입력 그대로 유지한다. History는 저장·이동하지 않는다.
- **이유:** applyPatch가 중간에 실패하면 실제 DOM이 반쯤 변경된 상태로 남아 현재 live VDOM과 어긋난다. 현재 이력으로 복원하면 다음 Patch를 같은 편집 내용으로 재시도할 수 있다.
- **인터페이스:**
  - `saveHistory.peek(0)` — 현재 위치의 이력 데이터 `{ vdom, html }` 조회. 위치 이동 없음.
  - `saveHistory.move(0, liveVDOM)` — 위치 이동·이력 추가 없이 live VDOM만 교체.
  - `restoreSnapshot(entry, actualRoot, { restoreEditor: false })` — 실제 영역만 복원하고 편집기 HTML은 덮어쓰지 않음. `restoreEditor` 기본값은 true.
- **영향 범위:**
  - `p1_prd.md` §2 Patch, §3 applyPatch, §6 restoreSnapshot, §7 History, §8 테스트 연결
  - `p1_function_flow.md` §2 Patch, §3 applyPatch, §6 restoreSnapshot, §7 History, §8 테스트 연결
  - `p1_test_cases.md` FLOW-05 추가
- **미확정:** 복원 자체가 실패할 때의 오류 UI·재시작 정책, 사용자에게 오류를 표시하는 방식.
- **후속 확정:** `P1-RESTORE-01`에서 `restoreSnapshot(entry, actualRoot, { editor, restoreEditor: false })`의 editor 옵션과 editor 필수 검사 시점을 확정했다. 복원 성공 시 원래 Patch 오류를 rethrow하고, 복원 실패 시 원래 오류와 복원 오류를 `AggregateError`로 보존한다. UI·재시작 정책은 계속 미확정이다.

## P1-ENV-01 — Phase 1 구현·테스트 환경

- **상태:** accepted
- **날짜:** 2026-11-07
- **결정:** TypeScript strict, Vite, Vitest + jsdom으로 구현·테스트한다. Playwright는 사용하지 않는다. npm lockfile을 사용하고 앱 런타임 의존성은 추가하지 않는다.
- **이유:** VNode·DiffCommand 계약을 타입으로 고정하고, 브라우저와 유사한 DOM 환경에서 단위·통합 테스트를 실행하기 위해서다.
- **인터페이스:**
  - `npm run dev` — `main.html` 개발 서버
  - `npm run typecheck` — `tsc --noEmit`
  - `npm test` — Vitest + jsdom
  - `npm run check` — typecheck + test
  - `npm run build` — typecheck + Vite build
- **영향 범위:** `package.json`, `tsconfig.json`, `vite.config.ts`, `tests/`; 인터페이스는 `p1_interfaces.md`
- **미확정:** coverage 기준, mutation testing 도입 여부, 브라우저 기능 테스트를 수동으로만 할지 여부.

## P1-VDOM-ROOT-01 — 논리적 루트를 VRoot로 분리

- **상태:** accepted
- **날짜:** 2026-11-07
- **결정:** 요소·텍스트 노드는 `VNode`로, 실제 영역 컨테이너에 대응하는 논리적 루트는 `VRoot`로 분리한다.
- **이유:** 논리적 루트는 DOM의 Element나 Text가 아니므로 `nodeType: 1, tagName: null`로 표현하면 의미가 섞인다.
- **인터페이스:**
  - `interface VRoot { childNodes: VNode[]; dom: Element | null }`
  - `createEmptyVDOM(actualRoot): VRoot` — `{ childNodes: [], dom: actualRoot }`
  - `createSnapshot(parsedRoot): VRoot` — `{ childNodes: [...], dom: null }`
  - `diff(prevRoot: VRoot, nextRoot: VRoot): DiffCommand[]`
- **영향 범위:** `p1_prd.md` §3, §5, §6, §9.1; `p1_function_flow.md` §3, §5, §6; `p1_test_cases.md` §1, SNAP-05, PATCH-08
- **후속 결정:** `applyPatch(prevRoot, nextRoot, changes): VRoot`와 유지 노드 연결은 P1-PATCH-LINK-02로 확정했다. `VRoot`는 컨테이너 태그·속성을 Diff하지 않는다. 인터페이스는 `p1_interfaces.md`의 §1–§3을 따른다.

## P1-KEY-01 — key attribute를 실제 DOM에도 렌더링

- **상태:** accepted
- **날짜:** 2026-11-07
- **결정:** 요소의 `key` attribute는 `attributes`에서 제거하지 않고 실제 DOM에도 렌더링한다. `matchChildren()`은 같은 `attributes`의 `key` 값을 읽어 식별자로 사용한다.
- **이유:** 실제 DOM에서 key를 확인해 노드 대응·유지·교체 결과를 검증할 수 있고, 속성별 예외 로직 없이 일반 속성 처리와 일관성을 유지할 수 있다.
- **영향 범위:**
  - `p1_prd.md` §5, §9.1
  - `p1_function_flow.md` §5
  - `p1_test_cases.md` §1, SNAP-04, SNAP-05, PATCH-08
- **후속 확정:** 같은 부모 안의 중복 key, key 값 변경, 같은 key의 태그 변경 대응은 P1-CONF-03에서 확정한다.
- **후속 구현:** 2026-11-08 `matchChildren()`이 제거되고 `findChildMatches()`가 `key`를 읽는다. key 식별·보존 정책은 그대로 유지한다. 변경 이유와 범위는 P1-MATCH-REMOVE-01을 따른다.

## P1-UI-01 — main.html 좌우 2분할 화면과 초기 루트

- **상태:** accepted
- **날짜:** 2026-11-07
- **결정:** `main.html`을 Vite 진입점으로 사용한다. 화면은 좌우 2분할이며 왼쪽은 HTML 코드 편집기, 오른쪽은 실제 영역이다. 실제 영역 컨테이너는 `#actual`이다. Patch·뒤로·앞으로 버튼은 하단 푸터에 둔다. `init()`은 `createEmptyVDOM(#actual)`로 초기 `VRoot.dom`을 연결한다.
- **이유:** 편집기와 렌더링 결과를 동시에 비교하고, Patch·이력 이동을 한 곳에서 조작하기 위해서다.
- **인터페이스:**
  - `getElements(): { editor, actualRoot, patchButton, backButton, forwardButton }`
  - `init(dependencies?): { elements, root: VRoot }` — 의존 함수 주입은 P1-INIT-TDD-01에서 추가. 실제 호출에는 의존 함수가 필요하다.
- **영향 범위:** `main.html`, `src/styles/main.css`, `src/app/init.ts`; `p1_prd.md` §1; `p1_function_flow.md` §1
- **미확정:** 줄번호·문법 강조, 버튼 비활성화 UI, 오류 표시 방식.

## P1-PATCH-LINK-01 — 유지 노드의 실제 DOM 참조 연결 방식

- **상태:** superseded by P1-PATCH-LINK-02
- **날짜:** 2026-11-07
- **배경:** `diff()`는 변경 명령만 반환한다. Patch가 끝나면 다음 VDOM의 모든 노드가 실제 DOM을 가리켜야 하지만, 변경 없는 노드는 명령에 포함되지 않는다.
- **결정:** A안. `applyPatch(prevRoot, nextRoot, changes)`가 `matchChildren()`을 다시 실행해 유지·이동 노드에 `prev.dom`을 연결하고 완성된 `nextRoot`를 반환한다. `diff()`는 지금처럼 정렬된 명령 배열을 반환한다.
- **이유:** TC의 `diff()` 반환 계약을 바꾸지 않으면서, Diff와 Patch가 같은 key/keyless 매칭 규칙을 공유할 수 있다. WeakMap이나 배열의 숨은 메타데이터도 필요 없다.
- **인터페이스:** `p1_interfaces.md` §4–§6
  - `matchChildren(prevChildren, nextChildren): ChildMatchPlan` — 공유 모듈 `src/vdom/match.ts`
  - `applyPatch(prevRoot, nextRoot, changes): VRoot`
  - `linkMatchedDom(prevRoot, nextRoot): void` — 유지·이동 노드 연결
  - `assertAllLinked(root, actualRoot): void` — Patch 종료 검증
- **보정:** `VRoot` 분리에 따라 root-level `insert`·`move`의 `parent`는 `VNode | VRoot`다.
- **검토한 대안:** B안 — `diff()`가 `{ changes, matches }`를 반환한다. 매칭을 한 번만 하지만 기존 TC와 `diff()` 반환 계약을 바꿔야 해서 채택하지 않았다.
- **영향 범위:** `p1_prd.md` §3, §9.2; `p1_function_flow.md` §3; `p1_test_cases.md` PATCH-01–08; `src/vdom/patch.ts`, `src/vdom/match.ts`, `tests/unit/vdom.patch.test.ts`, `tests/unit/vdom.match.test.ts`

## P1-PATCH-LINK-02 — diff가 유지 노드의 실제 DOM 참조를 연결

- **상태:** accepted — 매칭·연결 유틸리티 부분은 P1-MATCH-REMOVE-01로 대체
- **날짜:** 2026-11-07
- **배경:** P1-PATCH-LINK-01 A안은 diff와 Patch가 `matchChildren()`을 각각 실행해 매칭을 두 번 수행했다. 매칭을 한 번만 수행하고 Patch는 새 노드 생성에 집중하도록 역할을 조정한다.
- **결정:** `diff()`가 매칭된 pair 중 type/tag가 같은 유지·이동·수정 노드와 `VRoot`에 `prev.dom`을 `next.dom`으로 연결한다. insert/replace 노드는 diff가 연결하지 않고 null로 둔다. `applyPatch(prevRoot, nextRoot, changes)`는 유지 노드가 이미 연결되었다고 가정하고, 변경 명령 적용과 insert/replace의 `renderNode()` 연결만 담당한다. `diff()`의 반환 계약은 `DiffCommand[]`를 유지한다.
- **이유:** 매칭을 한 번만 수행하면서 `diff()` 반환 타입과 `applyPatch()` 시그니처를 바꾸지 않는다. Patch는 실제 DOM 변경에 집중하고, diff가 비교·매칭 결과를 이용해 참조를 연결한다.
- **인터페이스:**
  - `diff(prevRoot, nextRoot): DiffCommand[]` — next VDOM의 유지 노드 `dom` 연결 포함
  - `applyPatch(prevRoot, nextRoot, changes): VRoot`
  - `linkNode(prev, next): boolean` — diff가 매칭 pair마다 호출하는 연결 단위. `src/vdom/link.ts`
  - `linkMatchedDom(prevRoot, nextRoot): void` — 전체 트리 연결 유틸리티. 테스트·독립 연결용
  - `assertAllLinked(root, actualRoot): void` — Patch 종료 검증
- **영향 범위:**
  - `p1_prd.md` §2 Patch, §3 applyPatch, §4 Diff, §6 초기화·복원, §7 History, §8 테스트 연결, §9
  - `p1_function_flow.md` §2 Patch, §3 applyPatch, §4 Diff, §6 초기화·복원, §7 History, §8 테스트 연결
  - `p1_interfaces.md` §1, §3, §4, §5, §6, §7
  - `p1_test_cases.md` §1, §4–§9
  - `src/vdom/link.ts`, `src/vdom/patch.ts`, `tests/unit/vdom.patch.test.ts`
- **대체:** P1-PATCH-LINK-01 A안을 대체한다.
- **미확정:** diff가 연결을 수행할 때 prev VDOM이 실제 DOM에 연결되어 있어야 한다는 전제의 오류 처리, diff 실패 시 부분 연결된 next VDOM의 폐기 정책.
- **개인 Diff 코드 반영:** `diff()`에서 루트 연결, `collectNodeChanges()`에서 `linkNode()` 호출과 기존 하위 함수 취합·재귀를 수행한다. `findChildMatches()`의 기존 결과를 사용하며 전체 재매칭은 추가하지 않는다. 사용자의 정정에 따라 임의 추가한 격리 테스트를 제거하고, 공용 명세 DIFF-01–DIFF-09의 관련 연결 검증만 기존 테스트에 반영했다. 미구현 하위 함수는 대체하지 않으며, 전체 테스트는 32개 통과·기존 20개 실패다. 상세 범위·검증 결과는 `p1_diff_notes.md` §14를 따른다.
- **후속 변경:** `matchChildren()`, `ChildMatchPlan`, `linkMatchedDom()`은 P1-MATCH-REMOVE-01로 제거됐다. Diff는 `findChildMatches()`의 대응을 재사용하고 `collectNodeChanges()`에서 `linkNode()`만 호출한다. `applyPatch()`와 `assertAllLinked()` 계약은 유지한다.

## P1-PROPERTY-SNAPSHOT-01 — DOM에서 읽은 프로퍼티 상태를 비교한다

- **상태:** accepted
- **결정:** DOM → VDOM 생성 시 `readProperties()`는 태그별 고정 `propertySchema`의 모든 항목을 파싱된 DOM에서 읽는다. HTML 속성이 없거나 값이 false·빈 문자열이어도 이름을 생략하지 않는다. Diff는 기본값 추측·재설정 로직을 추가하지 않는다.
- **이유:** HTML에서 checked 속성을 지운 새 DOM에도 checked 프로퍼티는 false로 존재한다. 생성기가 이를 수집하면 기존 true와의 비교로 `setProperties`가 계산되며 표준 DOM 프로퍼티 삭제가 필요하지 않다.
- **전제:** 같은 생성 규칙과 태그의 스냅샷을 비교한다. 생성기는 아직 미구현이므로 이 내용은 구현 완료 주장이 아닌 생성 계약이다.
- **유지:** 기존 `removeProperties` 타입과 함수 단위 추가·제거 시험은 삭제하지 않는다. 일반 데이터 레코드에서 이름이 사라진 것을 검출하는 계약과 실제 생성 경로의 도달 가능성을 구분한다.
- **제외:** 표준 DOM 프로퍼티에 대한 delete나 기본값 리셋을 구현하지 않는다. 새로운 생성 경로가 프로퍼티 이름 생략을 허용하게 되면 실제 적용 정책을 재논의한다.
- **영향 범위:** PRD, 함수 흐름, 인터페이스, 테스트 명세의 생성·프로퍼티 설명. 실행 코드와 기존 테스트 기대 결과는 변경하지 않는다.

## P1-MATCH-REMOVE-01 — matchChildren·linkMatchedDom 제거와 매칭 경로 단일화

- **상태:** accepted
- **날짜:** 2026-11-08
- **배경:** `src/vdom/match.ts`는 `upstream/patch`의 `a8794e1`에서 추가됐다. 이후 `upstream/chan95821-diff`의 실제 Diff는 `findChildMatches()`를 사용해 자식 대응을 계산하고, `collectNodeChanges()`에서 `linkNode()`만 호출한다. `matchChildren()`과 `linkMatchedDom()`은 실제 Diff 경로에서 호출되지 않고 Patch 테스트의 연결 준비에만 사용됐다.
- **결정:** `src/vdom/match.ts`와 `tests/unit/vdom.match.test.ts`를 삭제한다. `src/vdom/link.ts`에서는 `linkMatchedDom()`, `linkChildren()`, `matchChildren` import를 제거하고 `linkNode()`와 `isLinkablePair()`만 유지한다. Patch 단위 테스트가 Diff의 연결 상태를 준비할 때는 별도 매칭 유틸리티 대신 실제 `diff()`를 사용한다.
- **이유:** 실제 실행 경로와 테스트 전용 경로의 매칭 구현이 중복돼 있었다. 두 구현은 중복 key 처리도 달라 동일 입력에서 서로 다른 대응을 만들 수 있었다. 사용되지 않는 `matchChildren()`의 insert·remove·move 계산과 `linkMatchedDom()`의 전체 재매칭을 제거해 Diff의 `findChildMatches()` 한 경로로 통일한다.
- **인터페이스:**
  - Diff 매칭: `findChildMatches(prevChildren, nextChildren): ChildMatch[]` — `src/vdom/diff/findChildMatches.ts`
  - 노드 연결: `linkNode(prev, next): boolean`, `isLinkablePair(prev, next): boolean` — `src/vdom/link.ts`
  - Patch: `applyPatch(prevRoot, nextRoot, changes): VRoot`, `assertAllLinked(root, actualRoot): void` — `src/vdom/patch.ts`
- **제거:** `matchChildren()`, `ChildMatchPlan`, `MatchedPair`, `linkMatchedDom()`, `linkChildren()`.
- **유지:** key 식별·보존 정책(P1-KEY-01), Diff의 유지 노드 연결, insert/replace를 Patch가 연결하는 `P1-PATCH-LINK-02`의 나머지 계약. 중복 key와 key 변경 규칙은 P1-CONF-03에서 확정한다.
- **통합 검증:** `tests/integration/vdom-snapshot-diff-patch.test.ts`에 IT-01–IT-08을 추가했다. 실제 `parseHTML()`, `createSnapshot()`, `diff()`, `applyPatch()`만 연결하고, Snapshot의 참조 미연결, Diff 중 실제 DOM 불변, Diff 후 유지·이동 노드 연결, Patch 후 전체 연결, 연속 Patch의 DOM 객체 재사용을 확인했다. History와 편집기·버튼·handler는 이 결정의 검증 범위가 아니다.
- **검증 결과:** 2026-11-08 `npm run check`에서 18개 테스트 파일, 148개 통과·2개 skip·7개 todo였다. IT-01–IT-08은 모두 통과했고 `npm run build`도 통과했다. 초안 실행 중 발견한 실패는 테스트가 `ul`의 key를 실제 영역 루트의 key로 읽은 fixture 오류였으며, 구현 기대 결과는 변경하지 않았다.
- **영향 범위:** `src/vdom/link.ts`, 삭제된 `src/vdom/match.ts`, `tests/unit/vdom.patch.test.ts`, 삭제된 `tests/unit/vdom.match.test.ts`, `tests/integration/vdom-snapshot-diff-patch.test.ts`, `p1_interfaces.md` §4·§7, `p1_prd.md` §4·§8, `p1_function_flow.md` §4·§8, `p1_test_cases.md` §5–§8·§12, `p1_test_boards.md`.
- **검증 한계:** History·`handlePatch()`·`handleHistoryMove()`·브라우저 기능 흐름은 아직 구현되지 않아 검증하지 않았다. `main.ts`의 실제 의존성 조립도 이 결정의 범위가 아니다.

## P1-HISTORY-STATE-01 — History가 현재 live VDOM과 저장 항목을 함께 관리

- **상태:** accepted
- **날짜:** 2026-11-08
- **결정:** History가 `entries`, 현재 위치 `index`, 현재 화면에 연결된 `currentLive` VDOM을 함께 소유한다. `get()`은 currentLive, `peek(direction)`은 저장 entry의 읽기 전용 view, `set(vdom, html)`은 DOM 참조 없는 복사본을 저장하면서 currentLive를 전달받은 VDOM으로 교체하고, `move(direction, liveVDOM)`은 위치와 currentLive만 갱신한다.
- **이유:** 현재 위치와 currentLive를 한 객체가 관리해야 Patch 성공·이력 이동·실패 복구에서 두 상태가 어긋나지 않는다. `get()`을 History 밖으로 분리하면 소유자가 둘로 늘어 동기화 지점과 회귀 위험이 커진다.
- **저장 데이터:** `HistoryEntry`는 `{ vdom: VRoot, html: string }`이다. `vdom`은 `cloneSnapshotData()`로 복사하며 모든 `dom`은 null이다. properties는 현재 `propertySchema`가 만드는 원시값을 얕게 복사한다.
- **History API:** `get(): VRoot`, `set(vdom, html): void`, `peek(direction: -1|0|1): Readonly<HistoryEntry> | null`, `move(direction, liveVDOM): void`.
- **상한:** 페이지 세션 메모리 기준 최대 50개다. `set()`에서 미래 이력을 제거한 뒤 새 항목을 추가하고, 50개를 넘으면 가장 오래된 항목을 제거하며 index를 보정한다.
- **경계:** 첫 `set()` 전 `get()`은 오류, 범위 밖 `peek()`은 null, 범위 밖 `move()`는 완전한 no-op, `move(0, liveVDOM)`은 index를 유지하고 currentLive만 교체한다.
- **검증 계획:** HIST-01, HIST-03의 조회, HIST-04의 저장, HIST-07의 상한·퇴거. `peek`이 위치를 바꾸지 않고 저장 데이터를 수정하지 않는지 확인한다.
- **구현·검증 결과:** 2026-11-08 `src/app/history.ts`와 `cloneSnapshotData()`를 구현했다. `tests/unit/history.test.ts`에서 HIST-01·HIST-03·HIST-04·HIST-07, 빈 상태, 범위 밖 이동, `move(0)`, 저장 데이터 불변, 50개 퇴거를 검증했다. 전체 22개 테스트 파일 193개가 통과했고 skip·todo는 0개다.
- **미확정·한계:** 하나의 초대형 VDOM이 차지하는 메모리는 50개 상한만으로 제한되지 않는다. `history.set()` 실패를 applyPatch 실패와 동일한 복구 범위에 넣을지는 미확정이다.
- **영향 범위:** `src/app/history.ts`, `src/vdom/create.ts`, `src/app/initialize.ts`, `src/app/init.ts`, `p1_prd.md` §6·§7, `p1_function_flow.md` §6·§7, `p1_interfaces.md` §6·§7, `p1_test_cases.md` §9, `p1_test_boards.md`, `p1_history_handler_design.md`.
- **설계 기준:** `p1_history_handler_design.md`.

## P1-RESTORE-01 — 저장 항목을 실제 화면·편집기로 복원하는 경계

- **상태:** accepted
- **날짜:** 2026-11-08
- **결정:** `restoreSnapshot(entry, actualRoot, options?)`은 저장 entry를 직접 사용하지 않고 `cloneSnapshotData(entry.vdom)`으로 복사한 뒤 `renderChildren()`, `assertAllLinked()`, 선택적 `writeEditorHTML()`을 수행한다. 옵션은 `{ editor?: HTMLTextAreaElement; restoreEditor?: boolean }`이며 `restoreEditor` 기본값은 true다.
- **편집기 계약:** `restoreEditor !== false`이면 `editor`가 필수다. editor 존재 검사는 실제 영역을 렌더링하기 전에 수행한다. 그래야 editor 누락 오류로 실제 DOM만 먼저 바뀌는 상태를 피할 수 있다.
- **재사용:** 새 렌더러를 만들지 않는다. `renderChildren()`과 그 내부의 `renderNode()`, `assertAllLinked()`, `cloneSnapshotData()`, `writeEditorHTML()`을 조합한다.
- **실패 경계:** `restoreSnapshot()` 자체가 실패하면 이전 화면 보존을 보장하지 않는다. `renderChildren()`은 기존 자식을 먼저 제거한다. 복원 실패의 오류 UI·재시작 정책은 미확정이다.
- **applyPatch 실패 복구:** `peek(0)`의 entry가 null이면 불변식 위반으로 원래 오류를 전파한다. 복원이 성공하면 `move(0, liveVDOM)` 후 원래 Patch 오류를 rethrow한다. 복원도 실패하면 원래 Patch 오류와 복원 오류를 `AggregateError`로 함께 보존한다.
- **검증 계획:** HIST-02, HIST-05, FLOW-04·FLOW-05. `restoreEditor` true/false, editor 누락 사전 오류, entry 원본 불변, 전체 DOM 연결을 확인한다.
- **구현·검증 결과:** 2026-11-08 `src/app/restore.ts`, `writeEditorHTML()`, `handlers.ts`를 구현했다. `tests/unit/restore.test.ts`, `tests/integration/handlers.test.ts`, `tests/integration/app-flow.test.ts`에서 HIST-02·HIST-05, FLOW-01~05, editor 옵션, 누락 사전 오류, 부분 DOM 변경 후 복구·재시도를 검증했다. 전체 테스트 통과·skip/todo 0개, 실제 브라우저의 Patch·뒤로·앞으로 흐름도 확인했다.
- **영향 범위:** `src/app/restore.ts`, `src/app/editor.ts`, `src/app/handlers.ts`, `src/app/initialize.ts`, `p1_prd.md` §2·§6, `p1_function_flow.md` §2·§6, `p1_interfaces.md` §6, `p1_test_cases.md` FLOW·HIST, `p1_test_boards.md`, `p1_history_handler_design.md`.
- **설계 기준:** `p1_history_handler_design.md`.

## P1-CONF-03 — 중복 key·key 변경·같은 key 태그 변경 규칙

- **상태:** accepted
- **날짜:** 2026-11-08
- **결정:**
  - 같은 key + 같은 태그 → matched/update
  - 같은 key + 다른 태그 → replace
  - key 값 변경 → remove + insert
  - 같은 부모의 중복 key → key 대응에서 제외하고 keyless 순서 기반 대응 목록에 포함
- **이유:** key를 노드 정체성으로 사용하고, 다른 부모·이동·여러 노드 변경에도 일반적으로 동작하는 규칙을 유지하기 위해서다. 같은 key의 태그 변경은 같은 정체성의 제자리 교체로 표현하고, key 변경은 다른 노드로 본다. 중복 key는 사용자가 편집기에서 만들 수 있는 입력이므로 Patch를 중단하지 않고 순서 기반으로 완화한다.
- **중복 key의 정확한 의미:** 어느 한쪽 목록에서라도 중복된 key는 그 비교에서 key 식별자로 사용하지 않는다. 해당 노드들은 keyless 노드와 함께 각 목록의 출현 순서로 대응하며, 다른 고유 key의 대응은 유지한다. 원본 `attributes`의 key 속성은 삭제하지 않는다.
- **테스트 영향:** DIFF-04의 skip 조건을 해소할 수 있다. ORDER-04의 `key=d1` → `key=d2` 입력은 replace가 아니라 remove + insert를 기대하도록 수정한다. FLOW-02·HIST-05의 key 변경 “교체” 입력은 실제 명령이 remove + insert일 수 있음을 명시한다.
- **유지:** key 속성을 실제 DOM에 렌더링하는 P1-KEY-01, keyless 형제의 순서 대응, 기존 move 규칙.
- **검증 계획:** DIFF-04, ORDER-04, ORDER-05, FLOW-02, HIST-05. 부모 replace 자체는 DIFF-04·PATCH-04가 담당한다.
- **구현·검증 결과:** 2026-11-08 DIFF-04와 ORDER-04의 skip을 해소하고 key 변경 remove + insert 기대를 반영했다. ORDER-01~05 Patch 적용 5개와 MOVE-07 연계 2개 todo도 실제 Diff·orderChanges·applyPatch로 구현했다. 관련 67개 테스트가 통과했고 전체 테스트의 skip·todo는 0개다.
- **영향 범위:** `src/vdom/diff/findChildMatches.ts`, `src/vdom/diff/collectNodeChanges.ts`, `p1_interfaces.md` §4, `p1_prd.md` §4, `p1_function_flow.md` §4, `p1_test_cases.md` §5·§6·§8–§10, `p1_test_boards.md`, `p1_diff_notes.md`.
- **설계 기준:** `p1_history_handler_design.md`.
