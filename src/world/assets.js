import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const names = ['library', 'pagoda', 'pavilion', 'ferry', 'gate', 'crane-flight', 'crane-standing'];

export function disposeRealmAssets({ assets, materials }) {
  const geometries = new Set();
  const textures = new Set();
  assets.forEach(root => root.traverse(obj => { if (obj.geometry) geometries.add(obj.geometry); }));
  materials.forEach(material => {
    Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    material.dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
}

function disposeModel(root) {
  const materials = new Map();
  root.traverse(obj => {
    for (const material of [obj.material].flat().filter(Boolean)) materials.set(material.uuid, material);
  });
  disposeRealmAssets({ assets: new Map([['model', root]]), materials });
}

export async function loadRealmAssets({ signal, onProgress = () => {} } = {}) {
  signal?.throwIfAborted();
  const draco = new DRACOLoader().setDecoderPath('/models/draco/').setDecoderConfig({ type: 'wasm' }).setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const assets = new Map();
  const materials = new Map();
  let completed = 0, failed = 0;
  onProgress({ stage: 'models', completed, total: names.length, failed });
  try {
    const results = await Promise.allSettled(names.map(async name => {
      try {
        // Fetch is abortable; decoder work may finish later, but cannot re-enter the scene.
        const response = await fetch(`/models/realm/${name}.glb`, { signal });
        if (!response.ok) throw new Error(`Model request failed: ${response.status}`);
        const buffer = await response.arrayBuffer();
        signal?.throwIfAborted();
        const model = await loader.parseAsync(buffer, '/models/realm/');
        if (signal?.aborted) { disposeModel(model.scene); signal.throwIfAborted(); }
        return model;
      } catch (error) { failed++; throw error; }
      finally {
        completed++;
        if (!signal?.aborted) onProgress({ stage: 'models', completed, total: names.length, failed });
      }
    }));
    if (signal?.aborted) {
      results.forEach(result => { if (result.status === 'fulfilled') disposeModel(result.value.scene); });
      signal.throwIfAborted();
    }
    results.forEach((result, index) => {
      if (result.status !== 'fulfilled') {
        console.warn(`Could not load realm model: ${names[index]}`, result.reason);
        return;
      }
      const root = result.value.scene;
      root.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = obj.receiveShadow = true;
        const material = obj.material;
        if (materials.has(material.name)) {
          const shared = materials.get(material.name);
          if (shared !== material) material.dispose();
          obj.material = shared;
        } else materials.set(material.name, material);
      });
      assets.set(names[index], root);
    });
  } finally {
    draco.dispose();
  }
  return { assets, materials };
}
