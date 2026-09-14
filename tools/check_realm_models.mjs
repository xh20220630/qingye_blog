import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createCranes } from '../src/world/cranes.js';
import { locations } from '../src/world/locations.ts';

const directory = new URL('../public/models/realm/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
const documents = new Map();
let bytes = 0;
for (const [name, entry] of Object.entries(manifest)) {
  const buffer = readFileSync(new URL(entry.file, directory));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${name}: GLB header`);
  assert.equal(buffer.readUInt32LE(4), 2, `${name}: glTF version`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${name}: complete binary`);
  assert.equal(buffer.length, entry.bytes, `${name}: manifest size`);
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  assert(json.extensionsRequired.includes('KHR_draco_mesh_compression'));
  assert(!json.images?.length && !json.buffers.some(b => b.uri), `${name}: self-contained asset`);
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    assert(primitive.extensions.KHR_draco_mesh_compression);
    const position = json.accessors[primitive.attributes.POSITION];
    assert(position.count > 0 && position.min.every(Number.isFinite) && position.max.every(Number.isFinite));
    assert.equal(json.accessors[primitive.attributes.NORMAL].count, position.count);
    assert.equal(json.accessors[primitive.attributes.TEXCOORD_0].count, position.count);
  }
  documents.set(name, json);
  bytes += buffer.length;
}

function hierarchy(json) {
  const objects = json.nodes.map(node => {
    const object = new THREE.Group();
    object.name = node.name;
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    return object;
  });
  json.nodes.forEach((node, index) => node.children?.forEach(child => objects[index].add(objects[child])));
  const root = new THREE.Group();
  json.scenes[json.scene].nodes.forEach(index => root.add(objects[index]));
  return root;
}

const flight = hierarchy(documents.get('crane-flight'));
for (const side of ['L', 'R']) {
  assert.equal(flight.getObjectByName(`Wrist_${side}`).parent, flight.getObjectByName(`Shoulder_${side}`));
}
const scene = new THREE.Scene();
const islands = locations.map(place => {
  const root = new THREE.Group();
  root.position.fromArray(place.position);
  scene.add(root);
  return { root, place };
});
const island = islands.find(i => i.place.id === 'ferry').root;
const cranes = createCranes(scene, new Map([
  ['crane-flight', flight], ['crane-standing', hierarchy(documents.get('crane-standing'))],
]), islands);
const sample = () => {
  const result = [];
  scene.traverse(obj => result.push(...obj.position, ...obj.quaternion));
  assert(result.every(Number.isFinite), 'Finite transforms throughout long flight and glide cycles');
  return result;
};
cranes.update(0);
const before = sample();
for (const t of [1, 5, 27, 100, 1000, 10000]) { cranes.update(t); sample(); }
assert.notDeepEqual(sample(), before, 'Flock moves over time');
cranes.update(5);
const paused = sample();
cranes.update(5);
assert.deepEqual(sample(), paused, 'Repeated time keeps reduced-motion poses still');
assert.equal(island.children.length, 2, 'Two resting cranes at the ferry');
for (const bird of island.children) {
  const plank = Math.round((bird.position.z - 4) / .46);
  const deck = 1.57 + Math.sin(plank / 18 * Math.PI) * .65;
  assert(Math.abs(bird.position.y + .065 * bird.scale.y - deck) < .01, 'Toes meet the bridge deck');
}
const flock = scene.children.filter(obj => obj.name.startsWith('CloudCrane_'));
const roofHeights = { library: 19.2, pagoda: 27.4, pavilion: 8.8, bridge: 8.8, gate: 13.4, orrery: 14 };
for (let t = 0; t < 220; t += .5) {
  cranes.update(t);
  for (const bird of flock) for (const { place } of islands) {
    if (Math.hypot(bird.position.x - place.position[0], bird.position.z - place.position[2]) < place.radius) {
      assert(bird.position.y > place.position[1] + roofHeights[place.kind] + 1.5, `${bird.name}: wings clear ${place.id}`);
    }
  }
}
cranes.update(20);
const directions = flock.map(bird => ({ before: bird.position.clone(), forward: new THREE.Vector3(0, 0, -1).applyQuaternion(bird.quaternion) }));
cranes.update(20.05);
flock.forEach((bird, i) => assert(bird.position.clone().sub(directions[i].before).normalize().dot(directions[i].forward) > .98, 'Crane faces the flight direction'));
for (const file of ['draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  assert.deepEqual(readFileSync(new URL(`../public/models/draco/${file}`, import.meta.url)), readFileSync(new URL(`../node_modules/three/examples/jsm/libs/draco/gltf/${file}`, import.meta.url)), 'Decoder matches the installed Three.js distribution');
}
console.log(JSON.stringify({ assets: documents.size, megabytes: +(bytes / 1e6).toFixed(2), flightNodes: flock.length, restingCranes: 2, source: fileURLToPath(directory), checks: 'GLB contracts, joint hierarchy, flight direction, roof clearance, resting contact, reduced motion, decoder integrity passed' }, null, 2));
