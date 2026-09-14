import * as THREE from 'three';

export function createCranes(scene, assets, islands) {
  const flock = [];
  const resting = [];
  const flight = assets.get('crane-flight');
  const standing = assets.get('crane-standing');
  const next = new THREE.Vector3();
  function flightPosition(a, phase, near, target) {
    const rx = near ? 40 : 88, rz = near ? 34 : 67;
    target.set(Math.cos(a) * rx - (near ? 30 : 0), (near ? 25 : 38) + Math.sin(a * 2) * (near ? 1.5 : 4.5) + phase * 1.3, Math.sin(a) * rz + (near ? 43 : 0));
    const base = target.y;
    for (const { place } of islands) {
      if (!place.position) continue;
      const distance = Math.hypot(target.x - place.position[0], target.z - place.position[2]);
      const radius = place.radius + 4;
      const roof = place.kind === 'pagoda' ? 29 : place.kind === 'library' ? 20 : 15;
      const clearance = place.position[1] + roof + 3;
      const lift = 1 - THREE.MathUtils.smoothstep(distance, radius, radius * 1.7);
      target.y = Math.max(target.y, base + Math.max(0, clearance - base) * lift);
    }
    return target;
  }
  if (flight) {
    for (let i = 0; i < 7; i++) {
      const bird = flight.clone(true);
      bird.name = `CloudCrane_${i}`;
      bird.userData.dynamic = true;
      bird.scale.setScalar(i < 2 ? 1.16 : .79 + (i % 3) * .10);
      // Flying silhouettes must not leave stationary shadows in the cached island map.
      bird.traverse(obj => { if (obj.isMesh) obj.castShadow = false; });
      const wings = [-1, 1].map(side => ({
        side,
        shoulder: bird.getObjectByName(`Shoulder_${side < 0 ? 'L' : 'R'}`),
        wrist: bird.getObjectByName(`Wrist_${side < 0 ? 'L' : 'R'}`),
      }));
      scene.add(bird);
      flock.push({ bird, wings, phase: i * .77, near: i < 2 });
    }
  }
  const ferry = islands.find(island => island.place.id === 'ferry');
  if (standing && ferry) {
    for (let i = 0; i < 2; i++) {
      const bird = standing.clone(true);
      bird.name = `FerryCrane_${i}`;
      bird.userData.dynamic = true;
      const scale = i ? .78 : .91;
      const z = i ? 8.4 : 11.4;
      const plank = Math.round((z - 4) / .46);
      const deck = 1.57 + Math.sin(plank / 18 * Math.PI) * .65;
      bird.position.set(i ? 1.0 : -1.05, deck - .065 * scale, z);
      bird.rotation.y = i ? -.6 : -1.7;
      bird.scale.setScalar(scale);
      ferry.root.add(bird);
      resting.push({ bird, base: bird.position.y, angle: bird.rotation.y, phase: i * 2.5 });
    }
  }
  return {
    update(time) {
      for (const { bird, wings, phase, near } of flock) {
        const a = time * (near ? .046 : .031) + phase + .9;
        flightPosition(a, phase, near, bird.position);
        flightPosition(a + .001, phase, near, next).sub(bird.position);
        bird.rotation.set(Math.atan2(next.y, Math.hypot(next.x, next.z)), Math.atan2(-next.x, -next.z), -.08 * Math.sin(a), 'YXZ');
        const beat = time * 2.5 + phase * 2.3;
        const effort = THREE.MathUtils.smoothstep(Math.sin(time * .24 + phase), -.3, .6);
        for (const { side, shoulder, wrist } of wings) {
          if (shoulder) {
            shoulder.rotation.z = side * (.13 + Math.sin(beat) * .52 * effort);
            shoulder.rotation.y = side * (.02 + Math.cos(beat) * .035 * effort);
          }
          if (wrist) {
            wrist.rotation.z = side * (-.10 + Math.sin(beat - .72) * .27 * effort);
            wrist.rotation.y = side * (.03 + Math.sin(beat - .45) * .09 * effort);
          }
        }
        bird.position.y += Math.sin(beat - .9) * .07 * effort;
      }
      for (const { bird, base, angle, phase } of resting) {
        bird.position.y = base + Math.sin(time * .8 + phase) * .007;
        bird.rotation.y = angle + Math.sin(time * .14 + phase) * .075;
      }
    },
  };
}
