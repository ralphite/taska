#!/bin/zsh
# T475 (D45): every check, every night: the page's build, its unit tests, the agent interface against the old app's
# answers, and every browser check (each of Yadong's requirements among them). A failure becomes a bug in Taska with
# what failed; the same failure the next night is added to that bug, not made again. Run by the LaunchAgent
# com.taska.nightly-checks at 3:30; by hand: zsh v2/tools/nightly-checks.sh
cd "$(dirname "$0")/../.." || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
URL=${TASKA_URL:-http://127.0.0.1:7340}
R=$PWD
mkdir -p .logs
LOG=$R/.logs/nightly-checks.log
LAST=$R/.logs/nightly-checks.last  # the last failure: its code in Taska and what failed
# The checks build and run in a worktree of their own at main's newest commit, never in the main checkout: a ship
# there rebuilds the page and runs its own checks meanwhile, and the two must not mix (B548)
W=$R/.claude/worktrees/nightly
git worktree prune  # a worktree folder deleted by a cleanup must not stay registered, or the add below fails
[[ -d $W ]] || git worktree add -q --detach $W HEAD || exit 1
git -C $W checkout -fq --detach $(git rev-parse HEAD) && git -C $W clean -fdq -e node_modules || exit 1
ln -sfn $R/v2/web/node_modules $W/v2/web/node_modules
cd $W || exit 1
{
  echo "nightly checks $(date '+%Y-%m-%d %H:%M') at $(git rev-parse --short HEAD)"
  npm --prefix v2/web run build >/dev/null 2>&1 || echo "FAILED: the page did not build"
  npm --prefix v2/web run test >/dev/null 2>&1 || echo "FAILED: the unit tests (npm --prefix v2/web run test)"
  /usr/bin/python3 v2/tests/test_compat.py >/dev/null 2>&1 || echo "FAILED: the agent interface (python3 v2/tests/test_compat.py)"
  /usr/bin/python3 v2/tests/ship_checks.py --all || echo "FAILED: the browser checks"
} > $LOG 2>&1
grep -q '^FAILED' $LOG || { rm -f $LAST; echo "nightly checks: all passed"; exit 0; }
# what failed, one line each: the failed parts, and the failed checks with Yadong's words
what=$(grep -E '^FAILED|^  \[(phone|desktop)\]|^    r[0-9]+' $LOG | head -40)
sig=$(print -r -- "$what" | grep -E '^FAILED|^  \[' | shasum | cut -c1-12)
post() { curl -s -m 10 -X POST "$URL/p/taska/do?by=claude-code&session=nightly" --data-binary @- ; }
body=$(print -r -- "$what" | sed 's/^/  /')
if [[ -f $LAST && "$(cut -d' ' -f2 $LAST)" == "$sig" ]]; then
  code=$(cut -d' ' -f1 $LAST)
  printf '%s say Failed again tonight (%s), the same as before; the whole log is .logs/nightly-checks.log\n' "$code" "$(date '+%m-%d')" | post
else
  out=$(printf 'new bug P1 now parent=T475 The nightly checks failed (%s)\n  What failed (the whole log is .logs/nightly-checks.log):\n%s\n' "$(date '+%m-%d')" "$body" | post)
  code=$(print -r -- "$out" | sed -n 's/^ok \([A-Z][0-9]*\) new.*/\1/p' | head -1)
  [[ -n "$code" ]] && echo "$code $sig" > $LAST
fi
echo "nightly checks: failed, told Taska ($code)"
exit 1
