import * as THREE from 'three';

/** RGBA frames packed x, then y, then time. A video loader can fill the same shape. */
export type Volume = {
  width: number;
  height: number;
  frames: number;
  data: Uint8Array;
};

export function createVolumeTexture(volume: Volume): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(
    volume.data,
    volume.width,
    volume.height,
    volume.frames,
  );
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
