# Phase 2 결정 기록

기준: [p2_test_cases.md](p2_test_cases.md), [p2_function_flow.md](p2_function_flow.md), [wiki/Phase2-Design-merged.md](../wiki/Phase2-Design-merged.md)의 승인안.
결정의 1차 자료는 GitHub 이슈 #55–#60의 구현 댓글과 #54의 구현 규칙 댓글이다. 이 문서는 그 결정을 티켓별로 다시 읽을 수 있게 정리하고, #61에서 확인한 전체 실행 결과와 남은 문서 충돌을 함께 남긴다.

구현 코드의 공개 경계는 `src/component/index.ts`이고, `h()`와 VNode 값 정규화는 `src/component/h.ts`가 소유한다. `index.ts`가 `h`를 re-export하므로 사용자 코드의 import 경로는 그대로다. 이벤트 연결·동기화는 `src/vdom/events.ts`, VNode 타입은 `src/vdom/types.ts`에 있다. Phase 1의 Diff·Patch·`renderChildren`·`renderNode` 계약은 그대로 재사용한다.

## P2-H-01 — h()의 태그·props·children 경계 (#55)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:**
  - `tagName`은 문자열만 받는다. 앞뒤 공백을 `trim()`한 뒤 대문자로 저장하고, trim 결과가 빈 문자열이면 오류다. `h(' div ')`는 `DIV`가 된다.
  - props는 **이벤트 prop → 태그별 property → attribute** 순서로 분류한다. property 판정은 Phase 1 `src/vdom/create.ts`의 `propertySchema`를 export해 그대로 재사용하며 표를 복제하지 않는다.
  - properties 값은 받은 그대로 저장한다. 문자열·숫자·불리언으로 강제 변환하지 않는다.
  - 이벤트가 하나도 없으면 `events` 필드 자체를 만들지 않는다. `events`는 Phase 1 fixture와의 호환을 위한 선택 필드다.
- **이유:**
  - Phase 1 Snapshot과 같은 태그 표기를 써야 Diff가 같은 요소로 인식한다.
  - property 목록을 두 곳에 두면 태그별 규칙이 갈라지므로 기존 표를 단일 출처로 쓴다.
  - properties는 실제 DOM 프로퍼티에 그대로 대입되는 값이므로 `h()`에서 타입을 바꾸면 사용자가 넘긴 값과 화면 값이 달라진다.
  - 이벤트가 없는 노드에 빈 `events` 객체를 남기면 Phase 1 VNode와 모양이 달라진다. 선택 필드를 아예 만들지 않아야 "필드가 없다"는 것 자체가 이벤트가 없다는 신호가 되고, 기존 fixture를 고치지 않아도 된다.
- **구현:**
  - `h()`가 `normalizeTagName()` → `classifyProps()` → `normalizeChildren()` 순서로 요소 VNode를 만든다.
  - `classifyProp()`은 `isEventProp()`(이름이 `on`으로 시작) → `isPropertyProp()`(`propertySchema[tagName]`) → `addAttribute()` 순서로 분류한다.
  - `className`은 `class`로 정규화한다. attribute 값이 `null`·`undefined`·`false`면 생략하고, `true`는 `""`로 넣는다. 객체 값은 `"[object Object]"`로 조용히 바꾸지 않고 오류다.
  - 지원 이벤트는 `onClick`·`onInput`·`onChange` 세 가지이며 각각 `click`·`input`·`change`로 저장한다. 그 밖의 `on*` prop과 함수가 아닌 이벤트 값은 오류다.
  - children은 중첩 배열을 재귀적으로 펼치고 `null`·`undefined`·boolean을 제외한다. 문자열·숫자는 Text VNode로 바꾸고 빈 문자열은 노드를 만들지 않는다. 허용값이 아닌 객체·함수·DOM Node·Promise는 오류다.
  - Component 반환값은 `normalizeComponentResult()`가 처리하며, `h()`와 달리 원시 문자열·숫자를 Text VNode로 바꾸지 않고 오류로 처리한다.
- **검증:** `tests/unit/p2/h.test.ts` 19개 통과. 명세 ID H-01–H-08의 직접 검증 9개와, 같은 규칙을 더 좁게 확인하는 보강 10개(`props` 생략, tagName trim, className, style·dataset 오류, propertySchema 재사용 2개, 이벤트 저장, 이벤트 생략, Text VNode의 events 부재, 지원 밖 이벤트 오류)다.
- **영향 범위:** `src/component/index.ts`, `src/vdom/types.ts`의 `VNode.events?`, `src/vdom/create.ts`의 `propertySchema` export, `tests/unit/p2/h.test.ts`, `p2_test_cases.md` §3.

