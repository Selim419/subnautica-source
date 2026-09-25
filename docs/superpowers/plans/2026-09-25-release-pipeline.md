# Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one `git push` to a single source repo rebuild and redeploy both live sites (`selim419.github.io/` and `selim419.github.io/subnautica-derinlik-gunlugu/`) with no manual file copying.

**Architecture:** The repo `subnautica-github-pages` is a public source repo. Vite emits to `app/dist` with `base` read from the `PAGES_BASE` env var, and a `verify-base` assertion proves the built `index.html` actually references that base. A `CI` workflow in the source repo builds and verifies both base variants; on a green build **pushed to `main`**, a second job sends a `repository_dispatch` to each Pages repo carrying the verified commit SHA. Each Pages repo checks out that SHA, rebuilds with its own base, verifies, and deploys via `actions/deploy-pages`. `workflow_run` is deliberately not used: it is repository-scoped and cannot see a workflow running in another repository.

**Tech Stack:** Vite 6, Node 24 (built-in `node --test`), GitHub Actions, one fine-grained PAT stored as a repository secret.

**Plan:** 1 of 2. Plan 2 (`dive-spine`) builds the design system, scene engine and scroll dive on top of this pipeline.

## Global Constraints

- Source repo name is `Selim419/subnautica-source`. It **must be public** â€” `actions/checkout` in the Pages repos clones it with a read-only token.
- The source remote is **SSH**: `git@github.com:Selim419/subnautica-source.git`. The user's ed25519 key is registered on GitHub, so **the agent performs every push** in this plan. The original draft assigned pushes to the user; that no longer applies.
- The two live URLs must not both break from one commit. Guarantee: neither deploys unless source `CI` succeeded. Deploy ordering between the two sites is **not** guaranteed and is not relied upon.
- `PAGES_BASE` values are exactly `/` and `/subnautica-derinlik-gunlugu/` â€” the trailing slash is required, and the value must always be root-absolute (never `./` or `../`). `verifyBase` rejects a non-root-absolute built reference.
- Build output directory is `app/dist/`, already gitignored.
- Turkish UI copy, the 10 wiki records, `src/wikiData.js` and the 3 `.webp` files **in `app/public/`** are not touched by this plan. Deleting the *stale build-output copies* of those `.webp` files from the two Pages repos is pipeline cleanup and is explicitly in scope (Task 8); the source copies are untouched.
- Node 22 is used in CI to match the local Node 24 toolchain's supported range; both satisfy Vite 6's requirements.

---

## File Structure

**Source repo `Selim419/subnautica-source` (= local `subnautica-github-pages`):**

| File | Responsibility |
|---|---|
| `app/vite.config.js` | `base` from `PAGES_BASE`; `outDir` to `dist` |
| `app/scripts/build-with-base.mjs` | Cross-platform wrapper: set `PAGES_BASE`, spawn `vite build` |
| `app/scripts/verify-base.mjs` | Pure assertion: built `index.html` references the expected base |
| `app/scripts/verify-base.test.mjs` | `node --test` coverage of the assertion |
| `app/package.json` | `build`, `build:root`, `build:subpath`, `test:base` scripts |
| `.github/workflows/ci.yml` | Build both variants, verify bases, fail loudly |
| `docs/superpowers/` | Documentation only (build output removed) |
| `README.md` | New pipeline commands |

**Pages repos (`Selim419/Selim419.github.io`, `Selim419/subnautica-derinlik-gunlugu`):**

| File | Responsibility |
|---|---|
| `.github/workflows/deploy.yml` | `repository_dispatch` -> checkout source at the dispatched SHA -> build -> verify -> deploy |
| `README.md` | Replaces the hand-copied build output |

---

## Task 1: Create the source repo and attach the remote

**Files:**
- Modify: none (git metadata only)
- Create: `Selim419/subnautica-source` on GitHub (public, no README, no `.gitignore`, no license)

**Interfaces:**
- Consumes: nothing
- Produces: a public remote named `origin` on the local repo at `C:\Users\selim\subnautica-github-pages`, with branch `main` pushed to it

- [ ] **Step 1: Confirm the working tree is clean before touching remotes**

Run:
```powershell
git -C C:\Users\selim\subnautica-github-pages status --short
```
Expected: no output. If there is output, stop and resolve it first.

- [ ] **Step 2: Confirm the branch name**

Run:
```powershell
git -C C:\Users\selim\subnautica-github-pages branch --show-current
```
Expected: `main`

- [ ] **Step 3: USER ACTION â€” create the empty public repo**

Open this URL in the browser and click **Create repository**:

