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