## P2-EVENT-01 — 이벤트 모듈 분리와 syncEvents 관찰 seam (#56, #57)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:** 이벤트 기록소·최초 연결·갱신을 `src/vdom/events.ts`가 소유한다. `patch.ts`의 `renderNode()`는 새 요소에 `bindEvents()`를 호출하는 연결만 담당하고, 갱신은 `update()`가 DOM Patch 뒤에 `syncEvents(root)`를 호출한다. `syncEvents`는 모듈에서 export해 테스트가 모듈 mock으로 호출 기록을 관찰할 수 있게 한다.
- **이유:**
  - VNode는 갱신마다 새로 만들어지므로, handler 추가·교체·제거를 판단할 기준은 실제 DOM 노드에 남아 있는 기록이어야 한다. `WeakMap<Node, VNodeEventMap>`이 그 기준이다.
  - 화면 데이터가 같아도 handler 함수 참조가 바뀌면 새 handler가 실행되어야 하고(UPD-03), handler가 사라지면 이전 handler가 실행되지 않아야 한다(UPD-04). Diff는 `events`를 비교하지 않으므로 DOM Patch와 별도 단계가 필요하다.
  - `syncEvents`를 이름 있는 경계로 두면 "화면이 같아 Patch를 생략한 갱신에서도 이벤트 동기화를 수행했는가"를 테스트가 관찰할 수 있다.
- **구현:**
  - `bindEvents(element, events)`가 `nodeEvents.set()`으로 기록한 뒤 `addEventListener()`로 연결한다. 기록과 연결을 한 함수에 두어 어긋나지 않게 한다.
  - `syncEvents(root)`가 next 트리를 순회하며 요소 VNode만 `replaceNodeEvents()`로 비교한다. 이전 기록과 다음 map을 비교해 바뀐·사라진 listener는 제거하고, 새·바뀐 listener는 추가한다. 다음 map이 비면 기록을 삭제한다.
  - `syncElementEvents()`는 `VNode.dom`이 `null`이거나 `Element`가 아니면 오류다. `syncEvents`는 실제 DOM이 이미 연결된 다음 VDOM을 전제로 한다.
- **검증:** INIT-01(최초 연결), UPD-03(같은 화면·새 handler), UPD-04(handler 제거), ERR-02(`syncEvents` 미호출), `syncEvents` 오류 경계 테스트가 통과했다. `syncEvents` 오류 테스트는 DOM Patch가 끝난 뒤 오류가 전파되고 effect가 실행되지 않음을 확인한다.
- **영향 범위:** `src/vdom/events.ts`, `src/vdom/patch.ts`, `src/vdom/types.ts`, `src/component/index.ts`, `tests/integration/p2/app.test.ts`, `tests/integration/p2/errors.test.ts`.

## P2-START-01 — startApp 컨테이너 등록 시점 (#56)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:** `startApp()`은 container가 `Element`인지 검증한 **직후**, 첫 렌더 전에 `WeakSet`에 사용 중으로 등록한다. 첫 렌더가 실패해도 등록을 해제하지 않는다.
- **이유:** 첫 렌더가 실패하면 컨테이너에 부분 화면이 남을 수 있다. 등록을 렌더 성공 후로 미루면 같은 컨테이너에 새 앱을 다시 시작할 수 있지만, 이전 실패의 흔적 위에 새 화면을 겹쳐 만든다. "container별 1회 시작"을 실패 여부와 무관한 계약으로 두는 편이 상태를 단순하게 만든다.
- **구현:** `startedContainers` WeakSet, `assertStartContainer()`, `startApp()`의 검증 → 등록 → `new FunctionComponent(...).mount()` 순서. `mount()`가 던지면 오류는 `startApp()` 호출자에게 전파되고 등록은 남는다.
- **검증:** INIT-04 2개 통과. `null`·문자열 container와 이미 시작한 container의 재시작이 각각 오류다. 반복 시작이 거부된 뒤에도 첫 앱의 handler가 계속 동작한다. 별도 테스트에서 컴포넌트가 던진 오류가 `startApp()` 호출자에게 전파되고 DOM이 만들어지지 않음을 확인했다.
- **영향 범위:** `src/component/index.ts`, `tests/integration/p2/app.test.ts`, `p2_test_cases.md` INIT-04.

## P2-UPDATE-01 — 갱신 예약은 queueMicrotask, 배치당 1회 (#57)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:** setter는 `scheduleUpdate()`로 `queueMicrotask()`에 `update()`를 예약하고, 인스턴스별 `updateScheduled` 플래그로 같은 배치에 1회만 건다. 예약 콜백은 시작 직후 플래그를 내린 뒤 `update()`를 실행한다.
- **이유:**
  - 클릭 handler 안에서 setter를 여러 번 호출해도 한 번의 재렌더로 모은다(UPD-06). `setTimeout`·`requestAnimationFrame`보다 먼저 실행되어 현재 동기 처리 뒤에 이어진다.
  - 콜백 시작 시 플래그를 먼저 내려야 effect 안 setter가 "현재 처리 중"이 아니라 "다음 배치"로 예약된다(UPD-05).
  - 예약 횟수 자체는 계약이 아니다. `p2_test_cases.md` §1과 같이 최종 State·화면 일치만 보장한다.
