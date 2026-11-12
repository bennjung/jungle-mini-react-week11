#!/usr/bin/env bash
#
# 발표용 "수정 전" worktree를 준비하고, 수정 전·후 개발 서버를 함께 실행한다.
#
# 기본값:
#   수정 전 커밋: d2e284c (제어 입력 값·커서 동기화 커밋 033d44c의 바로 앞)
#   worktree 경로: /tmp/opencode/mini-react-before
#   수정 전 포트: 5185
#   수정 후 포트: 5184
#
# 현재 작업 트리는 건드리지 않는다. worktree 생성과 의존성 설치 후 두 Vite 서버를
# 백그라운드로 띄우고, 이 스크립트가 두 프로세스를 함께 관리한다.
# Ctrl+C를 누르면 두 서버를 모두 종료한다.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"

BEFORE_COMMIT="${BEFORE_COMMIT:-d2e284c}"
WORKTREE_PATH="${WORKTREE_PATH:-/tmp/opencode/mini-react-before}"
BEFORE_PORT="${BEFORE_PORT:-5185}"
AFTER_PORT="${AFTER_PORT:-5184}"
INSTALL=1
START=1
REMOVE=0
FORCE=0
BEFORE_PID=""
AFTER_PID=""
INTERRUPTED=0

usage() {
  cat <<'EOF'
사용법:
  ./scripts/demo-before-worktree.sh [옵션]

기본 동작:
  수정 전 worktree를 준비하고, 수정 전·후 Vite 서버를 함께 실행합니다.
  Ctrl+C로 두 서버를 모두 종료합니다.

옵션:
  --path <경로>       worktree 경로 (기본: /tmp/opencode/mini-react-before)
  --commit <커밋>     수정 전 커밋 (기본: d2e284c)
  --before-port <포트> 수정 전 포트 (기본: 5185)
  --after-port <포트>  수정 후 포트 (기본: 5184)
  --no-install        npm ci를 실행하지 않음
  --no-start          서버를 실행하지 않고 준비만 함
  --remove            worktree를 제거
  --force             --remove 확인을 생략
  -h, --help          이 도움말

환경 변수:
  BEFORE_COMMIT, WORKTREE_PATH, BEFORE_PORT, AFTER_PORT

실행 예:
  ./scripts/demo-before-worktree.sh
  ./scripts/demo-before-worktree.sh --no-start
  ./scripts/demo-before-worktree.sh --before-port 5195 --after-port 5194
  ./scripts/demo-before-worktree.sh --remove

브라우저:
  http://localhost:5185/phase2-cat.html  (수정 전)
  http://localhost:5184/phase2-cat.html  (수정 후)
EOF
}

canonical_path() {
  (cd "$1" 2>/dev/null && pwd -P) || printf '%s\n' "$1"
}

# macOS의 /tmp -> /private/tmp 같은 symlink 차이를 흡수해 worktree 경로를 비교한다.
is_registered_worktree() {
  local target candidate line
  target="$(canonical_path "$1")"

  while IFS= read -r line; do
    case "$line" in
      "worktree "*)
        candidate="${line#worktree }"
        candidate="$(canonical_path "$candidate")"
        if [[ "$candidate" == "$target" ]]; then
          return 0
        fi
        ;;
    esac
  done < <(git -C "$REPO_ROOT" worktree list --porcelain)

  return 1
}

cleanup() {
  trap - INT TERM EXIT

  if [[ -n "$BEFORE_PID" ]]; then
    kill "$BEFORE_PID" 2>/dev/null || true
  fi
  if [[ -n "$AFTER_PID" ]]; then
    kill "$AFTER_PID" 2>/dev/null || true
  fi
  if [[ -n "$BEFORE_PID" ]]; then
    wait "$BEFORE_PID" 2>/dev/null || true
  fi
  if [[ -n "$AFTER_PID" ]]; then
    wait "$AFTER_PID" 2>/dev/null || true
  fi
}

handle_signal() {
  INTERRUPTED=1
  cleanup
  exit 130
}

