import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export const skies = {
  dawn: { top: '#3c7392', horizon: '#c4dee3', sun: '#ffecd0', cloud: '#c2d8e4', shadow: '#38576f', fog: '#a7c7d6', light: 2.8, ambient: 1.6, exposure: 1.0 },
  sunset: { top: '#4e547b', horizon: '#edbbaa', sun: '#ffd197', cloud: '#ebbbc0', shadow: '#716480', fog: '#baa4b8', light: 3.5, ambient: 1.5, exposure: 1.0 },
  night: { top: '#061424', horizon: '#263d5b', sun: '#c2e8ff', cloud: '#647f9c', shadow: '#15283d', fog: '#1b344d', light: 1.2, ambient: 0.8, exposure: 0.95 },
};

const quadVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const skyVertex = `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = `
  varying vec3 vWorld;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform vec3 uLightDirection;
  uniform float uNight;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float elevation = max(dir.y, 0.0);
    vec3 col = mix(uHorizon, uTop, pow(elevation, 0.48));
    float sunDot = max(dot(dir, uLightDirection), 0.0);
    col += uSun * pow(sunDot, 14.0) * 0.21;
    col += uSun * pow(sunDot, 320.0) * 0.75;
    col += uSun * smoothstep(0.9992, 0.9996, sunDot) * 2.0;
    vec3 moonDirection = normalize(vec3(-0.25, 0.075, -0.96));
    float moonDot = dot(dir, moonDirection);
    float moon = smoothstep(0.994, 0.9943, moonDot);
    float grain = hash(floor(dir * 220.0));
    col = mix(col, mix(uHorizon, vec3(0.84, 0.93, 0.96), 0.50 + uNight * 0.4) * (0.85 + grain * 0.15), moon * (0.55 + 0.4 * uNight));
    col += vec3(0.29, 0.43, 0.53) * pow(max(moonDot, 0.0), 85.0) * uNight * 0.4;
    vec3 starGrid = floor(dir * 700.0);
    float stars = step(0.9982, hash(starGrid)) * pow(hash(starGrid + 7.0), 5.0);
    col += vec3(stars) * uNight * smoothstep(0.04, 0.4, dir.y) * 1.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const cloudFragment = `
  precision highp sampler3D;
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform sampler2D uDepth;
  uniform sampler3D uNoise;
  uniform mat4 uInverseProjection;
  uniform mat4 uCameraWorld;
  uniform vec3 uCamera;
  uniform vec3 uLightDirection;
  uniform vec3 uSunColor;
  uniform vec3 uCloudColor;
  uniform vec3 uShadowColor;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSteps;
  uniform float uLightSteps;
  uniform float uNight;
  uniform float uFar;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float density(vec3 p) {
    float h = (p.y + 32.0) / 48.0;
    if (h < 0.0 || h > 1.0) return 0.0;
    float time = uTime;
    float shear = mix(0.45, 1.3, smoothstep(-26.0, 15.0, p.y));
    vec3 flow = p - vec3(time * 0.82 * shear, 0.0, time * 0.29 * shear);
    flow.x += sin(p.z * 0.033 - time * 0.065) * 2.2;
    flow.z += cos(p.x * 0.025 + time * 0.048) * 1.8;
    flow.y += sin(p.x * 0.028 + p.z * 0.017 - time * 0.11) * 0.75;
    vec3 q = flow * vec3(0.009, 0.014, 0.009);
    float base = texture(uNoise, q).r;
    float detail = texture(uNoise, q * 3.1 + vec3(0.14 - time * 0.009, 0.24 + sin(time * 0.05) * 0.035, 0.37 + time * 0.004)).r;
    float fine = texture(uNoise, q * 8.6 + vec3(time * 0.018, -time * 0.008, time * 0.013)).r;
    float shape = base * 0.75 + detail * 0.25 - (1.0 - fine) * 0.10;
    float threshold = 0.24 + h * h * 0.44;
    float edge = smoothstep(0.0, 0.16, h) * (1.0 - smoothstep(0.85, 1.0, h));
    return max(shape - threshold, 0.0) * 3.6 * edge;
  }
  float sunlight(vec3 p) {
    float opticalDepth = 0.0;
    for (int s = 1; s <= 4; s++) {
      if(float(s) > uLightSteps) break;
      float distanceToSample = float(s * s) * 2.3;
      opticalDepth += density(p + uLightDirection * distanceToSample) * float(s) * 2.1;
    }
    return exp(-opticalDepth * 0.34);
  }
  void main() {
    vec4 farPoint = uInverseProjection * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 ray = normalize((uCameraWorld * vec4(farPoint.xyz / farPoint.w, 0.0)).xyz);
    float depth = texture2D(uDepth, vUv).x;
    vec4 viewPoint = uInverseProjection * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    float opaqueDistance = length(viewPoint.xyz / viewPoint.w);
    float tBottom = (-32.0 - uCamera.y) / ray.y;
    float tTop = (16.0 - uCamera.y) / ray.y;
    float start = max(0.0, min(tBottom, tTop));
    float end = min(min(max(tBottom, tTop), opaqueDistance), uFar);
    vec3 clouds = vec3(0.0);
    float transmittance = 1.0;
    if (end > start) {
      float stepLength = (end - start) / uSteps;
      float t = start + stepLength * hash(gl_FragCoord.xy);
      float cosine = max(dot(ray, uLightDirection), 0.0);
      float forwardScatter = 0.25 + pow(cosine, 8.0) * 1.7;
      for (int i = 0; i < 96; i++) {
        if (float(i) >= uSteps || transmittance < 0.012 || t > end) break;
        vec3 p = uCamera + ray * t;
        float d = density(p);
        if (d > 0.008) {
          float light = sunlight(p);
          float heightLight = smoothstep(-24.0, 13.0, p.y);
          vec3 ambient = mix(uShadowColor, uCloudColor, heightLight * 0.72 + 0.10);
          float powder = 1.0 - exp(-d * 2.0);
          vec3 illumination = ambient * (0.65 + powder * 0.30) + uSunColor * light * (0.48 + forwardScatter) * (1.0 - uNight * 0.4);
          float alpha = 1.0 - exp(-d * stepLength * 0.23);
          clouds += transmittance * alpha * illumination;
          transmittance *= 1.0 - alpha;
        }
        t += stepLength;
      }
    }
    gl_FragColor = vec4(clouds, 1.0 - transmittance);
  }
`;