```
https://github.com/new?name=subnautica-source&description=Source%20for%20selim419.github.io&visibility=public
```

Then confirm:
- **Repository name** is exactly `subnautica-source`
- **Public** is selected
- **Do not** add a README, `.gitignore`, or a license (the local repo already has history that must be pushed on top)

- [ ] **Step 4: Add the remote**

Run:
```powershell
git -C C:\Users\selim\subnautica-github-pages remote add origin https://github.com/Selim419/subnautica-source.git
```
Expected: no output

- [ ] **Step 5: Verify the remote is attached and reachable**

Run:
```powershell
git -C C:\Users\selim\subnautica-github-pages remote -v
```
Expected: both `fetch` and `push` lines pointing at `Selim419/subnautica-source.git`

- [ ] **Step 6: USER ACTION â€” push**

Run this yourself (it will prompt for GitHub credentials):
```powershell
git -C C:\Users\selim\subnautica-github-pages push -u origin main
```
Expected: `branch 'main' set up to track 'origin/main'` and `3` commits pushed (2 pre-existing + the design spec commit).

- [ ] **Step 7: Verify the spec commit arrived**

Run:
```powershell
git -C C:\Users\selim\subnautica-github-pages ls-remote --heads origin
```
Expected: one line ending in `refs/heads/main`, and the SHA matches `git -C C:\Users\selim\subnautica-github-pages rev-parse HEAD`

---

## Task 2: Point the build at `dist` and read `base` from the environment

**Files:**
- Modify: `app/vite.config.js:1-12`
- Modify: `app/package.json:6-9`

**Interfaces:**
- Consumes: nothing
- Produces: Vite reads `process.env.PAGES_BASE` and emits to `app/dist`. `npm run build:root` and `npm run build:subpath` scripts exist for Task 3's tests to call.

- [ ] **Step 1: Record the current broken configuration**

The contract: with `PAGES_BASE` unset, base is `/`; with it set, base is that value
verbatim including the trailing slash. Confirm the current state violates it â€” this is
finding F2, and seeing it fail is the reason the rest of this task exists.

Run:
```powershell
Select-String -Path C:\Users\selim\subnautica-github-pages\app\vite.config.js -Pattern "base:|outDir:"
```
Expected output shows `base: '/subnautica-derinlik-gunlugu/'` and `outDir: '../docs'`.

- [ ] **Step 2: Replace `vite.config.js`**

Write `app/vite.config.js` with exactly this content:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.PAGES_BASE ?? '/'

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 3: Add the cross-platform build wrapper**

Create `app/scripts/build-with-base.mjs` with exactly this content:

```js
import { spawn } from 'node:child_process'

const base = process.argv[2]

if (!base) {
  console.error('usage: node scripts/build-with-base.mjs <base>')
  process.exit(1)
}

if (!base.startsWith('/')) {
  console.error(`base must start with / (got: ${base})`)
  process.exit(1)
}

if (!base.endsWith('/')) {
  console.error(`base must end with / (got: ${base})`)
  process.exit(1)
}

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, PAGES_BASE: base },
})

child.on('exit', (code) => process.exit(code ?? 1))
```

The leading- and trailing-slash checks exist because a missing trailing slash silently produces a broken `index.html` â€” that is exactly the class of bug this plan eliminates.

- [ ] **Step 4: Replace the scripts block in `app/package.json`**

Change the `scripts` object to exactly:

```json
"scripts": {
  "dev": "vite --host 127.0.0.1",
  "build": "vite build",
  "build:root": "node scripts/build-with-base.mjs /",
  "build:subpath": "node scripts/build-with-base.mjs /subnautica-derinlik-gunlugu/",
  "test:base": "node --test scripts/verify-base.test.mjs"
}
```

Keep `dependencies` and `devDependencies` exactly as they are.

