# Phase 1 테스트 진행표

기준: [p1_test_cases.md](p1_test_cases.md) §2–§12. 명세의 테스트 ID별로 한 행을 작성한다. 테스트 케이스는 INIT 2개, HTML 3개, SNAP 6개, NODE-COMMAND 2개, DIFF 9개, ORDER 5개, MOVE 7개, PATCH 8개, FLOW 5개, HIST 7개, CONF 1개, IT 8개로 총 63행이다. 구현 설계는 [p1_history_handler_design.md](p1_history_handler_design.md)를 따른다.

결과는 `O` 통과, `X` 실패, 빈칸은 미실행 또는 일부만 검증됨을 뜻한다. 일부 검증만 통과한 케이스는 전체 통과로 표시하지 않는다. mock 단위 테스트의 통과는 원인 분석에 명시하며 실제 함수 통합 통과를 의미하지 않는다.

| 테스트 카테고리 | 테스트 코드 | 테스트 내용 | 테스트 결과(O,X) | 원인 분석 |
| --- | --- | --- | --- | --- |
| 2. 초기화 (INIT) | **INIT-01** | 빈 실제 영역에 샘플을 렌더링하고 편집기·첫 이력·DOM 참조를 준비한다. | O | mock 기반 단위 검증 2개 통과. 지정된 initializeDOM 호출·샘플 입력, 의존 함수 전달, 편집기 원문, 첫 저장 1회, 컨테이너 유지와 mock Patch가 만든 전체 참조를 확인했다. 실제 Snapshot·Diff·Patch·History 통합 검증은 대기한다. |
| 2. 초기화 (INIT) | **INIT-02** | 초기 이력 준비 후 각 버튼이 Patch·이력 이동 경로를 한 번씩 실행한다. | O | mock 기반 단위 검증 1개 통과. 클릭 전 첫 저장, 실제 이벤트 연결을 통한 mock Patch 핸들러 1회·추가 저장 1회, 뒤로 -1·앞으로 1 핸들러 호출과 추가 저장 없음을 확인했다. 실제 핸들러의 변경·복원 동작은 통합 검증 대기다. |
| 3. 코드 읽기/파싱 (HTML) | **HTML-01** | 편집기 UI 대신 입력한 HTML 원문을 변경 없이 읽는다. | O | 원문·줄바꿈·들여쓰기와 편집기·기존 DOM 유지 검증 통과. 실제 init에 연결한 History mock의 저장 호출 기록 유지·이동 호출 없음과 현재 VDOM 데이터·참조 유지도 통과. 실제 이력 알고리즘은 HIST에서 검증한다. |
| 3. 코드 읽기/파싱 (HTML) | **HTML-02** | 중첩 HTML을 임시 DOM으로 파싱하고 실제 화면은 유지한다. | O | 구조·속성·텍스트·순서·임시 DOM 분리·기존 화면 유지 검증 통과. 실제 init에 연결한 History mock의 추가 저장·이동 없음과 현재 VDOM 유지도 통과. 실제 이력 알고리즘은 HIST에서 검증한다. |
| 3. 코드 읽기/파싱 (HTML) | **HTML-03** | 빈 HTML을 자식 없는 VDOM으로 변환하고 실제 화면은 아직 유지한다. | O | 실제 createSnapshot 구현 후 기존 테스트 통과. 빈 VRoot·기존 DOM·현재 VDOM 유지와 History mock의 추가 저장·이동 없음까지 확인했다. |
| 4. 스냅샷 (SNAP) | **SNAP-01** | 요소·텍스트의 종류·태그·속성과 중첩된 자식 순서를 보존한다. | O | 지정 입력의 전체 VRoot·VNode 데이터와 자식 순서, 임시 노드 미삽입, 기존 실제 DOM·History mock 유지 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-02** | 주석 노드만 제외하고 이웃 텍스트·요소의 순서를 유지한다. | O | 주석을 제외한 A·span·B 순서와 하위 구조 유지, 원본 주석 미삭제, 전체 dom null 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-03** | 원본 임시 DOM·편집기 수정이 이미 만든 VDOM 데이터를 바꾸지 않는다. | O | 원본 class·텍스트·자식 구조·편집기 수정 후에도 Snapshot의 원래 데이터와 dom null 유지 검증 통과. History mock도 유지한다. |
| 4. 스냅샷 (SNAP) | **SNAP-04** | 새로운 data 속성을 포함한 일반 속성의 이름·값을 수집한다. | O | 지정 속성 4개와 별도 key 입력의 속성 복사, 원본 속성·실제 DOM·History mock 유지 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-05** | 다음 VDOM은 기존·새 노드 구분 없이 Diff 전까지 실제 DOM 참조가 없다. | O | 다음 p·span·하위 텍스트·VRoot 전체 dom null, 이전 A 데이터·실제 DOM 참조 유지 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-06** | HTML에서 입력값·체크·선택 상태를 properties로 수집한다. | O | 테스트 함수 1개에서 입력 4종과 OPTION별 selected 상태를 검증했다. 속성·properties 분리, indeterminate false와 실제 화면 입력값을 읽지 않는 조건도 통과. |
| 5. 노드 명령 (NODE-COMMAND) | **NODE-COMMAND-01** | 현재 노드의 직접 명령과 자식에게서 받은 명령을 구분한다. | O | 교체·텍스트 변경·속성 변경과 자식 명령 취합을 격리 검증했다. 전체 Diff·Patch 연결과 명령 순서는 이 케이스의 범위가 아니다. |
| 5. 노드 명령 (NODE-COMMAND) | **NODE-COMMAND-02** | 변경 없는 자손은 연결하고 교체 하위 트리는 순회하지 않는다. | O | 변경 없는 자손 연결과 교체 하위 트리 미순회·미연결을 검증했다. 실제 DOM은 변경하지 않는다. |
| 5. Diff (DIFF) | **DIFF-01** | 같은 HTML을 다시 파싱해도 변경 명령은 없고 입력 VDOM·DOM은 유지된다. | O | 빈 명령, 실제 DOM 불변, 유지 노드의 DOM 연결을 확인했다. |
| 5. Diff (DIFF) | **DIFF-02** | 텍스트만 바뀌면 요소 교체 없이 텍스트 update 명령을 반환한다. | O | 기존 텍스트 대상 update와 p 미교체, 실제 DOM 불변을 확인했다. |
| 5. Diff (DIFF) | **DIFF-03** | 속성 추가·변경·삭제를 update로 계산하고 속성 나열 순서는 무시한다. | O | class 변경·data-extra 추가·title 삭제와 속성 순서 무시를 확인했다. |
| 5. Diff (DIFF) | **DIFF-04** | 태그·노드 종류 변경은 하위 중복 명령 없이 replace로 계산한다. |  | P1-CONF-03으로 기대 결과가 확정됐다. 같은 key + 다른 태그 replace를 검증하도록 `it.skip` 해소가 남아 있다. keyless replace는 IT-05에서 별도로 검증했다. |
| 5. Diff (DIFF) | **DIFF-05** | 입력·선택 프로퍼티의 변경을 false·빈 문자열까지 update에 담는다. | O | value·checked·selected 변경과 false·빈 문자열 처리를 확인했다. 함수 단위 추가·제거 계약도 별도 통과했다. |
| 5. Diff (DIFF) | **DIFF-06** | 중첩된 텍스트 하나만 바뀌면 부모·형제 변경 명령을 만들지 않는다. | O | 텍스트 update만 생성되고 부모·형제 replace/update가 없음을 확인했다. |
| 5. Diff (DIFF) | **DIFF-07** | 같은 key를 가진 형제는 move로 대응하고 새로 만들지 않는다. | O | b 이동과 a 텍스트 update, replace·insert·remove 미생성을 확인했다. |
| 5. Diff (DIFF) | **DIFF-08** | key 있는 형제는 key로, key 없는 형제는 순서로 대응한다. | O | keyed·keyless 대응과 텍스트 update만 생성됨을 확인했다. |
| 5. Diff (DIFF) | **DIFF-09** | key 없는 형제의 순서 변경은 move로 보장하지 않는다. | O | 순서 대응에 따른 텍스트 update와 move 미생성을 확인했다. |
| 6. 명령 순서 (ORDER) | **ORDER-01** | 새 기준 형제를 먼저 생성한 뒤 그 앞에 삽입해 목표 순서를 만든다. |  | 명령 정렬 단위 검증은 통과했고 IT-04가 실제 Diff→Patch 경로를 검증했다. 명세의 ORDER-01 Patch 적용 todo는 아직 남아 있다. |
| 6. 명령 순서 (ORDER) | **ORDER-02** | 부모·자식 생성 의존성을 지키며 새 하위 트리를 한 번만 만든다. |  | 명령 계획 단위 검증과 IT-01 초기 렌더링은 통과했지만, ORDER-02 명세의 실제 Patch 적용 todo는 남아 있다. |
| 6. 명령 순서 (ORDER) | **ORDER-03** | 형제 삭제와 삽입이 겹쳐도 제거된 노드를 삽입 기준으로 쓰지 않는다. |  | 제거·삽입 계획 검증과 IT-03 복합 경로는 통과했다. ORDER-03 명세의 실제 Patch 적용 todo는 남아 있다. |
| 6. 명령 순서 (ORDER) | **ORDER-04** | 부모 제거·key 변경에 포함된 하위 트리에 중복 명령을 적용하지 않는다. |  | 부모 제거 사례는 통과했다. key 변경 사례는 P1-CONF-03에 따라 remove + insert 기대로 수정해야 하며 현재 `it.skip`과 Patch 적용 todo가 남아 있다. |
| 6. 명령 순서 (ORDER) | **ORDER-05** | replace는 제자리 교체만 담당하고 위치 변경은 move로 처리한다. |  | move → replace 정렬 단위 검증은 통과했다. Patch 적용 todo가 남아 있다. |
| 6. 이동 (MOVE) | **MOVE-01** | 변경 없는 A B C에서 이동 명령을 만들지 않는다. | O | 공통 케이스의 빈 move 배열을 확인했다. |
| 6. 이동 (MOVE) | **MOVE-02** | 이동만 있는 순서 변경을 정렬 후 실제 객체 재배치로 확인한다. | O | 앞쪽·뒤쪽·이웃 교환·역순·여러 노드 재배치에서 목표 순서와 기존 DOM 객체 유지를 확인했다. |
| 6. 이동 (MOVE) | **MOVE-03** | 삽입·삭제로 위치가 바뀌어도 move를 만들지 않는다. | O | 삽입만·삭제만 공통 케이스에서 move가 빈 배열임을 확인했다. |
| 6. 이동 (MOVE) | **MOVE-04** | move 대상·부모·기준 형제가 유효하고 제거 대상이나 자신을 기준으로 쓰지 않는다. | O | 이동과 삽입·이동과 삭제 공통 케이스에서 대상·부모·기준 형제 유효성을 확인했다. |
| 6. 이동 (MOVE) | **MOVE-05** | key 없는 형제의 내용 교환을 move로 판단하지 않는다. | O | keyless A B → B A에서 빈 move 배열을 확인했다. |
| 6. 이동 (MOVE) | **MOVE-06** | 네 형제의 24개 목표 순열에서 목표 순서와 객체 동일성을 확인한다. | O | 정렬된 move를 표준 DOM 연산으로 적용해 모든 순열을 확인했다. 제품 applyPatch를 대신하지 않는다. |
| 6. 이동 (MOVE) | **MOVE-07** | 이동·삽입·삭제 혼합을 실제 orderChanges·applyPatch와 연계한다. |  | 명세의 두 `it.todo`는 남아 있다. IT-03이 인접한 복합 경로를 검증하지만 MOVE-07의 개별 fixture를 대체하지 않는다. |
| 7. Patch (PATCH) | **PATCH-01** | 텍스트 update는 기존 요소·텍스트 객체를 유지하며 값만 바꾼다. | O | 실제 diff로 연결을 준비한 뒤 텍스트 update와 객체 동일성을 확인했다. |
| 7. Patch (PATCH) | **PATCH-02** | 속성 추가·변경·삭제와 입력 프로퍼티 변경을 기존 요소에 적용한다. | O | 실제 diff 연결 후 속성·프로퍼티 갱신과 input 객체 유지를 확인했다. |
| 7. Patch (PATCH) | **PATCH-03** | 지정한 처음·중간·끝 위치에 삽입·제거하고 나머지 형제는 유지한다. | O | 각 위치 삽입·제거와 나머지 형제 유지를 확인했다. |
| 7. Patch (PATCH) | **PATCH-04** | 지정한 노드만 교체하고 새 실제 DOM 참조를 연결하며 형제는 유지한다. | O | div → p 교체, 새 노드 연결, span 유지를 확인했다. |
| 7. Patch (PATCH) | **PATCH-05** | 기존 노드를 기준 형제 앞·맨 뒤로 이동하고 객체 동일성을 유지한다. | O | C를 A 앞으로, A를 맨 뒤로 옮기며 객체 동일성을 확인했다. |
| 7. Patch (PATCH) | **PATCH-06** | OPTION 생성 후 단일·다중 선택 상태를 렌더링·복원한다. | O | 단일 선택과 다중 선택의 OPTION.selected 유지를 확인했다. |
| 7. Patch (PATCH) | **PATCH-07** | 삽입·삭제·이동·수정·교체를 함께 적용해 목표 트리와 참조를 완성한다. | O | 실제 diff 연결 후 복합 명령 적용과 전체 참조 연결을 확인했다. |
| 7. Patch (PATCH) | **PATCH-08** | Diff가 연결한 유지 노드를 사용하고 새 노드까지 전체 참조를 완성한다. | O | 유지 노드 연결, 텍스트 update, em insert와 전체 참조 연결을 확인했다. |
| 8. 전체 Patch (FLOW) | **FLOW-01** | 텍스트 수정의 파싱·스냅샷·Diff·DOM 반영·이력 저장을 단계별 검증한다. |  | IT-02가 History 이전 단계의 Snapshot→Diff→Patch를 검증했다. 실제 handlePatch와 History 저장 단계는 미구현이다. |
| 8. 전체 Patch (FLOW) | **FLOW-02** | 첫 Patch에서 삽입·교체한 실제 노드를 다음 Patch에서 다시 생성하지 않고 수정한다. |  | IT-06·IT-07이 핵심 연속 Patch를 검증했다. 실제 handler와 이력 추가 횟수는 미구현이다. key 변경 교체 사례는 P1-CONF-03에 따라 remove + insert로 계산된다. |
| 8. 전체 Patch (FLOW) | **FLOW-03** | 코드 변경 없이 Patch하면 DOM 변경과 이력 저장을 모두 생략한다. |  | IT-08이 빈 Diff와 Patch 생략 판단을 검증했다. 실제 handler의 이력 생략은 미구현이다. |
| 8. 전체 Patch (FLOW) | **FLOW-04** | Patch에서 오류가 발생하면 이력을 추가하지 않고 현재 이력 위치를 유지한다. |  | handlePatch·History 미구현. |
| 8. 전체 Patch (FLOW) | **FLOW-05** | applyPatch 실패 시 실제 영역만 현재 이력으로 복원하고 편집기는 유지한다. |  | restoreSnapshot·handlePatch·History 미구현. |
| 9. History (HIST) | **HIST-01** | 현재 VDOM의 DOM 참조와 저장 데이터·HTML 원문을 분리하고 과거 상태를 보존한다. |  | History 모듈 미구현. |
| 9. History (HIST) | **HIST-02** | 뒤로·앞으로 이동하면 화면·HTML 원문을 복원하고 실제 DOM 참조를 재연결한다. |  | History·restoreSnapshot·handleHistoryMove 미구현. |
| 9. History (HIST) | **HIST-03** | 처음·마지막 이력 밖으로 이동하면 화면·코드·현재 위치를 유지한다. |  | History·handler 미구현. |
| 9. History (HIST) | **HIST-04** | 과거로 돌아가 새 상태를 저장하면 미래 이력만 제거한다. |  | History·handlePatch 미구현. |
| 9. History (HIST) | **HIST-05** | 삭제·교체 전 상태를 복원한 뒤 현재 화면에 재생성된 노드를 수정한다. |  | restoreSnapshot·History 미구현. B 상태의 key 변경은 P1-CONF-03에 따라 remove + insert다. |
| 9. History (HIST) | **HIST-06** | 속성 순서만 바꾸면 저장하지 않고 이력 이동 시 미저장 코드를 저장 원문으로 바꾼다. |  | History·handlePatch·handleHistoryMove 미구현. |
| 9. History (HIST) | **HIST-07** | 50개 상한을 넘으면 가장 오래된 이력을 제거한다. |  | History 미구현. P1-HISTORY-STATE-01에 따른 신규 상한·퇴거 검증 대기. |
| 10. 확정 규칙 (CONF) | **CONF-03** | 같은 부모의 중복 key·같은 key의 태그 변경·key 값 변경 규칙을 확인한다. |  | P1-CONF-03으로 정책 확정. DIFF-04 skip 해소와 ORDER-04 기대값 수정이 남아 있다. |
| 12. 통합 (IT) | **IT-01** | 빈 실제 영역에 Snapshot → Diff → Patch로 초기 렌더링한다. | O | 실제 함수만 연결해 새 하위 트리 1회 렌더링과 전체 dom 연결을 확인했다. |
| 12. 통합 (IT) | **IT-02** | 텍스트·속성·프로퍼티 변경을 같은 실제 DOM에 반영한다. | O | Diff 중 DOM 불변, 유지 노드 연결, Patch 후 같은 객체의 값 변경을 확인했다. |
| 12. 통합 (IT) | **IT-03** | 삽입·삭제·이동·수정을 실제 Diff 명령으로 함께 적용한다. | O | 실제 diff 명령으로 최종 c → a → x, 객체 동일성, 삭제 노드 분리를 확인했다. |
| 12. 통합 (IT) | **IT-04** | 새 형제 삽입 의존성을 지켜 기존 형제 앞에 생성한다. | O | 실제 Diff→Patch로 A → B → C 순서와 C 객체 유지를 확인했다. |
| 12. 통합 (IT) | **IT-05** | keyless 노드의 replace와 새 하위 트리 연결을 검증한다. | O | 실제 Diff가 div → p replace를 만들고 Patch가 새 노드를 연결함을 확인했다. |
| 12. 통합 (IT) | **IT-06** | 첫 Patch에서 삽입한 노드를 다음 Patch에서 재사용한다. | O | 두 번째 Patch가 같은 p·텍스트 객체를 수정하고 중복 p를 만들지 않음을 확인했다. |
| 12. 통합 (IT) | **IT-07** | 첫 Patch에서 교체한 노드를 다음 Patch에서 재사용한다. | O | replace로 만든 p·텍스트를 두 번째 Patch가 기존 DOM으로 수정함을 확인했다. |
| 12. 통합 (IT) | **IT-08** | 변경 없음에서는 빈 명령을 반환하고 Patch를 생략한다. | O | 빈 Diff, DOM 불변, 현재 VDOM 객체 유지를 확인했다. |

