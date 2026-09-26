const PARTICULATE = {
  uniforms: {
    uTime: { value: 0 },
    uParticles: { value: 1 },
    uBiolum: { value: 0 },
    uAccent: { value: '#7fe7ff' },
    uWater: { value: '#4fc3d9' },
  },
  vertexShader: `
    attribute float aSize;
    uniform float uTime;
    varying float vFade;
    void main() {
      vec3 p = position;
      p.y += sin(uTime * 0.34 + p.x * 0.7) * 0.12;
      p.x += cos(uTime * 0.20 + p.y) * 0.08;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * (18.0 / -mv.z);
      vFade = clamp((p.z + 6.0) / 12.0, 0.35, 1.0);
    }`,
  fragmentShader: `
    uniform float uBiolum;
    uniform vec3 uAccent;
    varying float vFade;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float a = smoothstep(0.5, 0.05, d) * 0.52 * vFade;
      vec3 col = mix(vec3(0.35, 0.93, 0.92), uAccent, uBiolum);
      gl_FragColor = vec4(col, a * (0.55 + 0.45 * uBiolum));
    }`,
}
export default PARTICULATE
