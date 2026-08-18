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
5. removes the disposable repository, identities, and plaintext from `/tmp`, including when the
   recording fails.

Do not invoke the visible driver directly unless you are debugging the scenario. The tape prepares
its temporary repository, identities, editor, and environment before starting the driver.

## Scenario contract

Keep these scenes in this order so the animation tells one continuous access-control story:

1. Initialize a new GitVaulty repository as `admin`.
2. Create the `dev` and `sre` groups, with `admin` initially in both.
3. Register `alice` as the initial developer and `sam` as the initial SRE, then add them to their
   respective groups and show the group list.
4. Create the local `.env` for both `dev` and `sre`.
5. Create `.env.production` for `sre` only.
6. Create `terraform/prod.auto.tfvars` for `sre` only.
7. Later, register `jules`, add that user to `dev`, and show the updated group list.
8. As `jules`, materialize accessible files and show that only the local `.env` appears. Attempt to
   decrypt `.env.production` and `terraform/prod.auto.tfvars`, and show both authorization failures.
9. As `sam`, use the two SRE-only files in a Terraform command through `gitvaulty run`. Show that
   Terraform accepts them and that no plaintext secret file remains afterward.

If a user-facing command, prompt, message, or access rule in one of these scenes changes, update the
tape or driver and regenerate the GIF. Add a scene only when it strengthens this story; keep setup
details out of the visible recording.

## Recording rules

- Use dummy plaintext only. Never record real credentials or private identities.
- Store runtime identities and plaintext only in the tape's explicit `/tmp` paths.
- Never print plaintext secret values. Demonstrate success through filenames, authorization
  messages, Terraform validation, and cleanup status.
- Keep hidden setup commands before `Show` and clear the terminal with the direct ANSI sequence in
  the tape. The external `clear` command can leave hidden setup text in VHS's first frame.
- Use content-weighted pauses. Short success messages need about two seconds; created-file results
  need about three; group listings, materialization status, and cleanup evidence need about four.
- Clear between scenes so each section has one readable purpose and long commands do not crowd later
  output.

## Review the result

After generation, play the GIF from beginning to end and confirm:

- it opens on the repository initialization, with no setup commands or random characters;
- text is legible and no command or important result disappears too quickly;
- `dev` and `sre` membership is visible;
- local, production, and Terraform access rules match the scenario contract;
- Jules's two authorization failures are readable;
- Sam's Terraform success and final missing-file status are readable;
- no secret value, age private key, or local machine path is visible;
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

Finally, verify the disposable paths are gone:

```sh
test ! -e /tmp/gitvaulty-readme-demo
test ! -e /tmp/gitvaulty-readme-keys
```

Commit the tape, driver, instructions, and regenerated GIF together whenever they change.