- [ ] **Step 5: Run a root build and confirm the output directory**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app; npm run build:root
```
Expected: Vite reports `built in` and output paths are prefixed `dist/`.

- [ ] **Step 6: Confirm `docs/` was not written to**

Run:
```powershell
git -C C:\Users\selim\subnautica-github-pages status --short
```
Expected: no `docs/assets` or `docs/index.html` modifications. Any `M docs/...` line means `outDir` did not change â€” stop and fix Step 2.

---

## Task 3: Verify the base path, and prove the current bug is caught

**Files:**
- Create: `app/scripts/verify-base.mjs`
- Create: `app/scripts/verify-base.test.mjs`

**Interfaces:**
- Consumes: the `dist/index.html` produced by Task 2
- Produces: `verifyBase(html, expectedBase)` â€” throws with a message naming the actual base when it does not match. Task 4's CI workflow calls it via `node scripts/verify-base.mjs <base>`.

- [ ] **Step 1: Write the failing test**

Create `app/scripts/verify-base.test.mjs` with exactly this content:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyBase } from './verify-base.mjs'

const asset = (base) =>
  `<script type="module" crossorigin src="${base}assets/index-abc.js"></script>` +
  `<link rel="stylesheet" crossorigin href="${base}assets/index-abc.css">`

test('accepts a matching root base', () => {
  assert.doesNotThrow(() => verifyBase(asset('/'), '/'))
})

test('accepts a matching subpath base', () => {
  assert.doesNotThrow(() =>
    verifyBase(asset('/subnautica-derinlik-gunlugu/'), '/subnautica-derinlik-gunlugu/')
  )
})

test('rejects a subpath build when root was expected', () => {
  assert.throws(
    () => verifyBase(asset('/subnautica-derinlik-gunlugu/'), '/'),
    /base/
  )
})

test('rejects a root build when subpath was expected', () => {
  assert.throws(() => verifyBase(asset('/'), '/subnautica-derinlik-gunlugu/'), /base/)
})

test('rejects a base without a trailing slash', () => {
  assert.throws(() => verifyBase(asset('/subnautica-derinlik-gunlugu'), '/subnautica-derinlik-gunlugu/'), /trailing/)
})

test('rejects html with no asset references at all', () => {
  assert.throws(() => verifyBase('<html><body>nothing here</body></html>', '/'), /no asset/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app; npm run test:base
```
Expected: FAIL with `Cannot find module` or `verifyBase is not a function` â€” the implementation does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `app/scripts/verify-base.mjs` with exactly this content:

```js
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const match = /(?:\bsrc|\bhref)="([^"]*assets\/[^"]*)"/

export function verifyBase(html, expectedBase) {
  const found = match.exec(html)

  if (!found) {
    throw new Error('no asset reference found in index.html - build did not produce output')
  }

  const referenced = new URL(found[1], 'https://example.invalid/').pathname
  const expectedDir = expectedBase.endsWith('/') ? expectedBase : `${expectedBase}/`

  const marker = referenced.indexOf('assets/')
  const actualBase = marker === -1 ? referenced : referenced.slice(0, marker)

  if (!actualBase.endsWith('/')) {
    throw new Error(`base is missing its trailing slash: got ${actualBase}`)
  }

  if (actualBase !== expectedDir) {
    throw new Error(
      `base mismatch: index.html references ${referenced} but ${expectedDir} was expected`
    )
  }

  return true
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const expected = process.argv[2]
  if (!expected) {
    console.error('usage: node scripts/verify-base.mjs <expected-base>')
    process.exit(1)
  }
  const html = readFileSync(resolve('dist/index.html'), 'utf8')
  try {
    verifyBase(html, expected)
    console.log(`base OK: ${expected}`)
  } catch (error) {
    console.error(`base FAILED: ${error.message}`)
    process.exit(1)
  }
}
```

The comparison extracts the base as the substring before `assets/` and compares it
**exactly**. Do not simplify this to `referenced.startsWith(expectedBase)` â€” with
`expectedBase === '/'` that check is true for every absolute path and would accept the
wrong build. The trailing-slash case is caught separately because Vite emits
`/subassets/...` when `base` lacks the slash, producing a base that does not end in `/`.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app; npm run test:base
```
Expected: `# pass 6`, `# fail 0`

- [ ] **Step 5: Verify the real root build passes**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app; npm run build:root; node scripts/verify-base.mjs /
```
Expected: `base OK: /`

- [ ] **Step 6: Prove the check catches the original bug (F2)**

This is the step that demonstrates the whole plan is worth doing. Build the subpath variant and then assert the root check rejects it:

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app; npm run build:subpath; node scripts/verify-base.mjs /
```
Expected: `base FAILED: base mismatch: index.html references /subnautica-derinlik-gunlugu/assets/... but / was expected` and a non-zero exit code. **This failure is the correct result.**

