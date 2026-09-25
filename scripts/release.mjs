#!/usr/bin/env node
// Publishes the current source commit to both GitHub Pages sites.
//
// The two Pages repositories hold no build output. Each carries a `.deploy-source`
// file naming the exact source commit it should publish, and each has a workflow
// that checks out that commit, builds it with its own base, and deploys it. This
// script pushes the source, then records the resulting SHA in both Pages repos.
//
// Usage:
//   node scripts/release.mjs            push and publish
//   node scripts/release.mjs --dry-run  print what would happen, change nothing

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PIN = '.deploy-source'

const TARGETS = [
  { name: 'root site', dir: 'C:/Users/selim/selim419-github-io-deploy' },
  { name: 'subpath site', dir: 'C:/Users/selim/subnautica-pages-deploy' },
]

const dryRun = process.argv.includes('--dry-run')

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}\n${result.stderr || result.stdout}`)
  }
  return (result.stdout || '').trim()
}

function check(name, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

const sha = git(SOURCE, 'rev-parse', 'HEAD')
const short = sha.slice(0, 7)
console.log(`source commit ${short}\n`)

const status = git(SOURCE, 'status', '--porcelain')
if (status) {
  console.error('Source repo has uncommitted changes. Commit or stash them first:')
  console.error(status)
  process.exit(1)
}
check('source working tree is clean', true)

if (dryRun) {
  console.log('\n--dry-run: nothing was pushed.')
} else {
  git(SOURCE, 'push', 'origin', 'main')
  check('pushed source to origin/main', true)
}

for (const target of TARGETS) {
  console.log('')
  const { name, dir } = target
  let current = null
  try {
    current = readFileSync(resolve(dir, PIN), 'utf8').trim()
  } catch {
    current = null
  }

  if (current === sha) {
    check(`${name}: already pinned to ${short}`, true)
    continue
  }

  if (dryRun) {
    console.log(`--dry-run  ${name}: would pin to ${short}`)
    continue
  }

  writeFileSync(resolve(dir, PIN), `${sha}\n`, 'utf8')
  git(dir, 'add', PIN)
  git(dir, 'commit', '-m', `Pin deploy to ${short}`)
  git(dir, 'push', 'origin', 'main')
  check(`${name}: pinned and pushed`, true, short)
}

console.log('')
if (dryRun) {
  console.log('Dry run complete.')
} else {
  console.log('Pinned both sites. Watch the deploys:')
  console.log('  https://github.com/Selim419/Selim419.github.io/actions')
  console.log('  https://github.com/Selim419/subnautica-derinlik-gunlugu/actions')
}