- **구현:** `applyStateUpdate()`가 값 변경을 확인한 뒤 `rememberStateValue(slot)` → `slot.value = value` → `scheduleUpdate()` 순서로 진행한다. `scheduleUpdate()`는 `updateScheduled`가 참이면 반환하고, 아니면 참으로 바꾼 뒤 `queueMicrotask(() => { instance.updateScheduled = false; instance.snapshotHooksBeforeUpdate(); instance.update(); })`를 건다.
- **검증:** UPD-01(자동 재렌더·필요한 Patch), UPD-02(화면 같음·Patch 생략), UPD-05(effect 안 setter), UPD-06(연속 setter 최종 일치), HOOK-09(같은 값은 예약 안 함), FLOW-01이 통과했다. 테스트의 `flushUpdates()`는 microtask·`setTimeout(0)`·연쇄 microtask를 모두 flush한다.
- **영향 범위:** `src/component/index.ts`, `tests/helpers/p2.ts`, `tests/integration/p2/app.test.ts`, `tests/unit/p2/hooks.test.ts`.

## P2-HOOK-01 — 훅 슬롯·cursor·종류/개수 검증 (#57, #58, #59)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:** Hook 기록은 호출 순서를 정체성으로 하는 슬롯 목록이다. `cursor`는 render 시작마다 0으로 돌아가고, mount에서만 새 슬롯을 만들 수 있다. update에서 Hook 개수가 늘거나 줄거나, 같은 위치의 종류(`state`/`memo`/`effect`)가 바뀌면 오류다. Hook은 Component 실행 중에만 호출할 수 있다.
- **이유:** 조건부 Hook 호출을 조용히 다른 슬롯에 연결하면 이전 값·deps가 엉뚱한 Hook에 붙는다. React와 같은 순서 기반 규칙을 runtime에서 강제해 잘못된 render를 화면에 반영하지 않는다.
- **구현:**
  - `claimHookSlot()`이 `cursor` 위치의 슬롯을 꺼내고 종류를 비교한다. `cursor`가 목록 끝을 넘으면 mount에서만 새 슬롯을 push한다.
  - `beginHooks()`가 `activeHookOwner`·`cursor=0`·`phase`를 설정하고, `renderComponent()`의 `finally`에서 `endHooks()`가 소유자 문맥을 해제한다. `requireHookOwner()`는 문맥이 없으면 오류다.
  - `assertHookCountConsumed()`가 update 종료 시 `cursor !== hooks.length`이면 개수가 줄었다고 판정한다.
  - `runEffects()`는 슬롯 목록을 순서대로 순회하며 effect 슬롯만 처리한다.
- **검증:** HOOK-01(mount 기록·update 재사용), HOOK-02(호출 순서 분리), HOOK-07(컴포넌트 밖 호출 오류), HOOK-08(개수 감소·증가·종류 변경 3개)이 통과했다. HOOK-08은 오류 시 화면이 바뀌지 않음을 함께 확인한다.
- **영향 범위:** `src/component/index.ts`, `tests/unit/p2/hooks.test.ts`, `p2_test_cases.md` §4.

## P2-STATE-01 — setter 참조 유지와 Object.is 동일값 생략 (#57)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:** setter는 mount에서 슬롯과 함께 한 번 만들어지고, 이후 render에서도 같은 함수 참조를 반환한다. setter는 소유 인스턴스와 자기 슬롯을 기억한다. `Object.is(previous, next)`가 참이면 슬롯 쓰기와 갱신 예약을 모두 생략한다. 값 setter와 함수형 updater에 같은 규칙을 적용한다.
- **이유:**
  - setter 참조가 render마다 바뀌면 `h()`에 넘긴 handler 참조도 매번 바뀌어 `syncEvents`가 불필요하게 listener를 교체한다.
  - `Object.is`는 `NaN`을 같은 값으로, `+0`과 `-0`을 다른 값으로 판정한다. 같은 값으로 재렌더를 만들지 않는다는 계약(HOOK-09)을 값 종류별 예외 없이 표현할 수 있다.
- **구현:** `createStateHookSlot()`이 `setter` 클로저를 슬롯에 저장한다. `applyStateUpdate()`가 함수형 updater를 이전 값으로 계산하고 `Object.is`로 비교한 뒤, 다를 때만 `rememberStateValue()`·`slot.value`·`scheduleUpdate()`를 수행한다.
- **검증:** HOOK-01(setter 참조 유지), HOOK-02(자기 슬롯만 변경), HOOK-03(함수형 updater 누적), HOOK-09 3개(같은 값·같은 updater·NaN 미예약, NaN 동일, `+0`/`-0` 구분·같은 참조·새 객체 구분)가 통과했다.
- **영향 범위:** `src/component/index.ts`, `tests/unit/p2/hooks.test.ts`, `p2_test_cases.md` HOOK-01–03·09.

