#!/bin/zsh
# Check the committed source and a consistent copy of the current data. No models or live-data writes.
#   zsh tools/nightly-checks.sh [data root, default ~/.taska]
# The LaunchAgent runs this at 03:30. Failures are grouped into one Taska item until they change.
set -u
ROOT=${0:A:h:h}
DATA=${1:-$HOME/.taska}
URL=${TASKA_URL:-http://127.0.0.1:7340}
LOGS=${TASKA_NIGHTLY_LOGS:-$ROOT/.logs}
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset GEMINI_API_KEY GOOGLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY GOOGLE_APPLICATION_CREDENTIALS
[[ -d "$DATA" ]] || { echo "no data in $DATA"; exit 2; }
[[ -d "$ROOT/web/node_modules" ]] || { echo "run npm ci in web/ first"; exit 2; }
mkdir -p "$LOGS"
LOG=$LOGS/nightly-checks.log
LAST=$LOGS/nightly-checks.last
WORK=$(mktemp -d -t taska-checks)
trap 'rm -rf "$WORK"' EXIT
mkdir "$WORK/source"
# An archive is isolated from builds and uncommitted work in the checkout.
git -C "$ROOT" archive HEAD | tar -x -C "$WORK/source" || exit 1
ln -s "$ROOT/web/node_modules" "$WORK/source/web/node_modules"
check() { npm --prefix "$WORK/source/web" run check; }
data_check() {
  python3 "$WORK/source/tools/copy_data.py" "$DATA" "$WORK/data" &&
    python3 "$WORK/source/tests/check_data.py" "$WORK/data"
}
step() {
  local name=$1; shift
  if "$@" > "$WORK/step.out" 2>&1; then
    echo "passed: $name: $(tail -1 "$WORK/step.out")"
  else
    echo "FAILED: $name"
    tail -12 "$WORK/step.out" | sed 's/^/    /'
  fi
}
{
  echo "nightly checks $(date '+%Y-%m-%d %H:%M') at $(git -C "$ROOT" rev-parse --short HEAD)"
  step "types, architecture and regression tests" check
  step "current data loads and replays consistently" data_check
} > "$LOG" 2>&1
if ! grep -q '^FAILED' "$LOG"; then
  rm -f "$LAST"
  echo "nightly checks: all passed"
  exit 0
fi
what=$(grep -E '^FAILED|^    ' "$LOG" | head -40)
sig=$(grep '^FAILED' "$LOG" | shasum | cut -c1-12)
post() { curl -s -m 10 -X POST "$URL/p/taska/do?by=nightly&session=checks" --data-binary @-; }
body=$(print -r -- "$what" | sed 's/^/  /')
if [[ -f "$LAST" && "$(cut -d' ' -f2 "$LAST")" == "$sig" ]]; then
  code=$(cut -d' ' -f1 "$LAST")
  printf '%s say Failed again tonight (%s); details are in .logs/nightly-checks.log\n' "$code" "$(date '+%m-%d')" | post
else
  out=$(printf 'new bug P1 now The nightly checks failed (%s)\n  Details (.logs/nightly-checks.log):\n%s\n' "$(date '+%m-%d')" "$body" | post)
  code=$(print -r -- "$out" | sed -n 's/^ok \([A-Z][0-9]*\) new.*/\1/p' | head -1)
  [[ -n "$code" ]] && echo "$code $sig" > "$LAST"
fi
echo "nightly checks: failed, told Taska (${code:-not reached})"
exit 1