const compositeFragment = `
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform sampler2D uClouds;
  uniform sampler2D uDepth;
  uniform vec2 uResolution;
  uniform vec2 uCloudResolution;
  void main() {
    float centerDepth = texture2D(uDepth, vUv).r;
    vec2 grid = vUv * uCloudResolution - 0.5;
    vec2 fraction = fract(grid);
    vec2 origin = (floor(grid) + 0.5) / uCloudResolution;
    vec4 cloud = vec4(0.0);
    float total = 0.0;
    for (int y = 0; y < 2; y++) {
      for (int x = 0; x < 2; x++) {
        vec2 offset = vec2(float(x), float(y));
        vec2 uv = origin + offset / uCloudResolution;
        vec2 weights = mix(1.0 - fraction, fraction, offset);
        float edgeWeight = exp(-abs(texture2D(uDepth, uv).r - centerDepth) * 50000.0);
        float weight = weights.x * weights.y * max(edgeWeight, 0.001);
        cloud += texture2D(uClouds, uv) * weight;
        total += weight;
      }
    }
    cloud /= max(total, 0.001);
    float transmittance = 1.0 - cloud.a;
    vec3 color = texture2D(uScene, vUv).rgb * transmittance + cloud.rgb;
    vec3 bloom = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.785398;
      vec2 offset = vec2(cos(angle), sin(angle)) * 4.0 / uResolution;
      bloom += max(texture2D(uScene, vUv + offset).rgb - 1.0, 0.0);
    }
    color += bloom * 0.045 * transmittance;
    float vignette = pow(16.0 * vUv.x * vUv.y * (1.0-vUv.x) * (1.0-vUv.y), 0.13);
    color *= mix(0.83, 1.0, vignette);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeNoiseTexture() {
  const size = 64;
  const data = new Uint8Array(size ** 3);
  const noise = new ImprovedNoise();
  let i = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let value = 0;
        let weight = 0.58;
        for (let octave = 0; octave < 4; octave++) {
          const frequency = 4 * 2 ** octave;
          // Integer-period lattice coordinates make the volume tile without seams.
          const px = x / size * frequency;
          const py = y / size * frequency;
          const pz = z / size * frequency;
          const tx = x / size, ty = y / size, tz = z / size;
          const n00 = THREE.MathUtils.lerp(noise.noise(px, py, pz), noise.noise(px-frequency, py, pz), tx);
          const n10 = THREE.MathUtils.lerp(noise.noise(px, py-frequency, pz), noise.noise(px-frequency, py-frequency, pz), tx);
          const n01 = THREE.MathUtils.lerp(noise.noise(px, py, pz-frequency), noise.noise(px-frequency, py, pz-frequency), tx);
          const n11 = THREE.MathUtils.lerp(noise.noise(px, py-frequency, pz-frequency), noise.noise(px-frequency, py-frequency, pz-frequency), tx);
          value += THREE.MathUtils.lerp(THREE.MathUtils.lerp(n00, n10, ty), THREE.MathUtils.lerp(n01, n11, ty), tz) * weight;
          weight *= 0.5;
        }
        data[i++] = THREE.MathUtils.clamp((value * 1.25 + 0.5) * 255, 0, 255);
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export function createAtmosphere(renderer, scene, camera) {
  const lightDirection = new THREE.Vector3(-0.55, 0.72, -0.38).normalize();
  const skyUniforms = {
    uTop: { value: new THREE.Color(skies.dawn.top) }, uHorizon: { value: new THREE.Color(skies.dawn.horizon) },
    uSun: { value: new THREE.Color(skies.dawn.sun) }, uLightDirection: { value: lightDirection }, uNight: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyUniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false,
  }));
  sky.renderOrder = -10;
  scene.add(sky);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const noise = makeNoiseTexture();
  const uniforms = {
    uScene: { value: target.texture }, uDepth: { value: target.depthTexture }, uNoise: { value: noise },
    uInverseProjection: { value: camera.projectionMatrixInverse }, uCameraWorld: { value: camera.matrixWorld },
    uCamera: { value: camera.position }, uLightDirection: { value: lightDirection },
    uSunColor: { value: new THREE.Color(skies.dawn.sun) }, uCloudColor: { value: new THREE.Color(skies.dawn.cloud) },
    uShadowColor: { value: new THREE.Color(skies.dawn.shadow) }, uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 }, uSteps: { value: 56 }, uLightSteps: {value: 2}, uNight: { value: 0 }, uFar: { value: 620 },
  };
  const composite = new THREE.Scene();
  const cloudTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const cloudScene = new THREE.Scene();
  const cloudQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: quadVertex, fragmentShader: cloudFragment, depthTest: false, depthWrite: false, toneMapped: false }));
  cloudScene.add(cloudQuad);
  const compositeUniforms = {uScene: uniforms.uScene, uDepth: uniforms.uDepth, uClouds: {value: cloudTarget.texture}, uResolution: uniforms.uResolution, uCloudResolution: {value: new THREE.Vector2(1,1)}};
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: compositeUniforms, vertexShader: quadVertex, fragmentShader: compositeFragment, depthTest: false, depthWrite: false }));
  composite.add(quad);
  const screenCamera = new THREE.Camera();
  let lastTime = 0, windSpeed = 1, windTarget = 1;
  return {
    sky,
    setWind(mode) { windTarget = {calm: .45, breeze: 1, strong: 1.8}[mode] ?? 1; },
    setSky(mode) {
      const preset = skies[mode] || skies.dawn;
      skyUniforms.uTop.value.set(preset.top);
      skyUniforms.uHorizon.value.set(preset.horizon);
      skyUniforms.uSun.value.set(preset.sun);
      skyUniforms.uNight.value = uniforms.uNight.value = mode === 'night' ? 1 : 0;
      uniforms.uSunColor.value.set(preset.sun);
      uniforms.uCloudColor.value.set(preset.cloud);
      uniforms.uShadowColor.value.set(preset.shadow);
    },
    resize(width, height, scale, steps, cloudScale, lightSteps) {
      const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
      target.setSize(w, h);
      const cw = Math.max(1,Math.round(w * cloudScale)), ch = Math.max(1,Math.round(h * cloudScale));
      cloudTarget.setSize(cw,ch);
      compositeUniforms.uCloudResolution.value.set(cw,ch);
      uniforms.uResolution.value.set(w, h);
      uniforms.uSteps.value = steps;
      uniforms.uLightSteps.value=lightSteps;
    },
    render(time) {
      // Integrating wind speed keeps existing cloud shapes continuous when the breeze changes.
      const delta = Math.max(0, time - lastTime);
      lastTime = time;
      windSpeed += (windTarget - windSpeed) * (1 - Math.exp(-delta * 1.5));
      uniforms.uTime.value += delta * windSpeed;
      sky.position.copy(camera.position);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(cloudTarget);
      renderer.render(cloudScene, screenCamera);
      renderer.setRenderTarget(null);
      renderer.render(composite, screenCamera);
    },
    dispose() {
      target.dispose(); cloudTarget.dispose(); noise.dispose(); sky.geometry.dispose(); sky.material.dispose(); cloudQuad.geometry.dispose(); cloudQuad.material.dispose(); quad.geometry.dispose(); quad.material.dispose();
    },
  };
}
