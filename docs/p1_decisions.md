# Phase 1 결정 기록

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
- **미확정:** 같은 부모 안의 중복 key, key 값 변경, 같은 key의 태그 변경 대응은 CONF-03.

## P1-UI-01 — main.html 좌우 2분할 화면과 초기 루트

- **상태:** accepted
- **날짜:** 2026-11-07
- **결정:** `main.html`을 Vite 진입점으로 사용한다. 화면은 좌우 2분할이며 왼쪽은 HTML 코드 편집기, 오른쪽은 실제 영역이다. 실제 영역 컨테이너는 `#actual`이다. Patch·뒤로·앞으로 버튼은 하단 푸터에 둔다. `init()`은 `createEmptyVDOM(#actual)`로 초기 `VRoot.dom`을 연결한다.
- **이유:** 편집기와 렌더링 결과를 동시에 비교하고, Patch·이력 이동을 한 곳에서 조작하기 위해서다.
- **인터페이스:**
  - `getElements(): { editor, actualRoot, patchButton, backButton, forwardButton }`
  - `init(): { elements, root: VRoot }`
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

- **상태:** accepted
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
