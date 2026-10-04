import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Volume } from './volume';
import { createVolumeTexture } from './volume';

export type SceneHandle = {
  frameCount: number;
  setFrame: (index: number) => void;
  setGap: (amount: number) => void;
  resetView: () => void;
  resize: () => void;
};

const GHOST_SIDE = 0.52;
const GHOST_SIDE_FRONT = 0.16;
const GHOST_BACK = 0.2;
const GHOST_INNER_FRONT = 0.045;
const GHOST_INNER_FRONT_NEAR = 0.085;
const GHOST_INNER_REAR = 0.22;
const GHOST_INNER_REAR_DEEP = 0.38;
const CURRENT = 0.94;
const SPREAD = 3.25;
const DEPTH_FAN = 0.14;
const PLANE_SHRINK = 0.1;

export function createScene(container: HTMLElement, volume: Volume): SceneHandle {
  const { frames } = volume;
  const texture = createVolumeTexture(volume);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  const aspect = volume.width / volume.height;
  const imageSize = new THREE.Vector2(aspect * 0.98, 0.98);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    'role',
    'application',
  );
  canvas.setAttribute(
    'aria-label',
    'Spacetime cube of the clip. Drag to rotate, scroll to zoom.',
  );
  canvas.setAttribute('aria-describedby', 'panel-help');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 20);
  const initialPosition = new THREE.Vector3(0.95, 2.55, -2.35);
  const initialTarget = new THREE.Vector3(0, 0, 0);
  camera.position.copy(initialPosition);
  camera.lookAt(initialTarget);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(initialTarget);
  controls.enablePan = false;
  controls.minDistance = 0.7;
  controls.maxDistance = 8;

  let orbiting = false;
  canvas.addEventListener('pointerdown', () => {
    orbiting = true;
    container.classList.add('view-is-dragging');
  });
  const endDrag = () => {
    if (!orbiting) return;
    orbiting = false;
    container.classList.remove('view-is-dragging');
    container.classList.add('view-orbit-used');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointerup', endDrag);

  const uniforms = {
    uVolume: { value: texture },
    uFrames: { value: frames },
    uFrame: { value: 0 },
    uGhostSide: { value: GHOST_SIDE },
    uGhostSideFront: { value: GHOST_SIDE_FRONT },
    uGhostBack: { value: GHOST_BACK },
  };

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: CUBE_VERT,
      fragmentShader: CUBE_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  scene.add(cube);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0xf3f0e8, transparent: true, opacity: 0.22 }),
  );
  scene.add(edges);

  const innerUniforms = {
    uVolume: { value: texture },
    uFrames: { value: frames },
    uFrame: { value: 0 },
    uAlphaFront: { value: GHOST_INNER_FRONT },
    uAlphaFrontNear: { value: GHOST_INNER_FRONT_NEAR },
    uAlphaRear: { value: GHOST_INNER_REAR },
    uAlphaRearDeep: { value: GHOST_INNER_REAR_DEEP },
  };
  const planeGeo = new THREE.PlaneGeometry(imageSize.x * 0.98, imageSize.y * 0.98);
  const frameAttr = new THREE.InstancedBufferAttribute(new Float32Array(frames), 1);
  planeGeo.setAttribute('aFrame', frameAttr);
  const inner = new THREE.InstancedMesh(
    planeGeo,
    new THREE.ShaderMaterial({
      uniforms: innerUniforms,
      vertexShader: INNER_VERT,
      fragmentShader: INNER_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    frames,
  );
  scene.add(inner);

  const highlightUniforms = {
    uVolume: { value: texture },
    uFrames: { value: frames },
    uFrame: { value: 0 },
  };
  const highlight = new THREE.Mesh(
    new THREE.PlaneGeometry(imageSize.x * 0.98, imageSize.y * 0.98),
    new THREE.ShaderMaterial({
      uniforms: highlightUniforms,
      vertexShader: HIGHLIGHT_VERT,
      fragmentShader: HIGHLIGHT_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  highlight.rotation.y = Math.PI / 2;
  highlight.renderOrder = 2;
  scene.add(highlight);

  let gap = 0.42;
  let frameIndex = 0;
  let fromFar = true;
  const dummy = new THREE.Object3D();

  function layoutHighlight(spread: number) {
    const x = (0.5 - frameIndex / (frames - 1)) * spread;
    highlight.position.set(x, 0, 0);
  }

  function layoutInner(spread: number) {
    fromFar = camera.position.x >= 0;
    const shrink = 1 - gap * PLANE_SHRINK;
    for (let i = 0; i < frames; i++) {
      const frame = fromFar ? frames - 1 - i : i;
      const t = frame / (frames - 1);
      const x = (0.5 - t) * spread;
      const z = (t - 0.5) * spread * DEPTH_FAN;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.set(shrink, shrink, 1);
      dummy.updateMatrix();
      inner.setMatrixAt(i, dummy.matrix);
      frameAttr.setX(i, frame);
    }
    dummy.scale.set(1, 1, 1);
    inner.instanceMatrix.needsUpdate = true;
    frameAttr.needsUpdate = true;
  }

  function applyGap() {
    const spread = 0.02 + gap * SPREAD;
    cube.scale.set(spread, imageSize.y, imageSize.x);
    edges.scale.set(spread, imageSize.y, imageSize.x);
    layoutInner(spread);
    layoutHighlight(spread);
  }

  applyGap();

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
    if ((camera.position.x >= 0) !== fromFar) layoutInner(0.02 + gap * SPREAD);
    renderer.render(scene, camera);
  });

  return {
    frameCount: frames,
    setFrame(index) {
      frameIndex = Math.max(0, Math.min(frames - 1, Math.round(index)));
      uniforms.uFrame.value = frameIndex;
      highlightUniforms.uFrame.value = frameIndex;
      innerUniforms.uFrame.value = frameIndex;
      layoutHighlight(0.02 + gap * SPREAD);
    },
    setGap(amount) {
      gap = THREE.MathUtils.clamp(amount, 0, 1);
      applyGap();
    },
    resetView() {
      camera.position.copy(initialPosition);
      controls.target.copy(initialTarget);
      controls.update();
    },
    resize,
  };
}

const CUBE_VERT = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vLocal = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CUBE_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  varying vec3 vLocal;
  varying vec3 vNormal;
  uniform sampler3D uVolume;
  uniform float uFrames;
  uniform float uFrame;
  uniform float uGhostSide;
  uniform float uGhostSideFront;
  uniform float uGhostBack;

  vec3 sampleFrame(float u, float v, float frame) {
    float z = (frame + 0.5) / uFrames;
    return texture(uVolume, vec3(u, v, z)).rgb;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 an = abs(n);
    float uImg = 1.0 - (vLocal.z + 0.5);
    float vImg = 1.0 - (vLocal.y + 0.5);
    float t = clamp(1.0 - (vLocal.x + 0.5), 0.0, 1.0);
    float frameT = t * (uFrames - 1.0);

    vec3 color;
    float alpha;

    if (an.x > an.y && an.x > an.z) {
      // Near cap is open so the travelling frame reads clearly; far cap closes the block.
      if (n.x > 0.0) discard;
      color = sampleFrame(uImg, vImg, uFrames - 1.0);
      alpha = uGhostBack;
    } else if (an.z > an.y) {
      float uEdge = n.z > 0.0 ? 0.0 : 1.0;
      color = sampleFrame(uEdge, vImg, frameT);
      alpha = frameT < uFrame - 0.5 ? uGhostSideFront : uGhostSide;
      if (frameT < uFrame - 0.5) color *= 1.12;
    } else {
      float vEdge = n.y > 0.0 ? 0.0 : 1.0;
      color = sampleFrame(uImg, vEdge, frameT);
      alpha = frameT < uFrame - 0.5 ? uGhostSideFront : uGhostSide;
      if (frameT < uFrame - 0.5) color *= 1.12;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

const INNER_VERT = /* glsl */ `
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

const INNER_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  varying vec2 vUv;
  varying float vFrame;
  uniform sampler3D uVolume;
  uniform float uFrames;
  uniform float uFrame;
  uniform float uAlphaFront;
  uniform float uAlphaFrontNear;
  uniform float uAlphaRear;
  uniform float uAlphaRearDeep;
  void main() {
    if (abs(vFrame - uFrame) < 0.5) discard;
    float z = (vFrame + 0.5) / uFrames;
    vec3 color = texture(uVolume, vec3(1.0 - vUv.x, 1.0 - vUv.y, z)).rgb;
    float alpha;
    if (vFrame < uFrame - 0.5) {
      float span = max(uFrame, 1.0);
      float ahead = clamp((uFrame - vFrame) / span, 0.0, 1.0);
      alpha = mix(uAlphaFrontNear, uAlphaFront, ahead);
      color *= mix(1.18, 1.08, ahead);
    } else {
      float span = max(uFrames - uFrame - 1.0, 1.0);
      float behind = clamp((vFrame - uFrame) / span, 0.0, 1.0);
      alpha = mix(uAlphaRear, uAlphaRearDeep, behind);
    }
    gl_FragColor = vec4(color, alpha);
  }
`;

const HIGHLIGHT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HIGHLIGHT_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  varying vec2 vUv;
  uniform sampler3D uVolume;
  uniform float uFrames;
  uniform float uFrame;
  void main() {
    float z = (uFrame + 0.5) / uFrames;
    vec3 color = texture(uVolume, vec3(1.0 - vUv.x, 1.0 - vUv.y, z)).rgb;
    gl_FragColor = vec4(color, ${CURRENT});
  }
`;