## P2-MEMO-01 — useMemo deps 필수·비배열 오류·undefined 캐시 (#58)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:** `useMemo`의 deps는 필수다. 생략(`undefined`)과 비배열은 같은 오류로 처리한다. 비교는 길이와 각 값의 `Object.is`다. 계산 결과가 `undefined`여도 캐시하며, 계산이 성공한 뒤에만 슬롯의 `value`·`deps`를 갱신한다. deps 타입은 `readonly unknown[]`로 넓혔다.
- **이유:**
  - `undefined`를 "캐시 없음"으로 해석하면 `undefined`를 반환하는 계산이 매 render 다시 실행된다.
  - 실패한 계산의 deps를 남기면 다음 render가 실제로 만들어지지 않은 결과를 캐시로 신뢰한다.
  - deps 배열은 render마다 새로 만들어지므로 배열 참조가 아니라 길이·값을 비교해야 한다.
- **구현:** `assertMemoDependencies()`, `areHookDepsEqual()`, `createMemoHookSlot()`(계산 후 기록 생성), `updateMemoHookSlot()`(계산 성공 후 기록 갱신). mount에서 만든 슬롯은 같은 deps를 가지므로 첫 render의 비교를 그대로 통과한다.
- **검증:** HOOK-04 2개(같은 deps 재계산 없음·`undefined` 캐시), HOOK-05 4개(값·길이·순서·새 객체 참조 변경), deps 비배열 5개 입력 오류가 통과했다. #58 댓글 기준 11개 통과다.
- **영향 범위:** `src/component/index.ts`, `tests/unit/p2/hooks.test.ts`, `p2_test_cases.md` HOOK-04·05.

## P2-EFFECT-01 — useEffect deps·cleanup 계약 (#59)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-10
- **결정:**
  - deps를 생략하면 매 render 실행한다. deps가 `undefined`가 아닌데 배열이 아니면 오류다.
  - effect 반환값은 `undefined` 또는 cleanup 함수만 허용한다. `async` effect가 돌려주는 Promise, 숫자(`return setInterval(...)`) 등은 등록 시점에 오류다.
  - cleanup 슬롯은 호출 **전에** 비운다. cleanup이 던져도 같은 cleanup을 다시 실행하지 않는다.
  - 여러 효과는 Hook 호출 순서대로 각각 `이전 cleanup → 새 effect`를 처리한다. 한 효과의 cleanup/실행이 던지면 남은 효과는 실행하지 않는다.
  - 효과 실행이 성공한 뒤에만 `deps`·`shouldRun`을 갱신한다.
  - 화면 변경이 없어 Patch를 생략한 갱신에서도 효과 판단은 생략하지 않는다.
- **이유:**
  - `async () => {}`는 Promise를 반환하므로 cleanup으로 저장하면 실행 시점에 오류가 나고 원인을 찾기 어렵다. 등록 시점에 잡는 편이 낫다.
  - cleanup을 호출한 뒤 슬롯을 비우면 cleanup 오류 시 같은 함수가 다음 갱신에서 다시 실행된다. 호출 전에 비워 재실행을 막는다.
  - 효과 실행 전에 deps를 갱신하면 실패한 효과를 다음 render가 최신으로 오해한다.
- **구현:** `assertEffectDependencies()`, `createEffectHookSlot()`(mount 기록은 `nextDeps`·`shouldRun: true`), `registerEffectForCommit()`·`shouldRunEffect()`(update 후보 판단), `runEffects()`·`runEffectSlot()`·`runEffectCleanup()`·`invokeEffect()`.
- **검증:** HOOK-06 2개(같은 deps 재실행·cleanup 없음), EFF-01 11개(run→cleanup→run, deps 생략 매 render, 여러 효과 순서, deps 비배열 4개, cleanup 반환 오류 3개, 화면 불변에서 효과 판단)가 통과했다. `tests/unit/p2/hooks.test.ts` 35/35, exit 0.
- **영향 범위:** `src/component/index.ts`, `tests/unit/p2/hooks.test.ts`, `p2_test_cases.md` HOOK-06·EFF-01.
- **범위 밖:** 컴포넌트 해제 API가 없으므로 unmount cleanup은 다루지 않는다.

## P2-EFFECT-02 — deps 생략↔배열 전환 시 다음 렌더 1회 실행 (#59)

