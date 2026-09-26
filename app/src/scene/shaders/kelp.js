const KELP = {
  uniforms: {
    uTime: { value: 0 },
    uLight: { value: 1.4 },
    uLightColor: { value: '#ffffff' },
    uWater: { value: '#4fc3d9' },
    uFog: { value: 0.014 },
    uRays: { value: 0.9 },
    uParticles: { value: 1 },
    uBiolum: { value: 0 },
    uAccent: { value: '#7fe7ff' },
  },
  vertexShader: `
    uniform float uTime;
    attribute float aPhase;
    varying float vT;
    void main() {
      vec3 p = position;
      vT = uv.y;
      float sway = sin(uTime * 0.55 + aPhase + uv.y * 2.2) * 0.42 * uv.y;
      p.x += sway;
      p.z += cos(uTime * 0.41 + aPhase) * 0.16 * uv.y;
      #ifdef USE_INSTANCING
      vec4 instancePosition = instanceMatrix * vec4(p, 1.0);
      #else
      vec4 instancePosition = vec4(p, 1.0);
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
    }`,
  fragmentShader: `
    uniform float uLight, uBiolum, uFog;
    uniform vec3 uWater, uAccent, uLightColor;
    varying float vT;
    void main() {
      vec3 base = mix(uWater * 0.25, uWater * 0.7, vT);
      vec3 col = base * (0.35 + 0.65 * uLight * (0.3 + vT));
      col = mix(col, col * 0.4, uFog * 8.0);
      col += uAccent * uBiolum * pow(vT, 5.0) * 0.55;
      // Kelp is opaque and occludes the backdrop now (see buildScene's
      // NormalBlending note), so its own colour is what the reading line
      // sees wherever a stalk overlaps text - it needs the same readability
      // ceiling as the water it stands in front of.
      col = min(col, vec3(0.22));
      gl_FragColor = vec4(col, 1.0);
    }`,
}
export default KELP