- [ ] **Step 7: Restore the root build so the tree is in a known state**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app; npm run build:root; node scripts/verify-base.mjs /
```
Expected: `base OK: /`

- [ ] **Step 8: Commit**

```powershell
cd C:\Users\selim\subnautica-github-pages
git add app/scripts
git commit -m "Assert the built index.html references the expected base" -m "The test and the assertion that make the base path trustworthy. verify-base compares the base prefix of the built asset URL against the expected value exactly, so a build served with the wrong base fails loudly instead of shipping." -m "Note for future edits: the module-level regex in verify-base.mjs must not gain a g flag - exec would become stateful via lastIndex and the six tests would fail intermittently depending on order."
```

**Three constraints Task 4 depends on:**

- **The base must be root-absolute.** `verifyBase` rejects any reference not starting with
  `/`. This is deliberate: a Vite build with `base: './'` emits `src="./assets/..."`,
  which would otherwise normalize to `/` and pass the root check â€” the most common
  alternative "fix" for the original bug, and one that silently breaks a project-page
  deployment. `PAGES_BASE` must never be given a relative value.
- The verifier's `dist/index.html` path is anchored to the script location via
  `import.meta.url`, **not** the process working directory. It runs correctly from
  anywhere. The CI workflow still sets `working-directory: app`, but only because
  `npm ci` and `npm run` need it.
- The module-level regex must **not** gain a `g` flag. `verifyBase` calls `exec`
  repeatedly; with `/g`, `lastIndex` persists between calls and the results diverge.
  This is now enforced by a test that calls `verifyBase` twice on the same html, so
  adding the flag fails the suite immediately.

---

## Task 4: Add the source repo CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run build:root`, `npm run build:subpath`, `npm run test:base` from Task 2 and Task 3
- Produces: a workflow named **`CI`**. Task 5 and Task 6 depend on the exact workflow name `CI` and branch `main` â€” a rename breaks the deploy trigger silently.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/ci.yml` with exactly this content:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    timeout-minutes: 15
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: app/package-lock.json

      - name: Install
        run: npm ci

      - name: Test base assertion
        run: npm run test:base

      - name: Build root site
        run: npm run build:root

      - name: Verify root base
        run: node scripts/verify-base.mjs /

      - name: Build subpath site
        run: npm run build:subpath

      - name: Verify subpath base
        run: node scripts/verify-base.mjs /subnautica-derinlik-gunlugu/

      - name: Confirm build emitted to app/dist
        run: test -f dist/index.html

  dispatch:
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch root site
        env:
          GH_TOKEN: ${{ secrets.PAGES_DISPATCH_TOKEN }}
          TARGET: Selim419/Selim419.github.io
          SHA: ${{ github.sha }}
        run: |
          gh api "repos/$TARGET/dispatches" \
            --method POST \
            --field event_type=deploy \
            --field "client_payload[sha]=$SHA"

      - name: Dispatch subpath site
        env:
          GH_TOKEN: ${{ secrets.PAGES_DISPATCH_TOKEN }}
          TARGET: Selim419/subnautica-derinlik-gunlugu
          SHA: ${{ github.sha }}
        run: |
          gh api "repos/$TARGET/dispatches" \
            --method POST \
            --field event_type=deploy \
            --field "client_payload[sha]=$SHA"
```

The `dispatch` job carries three properties that matter:

- `needs: build` â€” a red build dispatches nothing, so a broken commit cannot reach either site.
- `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` â€” `pull_request`
  runs see `github.ref` as `refs/pull/N/merge`, so PR verification runs (which are
  wanted) never dispatch. This guard is what makes the `branches: [main]` filter on
  `workflow_run` unnecessary â€” and `workflow_run` is not used at all, because it is
  repository-scoped and cannot see a workflow running in another repository.
- `client_payload[sha]` carries the exact commit to publish, so each Pages repo builds
  the commit that passed CI rather than whatever `main` happens to be when it runs.

`gh` is preinstalled on `ubuntu-latest` and reads `GH_TOKEN` from the environment.
`POST /repos/{owner}/{repo}/dispatches` returns **204** on success.

The final step is a guard against a future `.gitignore` or `emptyOutDir` change silently producing an empty `dist`.

- [ ] **Step 2: Verify the workflow file has the shape the deploy workflows depend on**

The deploy workflows trigger on a workflow literally named `CI`. A rename here breaks
both deployments silently, so assert the name and the branch filter.

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages
$s = Get-Content .github/workflows/ci.yml -Raw
if ($s -notmatch '(?m)^name:\s*CI\s*$') { throw 'workflow must be named CI' }
if ($s -notmatch 'branches:\s*\[main\]') { throw 'CI must run on main' }
if ($s -notmatch 'verify-base\.mjs') { throw 'CI must verify the base path' }
"ci.yml shape OK"
```
Expected: `ci.yml shape OK`

- [ ] **Step 3: Run the same steps locally to prove CI will pass before it ever runs**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app
npm run test:base
$env:PAGES_BASE='/'; npm run build; node scripts/verify-base.mjs /
$env:PAGES_BASE='/subnautica-derinlik-gunlugu/'; npm run build; node scripts/verify-base.mjs /subnautica-derinlik-gunlugu/
Remove-Item Env:PAGES_BASE
```
Expected: `8` passing tests, then `base OK: /`, then `base OK: /subnautica-derinlik-gunlugu/`

