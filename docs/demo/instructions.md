# Generating the README demo

The README animation is a recording of the real GitVaulty CLI. Its source lives in
`demos/access-control.tape`, while `demos/access-control-demo.sh` runs the visible multi-user
scenario. The generated artifact is `demos/access-control.gif`.

## Prerequisites

Install the project dependencies with `npm install`, then make sure these commands are available:

- Node.js 20 or newer and npm;
- Git;
- Terraform;
- [VHS](https://github.com/charmbracelet/vhs);
- ffmpeg and ffprobe for optional frame-by-frame review.

The recording uses only generated identities and dummy values. It does not require development or
production credentials.

## Generate the GIF

From the repository root, run:

```sh
npm run demo:generate
```

The command:

1. checks that the required command-line tools are installed;
2. builds `dist/cli.js` from the current source;
3. runs the VHS tape;
4. writes `demos/access-control.gif`;
5. removes that invocation's disposable runtime directory, including its working repository, bare
   Git remote, identities, and plaintext, even when the recording fails.

Do not invoke the visible driver directly unless you are debugging the scenario. The tape prepares
its temporary repository, identities, editor, and environment before starting the driver.

## Runtime isolation

Each invocation atomically creates its own `/tmp/gitvaulty-readme.XXXXXX` runtime directory. The
working repository, generated identities, and local bare Git remote are children of that directory,
and the generator's cleanup trap removes only the directory owned by that invocation. The GIF stays
inside the invoking worktree at `demos/access-control.gif`, so separate worktrees can generate demos
in parallel without deleting one another's runtime files or overwriting one another's output.

The commands still run directly on the host with the current user's permissions. This isolates
concurrent demo runs from each other; it is not a container or security sandbox.

## People in the demo

The recording always uses exactly four people:

- `admin` — Admin, the repository owner and manager of `dev` and `sre`;
- `alice` — Alice, the initial developer;
- `sam` — Sam, the SRE;
- `jules` — Jules, the second developer who joins later.

GitVaulty does not have a repository-wide admin role. The username `admin` describes this scenario's
repository owner. Creating `dev` and `sre` makes Admin each group's first manager and member, so Admin
can sign membership revisions and re-encrypt the affected files.

Every cleared screen starts with the active persona, for example `# User: Jules (dev)`. If the actor
changes, start a new screen before showing their commands.

## Git workflow

The tape creates a disposable bare repository at `remote.git` inside the invocation's unique runtime
directory and configures it as `origin`. This keeps the recording offline while still exercising real
branches, commits, merges, pulls, and pushes.

A pushed `onboard/<name>` branch represents opening a pull request on a hosted Git service. The
subsequent Admin screen represents reviewing and merging that pull request before granting access.
Do not add a fake hosted-service UI or a fifth reviewer persona.

## Scenario contract

Keep these scenes in this order so the animation tells one continuous access-control story:

1. As Admin, run `gitvaulty group create dev` as the first repository command. Show GitVaulty
   automatically collecting the username, initializing the repository, installing the managed agent
   skill, and then continuing the requested command to create `dev`.
2. As Admin, create `sre`. Show that the creator is automatically manager and member of both `dev`
   and `sre`, then commit and push the repository bootstrap files and signed group configuration.
3. As Admin, create local `.env` for `dev` and `sre`, create `.env.production` for `sre`, and create
   `terraform/prod.auto.tfvars` for `sre`. Commit and push the encrypted files and policy metadata.
4. As Alice, create and push `onboard/alice` containing only `gitvaulty user register alice` and its
   public registration commit.
5. As Admin, pull `main`, merge Alice's reviewed registration, grant `dev`, then commit and push the
   access change. Switch to Alice and use `gitvaulty cat .env --force` to show that the single group
   grant unlocks the existing `dev` file.
6. Repeat the registration, review, merge, grant, commit, and push flow for Sam and `sre`. Switch to
   Sam and use `gitvaulty cat ... --force` to show that the group grant unlocks every existing `sre`
   file: local `.env`, production `.env`, and the Terraform secrets.
7. As Jules, create and push `onboard/jules` containing the public self-registration.
8. As Admin, merge Jules's reviewed registration. As Alice, show that an ordinary `dev` member cannot
   add Jules. Return to Admin, sign the `dev` membership revision, then commit and push it.
9. As Jules, use `gitvaulty cat .env --force` to show that the `dev` grant unlocks the local `.env`.
   On the same screen, attempt `gitvaulty cat ... --force` for `.env.production` and
   `terraform/prod.auto.tfvars`, and show both authorization failures.
10. As Sam, use both SRE-only files in a Terraform command through `gitvaulty run`. Show that Terraform
    accepts them.

If a user-facing command, prompt, message, or access rule in one of these scenes changes, update the
tape or driver and regenerate the GIF. Add a scene only when it strengthens this story; keep setup
details out of the visible recording.

## Recording rules

- Use dummy plaintext only. Never record real credentials or private identities.
- Store runtime identities and plaintext only in the tape's explicit `/tmp` paths.
- Print only the generated dummy fixture values in the warned `gitvaulty cat ... --force` scenes.
  Keep the visible warning immediately above the commands. Never substitute real credentials or
  expose private identities.
- Keep setup commands hidden, use VHS's native `Ctrl+L` before the first persona header, and call
  `Show` only after the hidden readiness marker confirms setup has finished and the complete header
  is on the cleared terminal. Hold the header briefly before typing the first scene so frame zero is
  complete. ANSI or external `clear` commands can leave hidden setup text in VHS's first frame.
- Keep the internal `bash "$DEMO_SCRIPT"` handoff hidden. Wait for the driver's first section header
  before calling `Show` again so implementation details never appear between visible scenes.
- Put `# User: <name> (<role>)` at the top of every cleared screen. The header must match the identity
  and Git author that execute the commands below it.
- Render persona headers, section descriptions, and warning comments instantly. Only commands and
  interactive answers should appear as typed input.
- Show the real Git boundary: onboarding branch, registration commit, push, Admin pull/merge, group
  grant commit, and push. Do not imply that self-registration grants access.
- Use content-weighted pauses. Short success messages need about two seconds; created-file results
  need about three; group listings and decrypted dummy values need about four.
- Clear between scenes so each section has one readable purpose and long commands do not crowd later
  output.

## Review the result

After generation, play the GIF from beginning to end and confirm:

- it opens on `gitvaulty group create dev` implicitly bootstrapping the repository, with no explicit
  `gitvaulty init`, setup commands, or random characters;
- text is legible and no command or important result disappears too quickly;
- `dev` and `sre` managers and membership are visible;
- only Admin, Alice, Sam, and Jules appear, and every screen has the correct persona header;
- onboarding registrations are committed and pushed before Admin merges and grants access;
- immediately after Alice and Sam receive group access, `gitvaulty cat` succeeds for every existing
  file assigned to that group;
- Alice's rejected membership change is readable before Admin's signed grant;
- encrypted secret and access-policy changes are committed and pushed;
- local, production, and Terraform access rules match the scenario contract;
- every direct plaintext display includes the demo-only warning and only generated dummy values;
- Jules's two authorization failures are readable;
- Jules's `dev` grant visibly unlocks every `dev` file without unlocking either SRE-only file;
- Sam's Terraform success is readable;
- apart from the warned dummy outputs, no plaintext value, master identity, derived private key, or
  personal workstation path is visible; the expected disposable
  `/tmp/gitvaulty-readme.*/remote.git` push target is allowed;
- the final frame remains long enough to read.

For targeted frame inspection, first read the duration:

```sh
ffprobe -v error \
  -select_streams v:0 \
  -show_entries stream=width,height,nb_frames,duration \
  -of default=noprint_wrappers=1 \
  demos/access-control.gif
```

Then extract a frame at a chosen timestamp:

```sh
ffmpeg -v error -y \
  -i demos/access-control.gif \
  -ss 60 \
  -frames:v 1 \
  /tmp/gitvaulty-demo-frame.png
```

Finally, verify that the completed invocation left no runtime directory behind. If no other demo is
currently running, this command prints nothing:

```sh
find /tmp -maxdepth 1 -type d -name 'gitvaulty-readme.*' -print
```

Commit the tape, driver, instructions, and regenerated GIF together whenever they change.
