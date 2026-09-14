import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const names = ['library', 'pagoda', 'pavilion', 'ferry', 'gate', 'crane-flight', 'crane-standing'];

export async function loadRealmAssets() {
  const draco = new DRACOLoader().setDecoderPath('/models/draco/').setDecoderConfig({ type: 'wasm' }).setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const assets = new Map();
  const materials = new Map();
  try {
    const results = await Promise.allSettled(names.map(name => loader.loadAsync(`/models/realm/${name}.glb`)));
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