- [ ] **Step 4: Restore the default build**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app; npm run build:root
```
Expected: `base OK`-clean build into `dist/`

- [ ] **Step 5: Commit and push**

```powershell
cd C:\Users\selim\subnautica-github-pages
git add .github/workflows/ci.yml
git commit -m "Add CI that builds, verifies and dispatches" -m "Builds both base variants and asserts each against its expected base, then dispatches a deploy to both Pages repos with the verified commit SHA. The dispatch job is gated on a push to main, so pull request runs verify without publishing."
git push
```

Then open `https://github.com/Selim419/subnautica-source/actions` and confirm the `CI`
run succeeds. **The `dispatch` job will fail on this first push** — the
`PAGES_DISPATCH_TOKEN` secret does not exist until Task 7 Step 2. A red dispatch job with
that cause is expected and harmless; the `build` job is what proves CI works. Do not
treat the dispatch failure as a regression.

---

## Task 5: Add the deploy workflow to the root Pages repo

**Files:**
- Create: `C:\Users\selim\selim419-github-io-deploy\.github\workflows\deploy.yml`

**Interfaces:**
- Consumes: a `repository_dispatch` event with `event_type: deploy` and
  `client_payload.sha` sent by the source repo's `CI` workflow
- Produces: a live update of `https://selim419.github.io/`. Task 7 verifies it.

**Why `repository_dispatch` and not `workflow_run`:** `workflow_run` matches workflows
**in the same repository**. `CI` runs in `Selim419/subnautica-source`; this file lives in
`Selim419/Selim419.github.io`. A `workflow_run` trigger here would never fire.
`repository_dispatch` is the documented cross-repository mechanism, and it also lets the
payload name the exact commit to publish.

- [ ] **Step 1: Write the workflow**

Create `C:\Users\selim\selim419-github-io-deploy\.github\workflows\deploy.yml` with exactly this content:

```yaml
name: Deploy root site

on:
  repository_dispatch:
    types: [deploy]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-root
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
        with:
          repository: Selim419/subnautica-source
          ref: ${{ github.event.client_payload.sha }}

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: app/package-lock.json

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build:root
        run: npm run build

      - name: Verify base
        run: node scripts/verify-base.mjs /

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: app/dist

      - uses: actions/deploy-pages@v4
```

`pages: write` and `id-token: write` come from this repository's own `GITHUB_TOKEN` â€” no
secret is involved in the deploy itself. The only secret in the whole pipeline is the
dispatch token in the source repo.

- [ ] **Step 2: Confirm the two base values did not get swapped**

The highest-risk copy-paste error in the pipeline: a swap still produces a green build,
it just serves the wrong site.

Run:
```powershell
$w = Get-Content C:\Users\selim\selim419-github-io-deploy\.github\workflows\deploy.yml -Raw
if ($w -match 'build:subpath') { throw "root repo has the subpath build - swapped" }
if ($w -notmatch 'npm run build:root') { throw "root repo must build with npm run build:root" }
if ($w -notmatch 'verify-base\.mjs /(\r?\n|$)') { throw "root repo must verify against /" }
if ($w -notmatch 'repository_dispatch') { throw "must trigger on repository_dispatch" }
if ($w -notmatch 'client_payload\.sha') { throw "must build the dispatched SHA" }
"root deploy wiring OK"
```
Expected: `root deploy wiring OK`

- [ ] **Step 3: Convert the remote to SSH and commit**

```powershell
cd C:\Users\selim\selim419-github-io-deploy
git remote set-url origin git@github.com:Selim419/Selim419.github.io.git
git add .github/workflows/deploy.yml
git commit -m "Deploy root site from subnautica-source on dispatch"
```

- [ ] **Step 4: Push**

```powershell
cd C:\Users\selim\selim419-github-io-deploy; git push
```

Nothing runs yet â€” a `repository_dispatch` workflow only fires when dispatched, and no
dispatch has been sent. The workflow must be on the default branch before it can be
triggered, so push before Task 4's dispatch job goes live.

---

## Task 6: Add the deploy workflow to the subpath Pages repo

**Files:**
- Create: `C:\Users\selim\subnautica-pages-deploy\.github\workflows\deploy.yml`

**Interfaces:**
- Consumes: the same `repository_dispatch` event as Task 5
- Produces: a live update of `https://selim419.github.io/subnautica-derinlik-gunlugu/`

