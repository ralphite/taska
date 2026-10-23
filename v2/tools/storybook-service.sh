#!/bin/zsh
# Storybook for the page (T456, r678/r679): a server of its own on http://localhost:6007, run from the source, so a
# change in the code shows at once. For development on this computer only; Taska itself does not carry it. Run by the
# LaunchAgent com.taska.storybook (KeepAlive), and listed in Local Hub (http://localhost:7331) as taska-storybook.
cd "$(dirname "$0")/../web" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" # the same node as the shell builds the page with
node .storybook/app.mjs --dev || exit 1 # the page as the stories open it, from the source
exec ./node_modules/.bin/storybook dev -p 6007 --exact-port --host 127.0.0.1 --no-open --ci # always 6007: the link and Local Hub point there
