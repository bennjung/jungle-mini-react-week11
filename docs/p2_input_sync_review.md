# 입력 동기화·선택 영역 코드 리뷰

기준점: `d2e284c27a56bf0566af214363b0e9af31f9a8b2` 대비 미커밋 소스 변경과 신규 파일.
명세: [구현 설계](p2_input_sync_design.md), [테스트 계약](p2_input_sync_test_cases.md).
CommandCode DeepSeek V4.1 Flash의 새 에이전트 두 개가 각 축을 독립 검토했다.
리뷰어는 파일을 수정하지 않았다. 352개 통과를 리뷰 결과의 대체 근거로 쓰지 않았다.

## Standards — 코드 규칙

### STD-01 공통 프로퍼티 의미 중복

- 선택 프로퍼티 이름·판정이 h.ts/input.ts/patch.ts에 중복됐다. 다중 select 예외와 value 문자열
  비교도 input.ts/patch.ts에 반복되어 수정 누락 위험이 있었다.
- 조치: 이미 세 곳이 소비하는 규칙을 `src/vdom/properties.ts` 한 곳으로 옮긴다.
  스냅샷 propertySchema는 그대로 두고 새 자동 수집 프로퍼티나 공개 API를 추가하지 않는다.
- 상태: properties.ts 공유로 중복 제거. 독립 재검토에서 실제 세 소비자·순환 import 없음 확인.

### STD-02 다중 select 주석·동작 범위

- SELECT.value를 건너뛰면서 OPTION.selected로 복원한다고만 적었지만, 같은 State 대상 확인은
  select 자손 option을 확인하지 않았다. 주석만으로 보장된다고 해석하면 안 된다.
- 조치: 아래 SPEC-01과 같은 원인으로 다루고, 실제 확인 범위와 option 수에 비례하는 비용을 기록한다.

### STD-03 문서 최신성

- 리뷰 시점의 README·진행표에 엔진 미구현·43개 실패가 남아 있었다.
- 조치: 구현·수정 후 실제 검사 결과와 미확정 항목을 구분해 함께 동기화한다.

### 판단이 필요한 개선 의견

- 제거 명령이 없을 때도 대상별 조상 탐색을 했다. 빈 Set 조기 반환으로 불필요한 탐색을 제거한다.
  제거되는 하위 대상 판정에 필요한 조상 확인과 FunctionComponent 탐색을 혼동하지 않는다.
- 조합 기록 미해제 위험: 실제 InputEvent.isComposing=false 경로는 이미 기록을 해제한다.
  조합 종료 유실·일반 Event만 전달되는 환경은 미검증으로 남기며 blur 정책을 임의 추가하지 않는다.
- 확인만인 Patch 실패도 기존 전체 복구를 사용한다. 비용·포커스 손실은 설계에 기록된 기존 복구 의미다.
- undefined 선택값·direction만 선언한 경우의 기본 위치는 기존 명세 미정책이다. 새 테스트 정답을
  구현에 맞춰 만들거나 공개 보장으로 승격하지 않는다.

## Spec — 요구·계약 충족

### SPEC-01 같은 State의 OPTION.selected 복원 누락 — 중간

- 재현: multiple select에서 VDOM은 a=true/b=false, 실제 DOM을 a=false/b=true로 바꾼 뒤
  change handler가 같은 State를 유지한다. 기존 구현은 SELECT.value를 건너뛰고 끝냈다.
- 기대: 이미 지정된 OPTION.selected와 실제 선택 상태 일치.
- 계약·테스트: INPUT-16을 먼저 추가하고 실행해 `expected false to be true` assertion 실패를 확인.
- 수정: 이벤트 대상 select의 options만 비교 대상으로 확장하고 기존 WeakMap·보정 명령을 사용한다.
  모든 VDOM이나 관계없는 select를 순회하지 않는다.
- 결과: INPUT-16 통과. 리뷰어가 optgroup·삭제 batch·State 변경 경로도 재확인해 해소 판정.

### SPEC-02 속성만 바뀌어도 과거 명시 위치 재적용 — 중간

- 재현: value=abcdef, 선택 선언1..1. 사용자가4..4로 이동한 뒤 className만 갱신하면
  빈 프로퍼티 변경에도 과거 선언이 적용돼 커서가1로 돌아갔다.
- 기대: 초기 생성·값 반영·위치 선언 변경 외의 속성만 반영하는 작업은 선택을 건드리지 않음.
- 계약·테스트: SELECT-08을 먼저 추가하고 실행해 `expected 1 to be 4` assertion 실패를 확인.
- 수정: attribute-only update는 applyPropertyChanges로 들어가지 않도록 처리한다.
- 결과: SELECT-08 통과. 독립 재검토에서도 커서4·value/선택 쓰기0 확인, 위치만 변경 경로 유지.

### SPEC-03 부분 선언·비숫자 위치 — 낮음 / 정책 미확정

- direction만 선언하면 위치 기본값이0, 문자열 위치는 숫자로 해석하지 않는다.
- 이미 남겨 둔 부분 선언·입력 타입 정책의 범위다. 이번에는 동작을 임의 확장하지 않는다.

## 검증 범위

- 최초 구현: 부모 세션이 `npm run check`를 재실행해352개 통과 및 타입 검사 통과 확인.
- 리뷰 재현: INPUT-16·SELECT-08 두 항목은 새 문서 입력을 먼저 정하고 구현 수정 전 실패 확인.
- 리뷰어는 same-State 텍스트·checkbox·단일select, 동일값 setter 생략, 성공 WeakMap 확정·복구,
  제거/교체 제외, 최신 값 합류, 중복 쓰기 방지, effect 순서, wrapper 재사용·해제를 확인했다.
- 실제 Chromium 계열 브라우저에서 공백 입력·새 문자 삽입·삭제의 값과 커서 확인. IME·undo/redo·
  autofill·다중 브라우저·정렬 상한 성능은 미검증이다.
- 축별 의견은 서로 합쳐 우선순위를 다시 매기지 않는다. 최종 통과·남은 한계는
  [진행표](p2_test_boards.md#입력-동기화선택-영역-테스트-선행)에 기록한다.

## 최종 재검토

- Standards: 공통 규칙 중복·불필요한 빈 제거 집합 탐색 해소. 주석·현재 문서 동기화.
  새로운 고위험 결함 발견 없음. 재검토에서 지적한 patch.ts 주석 줄바꿈도 수정했다.
- Spec: SPEC-01·02 해소, 기존값/선택/예약/복구 회귀 없음. SPEC-03은 낮은 우선순위의
  미확정 정책으로 남긴다. 값·선택과 무관한 property 변경의 선언 재적용도 확정 범위로 확대하지 않는다.
- 부모 세션이 타입 검사·전체354개 테스트를 재실행했다. 회귀 두 개는 기존 기대 변경 없이 추가했다.
- 독립 임시 복사본의 변이 검사에서 값 확인 제거 시 INPUT-01a 실패, 자동 커서 적용 제거 시
  CARET-01a 실패를 확인했다. 실제 브라우저 A/B·삭제·고양이 상태 유지도 최종 소스로 재확인했다.
