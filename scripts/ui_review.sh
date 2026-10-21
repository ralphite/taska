#!/bin/zsh
# A second pair of eyes before a UI change ships (R369): Gemini reviews screenshots of every state against what was
# asked. Usage: scripts/ui_review.sh <folder with state screenshots *.png> "<what the user asked, in their words>"
# Writes <folder>/review.md and prints it. Needs the Gemini CLI and GEMINI_API_KEY in the login shell.
set -e
dir=${1:?folder of screenshots}
asked=${2:?what was asked}
cd "$dir"
shots=(*.png)
cat > review-brief.md <<EOF
You are a strict senior product designer reviewing a change before it ships. The app: Taska, a task tracker where
one person talks to AI coding agents (desktop and phone, dark and light).

What the person asked for: $asked

The screenshots are states of the changed screen (file names say which: idle, hover, open, dragging, empty, long…).
Find every concrete problem you can SEE: layout, spacing, alignment, hierarchy, contrast, duplicated or useless
text, decoration without information, controls repeated on every row that should show only on hover, things that
jump or shift between states, anything that contradicts what was asked, and what is missing. Do not invent.
For each finding:
### <screenshot> — <short title>
- what: <one or two sentences>
- severity: high | medium | low
- fix: <one sentence>
Most important first, at most 12.
EOF
refs=""
for f in $shots; do refs="$refs @$f"; done
GEMINI_CLI_TRUST_WORKSPACE=true /opt/homebrew/bin/gemini -m gemini-3.1-pro-preview --skip-trust \
  -p "Read @review-brief.md and review these screenshots as it asks:$refs. Answer in English. Do not write files." \
  2>/dev/null | sed '/^Agent execution stopped/d' > review.md
cat review.md