- **상태:** accepted — 구현 완료, 전용 실행 단위 없음
- **날짜:** 2026-11-10
- **결정:** 이전 실행의 기준 deps가 `undefined`(생략)인 상태에서 배열 deps로 바뀌면 비교할 배열이 없으므로 다음 렌더에서 한 번 실행하고, 그때부터 새 배열을 비교 기준으로 삼는다. 반대 방향(배열→생략)은 생략 규칙에 따라 매 render 실행한다.
- **이유:** 생략과 배열은 "비교 기준이 없음"과 "배열로 비교함"이라는 서로 다른 계약이다. 생략 상태의 `undefined`를 빈 배열처럼 취급하면 배열로 전환한 첫 render를 "deps 없음"으로 오판해 실행을 잃는다.
- **구현:** `shouldRunEffect()`가 `nextDeps === undefined`이면 `true`, `slot.deps === undefined`이면 `true`, 그 밖에는 `areHookDepsEqual()`로 판정한다. 실행 성공 후 `slot.deps = slot.nextDeps`가 새 기준을 만든다.
- **검증:** #59 댓글의 판단 기록과 구현 경로로 확인했다. 이 전환만을 직접 고정하는 전용 테스트는 아직 없다. EFF-01의 deps 생략 테스트가 "매 render 실행" 경로를, deps 배열 테스트가 "배열 비교" 경로를 각각 검증한다. 전환 자체의 실행 단위가 없다는 점을 한계로 남긴다.
- **영향 범위:** `src/component/index.ts`, `p2_test_cases.md` EFF-01의 deps 경계.

## P2-FAIL-01 — 렌더 오류와 applyPatch 실패의 분리 (#60)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-11
- **결정:**
  - Component 실행·`h()`·Hook·반환값 정규화·Diff에서 난 오류는 **상태를 복원하지 않는다.** setter가 이미 쓴 State와 Hook 기록은 유지하고, 실제 DOM과 현재 VDOM은 마지막 성공 상태를 유지한다. 오류는 잡지 않고 호출자에게 전파한다.
  - `applyPatch()` 실패만 **화면과 훅 슬롯을 갱신 시작 전 시점으로 함께 되돌리는 원자적 복원**을 수행한다.
  - `syncEvents()` 실패는 DOM Patch가 끝난 뒤 발생하므로 화면은 새 상태이고 현재 VDOM은 마지막 성공 상태다. 오류를 전파하고 effect는 실행하지 않는다.
- **이유:**
  - ERR-01의 계약은 "첫 클릭의 상태 증가가 유지되는 것"이다. 렌더 오류는 DOM을 건드리기 전에 발생하므로 화면 복원이 필요 없고, State를 되돌리면 사용자가 누른 클릭 자체가 사라진다.
  - `applyPatch()`는 명령을 순서대로 적용하다 중간에 실패할 수 있어 실제 DOM이 반쯤 바뀔 수 있다. 화면만 복원하고 Hook 슬롯을 새 값에 두면 다음 setter가 "이미 반영된 값"으로 오판해 갱신을 예약하지 않는다. 두 상태를 같은 시점으로 되돌려야 다음 갱신이 일관된다.
- **구현:** `update()`는 `applyPatchOrRestore()`로 Patch만 감싸고, `syncEvents()`·현재 VDOM 교체·`runEffects()`는 그 뒤에 둔다. `finally`는 성공·실패 모두 `discardHooksBeforeUpdate()`로 복사본과 State 이전 값 기록을 버린다. `scheduleUpdate()` 콜백은 `updateScheduled = false`를 먼저 수행하므로 렌더 오류 뒤에도 다음 setter가 새 갱신을 예약할 수 있다.
- **검증:** ERR-01 1개(render 오류 시 DOM·VDOM 유지, `applyPatch`·`syncEvents` 미호출, 상태 증가 유지, 다음 갱신 정상), ERR-02 3개(화면 복원·훅 슬롯 복원·effect setter 회귀), `syncEvents` 오류 1개(DOM 반영 뒤 전파·effect 미실행), effect 오류 1개와 cleanup 오류 1개(남은 effect 미실행)가 통과했다.
- **영향 범위:** `src/component/index.ts`, `tests/integration/p2/errors.test.ts`, `p2_test_cases.md` ERR-01·ERR-02.

## P2-FAIL-02 — applyPatch 실패의 원자적 복원과 얕은 복사 (#60)

- **상태:** accepted — 구현·검증 완료. 복사 시점은 P2-FAIL-03에서 정정
- **날짜:** 2026-11-11
- **결정:** 적용 실패 시 `renderChildren(previousRoot, container)`로 마지막 성공 화면을 다시 만들고, `restoreHooksBeforeUpdate()`가 전체 슬롯 필드를 복사본으로 되돌린 뒤 State 이전 값 기록으로 `slot.value`를 덮어쓴다. 이어 `updateScheduled = false`로 다음 setter가 새 갱신을 예약하게 하고 원래 오류를 rethrow한다.
- **이유:**
  - setter는 슬롯 객체를 직접 참조한다. 배열이나 슬롯 객체의 동일성을 바꾸면 기존 setter가 복원된 슬롯을 가리키지 않는다. 그래서 필드만 되돌린다.
  - 전체 복사본은 갱신 시작 시점에 만들고 State 이전 값은 setter 시점에 기록해야 한다. setter 시점에는 효과 슬롯의 cleanup·deps가 아직 확정되지 않았고, 갱신 시작 시점에는 이미 새 State 값이 들어 있다. 두 기록을 합쳐야 화면·효과 실행 기록·State를 모두 같은 시점으로 되돌릴 수 있다(P2-FAIL-03).
  - `renderChildren()`은 마지막 성공 VDOM의 `VNode.dom`을 새 DOM으로 다시 연결하므로, 다음 Diff가 방금 복구한 실제 화면을 기준으로 비교할 수 있다.
