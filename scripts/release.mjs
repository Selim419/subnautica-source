#!/usr/bin/env node
// Publishes the current source commit to both GitHub Pages sites.
//
// The two Pages repositories hold no build output. Each carries a `.deploy-source`
// file naming the exact source commit it should publish, and each has a workflow
// that checks out that commit, builds it with its own base, and deploys it. This
// script pushes the source, waits for the source CI to conclude `success` at that
// exact commit, and only then records the SHA in both Pages repos.
//
// The CI wait is the gate that keeps a red source build off both live sites. The
// deploy workflows are triggered by a push to each Pages repo's own `main`, so
// nothing upstream of this script can know whether the source was green; if this
// script pinned an unverified commit, a red `npm run test:base` would publish
// unchallenged. An unknown CI state is treated as a refusal, not as a pass.
//
// Usage:
//   node scripts/release.mjs            push and publish
//   node scripts/release.mjs --force    publish even if the pin is unchanged
//   node scripts/release.mjs --dry-run  print what would happen, change nothing
//
// Paths to the two Pages clones default to this machine's layout and can be
// overridden with --root-dir / --subpath-dir, or $PAGES_ROOT_DIR /
// $PAGES_SUBPATH_DIR. Each target is checked for repository identity and branch
// before anything is pushed, so a path repointed at a fork fails loudly instead
// of pushing a pin that deploys nothing.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PIN = '.deploy-source'
const SOURCE_REPO = 'Selim419/subnautica-source'
const CI_WORKFLOW = 'CI'

// The unauthenticated GitHub API allows 60 requests per hour per IP, and this
// machine shares that IP with anything else running here. The poll interval is
// therefore long (5 minutes of waiting costs at most ~20 requests) rather than
// tight-looping, and a rate-limit response is waited out instead of retried
// immediately.
const CI_POLL_MS = 15_000
const CI_TIMEOUT_MS = 5 * 60_000

const dryRun = process.argv.includes('--dry-run')
// A pin that already names this commit is skipped, so a no-op release cannot
// restart the deploys. --force exists for the case where the pin is right but
// the deploys still need to run - for example after Actions was switched on
// after the push, since enabling Actions does not replay earlier workflow runs.
const force = process.argv.includes('--force')

function optionValue(flag, envName, fallback) {
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) return resolve(inline.slice(flag.length + 1))

  const index = process.argv.indexOf(flag)
  if (index !== -1) {
    const value = process.argv[index + 1]
    if (!value || value.startsWith('--')) {
      console.error(`${flag} requires a directory`)
      process.exit(1)
    }
    return resolve(value)
  }

  if (process.env[envName]) return resolve(process.env[envName])
  return resolve(fallback)
}

const TARGETS = [
  {
    name: 'root site',
    repo: 'Selim419/Selim419.github.io',
    dir: optionValue('--root-dir', 'PAGES_ROOT_DIR', 'C:/Users/selim/selim419-github-io-deploy'),
  },
  {
    name: 'subpath site',
    repo: 'Selim419/subnautica-derinlik-gunlugu',
    dir: optionValue(
      '--subpath-dir',
      'PAGES_SUBPATH_DIR',
      'C:/Users/selim/subnautica-pages-deploy'
    ),
  },
]

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}\n${result.stderr || result.stdout}`)
  }
  return (result.stdout || '').trim()
}

// Non-throwing probe, used where the failure is expected and wants its own
// message rather than a stack trace.
function gitStatus(cwd, ...args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' })
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// `git@github.com:Owner/Repo.git`, `https://github.com/Owner/Repo.git` and
// `ssh://git@github.com/Owner/Repo.git` all name the same repository.
function normalizeOrigin(url) {
  return url
    .trim()
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, '')
    .replace(/^ssh:\/\/git@github\.com\//, '')
    .replace(/^https?:\/\/(?:git@)?github\.com\//, '')
}

const sha = git(SOURCE, 'rev-parse', 'HEAD')
const short = sha.slice(0, 7)
console.log(`source commit ${short}\n`)

const sourceStatus = git(SOURCE, 'status', '--porcelain')
if (sourceStatus) {
  console.error('Source repo has uncommitted changes. Commit or stash them first:')
  console.error(sourceStatus)
  process.exit(1)
}
console.log('ok    source working tree is clean')

// Every precondition for all three repositories is checked before the first
// mutation. A dirty or misidentified Pages repo must abort the release before
// the source is on the remote, or the three repos are left inconsistent: source
// advanced, pins not moved.
for (const { name, repo, dir } of TARGETS) {
  if (!existsSync(dir)) {
    console.error(`${name} repo not found at ${dir}`)
    console.error('Pass --root-dir / --subpath-dir, or set PAGES_ROOT_DIR / PAGES_SUBPATH_DIR.')
    process.exit(1)
  }

  const inside = gitStatus(dir, 'rev-parse', '--is-inside-work-tree')
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
    console.error(`${name} path ${dir} is not a git repository`)
    process.exit(1)
  }

  const origin = normalizeOrigin(git(dir, 'remote', 'get-url', 'origin'))
  if (origin !== repo) {
    console.error(`${name} origin is ${origin}, expected ${repo}`)
    console.error(`Refusing to pin ${dir} - it would push a pin that deploys nothing.`)
    process.exit(1)
  }

  const branch = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')
  if (branch !== 'main') {
    console.error(`${name} is on branch ${branch}, expected main`)
    process.exit(1)
  }

  // A dirty Pages repo is a stop, not a warning. A workflow edit left uncommitted
  // here publishes silently: the pin moves, the deploy runs, and the workflow on
  // the remote is still the old one. That happened once and cost a long debugging
  // detour, so it fails loudly now.
  const dirty = git(dir, 'status', '--porcelain')
  if (dirty) {
    console.error(`${name} repo has uncommitted changes. Commit or discard them first:`)
    console.error(dirty)
    process.exit(1)
  }

  console.log(`ok    ${name} repo: ${repo} on main, clean`)
}

