export const REGIMES = [
  { id: 'daylight', from: 0,    to: 80,
    water: '#4fc3d9', fog: 0.014, light: 1.40, lightColor: '#ffffff',
    rays: 0.90, particles: 1.00, biolum: 0.00, accent: '#7fe7ff' },
  { id: 'twilight', from: 80,   to: 200,
    water: '#1f7fa8', fog: 0.030, light: 0.85, lightColor: '#bfe6ff',
    rays: 0.45, particles: 0.90, biolum: 0.06, accent: '#59d7c0' },
  { id: 'midnight', from: 200,  to: 525,
    water: '#0b3350', fog: 0.055, light: 0.45, lightColor: '#7fb4d8',
    rays: 0.18, particles: 0.70, biolum: 0.45, accent: '#57b8ff' },
  { id: 'deep',     from: 525,  to: 1065,
    water: '#05182c', fog: 0.085, light: 0.22, lightColor: '#4a7fa8',
    rays: 0.06, particles: 0.50, biolum: 0.60, accent: '#3f7ad9' },
  { id: 'biolum',   from: 1065, to: Infinity,
    water: '#030a18', fog: 0.120, light: 0.10, lightColor: '#6a4fb0',
    rays: 0.00, particles: 0.35, biolum: 1.00, accent: '#b06cff' },
]

export function regimeAt(metres) {
  if (metres < REGIMES[0].from) return 0
  for (let i = REGIMES.length - 1; i >= 0; i--) {
    if (metres >= REGIMES[i].from) return i
  }
  return 0
}