- [ ] **Step 1: Write the workflow**

Create `C:\Users\selim\subnautica-pages-deploy\.github\workflows\deploy.yml` with exactly this content â€” identical to Task 5 except for the workflow `name`, the concurrency group, and the two `PAGES_BASE` values:

```yaml
name: Deploy subpath site

on:
  repository_dispatch:
    types: [deploy]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-subpath
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
        with:
          repository: Selim419/subnautica-source
          ref: ${{ github.event.client_payload.sha }}

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: app/package-lock.json

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build:subpath
        run: npm run build

      - name: Verify base
        run: node scripts/verify-base.mjs /subnautica-derinlik-gunlugu/

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: app/dist

      - uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the base values were not swapped between the two repos**

Run:
```powershell
$root = Get-Content C:\Users\selim\selim419-github-io-deploy\.github\workflows\deploy.yml -Raw
$sub  = Get-Content C:\Users\selim\subnautica-pages-deploy\.github\workflows\deploy.yml -Raw
if ($root -match 'build:subpath') { throw "root repo has the subpath build - swapped" }
if ($sub -notmatch 'npm run build:subpath') { throw "subpath repo must build with npm run build:subpath" }
if ($sub -notmatch 'verify-base\.mjs /subnautica-derinlik-gunlugu/') { throw "subpath verify target wrong" }
if ($root -eq $sub) { throw "the two files are identical - the base values were never changed" }
"subpath deploy wiring OK - no swap"
```
Expected: `subpath deploy wiring OK - no swap`

- [ ] **Step 3: Convert the remote to SSH and commit**

```powershell
cd C:\Users\selim\subnautica-pages-deploy
git remote set-url origin git@github.com:Selim419/subnautica-derinlik-gunlugu.git
git add .github/workflows/deploy.yml
git commit -m "Deploy subpath site from subnautica-source on dispatch"
```

- [ ] **Step 4: Push**

```powershell
cd C:\Users\selim\subnautica-pages-deploy; git push
```

---

## Task 7: Add the dispatch token secret and switch both Pages repos to Actions

**Files:**
- Modify: `Selim419/subnautica-source` repository settings â€” one Actions secret (UI only)
- Modify: `Selim419/Selim419.github.io` settings â€” Pages source (UI only)
- Modify: `Selim419/subnautica-derinlik-gunlugu` settings â€” Pages source (UI only)

**Interfaces:**
- Consumes: Tasks 4, 5 and 6
- Produces: the end-to-end path. The next push to the source repo rebuilds and
  republishes both sites with no further action.

Three UI steps the agent cannot perform. Do them in this order.

- [ ] **Step 1: Create a fine-grained personal access token**

Open: **https://github.com/settings/personal-access-tokens/new**

Configure:
- **Token name:** `subnautica-source pages dispatch`
- **Expiration:** 90 days (it can be extended; a dispatch token has a small blast radius)
- **Resource owner:** `Selim419`
- **Repository access:** *Only select repositories* â†’ select **both**
  `Selim419.github.io` and `Selim419/subnautica-derinlik-gunlugu`
- **Permissions â†’ Repository permissions:** `Contents: Read and write`

That is the narrowest set that can call `POST /repos/{owner}/{repo}/dispatches`. The
REST docs only spell out the *classic* token's `repo` scope; a classic token would carry
write access to **every** repository on the account, which is why the fine-grained token
is used instead. If GitHub rejects the fine-grained token with 403 during the first
dispatch, widen to `Actions: Read and write` and retry â€” the error message names the
missing permission. Do not fall back to a classic `repo` token without saying so.

Copy the generated token; it is shown only once.

- [ ] **Step 2: Add it as a secret in the source repo**

Open: **https://github.com/Selim419/subnautica-source/settings/secrets/actions/new**

- **Name:** `PAGES_DISPATCH_TOKEN` (exact â€” `ci.yml` references this name)
- **Secret:** paste the token

- [ ] **Step 3: Confirm the live sites work before flipping anything**

```powershell
(Invoke-WebRequest https://selim419.github.io/ -UseBasicParsing).StatusCode
(Invoke-WebRequest https://selim419.github.io/subnautica-derinlik-gunlugu/ -UseBasicParsing).StatusCode
```
Expected: `200` and `200`. This is the pre-flip baseline. If either is not 200, stop.

- [ ] **Step 4: USER ACTION â€” flip the root repo to Actions**

Open `https://github.com/Selim419/Selim419.github.io/settings/pages`, set **Source** to
**GitHub Actions**, save.

- [ ] **Step 5: USER ACTION â€” flip the subpath repo to Actions**

Open `https://github.com/Selim419/subnautica-derinlik-gunlugu/settings/pages`, set
**Source** to **GitHub Actions**, save.

Nothing deploys yet â€” the dispatch job has not been committed. The flip only means the
next successful dispatch will be served.

- [ ] **Step 6: Commit and push the dispatch job**

```powershell
cd C:\Users\selim\subnautica-github-pages
git add .github/workflows/ci.yml
git commit -m "Dispatch a deploy to both Pages repos after a green build"
git push
```

This push **is** the end-to-end test. It triggers `CI`, which builds both base variants,
verifies both, and â€” only on a green build on `main` â€” dispatches to each Pages repo,
each of which checks out this exact SHA, rebuilds with its own base, verifies, and deploys.

- [ ] **Step 7: Watch all three runs go green**

Open:
- `https://github.com/Selim419/subnautica-source/actions`
- `https://github.com/Selim419/Selim419.github.io/actions`
- `https://github.com/Selim419/subnautica-derinlik-gunlugu/actions`

Expected: `CI` green, `Deploy root site` green, `Deploy subpath site` green.

If a deploy is red at the dispatch step, the cause is the token â€” read the 403 message
for the missing permission and widen it per Step 1. If a deploy is red at
`configure-pages`, the Pages source flip did not take.

- [ ] **Step 8: Verify both sites serve the Actions build**

```powershell
$r = Invoke-WebRequest https://selim419.github.io/ -UseBasicParsing
$s = Invoke-WebRequest https://selim419.github.io/subnautica-derinlik-gunlugu/ -UseBasicParsing
if ($r.StatusCode -ne 200) { throw "root site down" }
if ($s.StatusCode -ne 200) { throw "subpath site down" }
if ($r.Content -notmatch 'src="/assets/') { throw "root base wrong" }
if ($s.Content -notmatch 'src="/subnautica-derinlik-gunlugu/assets/') { throw "subpath base wrong" }
"both sites live and correctly based"
```
Expected: `both sites live and correctly based`

## Task 8: Remove the hand-copied build output and update the READMEs

**Files:**
- Delete: `docs/assets/`, `docs/index.html`, `docs/.nojekyll`, `docs/kelp-forest.webp`, `docs/lost-river.webp`, `docs/ocean-hero.webp` in the source repo
- Delete: `assets/`, `index.html`, `.nojekyll`, `*.webp` in both Pages repos
- Create: `README.md` in both Pages repos
- Modify: `README.md` in the source repo

**Interfaces:**
- Consumes: Task 7 being complete and green
- Produces: a repository tree with no stale build output

**This task runs only after Task 7. Until Pages serves from Actions, deleting the branch content 404s the live site.**

- [ ] **Step 1: Confirm both sites are still live before deleting anything**

Run:
```powershell
(Invoke-WebRequest https://selim419.github.io/ -UseBasicParsing).StatusCode
(Invoke-WebRequest https://selim419.github.io/subnautica-derinlik-gunlugu/ -UseBasicParsing).StatusCode
```
Expected: `200` and `200`. If either is not 200, stop â€” Task 7 is not actually done.

- [ ] **Step 2: Delete build output from the source repo**

```powershell
cd C:\Users\selim\subnautica-github-pages
git rm -r --quiet docs/assets docs/index.html docs/.nojekyll docs/kelp-forest.webp docs/lost-river.webp docs/ocean-hero.webp
```
Expected: no error. `docs/superpowers/` must remain.

- [ ] **Step 3: Verify only documentation remains under `docs/`**

```powershell
cd C:\Users\selim\subnautica-github-pages
git status --short
```
Expected: deletions under `docs/` only, plus `docs/superpowers/` untracked-or-unchanged. No `docs/*.webp` remains.

- [ ] **Step 4: Write the source repo README**

Overwrite `README.md` with:

````markdown
# Subnautica â€” kaynak

Bu depo `selim419.github.io` ve `selim419.github.io/subnautica-derinlik-gunlugu`
sitelerinin kaynak kodudur. Resmi Subnautica sitesi degildir.

## Gelistirme

```powershell
cd app
npm ci
npm run dev
```

## Build

```powershell
cd app
npm run build:root     # base = /
npm run build:subpath  # base = /subnautica-derinlik-gunlugu/
```

Cikti `app/dist/` altina yazilir ve `dist/index.html` icin taban yolu
`npm run test:base` dogrulanir.

## Yayinlama

`git push` -> kaynak repodaki `CI` workflow'u iki taban yolunu da build edip
dogrular. Basarili olursa her iki Pages reposundaki `deploy.yml` calisir, ayni
commit'i kendi taban yoluyla build edip GitHub Pages'a yayinlar.

Elle kopyalama yoktur.

## Yapi

- `app/src/dive/` â€” scroll'a bagli dalis, derinlik rejimleri
- `app/src/scene/` â€” prosedurel okyanus sahnesi (Three.js)
- `app/src/design/` â€” renk, tipografi ve olcu token'lari
- `docs/superpowers/` â€” tasarim ve plan belgeleri
````

- [ ] **Step 5: Commit the source repo cleanup**

```powershell
cd C:\Users\selim\subnautica-github-pages
git add README.md docs
git commit -m "Drop hand-copied build output; document the new pipeline

Build output lived in docs/ and was copied by hand into the Pages repos.
It now goes to app/dist and is deployed by GitHub Actions. docs/ is
documentation only."
```

- [ ] **Step 6: Write and commit the README in the root Pages repo**

```powershell
cd C:\Users\selim\selim419-github-io-deploy
git rm -r --quiet assets index.html .nojekyll kelp-forest.webp lost-river.webp ocean-hero.webp
```
Then create `README.md` with exactly:

```markdown
# selim419.github.io

Bu depo artik build ciktisi tutmaz. Icerik
`Selim419/subnautica-source` reposundan GitHub Actions ile yayinlanir.

Kaynak: https://github.com/Selim419/subnautica-source
Canli: https://selim419.github.io/
```

Then:
```powershell
git add README.md
git commit -m "Stop tracking build output; content now deploys from source"
```

- [ ] **Step 7: Repeat for the subpath Pages repo**

```powershell
cd C:\Users\selim\subnautica-pages-deploy
git rm -r --quiet assets index.html .nojekyll kelp-forest.webp lost-river.webp ocean-hero.webp
```
Create `README.md` with exactly:

```markdown
# subnautica-derinlik-gunlugu

Bu depo artik build ciktisi tutmaz. Icerik
`Selim419/subnautica-source` reposundan GitHub Actions ile yayinlanir.

Kaynak: https://github.com/Selim419/subnautica-source
Canli: https://selim419.github.io/subnautica-derinlik-gunlugu/
```

Then:
```powershell
git add README.md
git commit -m "Stop tracking build output; content now deploys from source"
```

- [ ] **Step 8: USER ACTION â€” push all three repos**

```powershell
cd C:\Users\selim\subnautica-github-pages; git push
cd C:\Users\selim\selim419-github-io-deploy; git push
cd C:\Users\selim\subnautica-pages-deploy; git push
```

- [ ] **Step 9: Final end-to-end verification**

Open `https://github.com/Selim419/subnautica-source/actions`, note the newest green `CI` run, then confirm both sites are live and correct:

```powershell
$r = Invoke-WebRequest https://selim419.github.io/ -UseBasicParsing
$s = Invoke-WebRequest https://selim419.github.io/subnautica-derinlik-gunlugu/ -UseBasicParsing
if ($r.StatusCode -ne 200) { throw "root site down" }
if ($s.StatusCode -ne 200) { throw "subpath site down" }
if ($r.Content -notmatch 'src="/assets/') { throw "root base wrong" }
if ($s.Content -notmatch 'src="/subnautica-derinlik-gunlugu/assets/') { throw "subpath base wrong" }
"END TO END OK"
```
Expected: `END TO END OK`

---

## Verification

Plan 1 is done when all of these hold:

1. `git -C C:\Users\selim\subnautica-github-pages remote -v` lists `Selim419/subnautica-source`.
2. `npm run test:base` in `app/` reports 8 passing, 0 failing.
3. `npm run build:subpath` followed by `node scripts/verify-base.mjs /` **fails** â€” the original bug is detected.
4. Source `CI` is green on `https://github.com/Selim419/subnautica-source/actions`.
5. Both Pages repos show a green `Deploy â€¦ site` run.
6. Both live URLs return 200 with correctly based asset paths.
7. No repo tracks build output; `docs/` in the source repo contains only `superpowers/`.

## Out of Scope

- No test runner is added. `node --test` covers `verify-base` only; Vitest and the module tests arrive with Plan 2. `ci.yml` therefore has no `npm test` step yet â€” Plan 2 adds it.
- The 3 `.webp` files stay in `app/public/`. Their placement in the Pages repos is removed, but the source copies are untouched.
- Deploy ordering between the two sites is not enforced. The guarantee is "neither deploys on a red CI", not "root goes first".
