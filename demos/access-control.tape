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
Type@0ms "export DEMO_DIR=/tmp/gitvaulty-readme-demo DEMO_KEYS=/tmp/gitvaulty-readme-keys DEMO_REMOTE=/tmp/gitvaulty-readme-remote.git"
Enter
Type@0ms 'cd /tmp && rm -rf "$DEMO_DIR" "$DEMO_KEYS" "$DEMO_REMOTE" && mkdir -p "$DEMO_DIR" "$DEMO_KEYS"'
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
Type@0ms 'printf "\033[2J\033[H\033[1;38;5;117m# User: Admin (repository owner)\033[0m\n"'
Enter
Sleep 500ms
Show

Type "# Initialize a GitVaulty repository"
Enter
Sleep 1s
Type "gitvaulty init"
Enter
Wait+Screen@30s /Your username/
Type "admin"
Enter
Wait+Screen@30s /Installed agent skill/
Wait+Screen@30s /GitVaulty is ready/
Sleep 2s
Type 'bash "$DEMO_SCRIPT"'
Enter
Wait+Screen@600s /Demo complete/
Sleep 4s

# Remove all runtime identities and plaintext after the recording.
Hide
Type@0ms 'cd /tmp && rm -rf "$DEMO_DIR" "$DEMO_KEYS" "$DEMO_REMOTE"'
Enter