현재 실행 기록: 2026-11-08, `npm run check`.

- 테스트 파일 18개, 테스트 148개 통과, 2개 skip, 7개 todo.
- `npm run build` 통과.
- skip: DIFF-04, ORDER-04 key 변경 사례. 두 skip의 기대 결과는 확정됐고 테스트 코드 반영·실행이 남아 있다.
- todo: ORDER-01–05의 Patch 적용 5개, MOVE-07 연계 2개.
- 통합 테스트 위치: [tests/integration/vdom-snapshot-diff-patch.test.ts](../tests/integration/vdom-snapshot-diff-patch.test.ts).
- 사용되지 않는 보조 매칭 모듈 제거와 Diff 매칭 경로 단일화는 P1-MATCH-REMOVE-01을 따른다.

초기화 실행 기록: INIT-01은 테스트 함수 2개, INIT-02는 1개로 mock 기반 단위 검증을 통과했다. 실제 Snapshot·Diff·Patch·History 통합은 아직 완료되지 않았다.

HTML·Snapshot 실행 기록: HTML-01~03과 SNAP-01~06은 각각 테스트 함수 1개로 통과했다. SNAP-06의 입력 유형 4종은 한 테스트 안에서 확인한다.

Diff·Patch 실행 기록: DIFF·MOVE·PATCH 단위 테스트는 통과했다. ORDER는 명령 정렬까지만 검증됐고 Patch 적용 todo가 남아 있다. IT-01~IT-08은 실제 Snapshot→Diff→Patch 경로를 통과했다.

History 실행 기록: History·restoreSnapshot·handlePatch·handleHistoryMove가 아직 구현되지 않아 FLOW-04·FLOW-05와 HIST-01~HIST-07은 미실행이다.
