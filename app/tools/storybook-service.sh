#!/bin/zsh
# Storybook for the page (app/web): a server of its own on http://localhost:6007, run from the source, so a change in
# the code shows at once. The sidebar's Storybook link and Local Hub point here (6007 since 10-24, T518 #7555: the old
# version's Storybook is stopped). For development on this computer only; Taska itself does not carry it. Run by the
# LaunchAgent com.taska.storybook-app (KeepAlive, ProcessType Interactive). Restarted only by its watchdog when stuck, or
# once after a change to its configuration (R489): zsh app/tools/storybook-restart.sh <who> <why>.
cd "$(dirname "$0")/../web" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" # the same node as the shell builds the page with
exec ./node_modules/.bin/storybook dev -p 6007 --exact-port --host 127.0.0.1 --no-open --ci # always 6007: the links point there
