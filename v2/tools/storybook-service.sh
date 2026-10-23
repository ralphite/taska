#!/bin/zsh
# Storybook for the page (T456, r678/r679): a server of its own on http://localhost:6007, run from the source, so a
# change in the code shows at once. For development on this computer only; Taska itself does not carry it. Run by the
# LaunchAgent com.taska.storybook (KeepAlive; v2/tools/launchd/), and listed in Local Hub (http://localhost:7331) as
# taska-storybook.
#
# AGENTS NEVER RESTART THIS SERVICE (B517, rule R489): no launchctl kickstart / stop / unload, no killing its process.
# A restart cuts every open Storybook page. Code changes, moved or removed story files and builds need no restart:
# the story list mends itself (.storybook/heal-index.ts). When it is stuck, the watchdog restarts it
# (storybook-watchdog.py, LaunchAgent com.taska.storybook-watchdog: the page unanswered for 5 minutes). The only way
# to restart it is storybook-restart.sh <who> <why>, which logs the time, who and why in .logs/storybook-restarts.log.
# Health, once a minute: .logs/storybook-health.jsonl.
#
# The LaunchAgent runs it as ProcessType Standard, not Background: a background job gets the lowest CPU priority, and
# while agents keep the computer busy the page then went minutes without an answer (B517).
cd "$(dirname "$0")/../web" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" # the same node as the shell builds the page with
node .storybook/app.mjs --dev || exit 1 # the page as the stories open it, from the source
exec ./node_modules/.bin/storybook dev -p 6007 --exact-port --host 127.0.0.1 --no-open --ci # always 6007: the link and Local Hub point there
