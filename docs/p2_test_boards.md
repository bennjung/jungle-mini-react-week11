# Phase 2 테스트 진행표

**최신 상태:** 입력 동기화·선택 영역 구현과 독립 리뷰의 두 회귀 수정을 완료했다.
`npm run check`: 타입 검사·전체 **28개 파일·354개 통과**, 실패·skip/todo 0개.
기존297개와 신규57개를 구분한다. 실제 Chromium 계열 Brave에서 공백 입력·새 문자 삽입·삭제와
같은 문서·루트·고양이 상태 유지도 확인했다. §8 미확정 정책·전체 IME 보장은 완료로 보지 않는다.
[새 계약 실행 결과](#입력-동기화선택-영역-테스트-선행)를 별도로 기록한다.

기존 기준선: [p2_test_cases.md](p2_test_cases.md) §2–§8은 INIT 4개, H 11개, HOOK 13개, UPD 6개, EFF 1개, ERR 3개, FLOW 3개로 **41행(테스트 ID 41개), 모두 O**다. [자식 경계 변경](p2_component_boundary_plan.md) 구현·검증과 독립 검토 지적 보완을 완료했다. 당시 `npm run check`: 타입 검사 통과, **26개 파일 293개 통과**. Phase 2 실행은 **100개**, Phase 1은 **193개**다. 이전 Phase 2 77개·전체 270개는 변경 전 기준선이다. 명세 ID 수·런타임 실행 수·컴파일 전용 타입 검사를 구분한다.

결과는 `O` 현재 구현의 검사 통과, `X` 실패, 빈칸은 미실행 또는 일부 검증을 뜻한다. 소스·테스트를 명세와 대조하고 전체 검사를 재실행해 아래 41행을 판정했다. H-09의 타입 부분은 컴파일 검사이고 나머지 DOM 증거는 jsdom 관찰이다. spy 호출 기록과 DOM 참조 검증을 구분한다. 과거41행 작업 당시에는 사용자 브라우저 실화면 검증을 수행하지 않았으며 이번 입력 검증은 아래 별도 기록을 따른다.

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
| 3. h()·정규화 (H) | **H-08** | 잘못된 첫 인자는 오류다. | O | 실행 1개. 빈 문자열·공백·null·1·객체 모두 오류, 빈 컨테이너 유지. 함수 전체 거부가 아닌 첫 인자 검증이며 함수+여분 인자는 H-09로 분리. |
| 3. h()·정규화 (H) | **H-09** | 함수 즉시 실행·원본 props·생략값·필수 타입·여분 인자 선거부 | O | 실행 3개+별도 컴파일 검사. before→child→after·진입 1회, 원본 props/payload/callback/명시 children 유지, 콜백 실행 가능. 생략/undefined/null은 빈 객체. 원문 여분 인자 3건 모두 진입 0회·기록 없음. h.types.ts의 필수 props·잘못된 타입·여분 인자·VNode/VNode[] 검사 통과(실행 0개). |
| 3. h()·정규화 (H) | **H-10** | 자식 반환의 허용·거부 행렬과 기존 정규화 재사용 | O | 실행 2개. 허용 행렬은 VNode 참조 유지·중첩 펼침·빈 값 제외. 원시 문자열/숫자·객체·함수·DOM·Promise의 직접/중첩 반환은 진입 1회 뒤 오류, DOM 없음. H-04·H-05 원문 입력 유지. |
| 3. h()·정규화 (H) | **H-11** | 요소·여러 함수 자식·중첩 자식을 기존 VNode로 합성 | O | 실행 2개. 단독 VNode와 최초 DOM 순서 SPAN/I/B/SPAN/I·텍스트 AGBCG·깊이 우선 진입 일치. 별도 루트 함수 h 반환은 감싸기 요소 없는 SPAN/I·AG 형제 표시. |
| 4. Hook (HOOK) | **HOOK-01** | useState가 mount에서 기록을 만들고 update에서 값과 setter를 유지한다. | O | 클릭마다 값이 바뀌고 setter 참조가 유지됨을 확인. |
| 4. Hook (HOOK) | **HOOK-02** | 여러 useState가 호출 순서로 분리되고 setter가 자기 기록만 바꾼다. | O | 두 번째 setter가 첫 번째 값을 바꾸지 않음 확인. |
| 4. Hook (HOOK) | **HOOK-03** | 함수형 updater가 이전 값 기준으로 다음 State를 계산한다. | O | 한 handler의 두 updater가 직전 값 기준으로 누적됨을 확인. |
| 4. Hook (HOOK) | **HOOK-04** | useMemo가 의존성이 같으면 다시 계산하지 않는다. | O | 실행 단위 2개. 다른 State 재렌더에서 계산 횟수 불변, `undefined` 결과도 캐시됨을 확인. |
| 4. Hook (HOOK) | **HOOK-05** | useMemo가 의존성이 바뀌면 다시 계산한다. | O | 실행 단위 4개. 값·deps 길이·순서·새 객체 참조 변경에서 재계산 확인. |
| 4. Hook (HOOK) | **HOOK-06** | useEffect가 commit 뒤 실행되고 의존성이 같으면 다시 실행하지 않는다. | O | 실행 단위 2개. label만 바뀌면 effect 미실행, 같은 deps면 cleanup도 미실행. |
| 4. Hook (HOOK) | **HOOK-07** | Component 실행 밖에서 Hook을 호출하면 오류다. | O | 실행 단위 2개. 일반 함수 호출과 `useMemo` 밖 호출 모두 오류. |
| 4. Hook (HOOK) | **HOOK-08** | Hook 개수나 종류가 render 사이에 바뀌면 오류다. | O | 실행 단위 3개. 개수 감소·증가·같은 위치 종류 변경 모두 오류, 화면 불변. |
| 4. Hook (HOOK) | **HOOK-09** | 같은 값을 넣는 setter는 갱신을 예약하지 않는다. | O | 실행 단위 3개. 같은 값·같은 updater·NaN 미예약, NaN 동일, +0/-0 구분·같은 참조·새 객체 구분 확인. |
| 4. Hook (HOOK) | **HOOK-10** | 자식의 세 Hook 거부와 바깥 문맥 해제 | O | 실행 3개. 각 Child 진입 1회·다음 문장 0회·계산/효과 0회·빈 DOM과 종료 후 바깥 세 Hook 거부 확인. owner=null 한 줄 제거 변이에서 3개 실패, 복원 후 3개 통과. |
| 4. Hook (HOOK) | **HOOK-11** | 정상 자식 앞뒤 부모 State A/B와 setter 재사용 | O | 실행 1개. A/B→A/B2→A2/B2·자식 1→2→3회, 두 setter 각각 참조 유지·서로 다름. 최초 표시와 매 갱신 직후 바깥 세 Hook 오류·계산/효과 0회. |
| 4. Hook (HOOK) | **HOOK-12** | 손자 뒤 자식 Hook 계속 차단·루트 문맥 복원 | O | 실행 3개. 세 Hook 모두 매 render child→grandchild-end→caught, A/B→A/B2·자식/손자 1→2회·setter 동일. 다음 문장/계산/효과 0회, 최초 및 갱신 후 바깥 Hook 거부. |
| 4. Hook (HOOK) | **HOOK-13** | 일반/정규화/Hook 오류 뒤 복원·부모 슬롯 비오염 | O | 실행 8개(일반 예외·잘못된 반환·세 Hook 5개, 정규화 getter 세 Hook 3개). 오류 종류·진입/catch 매 render 1회·다음 문장/계산/효과 0회. 다른 종류 루트 Hook과 setter 재사용, M:A→M:A2; memo 오용은 일반/getter 모두 A/B→A2/B→A2/B2·진입/catch 1→2→3회. 최초/각 갱신 직후 바깥 Hook 거부. 비공개 슬롯 노출 없음. |
| 5. 갱신 (UPD) | **UPD-01** | State 변경이 자동 재렌더와 필요한 Patch로 이어진다. | O | 바뀐 텍스트만 update되고 나머지 노드는 유지됨을 확인. |
| 5. 갱신 (UPD) | **UPD-02** | 화면 데이터가 같으면 applyPatch를 호출하지 않는다. | O | 재렌더는 실행되지만 `applyPatch` spy 호출 0회, 실제 DOM 객체 불변. |
| 5. 갱신 (UPD) | **UPD-03** | 화면이 같아도 handler가 바뀌면 새 handler가 실행된다. | O | 텍스트는 그대로이고 클릭 결과만 새 handler로 바뀜을 확인. |
| 5. 갱신 (UPD) | **UPD-04** | handler가 제거되면 이전 handler가 실행되지 않는다. | O | enabled가 false인 동안 클릭이 아무 것도 실행하지 않음 확인. |
| 5. 갱신 (UPD) | **UPD-05** | effect 안 setter가 현재 처리 후 다음 갱신으로 이어진다. | O | effect가 끝난 뒤 다음 render가 실행됨을 확인. |
| 5. 갱신 (UPD) | **UPD-06** | 연속 setter 호출 후 최종 State와 화면이 일치한다. | O | 두 값이 모두 반영된 최종 화면 확인. |
| 6. 생명주기 (EFF) | **EFF-01** | 의존성이 바뀌면 이전 cleanup이 새 effect보다 먼저 실행된다. | O | 실행 단위 11개. run→cleanup→run, deps 생략 시 매 render 실행·매번 cleanup, 여러 효과의 순서, deps 비배열 4개, cleanup 반환 오류 3개, 화면 불변에서의 효과 판단 확인. |
| 7. 실패 (ERR) | **ERR-01** | 갱신 중 render 오류는 DOM 반영 전에 중단되고 이전 화면이 유지된다. | O | render 오류 시 DOM·현재 VDOM 유지, `applyPatch`·`syncEvents` 미호출, 첫 클릭의 State 증가 유지, 다음 갱신 정상. |
| 7. 실패 (ERR) | **ERR-02** | applyPatch 실패는 마지막 성공 VDOM으로 복구하고 오류를 전파한다. | O | 실행 단위 3개. 부분 DOM 변경 후 마지막 성공 화면 재생성, 훅 슬롯 복원으로 같은 setter 재예약, `syncEvents`·effect 미실행, 다음 갱신 정상. effect setter로 시작한 갱신이 실패해도 이미 실행한 `[]` 효과가 다시 실행되지 않음을 확인. |
| 7. 실패 (ERR) | **ERR-03** | 갱신 중 자식 Hook 오류: 0→1 실패→2 정상 | O | 실행 1개. captureScheduledUpdates로 오류 포착. Child 진입 [0,1]·다음 문장 누적 1, span 0·section/span/text/button 동일, Patch/sync 0·효과 [0]. 다음 정상 콜백 진입 [0,1,2]·span 2·참조 유지·Patch/sync 각 1·효과 [0,2]. 실패/정상 직후 바깥 세 Hook 오류. State 1 유지 증명. |
| 8. 통합 (FLOW) | **FLOW-01** | 카운터에서 클릭·State·화면 반영이 자동으로 이어진다. | O | 증가 3회·감소 1회 후 화면 2, 루트 요소 객체 유지 확인. |
| 8. 통합 (FLOW) | **FLOW-02** | 함수 h 경계의 자식 이벤트로 부모 State·화면 갱신 | O | 실행 1개. 기존 div 안 함수 h 호출. count 0·1 진입 각 1회, 각 render의 부모 callback과 자식 props 참조 동일·render 간 callback은 변경. 클릭 후 0→1·버튼/텍스트 DOM 참조 동일. |
| 8. 통합 (FLOW) | **FLOW-03** | 입력 요소의 value·checked가 properties를 거쳐 화면에 반영된다. | O | 최초 value A·checked false, 갱신 후 B·true, input 요소 객체 유지 확인. |

## 입력 동기화·선택 영역 테스트 선행

명세: [p2_input_sync_test_cases.md](p2_input_sync_test_cases.md). 아래는 실제 실행한 결과이며
실패를 현재 동작에 맞춰 기대값 수정으로 없애지 않는다. 숫자는 명세 행 수가 아닌 실행 단위다.

| 그룹 | 실행 | 통과 | 실패 | 판정 |
|---|---:|---:|---:|---|
| INPUT | 21 | 21 | 0 | 같은 State의 값 복원·최신 조회·대상 한정·복수 앱·checkbox·OPTION.selected 포함 |
| CARET | 18 | 18 | 0 | 대표 수치·선택 방향·표시 문자 경계. CARET-05 네 입력은 결정성·안전성만 검증 |
| SELECT | 8 | 8 | 0 | 명시 위치 우선·초기/위치만 변경·선언 삭제·속성만 갱신 시 커서 유지 |
| GUARD | 10 | 10 | 0 | 미지원 타입·조합 중 쓰기 방지·비조합 input 재개·포커스·실패·제거/교체 |
| **새 파일 합계** | **57** | **57** | **0** | `tests/integration/p2/controlled-input.test.ts` |
| 기존 회원가입 데모 | 4 | 4 | 0 | DEMO-03/04 정상 기대 통과. 같은 루트 전환·붙여넣기도 유지 |
| 기존 명세 기준선 | 293 | 293 | 0 | 기존 26개 파일은 전부 통과 |
| **전체** | **354** | **354** | **0** | 28개 파일 전부 통과 |

### 실행 기록

1. 변경 전 `npm run check`: 타입 검사 통과, 27개 파일·297개 통과.
2. 문서에서 정확한 입력·시점·기대값을 먼저 작성한 뒤 테스트 코드 작성.
   기존 helper `createContainer`·`flushUpdates`·`captureScheduledUpdates`·`resetBody` 재사용.
3. 새 테스트는 기존 공개 `startApp`·`h`·Hook을 호출한다. 실제 Patch를 실행하는 spy로
   실패 주입을 하되 정상 경로를 대역으로 대체하지 않는다. 내부 미구현 함수 import 없음.
4. `npm run typecheck`: 통과.
5. `npx vitest run --reporter=json --outputFile=/tmp/opencode/input-sync-all-red.json`:
   352개 중 309개 통과·43개 실패. **실패43개 모두 assertion 실패**이며 모듈 부재·환경
   초기화 중단이 아니다. 새 INPUT-01a/b·15는 값 불일치, CARET은 끝 이동,
   SELECT는 명시 위치 미반영을 검출한다.
6. 기존 `tests/integration/p2/signup-demo.test.ts`의 두 경계 기대를 DEMO-03/04로 바꿨다.
   원래 실패를 기대하는 검사로 뒤집거나 skip/fails 표식으로 통과 처리하지 않았다.
7. 테스트 선행 단계의 `git diff --check`: 통과. 이 시점에는 엔진을 변경하지 않았음.
8. 사용자 구현 승인 후 [설계](p2_input_sync_design.md)를 작성하고 CommandCode DeepSeek V4.1
   Flash 세 에이전트가 파일을 나눠 구현. 부모 세션의 `npm run check`: 352개 전부 통과.
9. 독립 [코드 리뷰](p2_input_sync_review.md)에서 다중 OPTION 복원 누락과 attribute-only
   선택 재적용을 재현. 문서·INPUT-16/SELECT-08을 먼저 추가하고 각각 assertion 실패 확인 후 수정.
   추가 두 항목만 실행한 필터 검사의55 skipped는 선택하지 않은 항목이며, 전체 검사는 skip0이다.
10. 부모 세션 `npm run check`: 타입 검사·28개 파일354개 통과. 리뷰어 두 명의 재검토에서도
    같은 결과·기존 중간 지적 해소 확인, 새 고위험 결함 발견 없음. 부분 선언 등 미확정은 유지.
11. `npm run build`: 타입 검사와 Phase 1 main.html 빌드 통과. Phase 2 배포 입력 확정·배포를 뜻하지 않음.
12. 실제 Chromium 계열 Brave의 native 키 입력으로 A/B/삭제 확인:
    `cat@example.com`의2번 위치에 공백 → 값 유지·커서2,
    같은 위치에 ` x ` 삽입 → `caxt@example.com`·커서3,
    Backspace → `cat@example.com`·커서2. 각 시점 State 텍스트도 실제 값과 일치.
    같은 #app 참조·performance.timeOrigin 유지, 고양이로 돌아온 뒤 쓰다듬은 횟수1 유지.
    최종 브라우저 실행의 page/console 오류0. 클립보드 붙여넣기 자체·IME·undo는 검증하지 않음.
13. `/tmp/opencode`의 별도 복사본 두 개에서 한 기능씩 무력화:
    collectInputChanges를 무력화하면 INPUT-01a가 공백 잔류로 실패,
    자동 setSelectionRange를 제거하면 CARET-01a가 커서3≠2로 실패.
    원본 프로젝트를 변형하지 않았고 테스트 기대도 수정하지 않음.
14. 표시 문자 경계·단조성336회 추가 probe 통과. 국소 비용 측정과20만 문자 지연은
    [설계 §6](p2_input_sync_design.md#6-구현된-내부-기본값과-리뷰-보완)에 기록. 브라우저 전체 성능 보장 아님.

### 미검증·한계

- 자동 회귀는 jsdom이다. 실제 Brave의 텍스트 입력 A/B·삭제·같은 루트 전환은 확인했으나
  실제 클립보드·한글 IME·undo/redo·autofill·다중 브라우저는 미검증이다.
- INPUT-06은 같은 트리의 비대상 DOM value 읽기·쓰기를 막는다. 이 결과만으로 WeakMap
  사용 여부나 모든 내부 순회가 없다는 것을 증명하지는 않는다. 독립 소스 리뷰에서
  FunctionComponent별 WeakMap·성공 시 교체를 확인했다. assertAllLinked 전체 순회는 유지된다.
- 마지막 동률·상대 위치 반올림·계산량 상한·compositionend 단독 처리 등은 명세 §8에
  잠정 내부 기본값과 별도 미확정 정책으로 남겼다. 수치 경계 전용 회귀는 아직 없고 통과 수에 포함하지 않는다.
- Intl.Segmenter 지원 런타임 전제, 명시적 부분 선언·undefined·타입별 value 정규화·
  handler 예외·중첩 이벤트·syncEvents 실패의 확대된 보장은 여전히 미확정이다.

## 기존 실행 단위 구성

현재 명세 ID **41개**와 Phase 2 실행 **100개**를 구분한다. 변경 전 실행은 19+35+16+7=77개, 현재는 +23개다. 컴파일 전용 타입 검사는 런타임 수에 합산하지 않는다.

| 파일 | 실행 단위 | 구성 |
| --- | --- | --- |
| [tests/unit/p2/h.test.ts](../tests/unit/p2/h.test.ts) | 26 | 기존 19개(H-08 교체 포함)+H-09 3개·H-10 2개·H-11 2개 |
| [tests/unit/p2/hooks.test.ts](../tests/unit/p2/hooks.test.ts) | 50 | 기존 35개+HOOK-10 3개·HOOK-11 1개·HOOK-12 3개·HOOK-13 8개 |
| [tests/integration/p2/app.test.ts](../tests/integration/p2/app.test.ts) | 16 | INIT·UPD·FLOW 직접 검증 15개 + 컴포넌트 오류 전파 보강 1개 |
| [tests/integration/p2/errors.test.ts](../tests/integration/p2/errors.test.ts) | 8 | 기존 7개+ERR-03 1개 |
| **Phase 2 실행 합계** | **100** | 4개 파일, 명세 41개의 여러 입력·시나리오·보강 테스트 포함 |
| [tests/unit/p2/h.types.ts](../tests/unit/p2/h.types.ts) | 0 | 컴파일 전용. 필수 props·여분 인자·반환 타입 검사 통과 |
| **Phase 1 실행 합계** | **193** | 22개 파일, 변경 전과 동일 |
| **전체 실행 합계** | **293** | 26개 파일. 타입 검사를 별도 수행 |

## 테스트 코드 위치

공개 경계는 `src/component/index.ts`다. `h`, `startApp`, `useState`, `useMemo`, `useEffect`를 여기서 내보낸다. 공개 h 오버로드가 문자열/함수를 분기하고 함수는 내부 renderChild 1개로 실행한다. h.ts의 기존 요소 h는 createElementVNode 별칭으로, 반환 정규화도 기존 함수를 재사용한다. 이전 re-export 방식은 대체됐다.

| 범위 | 파일 |
| --- | --- |
| INIT, UPD, FLOW | [tests/integration/p2/app.test.ts](../tests/integration/p2/app.test.ts) |
| ERR | [tests/integration/p2/errors.test.ts](../tests/integration/p2/errors.test.ts) |
| H | [tests/unit/p2/h.test.ts](../tests/unit/p2/h.test.ts) |
| H-09 타입 검사(실행하지 않음) | [tests/unit/p2/h.types.ts](../tests/unit/p2/h.types.ts) |
| HOOK, EFF | [tests/unit/p2/hooks.test.ts](../tests/unit/p2/hooks.test.ts) |
| 공통 대기·fixture | [tests/helpers/p2.ts](../tests/helpers/p2.ts) |

## 실행 기록

- 현재 문서 동기화: 명세 ID·진행표 41개 모두 통과. 변경 H-08·FLOW-02와 신규 8개 ID의 증거는 위 표를 따른다. 아래 과거 기록은 보존하고 그 뒤 최종 결과를 추가한다.
- 2026-11-10: `tests/unit/p2/*`, `tests/integration/p2/*` 작성. 구현 전이므로 `npx vitest run tests/unit/p2 tests/integration/p2` 결과는 **32 실패 / 4 통과**(테스트 36개)였다. 통과 4개는 `H-04`·`H-05`·`H-08`·`HOOK-07`이며, 미구현 stub이 항상 예외를 던져 생긴 가짜 통과였다. 이후 구현·보강과 회귀 테스트 추가로 실행 단위가 77개가 됐다.
- 2026-11-11: `npx vitest run tests/unit/p2 tests/integration/p2 --reporter=json` → **4개 파일, 75개 통과, exit 0**. 파일별 19 + 35 + 16 + 5.
- 2026-11-11: `npm test` → **26개 파일, 268개 통과, exit 0, unhandled error 0**. Phase 1 회귀는 22개 파일 193개 통과다.
- 2026-11-11: `npm run check` → 타입 검사와 전체 테스트 통과, exit 0.
- 2026-11-11: ERR-02 effect setter 복원 회귀 1개와 effect cleanup 오류 1개를 `tests/integration/p2/errors.test.ts`에 추가. `npx vitest run tests/integration/p2/errors.test.ts`는 수정 전 **1 실패 / 6 통과, exit 1**(`['effect','effect']` ≠ `['effect']`), 수정 후 **7 통과, exit 0**이었다.
- 2026-11-11: `npx vitest run tests/unit/p2 tests/integration/p2 --reporter=dot` → **4개 파일, 77개 통과, exit 0**. 파일별 19 + 35 + 16 + 7.
- 2026-11-11: `npm test` → **26개 파일, 270개 통과, exit 0, unhandled error 0**. Phase 1 회귀는 22개 파일 193개 통과다.
- 2026-11-11: `npm run check` → 타입 검사와 전체 테스트 통과, exit 0.
- 수치 주의: #61의 36개는 최초 작성 시점이다. 이전 구현·보강 후 77개·당시 ID 33개는 현재 변경 전 기준선이다.
- 2026-11-11 자식 경계 변경: H-09 첫 실행 `npx vitest run tests/unit/p2/h.test.ts`는 20개 중 1개 실패(문자열 전용 태그 거부), 최소 구현 후 같은 명령 20개 통과. 다른 기존 기능 재사용 경로는 첫 실행 통과였다. HOOK-12/13 테스트 fixture 결함과 별도 타입 검사 오류를 제품 실패로 기록하지 않는다. 상세 명령·원인은 [계획 실행 기록](p2_component_boundary_plan.md#실행-기록)에 보존했다.
- HOOK-10 민감도 검사: owner=null 한 줄 임시 제거 후 `npx vitest run tests/unit/p2/hooks.test.ts -t "HOOK-10"`는 3개 실패, 복원 후 3개 통과. 제품 구현 전 실패가 아닌 변이 검사다.
- 독립 검토 2건의 지적 보완: 타입 전용 파일 분리, H-09 여분 인자 원문, 바깥 Hook 검사 시점, HOOK-12 갱신 후 증거, HOOK-13 memo/getter 두 번째 State 갱신을 보강. 제품 소스 오류 지적은 없었다. 명세 검토자 최종 재검토는 최초 4건 모두 해결·새 핵심 회귀 없음으로 완료됐다.
- 중간 h.types.test.ts의 함수 존재 확인 1개는 제거했다. 27개 파일 294개·Phase 2 101개는 중간 결과이며 최종 수치가 아니다. 최종 h.types.ts는 tsconfig tests 포함으로 컴파일하고 vitest의 tests/**/*.test.ts 실행에서는 제외된다.
- 보완 후 `npx vitest run tests/unit/p2/h.test.ts tests/unit/p2/hooks.test.ts tests/integration/p2/errors.test.ts`: 3개 파일 **84개 통과**. `npm run typecheck` 통과, `npx tsc --noEmit --listFiles`로 h.types.ts 포함 확인.
- 최종 주 담당자 및 문서 담당자 `npm run check` 재실행: 타입 검사 통과, **26개 파일 293개 통과**. Phase 2 **100개**(26+50+16+8), Phase 1 **193개** 유지. 전체/Phase 2 모두 기준선 대비 +23이다.
- 문서 담당자 `npx vitest run tests/unit/p2 tests/integration/p2 --reporter=verbose`: **4개 파일 100개 통과**로 대상 범위를 별도 확인했다. JSON 집계 파이프의 파싱 실패는 테스트 실패와 구분하며 상세는 계획 실행 기록을 따른다.
- 주 담당자 `npm run build`: tsc --noEmit + vite build 성공. 사용자 브라우저 실화면 검증은 미실행이며 jsdom DOM 증거·빌드 성공과 구분한다.

## 확정된 경계

- 함수 h 경계: 실행과 반환 정규화 동안 소유자 null, finally 직전 소유자 복원. 자식 beginHooks/endHooks·별도 슬롯·resolve 없음. 직접 Child(props) 자동 감지는 지원하지 않는다. 콜백 props 실행·부모 setter 이벤트 전달은 허용하며 렌더 도중 setter 정책은 바꾸지 않는다. 위 H·HOOK·ERR·FLOW 행으로 검증했다. 정규화 차단은 배열 인덱스 getter 입력 증거이며 Proxy·특수 반복자 전반의 검증을 뜻하지 않는다.
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
