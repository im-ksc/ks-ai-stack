# Records hud.gif. Run from the repo root: vhs mod/hud/demo/hud.tape
# Run it from a plain terminal, not from inside Claude Code: the env Claude Code
# passes to its shells changes how the child session looks.
# Needs the hud mod loaded, and uses real tokens and your real usage limits.

Output mod/hud/demo/hud.gif

Set Shell bash
Set FontSize 16
Set Width 1100
Set Height 560
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# A throwaway repo on a feature branch, so the band has a branch to show.
# Claude loads only this repo's hud, so no other mod takes the band's place.
Hide
Type "R=$PWD && cd $(mktemp -d /tmp/demo.XXXX) && git init -q -b feat/demo && git commit -q --allow-empty -m init && clear" Enter
Type `claude --model haiku --settings "{\"env\":{\"CLAUDE_CODE_PLUGIN_DIRS\":\"$R/mod/hud\",\"DISABLE_AUTOUPDATER\":\"1\"}}" --allowedTools "Bash(touch:*)" "Bash(sleep:*)" TodoWrite` Enter
# Trust the new folder.
Sleep 6s
Down Enter
Sleep 4s
Show

Sleep 1s
Type "Make a 4-item todo list: create a.txt, b.txt, c.txt and d.txt. For each item, mark it in progress, run touch on the file and then sleep 2, then mark it done." Sleep 500ms Enter
Sleep 42s
Hide
Ctrl+C
Ctrl+C
