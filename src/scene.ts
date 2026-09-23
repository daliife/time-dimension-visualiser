import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Volume } from './volume';
import { createVolumeTexture } from './volume';

export type SceneHandle = {
  frameCount: number;
  setFrame: (index: number) => void;
  setGap: (amount: number) => void;
  resize: () => void;
};

const GHOST_ALPHA = 0.02;
const CURRENT_ALPHA = 0.55;

export function createScene(container: HTMLElement, volume: Volume): SceneHandle {
  const { frames } = volume;
  const texture = createVolumeTexture(volume);
  const aspect = volume.width / volume.height;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 20);
  // Face the stack from +X/−Z so the frame is on the left and time recedes to the right.
  camera.position.set(2.4, 0.99, -2.7);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 0.7;
  controls.maxDistance = 8;

  const uniforms = {
    uVolume: { value: texture },
    uGhost: { value: GHOST_ALPHA },
    uCurrent: { value: CURRENT_ALPHA },
    uFrames: { value: frames },
    uFrame: { value: 0 },
  };

  const geometry = new THREE.PlaneGeometry(aspect * 0.98, 0.98);
  const frameAttr = new THREE.InstancedBufferAttribute(new Float32Array(frames), 1);
  geometry.setAttribute('aFrame', frameAttr);

  const layers = new THREE.InstancedMesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: LAYER_VERT,
      fragmentShader: LAYER_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    frames,
  );
  layers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(layers);

  let gap = 0.4;
  let fromFar = true;
  const dummy = new THREE.Object3D();

  function layoutLayers() {
    const spread = 0.02 + gap * 2.4;
    fromFar = camera.position.x >= 0;
    for (let i = 0; i < frames; i++) {
      // Draw the far slices first so transparency stacks correctly.
      // Frame 0 stays nearest the default camera (+X).
      const frame = fromFar ? frames - 1 - i : i;
      dummy.position.set((0.5 - frame / (frames - 1)) * spread, 0, 0);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      layers.setMatrixAt(i, dummy.matrix);
      frameAttr.setX(i, frame);
    }
    layers.instanceMatrix.needsUpdate = true;
    frameAttr.needsUpdate = true;
  }

  layoutLayers();

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    if ((camera.position.x >= 0) !== fromFar) layoutLayers();
    renderer.render(scene, camera);
  });

  return {
    frameCount: frames,
    setFrame(index) {
      const frame = Math.max(0, Math.min(frames - 1, Math.round(index)));
      uniforms.uFrame.value = frame;
    },
    setGap(amount) {
      gap = THREE.MathUtils.clamp(amount, 0, 1);
      layoutLayers();
    },
    resize,
  };
}

const LAYER_VERT = /* glsl */ `
  attribute float aFrame;
  varying vec2 vUv;
  varying float vFrame;
  void main() {
    vUv = uv;
    vFrame = aFrame;
    vec4 world = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * world;
  }
`;

const LAYER_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  varying vec2 vUv;
  varying float vFrame;
  uniform sampler3D uVolume;
  uniform float uFrames;
  uniform float uFrame;
  uniform float uGhost;
  uniform float uCurrent;
  void main() {
    float z = (vFrame + 0.5) / uFrames;
    vec3 color = texture(uVolume, vec3(1.0 - vUv.x, 1.0 - vUv.y, z)).rgb;
    float onLayer = 1.0 - step(0.5, abs(vFrame - uFrame));
    float alpha = mix(uGhost, uCurrent, onLayer);
    gl_FragColor = vec4(color, alpha);
  }
`;
