# 이슈 추적: GitHub

이슈와 명세는 `bennjung/jungle-mini-react-week11`의 GitHub 이슈로 관리한다.
`gh` 명령의 저장소 선택이 개인 포크로 바뀌지 않도록 대상 저장소를 명시한다.

## 작업

- 생성: `gh issue create --repo bennjung/jungle-mini-react-week11`
- 조회: `gh issue view <번호> --repo bennjung/jungle-mini-react-week11`
- 목록: `gh issue list --repo bennjung/jungle-mini-react-week11`
- 수정·표식 변경: `gh issue edit <번호> --repo bennjung/jungle-mini-react-week11`
- 의견 작성: `gh issue comment <번호> --repo bennjung/jungle-mini-react-week11`
- 닫기: 사유를 의견으로 남긴 뒤 `gh issue close <번호> --repo bennjung/jungle-mini-react-week11`

하위 이슈와 선행 관계는 GitHub의 기본 기능을 사용한다.
사용할 수 없다면 본문에 상위 이슈와 선행 이슈를 명시한다.

## 명세 게시

스킬이 이슈 추적 도구에 게시하도록 지시하면 팀 저장소에 GitHub 이슈를 생성한다.

## 끌어오기 요청의 분류

끌어오기 요청을 이슈 분류 대상으로 취급하지 않는다.
