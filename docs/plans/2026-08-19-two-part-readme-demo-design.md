# Two-Part README Demo Design

## Goal

Turn the existing README animation into one GIF with two explicit chapters. The first chapter should
teach the smallest useful GitVaulty workflow: create one encrypted file, decrypt it directly, and
prove that the plaintext file was not stored. The second chapter should retain the complete signed
group-access story.

## Continuous scenario

Both chapters use one disposable repository and the same Admin identity. The first visible command
is `gitvaulty create .env`, which implicitly initializes GitVaulty and assigns the new file to the
default `team` group. The dummy editor supplies generated placeholder values. A separate screen uses
`gitvaulty cat .env --force` under the existing demo-only warning, then runs a shell existence check
that prints a concise success message only when `.env` is absent. The encrypted
`.env.gitvaulty` remains the repository source of truth.

The second chapter continues from that state. Admin creates `dev` and `sre`, shows their signed
manager/member policies, and changes the existing `.env` access to `dev + sre` with
`gitvaulty access`. Admin then creates the SRE-only production and Terraform files. The rest of the
current onboarding, reviewed Git commits, signed grants, direct reads, authorization failures, and
Terraform execution remains unchanged.

## Presentation and safety

Chapter labels and all explanatory comments appear instantly; commands retain normal typing speed.
The first chapter is deliberately short and uses only generated dummy values. Its filesystem check
does not read plaintext or rely on `materialize`, `status`, or `clean`. The second chapter clears the
screen before it begins so viewers can distinguish the simple single-user story from access control.

The existing `npm run demo:generate` command continues to build one GIF at
`demos/access-control.gif`. The README describes the two chapters above that single artifact, while
`docs/demo/instructions.md` defines both scenario contracts and their visual review checks.