- **복원 범위:** 얕은 복사다. State 값 객체를 제자리에서 변경하는 사용은 React와 같은 불변 전제를 따르므로 지원하지 않는다. 복원은 전체 재생성이므로 포커스·스크롤·비제어 입력 상태는 보존하지 않는다.
- **구현:** `rememberStateValue()`, `snapshotHooksBeforeUpdate()`, `copyHookSlot()`, `restoreHooksBeforeUpdate()`, `discardHooksBeforeUpdate()`, `restorePatchFailure()`, `restoreLastCommittedRoot()`. 복원 중 `renderChildren()` 오류는 삼켜 원래 Patch 오류를 가리지 않는다.
- **검증:** ERR-02 3개 통과. 첫 테스트는 Patch가 `span`을 `B`로 바꾼 뒤 실패하는 상황에서 화면이 `A`로 돌아오고 `syncEvents`·effect가 실행되지 않으며 다음 갱신이 `B`로 정상 동작함을 확인한다. 두 번째 테스트는 실패한 갱신의 State가 `A`로 복원되어 같은 setter가 다시 새 변경으로 예약되는지 확인한다. 세 번째 테스트는 effect setter로 시작한 갱신이 실패해도 이미 실행한 `[]` 효과의 실행 기록이 유지되는지 확인한다. #60 댓글에 따르면 복원 코드를 끄면 두 번째 테스트가 `expected 2 to be 3`으로 실패한다.
- **영향 범위:** `src/component/index.ts`, `tests/integration/p2/errors.test.ts`, `p2_test_cases.md` ERR-02.

## P2-FAIL-03 — 복원 스냅샷은 갱신 시작 시점, State 이전 값은 setter 시점 (#61)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-11
- **결정:** setter는 자신이 덮어쓰는 State 슬롯의 이전 값만 슬롯별 첫 쓰기로 기록한다. 전체 Hook 슬롯 복사본은 예약된 갱신이 실제로 시작되는 microtask 콜백 안, render 전에 만든다. Patch 실패 복원은 전체 복사본으로 슬롯 필드를 되돌린 뒤 State 이전 값 기록으로 `slot.value`를 덮어쓴다. 성공 시 두 기록을 모두 버리고 슬롯 객체 동일성은 유지한다.
- **이유:**
  - 효과는 commit 뒤에 실행되고 `cleanup`·`deps`는 효과가 반환된 뒤에 확정된다. 효과 안 setter가 전체 슬롯을 복사하면 복사본의 효과 슬롯에는 `cleanup: null`, `deps: undefined`, `shouldRun: true`가 남는다. 이어서 Patch가 실패하면 이 복사본으로 복원되어 이미 실행한 효과의 cleanup이 사라지고 다음 갱신에서 효과가 다시 실행된다.
  - 갱신 시작 시점에는 직전 commit의 효과 실행이 끝나 있으므로 실행 완료 정보를 담은 복사본을 만들 수 있다.
  - 그 시점에는 setter가 이미 State를 새 값으로 써 두었으므로, State만은 setter 시점에 따로 기록한 이전 값으로 덮어써야 배치 시작 전으로 돌아간다.
- **구현:** `stateValuesBeforeUpdate: Map<StateHookSlot, unknown>`, `rememberStateValue()`, `snapshotHooksBeforeUpdate()`, `restoreHooksBeforeUpdate()`의 2단계 복원, `scheduleUpdate()` 콜백의 snapshot 호출.
- **검증:** `tests/integration/p2/errors.test.ts`의 ERR-02 세 번째 실행 단위가 effect setter로 시작한 갱신의 Patch 실패를 재현한다. 수정 전에는 다음 갱신에서 효과가 다시 실행되어 `['effect','effect']`로 실패했고, 수정 후에는 `['effect']`로 통과한다. cleanup 오류 전파 테스트도 함께 통과한다.
- **영향 범위:** `src/component/index.ts`, `docs/p2_function_flow.md`, `tests/integration/p2/errors.test.ts`.

## P2-TEST-01 — 승인된 테스트 수정 2건 (#60)

