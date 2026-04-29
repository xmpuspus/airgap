# vhs tape for the KB Studio walk-through
# Outputs demo/kb-studio.gif

Output demo/kb-studio.gif
Set FontSize 14
Set Width 1100
Set Height 720
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "npm run kb:studio"
Sleep 500ms
Enter
Sleep 4s

Type "demo/kb-studio-fixture.csv"
Sleep 800ms
Enter
Sleep 3s

Type "What plans do you have"
Sleep 600ms
Enter
Sleep 3s

Type "store hours"
Sleep 600ms
Enter
Sleep 3s

Enter
Sleep 1s

Type "8"
Sleep 600ms
Enter
Sleep 1s

Type "/tmp/kb-studio-out"
Sleep 600ms
Enter
Sleep 2s

Type "n"
Sleep 600ms
Enter
Sleep 3s
