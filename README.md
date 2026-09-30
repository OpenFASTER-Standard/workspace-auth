# workspace-auth

Static, serverless admin login for OpenFASTER annotation workspaces. No
server, no database — an admin's identity is proven by decrypting a small,
git-committed file, entirely in the browser.

Design: [`generator`'s `docs/specs/2026-09-30-workspace-admin-authentication-design.md`](https://github.com/OpenFASTER-Standard/generator/blob/main/docs/specs/2026-09-30-workspace-admin-authentication-design.md).

## How it works

Open `index.html?workspace=<workspace-id>`. The page fetches
`rosters/<workspace-id>.age` (always public — its confidentiality comes
from encryption, not from repo privacy) and asks for a passphrase. A
correct passphrase decrypts the file client-side (via the bundled
`age-encryption` library) and reveals a GitHub token scoped to that one
workspace's own content repo, held only in memory for the page's lifetime
— never `localStorage`, `sessionStorage`, or a cookie.

## Roster file format

`rosters/<workspace-id>.age` is the **raw binary** output of
`pyrage.passphrase.encrypt(...)` — no ASCII armor (verified live: `pyrage`
has no `armor` module; the file begins with the literal ASCII header
`age-encryption.org/v1`). Decrypted plaintext is JSON:

```json
{"workspace_repo": "<owner>/<repo>", "github_token": "<fine-grained PAT, scoped to only that one repo, contents:write>"}
```

`workspace-id` (the filename's stem) is an independent slug chosen at
provisioning time — it is *not* derived from `owner/repo`, which is
recorded inside the encrypted payload instead. Two different
organizations' same-named repos never collide.

## Provisioning a new workspace (manual runbook)

Not automated — GitHub has no API for a token to self-issue a new
fine-grained PAT (a deliberate GitHub security boundary), so any amount of
automation here still bottlenecks on a manual step:

1. Create the workspace's content repo: `gh repo create <owner>/<name> --public` or `--private`.
2. Manually create a fine-grained PAT scoped to only that repo, `contents: write`
   permission, via GitHub's web UI (Settings → Developer settings → Fine-grained tokens).
3. Pick a passphrase for this workspace's admin group and run, from `generator`'s own venv:
   ```python
   from workspace_auth.roster import create_roster
   ciphertext = create_roster(
       workspace_repo="<owner>/<name>",
       github_token="<the PAT from step 2>",
       passphrase="<the chosen passphrase>",
   )
   open("rosters/<workspace-id>.age", "wb").write(ciphertext)
   ```
4. Commit and push that one file to this repo.
5. Share the passphrase with the trusted admin group out of band — via
   this ecosystem's existing Vaultwarden org vault, not chat/email.

## Regenerating `age.js`

`age.js` is a committed build artifact (this is a static site — GitHub
Pages has no build step), bundled from the real
[`age-encryption`](https://www.npmjs.com/package/age-encryption) npm
package (`FiloSottile/typage`) via `esbuild`, exactly per that package's
own documented browser-usage instructions:

```bash
mkdir /tmp/age-build && cd /tmp/age-build
npm init -y
npm install esbuild age-encryption
npx esbuild --target=es2022 --bundle --minify --outfile=age.js --global-name=age age-encryption
cp age.js <this repo>/age.js
```

Regenerate only when upgrading the `age-encryption` version.