- **상태:** accepted — 사용자 승인·반영
- **날짜:** 2026-11-11
- **결정 1:** ERR-01·ERR-02의 `container.textContent` 기대값을 `span.textContent` 기준으로 수정한다. fixture가 `span`과 버튼 라벨을 함께 렌더링해 전체 텍스트가 `0tick`·`Anext`가 되는 결함이 있었다.
- **결정 2:** 예약 갱신 오류는 `queueMicrotask` spy로 콜백을 직접 실행해 `expect().toThrow()`로 포착한다. ERR-02 fixture는 `useState(A)` + `setValue(B)` 원본으로 되돌린다.
- **이유:** 예약 콜백의 오류는 `click()` 호출로 전파되지 않고, 어떤 방식으로도 런타임 종료 코드 1을 만든다. 테스트가 콜백을 직접 실행해야 오류를 assertion으로 관찰하고 실패 원인을 판정할 수 있다. 이 수정은 테스트 케이스 동결 원칙의 예외로 사용자 승인을 받았다.
- **구현:** `tests/integration/p2/errors.test.ts`의 `captureScheduledUpdates()`가 `vi.spyOn(globalThis, 'queueMicrotask')`로 콜백을 모은다. 각 테스트는 `scheduled[0]!()`를 `expect().toThrow()`로 감싼다.
- **검증:** `tests/integration/p2/errors.test.ts` 5/5 통과, exit 0, unhandled error 0. 복원 증명 테스트를 추가했고, 복원 코드를 끄면 실패함을 확인했다.
- **영향 범위:** `tests/integration/p2/errors.test.ts`만. 제품 코드 계약과 기대 정책은 변경하지 않는다.

## P2-STRUCT-01 — h() 모듈 분리와 자식 순회 공유 (#61)

- **상태:** accepted — 구현·검증 완료
- **날짜:** 2026-11-11
- **결정:**
  - `src/component/index.ts`의 `h()`와 그 내부 helper(tagName 정규화, props 분류, children 정규화, Text VNode 생성, 이벤트 이름 변환)를 `src/component/h.ts`로 옮기고, `index.ts`는 `h`를 re-export한다. 공개 import 경로(`src/component`)는 그대로다.
  - `appendComponentResult()`와 `appendChild()`의 중복을 `appendChildValue(nodes, value, policy)`로 합친다. 무시 값 제외·배열 재귀 펼침·VNode 판정·오류 처리는 공유하고, 원시 문자열·숫자를 Text VNode로 바꿀지와 오류 문구만 정책 객체로 분리한다.
  - 제품·테스트에서 호출되지 않는 `getNodeEvents()`를 `src/vdom/events.ts`에서 제거한다.
  - 런타임(`FunctionComponent`, Hook)은 이번에 나누지 않는다.
- **이유:**
  - `index.ts`가 Hook·생명주기·h()·정규화를 모두 담아 커지고 있었다. h()는 DOM을 만들지 않고 VNode만 만드는 독립 경계라 가장 먼저 분리하기에 위험이 낮다.
  - 같은 자식 순회를 두 벌로 유지하면 무시 값·배열·VNode 판정 규칙이 한쪽만 바뀔 수 있다. 원시값 정책만 다르므로 정책 인자 하나로 공유하는 편이 작다.
  - 호출되지 않는 export는 공개 API가 아니어도 독자가 제품 경로로 오해한다. 실제 호출이 생길 때 다시 추가한다.
  - 늦은 단계에서 런타임과 Hook까지 한 번에 나누면 함수 흐름·테스트가 동시에 흔들릴 위험이 크다. 이번에는 경계가 분명한 h()만 옮기고, 나머지는 `p2_function_flow.md`의 호출 지도로 탐색 경로를 제공한다.
- **구현:** `src/component/h.ts` 신설, `index.ts`의 `export { h } from './h'`, `appendChildValue()`의 `ChildTraversalPolicy`(h 정책·Component 반환값 정책), `getNodeEvents()` 삭제.
- **검증:** `npm run check` 통과, Phase 2 77개 실행 단위 통과. h() 공개 동작과 오류 문구는 기존 `tests/unit/p2/h.test.ts` 19개가 그대로 검증한다. `getNodeEvents` 참조는 제품·테스트 코드에서 0건이며, 함수 흐름 문서의 표에서도 제거했다.
- **영향 범위:** `src/component/index.ts`, `src/component/h.ts`, `src/vdom/events.ts`, `docs/p2_function_flow.md`.

## P2-VERIFY-01 — 전체 검증과 기록 정합화 (#61)