trap handle_signal INT TERM
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      WORKTREE_PATH="${2:?--path 뒤에 경로가 필요합니다}"
      shift 2
      ;;
    --commit)
      BEFORE_COMMIT="${2:?--commit 뒤에 커밋이 필요합니다}"
      shift 2
      ;;
    --before-port)
      BEFORE_PORT="${2:?--before-port 뒤에 포트가 필요합니다}"
      shift 2
      ;;
    --after-port)
      AFTER_PORT="${2:?--after-port 뒤에 포트가 필요합니다}"
      shift 2
      ;;
    --no-install)
      INSTALL=0
      shift
      ;;
    --no-start)
      START=0
      shift
      ;;
    --remove)
      REMOVE=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$FORCE" == "1" && "$REMOVE" != "1" ]]; then
  echo "오류: --force는 --remove와 함께 사용합니다." >&2
  exit 1
fi

if [[ "$REMOVE" == "1" ]]; then
  if [[ ! -e "$WORKTREE_PATH" ]]; then
    echo "제거할 worktree가 없습니다: $WORKTREE_PATH"
    exit 0
  fi

  if ! is_registered_worktree "$WORKTREE_PATH"; then
    echo "오류: 이 경로는 현재 저장소의 worktree가 아닙니다: $WORKTREE_PATH" >&2
    echo "직접 삭제하지 말고 경로를 확인하세요." >&2
    exit 1
  fi

  if [[ "$FORCE" != "1" ]]; then
    read -r -p "정말 제거할까요? $WORKTREE_PATH [y/N] " answer
    case "$answer" in
      y|Y|yes|YES) ;;
      *)
        echo "취소했습니다."
        exit 0
        ;;
    esac
  fi

  # /tmp -> /private/tmp 같은 symlink 환경에서도 등록된 경로와 맞도록 실제 경로를 쓴다.
  REMOVE_PATH="$(canonical_path "$WORKTREE_PATH")"
  git -C "$REPO_ROOT" worktree remove --force "$REMOVE_PATH"
  git -C "$REPO_ROOT" worktree prune
  echo "제거 완료: $WORKTREE_PATH"
  exit 0
fi

if ! git -C "$REPO_ROOT" cat-file -e "${BEFORE_COMMIT}^{commit}" 2>/dev/null; then
  echo "오류: 커밋을 찾을 수 없습니다: $BEFORE_COMMIT" >&2
  echo "현재 저장소의 최근 커밋:" >&2
  git -C "$REPO_ROOT" log --oneline -8 >&2
  exit 1
fi

BEFORE_SHA="$(git -C "$REPO_ROOT" rev-parse --short "$BEFORE_COMMIT")"
BEFORE_FULL_SHA="$(git -C "$REPO_ROOT" rev-parse "$BEFORE_COMMIT")"
BEFORE_SUBJECT="$(git -C "$REPO_ROOT" log -1 --format=%s "$BEFORE_COMMIT")"
CURRENT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"

echo "저장소: $REPO_ROOT"
echo "현재 HEAD: $CURRENT_SHA"
echo "수정 전 커밋: $BEFORE_SHA ($BEFORE_FULL_SHA)"
echo "수정 전 제목: $BEFORE_SUBJECT"
echo "worktree 경로: $WORKTREE_PATH"

if [[ -e "$WORKTREE_PATH" ]]; then
  if is_registered_worktree "$WORKTREE_PATH"; then
    echo "이미 worktree가 있습니다. 새로 만들지 않고 재사용합니다."
    ACTUAL_FULL_SHA="$(git -C "$WORKTREE_PATH" rev-parse HEAD)"
    ACTUAL_SHORT_SHA="$(git -C "$WORKTREE_PATH" rev-parse --short HEAD)"
    ACTUAL_SUBJECT="$(git -C "$WORKTREE_PATH" log -1 --format=%s)"

    if [[ "$ACTUAL_FULL_SHA" != "$BEFORE_FULL_SHA" ]]; then
      echo "오류: 기존 worktree HEAD가 요청한 수정 전 커밋과 다릅니다." >&2
      echo "요청: $BEFORE_SHA $BEFORE_SUBJECT" >&2
      echo "실제: $ACTUAL_SHORT_SHA $ACTUAL_SUBJECT" >&2
      echo "다시 만들려면 --remove 후 실행하거나 --path로 다른 경로를 지정하세요." >&2
      exit 1
    fi

    echo "worktree HEAD: $ACTUAL_SHORT_SHA (요청한 수정 전 커밋과 일치)"
  else
    echo "오류: 경로가 이미 있지만 git worktree가 아닙니다: $WORKTREE_PATH" >&2
    echo "경로를 비우거나 --path로 다른 경로를 지정하세요." >&2
    exit 1
  fi
