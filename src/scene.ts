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
/** Keep in sync with clip length in `main.ts`. */
const CLIP_DURATION_SEC = 4;

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

  const AXIS_COLOR = 0xf3f0e8;
  const timeAxisGroup = new THREE.Group();
  scene.add(timeAxisGroup);
  const axisParts: THREE.Object3D[] = [];

  let gap = 0.42;
  let frameIndex = 0;
  let fromFar = true;
  const dummy = new THREE.Object3D();

  function frameX(index: number, spread: number) {
    const t = index / (frames - 1);
    return (0.5 - t) * spread;
  }

  function timeToX(seconds: number, spread: number) {
    const t = CLIP_DURATION_SEC > 0 ? seconds / CLIP_DURATION_SEC : 0;
    return (0.5 - t) * spread;
  }

  /** Front-left of the stack (toward the default camera) so the rail reads clearly. */
  function axisPlacement() {
    return {
      y: -imageSize.y * 0.34,
      z: -(imageSize.x * 0.5 + 0.14),
    };
  }

  function clearAxisParts() {
    for (const part of axisParts) {
      timeAxisGroup.remove(part);
      if (part instanceof THREE.Sprite) {
        const mat = part.material;
        mat.map?.dispose();
        mat.dispose();
      } else if (part instanceof THREE.Mesh || part instanceof THREE.Line || part instanceof THREE.LineSegments) {
        part.geometry.dispose();
        const mat = part.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }
    axisParts.length = 0;
  }

  function addAxisLine(points: THREE.Vector3[], opacity: number) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: AXIS_COLOR, transparent: true, opacity }),
    );
    timeAxisGroup.add(line);
    axisParts.push(line);
  }

  function addRulerTick(x: number, y: number, z: number, height: number, opacity: number) {
    addAxisLine([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + height, z)], opacity);
  }

  function addRulerLabel(text: string, x: number, y: number, z: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 28px ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = '#f3f0e8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const map = new THREE.CanvasTexture(canvas);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map, transparent: true, depthTest: true, toneMapped: false }),
    );
    sprite.center.set(0.5, 1);
    sprite.position.set(x, y, z);
    sprite.scale.set(0.11, 0.055, 1);
    timeAxisGroup.add(sprite);
    axisParts.push(sprite);
  }

  function layoutTimeAxis(spread: number) {
    clearAxisParts();
    const { y, z } = axisPlacement();
    const xStart = timeToX(0, spread);
    const xEnd = timeToX(CLIP_DURATION_SEC, spread);

    addAxisLine([new THREE.Vector3(xStart, y, z), new THREE.Vector3(xEnd, y, z)], 0.9);

    const minorStep = 0.1;
    const steps = Math.round(CLIP_DURATION_SEC / minorStep);
    for (let i = 0; i <= steps; i++) {
      const sec = i * minorStep;
      const x = timeToX(sec, spread);
      const wholeSecond = i % 10 === 0;
      const halfSecond = i % 5 === 0 && !wholeSecond;
      if (wholeSecond) {
        addRulerTick(x, y, z, 0.045, 0.9);
      } else if (halfSecond) {
        addRulerTick(x, y, z, 0.03, 0.55);
      } else {
        addRulerTick(x, y, z, 0.016, 0.32);
      }
    }

    for (let sec = 0; sec <= CLIP_DURATION_SEC; sec++) {
      const x = timeToX(sec, spread);
      addRulerLabel(String(sec), x, y - 0.018, z);
    }
  }

  function layoutHighlight(spread: number) {
    highlight.position.set(frameX(frameIndex, spread), 0, 0);
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
    layoutTimeAxis(spread);
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
