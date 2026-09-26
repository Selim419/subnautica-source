const RAYS = {
  uniforms: {
    uTime: { value: 0 },
    uRays: { value: 0.9 },
    uLightColor: { value: '#ffffff' },
    uWater: { value: '#4fc3d9' },
    uFog: { value: 0.014 },
    uLight: { value: 1.4 },
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
    uniform float uTime, uRays;
    uniform vec3 uLightColor, uWater;
    varying vec2 vUv;
    void main() {
      float tilt = (vUv.x - 0.5) * 0.9;
      float band = sin((vUv.x + tilt) * 26.0 + uTime * 0.25) * 0.5 + 0.5;
      band = pow(band, 3.0);
      float falloff = 1.0 - smoothstep(0.0, 1.0, vUv.y);
      float a = band * falloff * uRays * 0.5;
      vec3 col = mix(uLightColor, uWater, vUv.y * 0.6);
      gl_FragColor = vec4(col, a);
    }`,
}
export default RAYS