// Polls the public GitHub API for the `CI` run at `sha` and resolves true only
// when that run has completed with `success`. A run that has not appeared yet, or
// is still queued or in progress, keeps waiting. A completed run with any other
// conclusion, a run that never appears, and a poll that times out all resolve
// false - the caller then stops without pinning. Unknown is never green.
async function waitForGreenCi(commitSha) {
  const url = `https://api.github.com/repos/${SOURCE_REPO}/actions/runs?head_sha=${commitSha}`
  const startedAt = Date.now()
  const deadline = startedAt + CI_TIMEOUT_MS
  const elapsed = () => `${Math.round((Date.now() - startedAt) / 1000)}s`
  let polls = 0

  for (;;) {
    polls += 1
    const res = await fetch(url, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'subnautica-release',
        'x-github-api-version': '2022-11-28',
      },
    })

    const rateLimited =
      (res.status === 403 || res.status === 429) &&
      (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429)

    if (rateLimited) {
      const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000
      const waitMs = Math.max(30_000, reset - Date.now() + 5_000)
      console.log(
        `      unauthenticated API rate limit reached (60/hour per IP); waiting ${Math.round(waitMs / 1000)}s`
      )
      if (Date.now() + waitMs > deadline) {
        console.error(`FAIL  rate limited for longer than the ${CI_TIMEOUT_MS / 1000}s budget; not pinning`)
        return false
      }
      await sleep(waitMs)
      continue
    }

    if (res.ok) {
      const body = await res.json()
      const run = (body.workflow_runs || []).find((candidate) => candidate.name === CI_WORKFLOW)

      if (!run) {
        console.log(`      no '${CI_WORKFLOW}' run for ${short} yet (${polls} polls, ${elapsed()})`)
      } else if (run.status !== 'completed') {
        console.log(`      CI run ${run.id} is ${run.status} (${polls} polls, ${elapsed()})`)
      } else if (run.conclusion === 'success') {
        console.log(`ok    source CI green: run ${run.id}, ${elapsed()} elapsed, ${polls} polls`)
        return true
      } else {
        console.error(`FAIL  source CI run ${run.id} concluded '${run.conclusion}' after ${elapsed()}`)
        return false
      }
    } else {
      console.log(`      API returned ${res.status}; retrying (${polls} polls, ${elapsed()})`)
    }

    if (Date.now() + CI_POLL_MS >= deadline) {
      console.error(
        `FAIL  no green CI for ${short} within ${CI_TIMEOUT_MS / 1000}s (${polls} polls, ${elapsed()}). Not pinning - an unknown CI state is not a pass.`
      )
      return false
    }
    await sleep(CI_POLL_MS)
  }
}

if (dryRun) {
  console.log('\n--dry-run: nothing was pushed, no CI poll was made, no pin was written.')
} else {
  git(SOURCE, 'push', 'origin', 'main')
  console.log('ok    pushed source to origin/main')

  // The gate. Everything below this line mutates the two Pages repos, so a red
  // or unknown CI state stops here with both pins untouched.
  if (!(await waitForGreenCi(sha))) {
    console.error(`\nNot pinning. Source ${short} has no green CI run.`)
    process.exit(1)
  }
}

for (const { name, dir } of TARGETS) {
  console.log('')

  let current = null
  try {
    current = readFileSync(resolve(dir, PIN), 'utf8').trim()
  } catch {
    current = null
  }

  if (current === sha && !force) {
    console.log(`ok    ${name}: already pinned to ${short}`)
    continue
  }

  if (dryRun) {
    console.log(`--dry-run  ${name}: would pin to ${short}`)
    continue
  }

  writeFileSync(resolve(dir, PIN), `${sha}\n`, 'utf8')
  git(dir, 'add', PIN)
  // --allow-empty is required, not a convenience. With --force and the pin
  // already correct the file content does not change, `git add` stages nothing,
  // and a plain `git commit` exits 1 ("nothing to commit") - killing the script
  // in exactly the case --force exists to serve. The commit is also the deploy
  // trigger, so skipping it when the index is clean would mean no push and no
  // redeploy at all.
  git(dir, 'commit', '--allow-empty', '-m', `Pin deploy to ${short}`)
  git(dir, 'push', 'origin', 'main')
  console.log(`ok    ${name}: pinned and pushed  ${short}`)
}

console.log('')
if (dryRun) {
  console.log('Dry run complete.')
} else {
  console.log('Pinned both sites. Watch the deploys:')
  console.log('  https://github.com/Selim419/Selim419.github.io/actions')
  console.log('  https://github.com/Selim419/subnautica-derinlik-gunlugu/actions')
}