- **상태:** 완료
- **날짜:** 2026-11-11
- **결정:** 코드는 변경하지 않고 문서만 정리한다. 문서와 코드가 어긋나면 코드가 아니라 문서를 고친다. 수정 제한 문서(`p1_prd`, `p1_function_flow`, `p1_test_cases`, `p1_interfaces`)는 건드리지 않는다.
- **이유:** #55–#60 구현이 끝났지만 진행표 수치와 결정 기록이 실제 실행과 어긋난 채 남아 있으면 다음 작업이 잘못된 전제를 쓴다. 이번 작업의 산출물은 실행 결과와 같은 수치를 가진 기록이다.
- **구현:** `docs/p2_decisions.md`와 `docs/p2_function_flow.md`를 새로 작성하고, `docs/p2_test_boards.md`의 판정·실행 기록·확정 경계를 갱신했다. 코드·테스트 파일은 수정하지 않았다.
- **실행:**
  - `npx vitest run tests/unit/p2 tests/integration/p2 --reporter=json` → 4개 파일, 75개 통과, exit 0. 파일별: `h.test.ts` 19, `hooks.test.ts` 35, `app.test.ts` 16, `errors.test.ts` 5.
  - `npm test` → 26개 파일, 268개 통과, exit 0, unhandled error 0. Phase 1 회귀는 22개 파일 193개 통과다.
  - `npm run check` → 타입 검사와 전체 테스트 통과, exit 0.
- **검증:** 전체 26개 파일 268개 통과, unhandled error 0. Phase 2 대상 4개 파일 75개 통과. 수정 제한 문서 4개의 `git diff dev`가 빈 출력임을 확인했다. `git status`에서 이번 작업이 만든 문서 3개 외에 코드 파일 변경이 없음을 확인했다.
- **수치 구분:** 테스트 명세 ID는 33개다. 이 항목의 75개·268개는 #61 검증 시점의 기록이다. 이후 P2-FAIL-03·P2-STRUCT-01에서 실행 단위 2개가 추가되어 현재 Phase 2 실행 단위는 77개다. 최신 전체 수치는 [p2_test_boards.md](p2_test_boards.md)를 따른다. 같은 ID를 여러 입력·시나리오로 나눈 테스트와 명세 ID 밖 보강 테스트가 포함되므로 테스트 ID와 실행 단위 수를 같게 기록하지 않는다. #61 본문의 36은 최초 테스트 작성 시점의 실행 단위 수이고, 구현·보강 과정에서 75개로 늘었다.
- **문서 경계 확인:** `git diff dev -- docs/p1_prd.md docs/p1_function_flow.md docs/p1_test_cases.md docs/p1_interfaces.md`가 빈 출력이다.
- **영향 범위:** `docs/p2_decisions.md`, `docs/p2_function_flow.md`, `docs/p2_test_boards.md`.

## 남은 문서 충돌

아래 항목은 이번 작업에서 수정하지 않았다. 수정 제한 문서이거나, 확정된 설계와 명세 문면의 관계를 사용자가 판단해야 하는 항목이다.

1. **`docs/p1_test_cases.md`의 key 정책 서술 충돌.** 앞부분 §1(11행)은 "중복 key 오류, key 변경, 같은 key의 태그 변경 정책은 아직 미확정"이라고 적고 있지만, 같은 문서 §10(506행 이후)은 P1-CONF-03으로 "같은 key + 같은 태그 matched/update, 같은 key + 다른 태그 replace, key 변경 remove + insert, 중복 key는 keyless 순서 대응"을 확정했다. 후반 확정 기록이 실제 구현·테스트와 일치한다. 수정 제한 문서이므로 보고만 한다.
2. **`docs/p1_decisions.md` P1-INIT-TDD-01의 과거 미완료 서술.** 상태가 "단위 검증 통과 — 실제 함수 통합 검증은 대기"이고, 주입 표의 `createSnapshot`·`createHistory` 행도 "구현 대기"다. 그러나 이후 P1-SNAP-01·P1-HISTORY-STATE-01·P1-RESTORE-01에서 실제 구현과 통합 검증이 완료됐다. 결정 당시 기록과 이후 결과가 같은 항목 안에서 갱신되지 않았다.
3. **`docs/p1_diff_notes.md`의 과거 미구현 기록.** §11–§19 곳곳에 `collectChildChanges: 미구현`, `findChildMatches: 미구현`, `orderChanges: 미구현`, "전체 테스트 32개 통과·20개 실패" 같은 작업 당시 기록이 남아 있다. 이후 절에서 구현이 완료됐지만 과거 절에는 "현재 미구현"으로 읽힐 수 있는 서술이 그대로 있다.
4. **`docs/p1_prd.md`·`docs/p1_interfaces.md`의 프로퍼티 제거 정책과 구현 차이.** PRD 288행은 "실제 DOM의 프로퍼티 제거 정책은 구현하지 않는다"고 하고, 인터페이스 116행은 "실제 DOM 제거 방법은 미확정"이라고 적는다. 그러나 `src/vdom/patch.ts`의 `removeProperties()`는 `Reflect.deleteProperty(element, name)`로 실제 삭제를 수행한다. 정상 생성 경로에서는 `setProperties`가 우선해 이 경로가 드러나지 않지만, 데이터 계약과 구현의 차이를 명세 문면만으로는 알 수 없다.
