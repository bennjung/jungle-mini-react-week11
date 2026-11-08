# Phase 1 테스트 진행표

기준: [p1_test_cases.md](p1_test_cases.md) §2–§12. 명세의 테스트 ID별로 한 행을 작성한다. 테스트 케이스는 INIT 2개, HTML 3개, SNAP 6개, NODE-COMMAND 2개, DIFF 9개, ORDER 5개, MOVE 7개, PATCH 8개, FLOW 5개, HIST 7개, CONF 1개, IT 8개로 총 63행이다. 구현 설계는 [p1_history_handler_design.md](p1_history_handler_design.md)를 따른다.

결과는 `O` 통과, `X` 실패, 빈칸은 미실행 또는 일부만 검증됨을 뜻한다. 일부 검증만 통과한 케이스는 전체 통과로 표시하지 않는다. mock 단위 테스트와 실제 함수 통합 테스트의 범위를 원인 분석에 구분한다.

| 테스트 카테고리 | 테스트 코드 | 테스트 내용 | 테스트 결과(O,X) | 원인 분석 |
| --- | --- | --- | --- | --- |
| 2. 초기화 (INIT) | **INIT-01** | 빈 실제 영역에 샘플을 렌더링하고 편집기·첫 이력·DOM 참조를 준비한다. | O | mock 기반 단위 검증과 `tests/integration/app-flow.test.ts`의 실제 의존성 검증 모두 통과. 샘플 1회 렌더링, 편집기 원문, 첫 이력, 전체 참조 연결을 확인했다. |
| 2. 초기화 (INIT) | **INIT-02** | 초기 이력 준비 후 각 버튼이 Patch·이력 이동 경로를 한 번씩 실행한다. | O | 실제 init과 버튼 클릭으로 Patch·뒤로·앞으로 경로, 이력 추가·이동 횟수를 확인했다. |
| 3. 코드 읽기/파싱 (HTML) | **HTML-01** | 편집기 UI 대신 입력한 HTML 원문을 변경 없이 읽는다. | O | 원문·줄바꿈·들여쓰기와 실제 영역·현재 VDOM·History mock 유지 검증 통과. |
| 3. 코드 읽기/파싱 (HTML) | **HTML-02** | 중첩 HTML을 임시 DOM으로 파싱하고 실제 화면은 유지한다. | O | 구조·속성·텍스트·순서·임시 DOM 분리와 기존 화면 유지 검증 통과. |
| 3. 코드 읽기/파싱 (HTML) | **HTML-03** | 빈 HTML을 자식 없는 VDOM으로 변환하고 실제 화면은 아직 유지한다. | O | 빈 VRoot, 기존 실제 DOM·현재 VDOM·History mock 유지 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-01** | 요소·텍스트의 종류·태그·속성과 중첩된 자식 순서를 보존한다. | O | 전체 VRoot·VNode 데이터와 자식 순서, 임시 노드 미삽입, 기존 DOM 유지 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-02** | 주석 노드만 제외하고 이웃 텍스트·요소의 순서를 유지한다. | O | 주석 제외, 이웃 텍스트·요소 순서 유지, 원본 주석 미삭제 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-03** | 원본 임시 DOM·편집기 수정이 이미 만든 VDOM 데이터를 바꾸지 않는다. | O | 원본 변경 후 Snapshot 데이터와 dom null이 유지됨을 확인했다. |
| 4. 스냅샷 (SNAP) | **SNAP-04** | 새로운 data 속성을 포함한 일반 속성의 이름·값을 수집한다. | O | 일반 속성·data 속성·key 복사와 원본 DOM 유지 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-05** | 다음 VDOM은 기존·새 노드 구분 없이 Diff 전까지 실제 DOM 참조가 없다. | O | VRoot·모든 VNode dom null과 이전 DOM 참조 유지 검증 통과. |
| 4. 스냅샷 (SNAP) | **SNAP-06** | HTML에서 입력값·체크·선택 상태를 properties로 수집한다. | O | INPUT·TEXTAREA·SELECT·OPTION 4종과 indeterminate 기본값 검증 통과. |
| 5. 노드 명령 (NODE-COMMAND) | **NODE-COMMAND-01** | 현재 노드의 직접 명령과 자식에게서 받은 명령을 구분한다. | O | 교체·텍스트·속성 변경과 자식 명령 취합을 격리 검증했다. |
| 5. 노드 명령 (NODE-COMMAND) | **NODE-COMMAND-02** | 변경 없는 자손은 연결하고 교체 하위 트리는 순회하지 않는다. | O | 변경 없는 자손 연결, 교체 하위 트리 미순회·미연결 검증 통과. |
| 5. Diff (DIFF) | **DIFF-01** | 같은 HTML을 다시 파싱해도 변경 명령은 없고 입력 VDOM·DOM은 유지된다. | O | 빈 명령, 실제 DOM 불변, 유지 노드 연결 검증 통과. |
| 5. Diff (DIFF) | **DIFF-02** | 텍스트만 바뀌면 요소 교체 없이 텍스트 update 명령을 반환한다. | O | 텍스트 update와 p 미교체, 실제 DOM 불변 검증 통과. |
| 5. Diff (DIFF) | **DIFF-03** | 속성 추가·변경·삭제를 update로 계산하고 속성 나열 순서는 무시한다. | O | class·data-extra·title 처리와 속성 순서 무시 검증 통과. |
| 5. Diff (DIFF) | **DIFF-04** | 태그·노드 종류 변경은 하위 중복 명령 없이 replace로 계산한다. | O | P1-CONF-03에 따라 같은 key + 다른 태그 replace를 skip 없이 검증했다. |
| 5. Diff (DIFF) | **DIFF-05** | 입력·선택 프로퍼티의 변경을 false·빈 문자열까지 update에 담는다. | O | value·checked·selected 변경과 함수 단위 추가·제거 계약 통과. |
| 5. Diff (DIFF) | **DIFF-06** | 중첩된 텍스트 하나만 바뀌면 부모·형제 변경 명령을 만들지 않는다. | O | 텍스트 update만 생성되고 부모·형제 명령이 없음을 확인했다. |
| 5. Diff (DIFF) | **DIFF-07** | 같은 key를 가진 형제는 move로 대응하고 새로 만들지 않는다. | O | b 이동·a 텍스트 update와 replace·insert·remove 미생성 검증 통과. |
| 5. Diff (DIFF) | **DIFF-08** | key 있는 형제는 key로, key 없는 형제는 순서로 대응한다. | O | keyed·keyless 대응과 텍스트 update만 생성됨을 확인했다. |
| 5. Diff (DIFF) | **DIFF-09** | key 없는 형제의 순서 변경은 move로 보장하지 않는다. | O | 순서 대응에 따른 텍스트 update와 move 미생성 검증 통과. |
| 6. 명령 순서 (ORDER) | **ORDER-01** | 새 기준 형제를 먼저 생성한 뒤 그 앞에 삽입해 목표 순서를 만든다. | O | 실제 diff·orderChanges·applyPatch로 A→B→C, C·부모 유지, 새 참조 연결을 확인했다. |
| 6. 명령 순서 (ORDER) | **ORDER-02** | 부모·자식 생성 의존성을 지키며 새 하위 트리를 한 번만 만든다. | O | 빈 루트에서 section·p·텍스트를 한 번만 생성하고 루트를 유지함을 확인했다. |
| 6. 명령 순서 (ORDER) | **ORDER-03** | 형제 삭제와 삽입이 겹쳐도 제거된 노드를 삽입 기준으로 쓰지 않는다. | O | A→X→C, X의 before 유효성, A·C 객체 유지, B 분리를 확인했다. |
| 6. 명령 순서 (ORDER) | **ORDER-04** | 부모 제거·key 변경에 포함된 하위 트리에 중복 명령을 적용하지 않는다. | O | 부모 제거는 remove 1개, key 변경은 remove+insert, 하위 p 재조작·span 중복 생성 없음과 최종 트리를 확인했다. |
| 6. 명령 순서 (ORDER) | **ORDER-05** | replace는 제자리 교체만 담당하고 위치 변경은 move로 처리한다. | O | move→replace 순서, 최종 B→A'→C, B·C 객체 유지와 이전 A 분리를 확인했다. |
| 6. 이동 (MOVE) | **MOVE-01** | 변경 없는 A B C에서 이동 명령을 만들지 않는다. | O | 빈 move 배열 검증 통과. |
| 6. 이동 (MOVE) | **MOVE-02** | 이동만 있는 순서 변경을 정렬 후 실제 객체 재배치로 확인한다. | O | 앞쪽·뒤쪽·이웃 교환·역순·여러 노드 재배치 검증 통과. |
| 6. 이동 (MOVE) | **MOVE-03** | 삽입·삭제로 위치가 바뀌어도 move를 만들지 않는다. | O | 삽입만·삭제만 공통 케이스에서 move가 빈 배열임을 확인했다. |
| 6. 이동 (MOVE) | **MOVE-04** | move 대상·부모·기준 형제가 유효하고 제거 대상이나 자신을 기준으로 쓰지 않는다. | O | 이동과 삽입·이동과 삭제 케이스의 참조 유효성을 확인했다. |
| 6. 이동 (MOVE) | **MOVE-05** | key 없는 형제의 내용 교환을 move로 판단하지 않는다. | O | keyless A B→B A에서 빈 move 배열 확인. |
| 6. 이동 (MOVE) | **MOVE-06** | 네 형제의 24개 목표 순열에서 목표 순서와 객체 동일성을 확인한다. | O | 모든 순열에 정렬된 move를 표준 DOM 연산으로 적용했다. |
| 6. 이동 (MOVE) | **MOVE-07** | 이동·삽입·삭제 혼합을 실제 orderChanges·applyPatch와 연계한다. | O | abc→cxab와 abcd→dac를 실제 연계 적용해 순서·객체·삭제 분리를 확인했다. |
| 7. Patch (PATCH) | **PATCH-01** | 텍스트 update는 기존 요소·텍스트 객체를 유지하며 값만 바꾼다. | O | 실제 diff 연결 후 텍스트 update와 객체 동일성 검증 통과. |
| 7. Patch (PATCH) | **PATCH-02** | 속성 추가·변경·삭제와 입력 프로퍼티 변경을 기존 요소에 적용한다. | O | 실제 diff 연결 후 속성·프로퍼티 갱신과 input 객체 유지 확인. |
| 7. Patch (PATCH) | **PATCH-03** | 지정한 처음·중간·끝 위치에 삽입·제거하고 나머지 형제는 유지한다. | O | 각 위치 삽입·제거와 나머지 형제 유지 검증 통과. |
| 7. Patch (PATCH) | **PATCH-04** | 지정한 노드만 교체하고 새 실제 DOM 참조를 연결하며 형제는 유지한다. | O | div→p 교체, 새 노드 연결, span 유지 검증 통과. |
| 7. Patch (PATCH) | **PATCH-05** | 기존 노드를 기준 형제 앞·맨 뒤로 이동하고 객체 동일성을 유지한다. | O | C를 A 앞으로, A를 맨 뒤로 이동하며 객체 동일성 확인. |
| 7. Patch (PATCH) | **PATCH-06** | OPTION 생성 후 단일·다중 선택 상태를 렌더링·복원한다. | O | 단일·다중 선택의 OPTION.selected 유지 검증 통과. |
| 7. Patch (PATCH) | **PATCH-07** | 삽입·삭제·이동·수정·교체를 함께 적용해 목표 트리와 참조를 완성한다. | O | 실제 diff 연결 후 복합 명령 적용과 전체 참조 연결 확인. |
| 7. Patch (PATCH) | **PATCH-08** | Diff가 연결한 유지 노드를 사용하고 새 노드까지 전체 참조를 완성한다. | O | 유지 노드·텍스트·em insert의 전체 참조 연결 확인. |
| 8. 전체 Patch (FLOW) | **FLOW-01** | 텍스트 수정의 파싱·스냅샷·Diff·DOM 반영·이력 저장을 단계별 검증한다. | O | 실제 handler로 텍스트 수정, DOM 객체 유지, VDOM 참조, 한 번 저장을 확인했다. |
| 8. 전체 Patch (FLOW) | **FLOW-02** | 첫 Patch에서 삽입·교체한 실제 노드를 다음 Patch에서 다시 생성하지 않고 수정한다. | O | 삽입·교체 두 사례에서 두 번째 Patch가 같은 p·텍스트를 수정함을 확인했다. |
| 8. 전체 Patch (FLOW) | **FLOW-03** | 코드 변경 없이 Patch하면 DOM 변경과 이력 저장을 모두 생략한다. | O | applyPatch·set·move 미호출과 기존 live 유지 확인. |
| 8. 전체 Patch (FLOW) | **FLOW-04** | Patch에서 오류가 발생하면 이력을 추가하지 않고 현재 이력 위치를 유지한다. | O | applyPatch 오류 시 set 미호출, move(0), entry 유지 검증 통과. |
| 8. 전체 Patch (FLOW) | **FLOW-05** | applyPatch 실패 시 실제 영역만 현재 이력으로 복원하고 편집기는 유지한다. | O | 부분 DOM 변경 후 실패에서 full restore, editor 유지, move(0), 재시도 중복 없음 확인. |
| 9. History (HIST) | **HIST-01** | 현재 VDOM의 DOM 참조와 저장 데이터·HTML 원문을 분리하고 과거 상태를 보존한다. | O | get=live, 저장 entry=dom null 복사본·HTML, 원본 변경에도 entry 불변 확인. |
| 9. History (HIST) | **HIST-02** | 뒤로·앞으로 이동하면 화면·HTML 원문을 복원하고 실제 DOM 참조를 재연결한다. | O | 실제 handler와 restore로 화면·원문·전체 참조·이력 데이터 유지 확인. |
| 9. History (HIST) | **HIST-03** | 처음·마지막 이력 밖으로 이동하면 화면·코드·현재 위치를 유지한다. | O | History 단위와 실제 버튼 경계 no-op 검증 통과. |
| 9. History (HIST) | **HIST-04** | 과거로 돌아가 새 상태를 저장하면 미래 이력만 제거한다. | O | A·B·D 저장과 C 미래 이력 제거를 확인했다. |
| 9. History (HIST) | **HIST-05** | 삭제·교체 전 상태를 복원한 뒤 현재 화면에 재생성된 노드를 수정한다. | O | restore 후 새 p가 재생성되고 후속 Patch가 화면의 그 p를 수정함을 확인했다. |
| 9. History (HIST) | **HIST-06** | 속성 순서만 바꾸면 저장하지 않고 이력 이동 시 미저장 코드를 저장 원문으로 바꾼다. | O | 속성 순서 no-op, 미저장 편집의 원문 복원, 이동 시 set 미호출 확인. |
| 9. History (HIST) | **HIST-07** | 50개 상한을 넘으면 가장 오래된 이력을 제거한다. | O | 51번째 저장 퇴거, 길이 50, 마지막 위치, 과거 저장 시 미래만 제거, 빈 상태·범위 밖 no-op 확인. |
| 10. 확정 규칙 (CONF) | **CONF-03** | 같은 부모의 중복 key·같은 key의 태그 변경·key 값 변경 규칙을 확인한다. | O | P1-CONF-03 정책을 DIFF-04·ORDER-04 및 관련 통합 테스트로 검증했다. |
| 12. 통합 (IT) | **IT-01** | 빈 실제 영역에 Snapshot → Diff → Patch로 초기 렌더링한다. | O | 8개 IT 통합 테스트 모두 통과. 초기 렌더링과 전체 dom 연결 확인. |
| 12. 통합 (IT) | **IT-02** | 텍스트·속성·프로퍼티 변경을 같은 실제 DOM에 반영한다. | O | Diff 중 DOM 불변, 유지 노드 연결, Patch 후 동일 객체 변경 확인. |
| 12. 통합 (IT) | **IT-03** | 삽입·삭제·이동·수정을 실제 Diff 명령으로 함께 적용한다. | O | 실제 diff 명령으로 최종 c→a→x, 객체 동일성, 삭제 노드 분리 확인. |
| 12. 통합 (IT) | **IT-04** | 새 형제 삽입 의존성을 지켜 기존 형제 앞에 생성한다. | O | 실제 Diff→Patch로 A→B→C와 C 객체 유지 확인. |
| 12. 통합 (IT) | **IT-05** | keyless 노드의 replace와 새 하위 트리 연결을 검증한다. | O | 실제 Diff가 div→p replace를 만들고 Patch가 새 노드를 연결함을 확인. |
| 12. 통합 (IT) | **IT-06** | 첫 Patch에서 삽입한 노드를 다음 Patch에서 재사용한다. | O | 두 번째 Patch가 같은 p·텍스트를 수정하고 중복 p를 만들지 않음 확인. |
| 12. 통합 (IT) | **IT-07** | 첫 Patch에서 교체한 노드를 다음 Patch에서 재사용한다. | O | replace로 만든 p·텍스트를 두 번째 Patch가 기존 DOM으로 수정함을 확인. |
| 12. 통합 (IT) | **IT-08** | 변경 없음에서는 빈 명령을 반환하고 Patch를 생략한다. | O | 빈 Diff, DOM 불변, 현재 VDOM 유지 확인. |

현재 실행 기록: 2026-11-08, `npm run check`.

- 테스트 파일 22개, 테스트 193개 통과, skip 0개, todo 0개.
- `npm run typecheck`, `npm run build` 통과.
- 통합 테스트 위치: [handlers.test.ts](../tests/integration/handlers.test.ts), [app-flow.test.ts](../tests/integration/app-flow.test.ts), [vdom-snapshot-diff-patch.test.ts](../tests/integration/vdom-snapshot-diff-patch.test.ts).
- 실제 브라우저 확인: 샘플 초기 렌더링 1회, 편집기 수정→Patch, 뒤로·앞으로 복원, 복원 후 연속 Patch, Tab 2칸 입력, page/console error 0건.
- History 상한과 퇴거는 P1-HISTORY-STATE-01, key 정책은 P1-CONF-03을 따른다.
- 복원 자체 실패 UI·재시작 정책과 `history.set()` 실패의 DOM 복구는 여전히 미확정 범위다.
