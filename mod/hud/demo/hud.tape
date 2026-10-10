# Records hud.gif. Run from the repo root: vhs mod/hud/demo/hud.tape
# Run it from a plain terminal, not from inside Claude Code: the env Claude Code
# passes to its shells changes how the child session looks.
# Needs the hud mod loaded, and uses real tokens and your real usage limits.

Output mod/hud/demo/hud.gif

Set Shell bash
Set FontSize 16
Set Width 1200
Set Height 600
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# A throwaway repo on a feature branch, so the band has a branch to show.
# Claude loads only this repo's hud, with installed copies of the mods turned off,
# so no other band shows under it.
Hide
Type "R=$PWD && cd $(mktemp -d /tmp/demo.XXXX) && git init -q -b feat/demo && git commit -q --allow-empty -m init && clear" Enter
Type `claude --model haiku --settings "{\"env\":{\"CLAUDE_CODE_PLUGIN_DIRS\":\"$R/mod/hud\",\"DISABLE_AUTOUPDATER\":\"1\"},\"enabledPlugins\":{\"hud@ks-ai-stack\":false,\"replay-theater@ks-ai-stack\":false}}" --permission-mode default --allowedTools "Bash(touch:*)"` Enter
# Trust the new folder.
Sleep 6s
Down Enter
Sleep 4s
Show

Sleep 1s
Type "Run touch notes.txt, then say done in one word." Sleep 500ms Enter
# The limits, context, cost and the branch's * fill in when the turn ends.
Wait+Screen@40s /[1-9][0-9.]*k? in/
Sleep 4s

# Focus the band, then collapse it to one line and expand it again.
Ctrl+X Tab
Sleep 1s
Type "h"
Sleep 5s
Type "h"
Sleep 5s
Hide
Ctrl+C
Ctrl+C
