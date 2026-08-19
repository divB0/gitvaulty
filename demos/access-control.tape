Require git
Require node
Require terraform

Output demos/access-control.gif

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 800
Set Padding 28
Set Theme "TokyoNightStorm"
Set WindowBar Colorful
Set TypingSpeed 30ms
Set Framerate 8
Set PlaybackSpeed 1.0
Set CursorBlink false

# Prepare a disposable repository, runtime-only identities, and dummy plaintext.
Hide
Type@0ms 'export GITVAULTY_CLI="$PWD/dist/cli.js"'
Enter
Type@0ms 'export DEMO_SCRIPT="$PWD/demos/access-control-demo.sh"'
Enter
Type@0ms ': "${DEMO_DIR:?Demo repository path was not provided}" "${DEMO_KEYS:?Demo identity path was not provided}" "${DEMO_REMOTE:?Demo remote path was not provided}"'
Enter
Type@0ms 'mkdir -p "$DEMO_DIR" "$DEMO_KEYS"'
Enter
Type@0ms 'git init -q --bare "$DEMO_REMOTE" && cd "$DEMO_DIR" && git init -q -b main && git remote add origin "$DEMO_REMOTE"'
Enter
Type@0ms 'gitvaulty() { node "$GITVAULTY_CLI" "$@"; }'
Enter
Type@0ms 'as_user() { DEMO_USER="$1"; export DEMO_USER GITVAULTY_AGE_KEY_FILE="$DEMO_KEYS/$1.txt"; }'
Enter
Type@0ms "export PS1='\[\e[1;36m\]${DEMO_USER}@gitvaulty\[\e[0m\] $ '"
Enter
Type@0ms 'for user in admin alice sam jules; do GITVAULTY_AGE_KEY_FILE="$DEMO_KEYS/$user.txt" gitvaulty key create >/dev/null; done'
Enter
Type@0ms 'printf "%s\n" "#!/bin/sh" "case \$(basename \"\$1\") in" ".env) printf \"API_URL=https://dev.example.test\\nAPI_TOKEN=replace-me\\n\" > \"\$1\" ;;" ".env.production) printf \"API_URL=https://prod.example.test\\nAPI_TOKEN=replace-me\\n\" > \"\$1\" ;;" "prod.auto.tfvars) printf \"database_password = \\\"replace-me\\\"\\n\" > \"\$1\" ;;" "esac" > "$DEMO_KEYS/editor.sh"'
Enter
Type@0ms 'chmod +x "$DEMO_KEYS/editor.sh" && export EDITOR="$DEMO_KEYS/editor.sh"'
Enter
Type@0ms "as_user admin"
Enter
Type@0ms "printf '\104\105\115\117\137\122\105\101\104\131\n'"
Enter
Wait+Screen@30s /DEMO_READY/
Sleep 500ms
Ctrl+L
Sleep 500ms
Type@0ms "# User: Admin (repository owner)"
Enter
Sleep 500ms
Show
Sleep 1s

Type "# First command bootstraps GitVaulty automatically"
Enter
Sleep 1s
Type "gitvaulty group create dev"
Enter
Wait+Screen@30s /Your username/
Type "admin"
Enter
Wait+Screen@30s /GitVaulty initialized/
Wait+Screen@30s /Installed agent skill/
Wait+Screen@30s /Created group dev/
Sleep 3s
Hide
Type@0ms 'bash "$DEMO_SCRIPT"'
Enter
Wait+Screen@30s /Create sre and review both signed access groups/
Show
Wait+Screen@600s /Demo complete/
Sleep 4s
