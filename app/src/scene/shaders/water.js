const WATER = {
  uniforms: {
    uTime: { value: 0 },
    uWater: { value: '#4fc3d9' },
    uFog: { value: 0.014 },
    uLight: { value: 1.4 },
    uLightColor: { value: '#ffffff' },
    uRays: { value: 0.9 },
    uParticles: { value: 1 },
    uBiolum: { value: 0 },
    uAccent: { value: '#7fe7ff' },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform float uTime, uFog, uLight, uBiolum;
    uniform vec3 uWater, uLightColor, uAccent;
    varying vec2 vUv;
    void main() {
      float depth = 1.0 - vUv.y;
      vec3 col = uWater * mix(0.34, 0.22, depth);
      float c1 = sin(vUv.x * 34.0 + uTime * 0.5) * sin(vUv.y * 27.0 - uTime * 0.42);
      float c2 = sin(vUv.x * 61.0 - uTime * 0.31) * sin(vUv.y * 47.0 + uTime * 0.27);
      float caustic = pow(max(c1 * c2, 0.0), 3.0) * uLight * (1.0 - depth) * 0.3;
      col += uLightColor * caustic;
      col += uAccent * uBiolum * pow(max(sin(vUv.x * 18.0 + uTime * 0.6)
             * sin(vUv.y * 14.0 - uTime * 0.5), 0.0), 6.0) * 0.5;
      col = mix(col, uWater * 0.4, clamp(uFog * 12.0 * depth, 0.0, 0.85));
      // Screen-space readability ceiling: the reading line always sits over this
      // material, so its brightest pixel (the sunlit near-surface band, before
      // any DOM scrim) is capped low enough to hold body text at >=4.5:1 against
      // --ink, per spec 6.4/7's measured-not-eyeballed contrast gate.
      col = min(col, vec3(0.22));
      gl_FragColor = vec4(col, 1.0);
    }`,
}
export default WATER