else
  mkdir -p "$(dirname "$WORKTREE_PATH")"
  git -C "$REPO_ROOT" worktree add --detach "$WORKTREE_PATH" "$BEFORE_COMMIT"
fi

if [[ "$INSTALL" == "1" ]]; then
  if [[ -d "$WORKTREE_PATH/node_modules" ]]; then
    echo "node_modules가 이미 있습니다. npm ci를 건너뜁니다."
  else
    echo "의존성 설치: npm ci --prefer-offline --no-audit --no-fund"
    if ! (cd "$WORKTREE_PATH" && npm ci --prefer-offline --no-audit --no-fund); then
      echo "오류: npm ci에 실패했습니다." >&2
      echo "네트워크·npm 캐시를 확인하거나 --no-install로 만든 뒤 의존성을 직접 준비하세요." >&2
      exit 1
    fi
  fi
fi

print_next_steps() {
  cat <<EOF

수정 전 ($BEFORE_SHA):
  cd "$WORKTREE_PATH"
  npx vite --config vite.phase2.config.ts --port $BEFORE_PORT --strictPort

수정 후 ($CURRENT_SHA):
  cd "$REPO_ROOT"
  npx vite --config vite.phase2.config.ts --port $AFTER_PORT --strictPort

브라우저:
  http://localhost:$BEFORE_PORT/phase2-cat.html  (수정 전)
  http://localhost:$AFTER_PORT/phase2-cat.html  (수정 후)

시연:
  1. 두 화면에서 회원가입으로 이동
  2. cat@example.com 입력
  3. 중간에 공백 한 글자 입력 → 수정 전은 State/입력값 불일치, 수정 후는 일치
  4. 중간에 ' x ' 입력 → 수정 전은 커서가 끝, 수정 후는 커서 3

정리:
  "$0" --remove
EOF
}

if [[ "$START" != "1" ]]; then
  print_next_steps
  exit 0
fi

VITE_BEFORE="$WORKTREE_PATH/node_modules/.bin/vite"
VITE_AFTER="$REPO_ROOT/node_modules/.bin/vite"

if [[ ! -x "$VITE_BEFORE" ]]; then
  echo "오류: 수정 전 worktree에 vite가 없습니다: $VITE_BEFORE" >&2
  echo "--no-install을 사용했다면 의존성을 먼저 준비하세요." >&2
  exit 1
fi

if [[ ! -x "$VITE_AFTER" ]]; then
  echo "오류: 현재 저장소에 vite가 없습니다: $VITE_AFTER" >&2
  echo "먼저 npm install을 실행하세요." >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]]; then
  echo "주의: 현재 저장소에 커밋되지 않은 변경이 있습니다. '수정 후' 화면이 HEAD와 다를 수 있습니다."
fi

cat <<EOF

서버를 시작합니다. Ctrl+C로 두 서버를 함께 종료합니다.
  수정 전: http://localhost:$BEFORE_PORT/phase2-cat.html
  수정 후: http://localhost:$AFTER_PORT/phase2-cat.html

EOF

( cd "$WORKTREE_PATH" && exec "$VITE_BEFORE" --config vite.phase2.config.ts --port "$BEFORE_PORT" --strictPort ) \
  > >(while IFS= read -r line; do printf '[before] %s\n' "$line" >&2; done) 2>&1 &
BEFORE_PID=$!

( cd "$REPO_ROOT" && exec "$VITE_AFTER" --config vite.phase2.config.ts --port "$AFTER_PORT" --strictPort ) \
  > >(while IFS= read -r line; do printf '[after]  %s\n' "$line" >&2; done) 2>&1 &
AFTER_PID=$!

# macOS 기본 bash 3.2에는 wait -n이 없으므로, 두 PID를 폴링해 먼저 끝난 쪽을 기다린다.
STATUS=0
while true; do
  if ! kill -0 "$BEFORE_PID" 2>/dev/null; then
    if wait "$BEFORE_PID"; then STATUS=0; else STATUS=$?; fi
    break
  fi
  if ! kill -0 "$AFTER_PID" 2>/dev/null; then
    if wait "$AFTER_PID"; then STATUS=0; else STATUS=$?; fi
    break
  fi
  sleep 1
done

echo "서버 하나가 종료되었습니다. 다른 서버도 종료합니다."
exit "$STATUS"
