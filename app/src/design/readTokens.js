// Reads layer 1 of tokens.css into JS.
//
// Only layer 1. The per-regime overrides in layer 2 are applied by the CSS cascade
// from a [data-regime] attribute, and a canvas cannot read the cascade — the scene
// reads these raw values and interpolates between them itself.
const NAMES = [
  'abyss', 'deep', 'water', 'kelp', 'glow', 'amber', 'coral',
  'ink', 'ink-muted', 'ink-faint', 'surface', 'surface-2',
  'hairline', 'hairline-firm', 'scrim',
  'surface-invert', 'ink-invert', 'accent-invert', 'edge',
]

export function readTokens(root = document.documentElement) {
  const cs = getComputedStyle(root)
  const raw = {}
  for (const name of NAMES) {
    const value = cs.getPropertyValue(`--${name}`).trim()
    if (!value) throw new Error(`token --${name} is missing from :root`)
    raw[name] = value
  }
  return { raw }
}
