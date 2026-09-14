import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCranes } from './cranes.js';

const noise = new ImprovedNoise();
const up = new THREE.Vector3(0, 1, 0);
const point = (x, y, z) => new THREE.Vector3(x, y, z);
const stoneVertex = `varying vec3 vStonePosition;\n`;
const stoneFragment = `
  varying vec3 vStonePosition;
  float mineralHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
  float stoneNoise(vec3 p) {
    vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(mineralHash(i),mineralHash(i+vec3(1,0,0)),f.x),mix(mineralHash(i+vec3(0,1,0)),mineralHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(mineralHash(i+vec3(0,0,1)),mineralHash(i+vec3(1,0,1)),f.x),mix(mineralHash(i+vec3(0,1,1)),mineralHash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
`;

function mineral(material, strength = 0.12) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = stoneVertex + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStonePosition = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = stoneFragment + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\nfloat vein = stoneNoise(vStonePosition * 0.9) * 0.7 + stoneNoise(vStonePosition * 3.3) * 0.3;\ndiffuseColor.rgb *= 1.0 - ${strength.toFixed(3)} * vein;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + vec3(dFdx(vein), dFdy(vein), 0.0) * 0.12);');
  };
  material.customProgramCacheKey = () => `mineral-${strength}`;
  return material;
}

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const obj = new THREE.Mesh(geometry, material);
  obj.position.set(x, y, z);
  obj.castShadow = obj.receiveShadow = true;
  parent.add(obj);
  return obj;
}
function box(parent, material, w, h, d, x, y, z) { return mesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z); }
function beam(parent, material, from, to, radius = 0.12, sides = 8) {
  const delta = to.clone().sub(from);
  const obj = mesh(parent, new THREE.CylinderGeometry(radius, radius * 1.08, delta.length(), sides), material);
  obj.position.copy(from).add(to).multiplyScalar(0.5);
  obj.quaternion.setFromUnitVectors(up, delta.normalize());
  return obj;
}

function cliffGeometry(radius, height, seed) {
  const radial = 56, levels = 27;
  const vertices = [], colors = [], indices = [];
  const color = new THREE.Color();
  for (let j = 0; j <= levels; j++) {
    const t = j / levels;
    const profile = Math.pow(1 - t, 0.54) * (0.88 + Math.sin(t * 12 + 0.5) * 0.09);
    for (let i = 0; i <= radial; i++) {
      const angle = i / radial * Math.PI * 2;
      const n = noise.noise(Math.cos(angle) * 3 + seed, t * 4, Math.sin(angle) * 3);
      const n2 = noise.noise(Math.cos(angle) * 12 + seed, t * 3, Math.sin(angle) * 12);
      const ridges = Math.sin(angle * 13 + n * 2.2) * 0.055;
      const r = radius * profile * (1 + n * 0.32 + n2 * 0.14 + ridges);
      const y = -t * height + (j === 0 ? 0 : n * 1.8);
      vertices.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
      color.set(j < 3 ? '#597b69' : '#698189');
      color.lerp(new THREE.Color('#253e49'), t * 0.40 + n * 0.22);
      color.multiplyScalar(0.85 + Math.sin(t * 90 + n) * 0.08 + n2 * 0.23);
      colors.push(color.r, color.g, color.b);
      if (j < levels && i < radial) {
        const a = j * (radial + 1) + i, b = a + radial + 1;
        indices.push(a, a+1, b, b, a+1, b+1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mountainGeometry(radius,height,seed){
  const geometry=new THREE.CylinderGeometry(radius*.37,radius,height,40,24);
  const positions=geometry.attributes.position;
  const colors=[];
  const color=new THREE.Color();
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const t=(y+height/2)/height;
    const angle=Math.atan2(z,x);
    const folds=noise.noise(x*.23+seed,y*.055,z*.23)*.28+Math.sin(angle*13+seed)*.085;
    const stretch=1+folds+Math.sin(t*25+seed)*.075;
    positions.setXYZ(i,x*stretch,y+height/2-28+noise.noise(x*.3+seed,0,z*.3)*3,z*stretch);
    color.set(t>.93?'#577568':'#617c82');
    color.multiplyScalar(.75+folds*.55+t*.13);
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

function curvedRoof(parent, material, gold, width, depth, base, rise) {
  const vertices = [], indices = [];
  const divisions = 24;
  for (let j = 0; j <= divisions; j++) {
    for (let i = 0; i <= divisions; i++) {
      const u = i / divisions * 2 - 1, v = j / divisions * 2 - 1;
      const edge = Math.max(Math.abs(u), Math.abs(v));
      const height = base + rise * Math.pow(1 - edge, 1.7) + Math.pow(Math.abs(u * v), 5) * rise * 0.32;
      vertices.push(u * width / 2, height + Math.cos(u * 95) * 0.025, v * depth / 2);
      if (i < divisions && j < divisions) {
        const a = j * (divisions + 1) + i, b = a + divisions + 1;
        indices.push(a, b, a+1, b, b+1, a+1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  mesh(parent, geometry, material);
  const curves = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    curves.push(new THREE.CatmullRomCurve3(Array.from({length: 14}, (_, i) => {
      const t = i / 13;
      return point(sx * width / 2 * t, base + rise * Math.pow(1-t,1.7) + Math.pow(t,10) * rise * 0.32 + 0.08, sz * depth / 2 * t);
    })));
  }
  for (const curve of curves) mesh(parent, new THREE.TubeGeometry(curve, 20, 0.065, 5, false), gold);
  for (const s of [-1,1]) {
    const edge = new THREE.CatmullRomCurve3(Array.from({length: 20}, (_, i) => {
      const u = i / 19 * 2 - 1;
      return point(u*width/2, base + Math.pow(Math.abs(u),5)*rise*.32, s*depth/2);
    }));
    mesh(parent, new THREE.TubeGeometry(edge, 22, 0.07, 5, false), gold);
  }
  mesh(parent, new THREE.ConeGeometry(0.22, 1.2, 8), gold, 0, base+rise+.5, 0);
}

function balustrade(parent, m, radius, y, start = 0, end = Math.PI*2, count = 42) {
  for (let i = 0; i < count; i++) {
    const a = start + (end-start) * i / count;
    const b = start + (end-start) * (i+1) / count;
    const x = Math.cos(a)*radius, z = Math.sin(a)*radius;
    box(parent, m.marble, .24, 1.25, .24, x, y+.65, z);
    mesh(parent, new THREE.SphereGeometry(.18, 6, 5), m.marble, x, y+1.34, z);
    beam(parent, m.marble, point(x,y+1.03,z), point(Math.cos(b)*radius,y+1.03,Math.sin(b)*radius), .095, 6);
  }
}

function building(parent, m, width = 10, levels = 2, open = false) {
  box(parent, m.marble, width+1.8, 0.8, width*.8+1.8, 0,.4,0);
  box(parent, m.marble, width+1, 0.5, width*.8+1, 0,.95,0);
  for (let level = 0; level < levels; level++) {
    const w = width * Math.pow(.79, level), depth = w*.8;
    const y = 1.2 + level * 4.7;
    if (!open) box(parent,m.wall,w*.83,3.35,depth*.83,0,y+1.67,0);
    for (const x of [-w*.43, w*.43]) for (const z of [-depth*.43,depth*.43]) {
      beam(parent,m.wood,point(x,y,z),point(x,y+3.6,z),.19);
      mesh(parent,new THREE.CylinderGeometry(.28,.35,.32,8),m.gold,x,y+.1,z);
      box(parent,m.gold,.65,.15,.65,x,y+3.2,z);
    }
    if (!open) {
      for (const side of [-1,1]) for (let k = -2; k <= 2; k++) {
        box(parent,m.window,w*.102,1.9,.06,k*w*.14,y+1.7,side*(depth*.418));
        for (let v = -1; v <= 1; v++) box(parent,m.wood,.045,2.0,.1,k*w*.14+v*w*.03,y+1.7,side*(depth*.425));
        for (let h = 0; h < 3; h++) box(parent,m.wood,w*.108,.045,.1,k*w*.14,y+.95+h*.75,side*(depth*.425));
      }
    }
    box(parent,m.wood,w+.45,.22,depth+.45,0,y+3.4,0);
    curvedRoof(parent,m.roof,m.gold,w+3.0,depth+3.0,y+3.5,2.05);
    if (level > 0) {
      box(parent,m.marble,w+1.5,.22,depth+1.5,0,y-.15,0);
      for (const s of [-1,1]) for (let k = -4; k <= 4; k++) {
        box(parent,m.marble,.12,.9,.12,k*(w+1)/8,y+.2,s*(depth+.9)/2);
      }
    }
  }
  for (let step=0;step<6;step++) box(parent,m.marble,width*.35,.2,1.0,0,.1+step*.18,width*.4+3.9-step*.5);
}

function pine(parent, m, x, y, z, scale = 1, seed = 1) {
  const group = new THREE.Group(); group.position.set(x,y,z); group.scale.setScalar(scale); parent.add(group);
  const lean = Math.sin(seed)*1.1;
  beam(group,m.bark,point(0,0,0),point(lean,3.9,.3),.24,7);
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4 + seed, h = 2.2+i*.38;
    const reach = (1-i/8)*2.3;
    const end = point(lean + Math.cos(a)*reach,h+.35,Math.sin(a)*reach);
    beam(group,m.bark,point(lean*h/4,h-.35,0),end,.09,6);
    const crown = mesh(group,new THREE.IcosahedronGeometry(1,1),i%2 ? m.leaf : m.leafLight,end.x,end.y,end.z);
    crown.scale.set(1.75-i*.09,.45,1.25-i*.055);
    crown.rotation.y=a;
  }
}

function waterfall(parent, m, radius, height, phase) {
  const geometry = new THREE.PlaneGeometry(2.1, height*.94, 8, 24);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: m.time, uPhase: { value: phase }, uTint: m.waterTint },
    vertexShader: `varying vec2 vUv; uniform float uTime; uniform float uPhase;
      void main(){ vUv=uv; vec3 p=position; p.x += sin(uv.y*10.0+uTime*.7+uPhase)*.15*(1.0-uv.y); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uTint;
      void main(){ float lines=pow(.5+.5*sin(vUv.x*90.0+sin(vUv.y*20.0-uTime*4.0)),3.0); float ribbon=sin(vUv.x*3.14159); float fade=smoothstep(0.0,.24,vUv.y); gl_FragColor=vec4(uTint+vec3(lines*.15),ribbon*fade*(.30+lines*.35)); }`,
  });
  const water=mesh(parent,geometry,material, radius*.47,-height*.45,radius*.69);
  water.userData.dynamic=true;
  water.castShadow=false;
  const lip=mesh(parent,new THREE.CircleGeometry(1.7,20),m.water,radius*.47,.10,radius*.64);
  lip.rotation.x=-Math.PI/2;
}

function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map();
  const removed = [];
  root.traverse(obj => {
    if (!obj.isMesh || obj.userData.dynamic || obj.material.transparent) return;
    let parent = obj.parent;
    while (parent && parent !== root) { if (parent.userData.dynamic) return; parent = parent.parent; }
    const geometry = obj.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,obj.matrixWorld));
    const flat=geometry.index ? geometry.toNonIndexed() : geometry;
    if (!flat.getAttribute('uv')) flat.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count*2),2));
    if (!batches.has(obj.material)) batches.set(obj.material,[]);
    batches.get(obj.material).push(flat);
    if (flat !== geometry) geometry.dispose();
    removed.push(obj);
  });
  for (const obj of removed) { obj.removeFromParent(); obj.geometry.dispose(); }
  for (const [material, geometries] of batches) {
    const merged=mergeGeometries(geometries);
    if (merged) mesh(root,merged,material);
    geometries.forEach(g=>g.dispose());
  }
}

export function createWorldModels(scene, locations, imported = { assets: new Map(), materials: new Map() }) {
  const m = {
    marble: mineral(new THREE.MeshStandardMaterial({color:'#dfdfc9', roughness:.68, metalness:.03})),
    wall: mineral(new THREE.MeshStandardMaterial({color:'#e6d9b9', roughness:.7})),
    cliff: mineral(new THREE.MeshStandardMaterial({vertexColors:true, roughness:.94}), .28),
    roof: mineral(new THREE.MeshPhysicalMaterial({color:'#28545b', metalness:.18, roughness:.54, clearcoat:.18, side:THREE.DoubleSide})),
    gold: new THREE.MeshStandardMaterial({color:'#b69752', metalness:.73, roughness:.32}),
    wood: new THREE.MeshStandardMaterial({color:'#405754', roughness:.7}),
    window: new THREE.MeshStandardMaterial({color:'#f2d6a4',emissive:'#edba69',emissiveIntensity:.42,roughness:.65}),
    bark: new THREE.MeshStandardMaterial({color:'#514e3e',roughness:1}),
    leaf: new THREE.MeshStandardMaterial({color:'#2b584b',roughness:.92}),
    leafLight: new THREE.MeshStandardMaterial({color:'#416b50',roughness:.9}),
    ground: mineral(new THREE.MeshStandardMaterial({color:'#8a9b77',roughness:1})),
    jade: new THREE.MeshPhysicalMaterial({color:'#6cc4be',emissive:'#30837d',emissiveIntensity:.3,metalness:.15,roughness:.2,clearcoat:1}),
    glow: new THREE.MeshBasicMaterial({color:new THREE.Color('#b2e4da').multiplyScalar(2.3),toneMapped:false}),
    water: new THREE.MeshPhysicalMaterial({color:'#9bd4d1',metalness:.45,roughness:.18,clearcoat:1}),
    time:{value:0}, waterTint:{value:new THREE.Color('#c0e4df')},
  };
  for (const [name, material] of imported.materials) {
    if (/Limestone|StoneCarving|Plaster|Tile/.test(name)) mineral(material, /Tile/.test(name) ? .13 : .19);
    if (/Cedar|Lacquer/.test(name)) mineral(material, .12);
    if (/Feather/.test(name)) {
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec2 featherUv;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfeatherUv = uv;');
        shader.fragmentShader = 'varying vec2 featherUv;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float barb = sin((featherUv.y + abs(featherUv.x - .5) * .22) * 560.0);
          float detailFade = 1.0 - smoothstep(.002, .016, fwidth(featherUv.y));
          diffuseColor.rgb *= 1.0 - (.022 + barb * .016) * detailFade;
        `);
      };
      material.defines = { ...material.defines, USE_UV: '' };
      material.customProgramCacheKey = () => 'feather-barbs-v1';
    }
  }
  const addAsset = (parent, name) => {
    const model = imported.assets.get(name);
    if (!model) return false;
    parent.add(model.clone(true));
    return true;
  };
  const islands=[], animated=[];
  locations.forEach((place,index)=>{
    const root = new THREE.Group(); root.name=place.id; root.position.fromArray(place.position); scene.add(root);
    const r=place.radius;
    mesh(root,cliffGeometry(r,place.height,index*17.3),m.cliff);
    const top=mesh(root,new THREE.CylinderGeometry(r*.9,r*.94,.75,56),m.ground,0,-.4,0);
    top.receiveShadow=true;
    mesh(root,new THREE.CylinderGeometry(r*.68,r*.73,.65,48),m.marble,0,.05,0);
    mesh(root,new THREE.CylinderGeometry(r*.64,r*.68,.27,48),m.marble,0,.49,0);
    balustrade(root,m,r*(place.kind==='library'?.86:.68),.4,.1,Math.PI*1.72,36);
    for (let k=0;k<7;k++) {
      const a=k/7*Math.PI*2+index;
      const x=Math.cos(a)*r*.78, z=Math.sin(a)*r*.78;
      const blocksBridge=place.kind==='bridge'&&z>3&&Math.abs(x)<4.5;
      const blocksHall=place.kind==='library'&&Math.abs(x)>6&&Math.abs(z)<4;
      if(!blocksBridge&&!blocksHall)pine(root,m,x,0,z,.65+(k%3)*.16,k+index*2.3);
      const rock=mesh(root,new THREE.IcosahedronGeometry(1,1),m.ground,Math.cos(a+.3)*r*.85,-.15,Math.sin(a+.3)*r*.85);
      rock.scale.set(2.1,1.3,1.5);
    }
    waterfall(root,m,r,place.height,index);
    const structure=new THREE.Group(); structure.position.y=.7; root.add(structure);
    if(place.kind==='library') {
      if (!addAsset(structure,'library')) building(structure,m,11,3);
    } else if(place.kind==='pagoda') {
      if (!addAsset(structure,'pagoda')) building(structure,m,7.4,5);
      const ring=mesh(structure,new THREE.TorusGeometry(10,.05,5,100),m.glow,0,3,0);ring.rotation.x=Math.PI/2;
    } else if(place.kind==='pavilion'||place.kind==='bridge') {
      if (!addAsset(structure,place.kind==='bridge'?'ferry':'pavilion')) {
        building(structure,m,place.kind==='bridge'?5.5:8.6,1,true);
        if(place.kind==='bridge') {
          for(let i=0;i<16;i++) { const z=4+i*.55; box(structure,m.marble,3.6,.22,.52,0,.5+i*.07,z); for(const side of [-1,1])box(structure,m.gold,.08,.9,.08,side*1.7,1+i*.07,z); }
        }
      }
    } else if(place.kind==='orrery') {
      mesh(structure,new THREE.CylinderGeometry(4.6,5.6,1.5,32),m.marble,0,1.1,0);
      mesh(structure,new THREE.CylinderGeometry(.6,1.7,4.0,16),m.gold,0,3.5,0);
      for(let k=0;k<3;k++) {
        const orbit=mesh(structure,new THREE.TorusGeometry(5.3+k*.25,.11,8,100),m.gold,0,7,0);
        orbit.rotation.set(k*.9+.5,k*.6,.6);orbit.userData.dynamic=true;
        animated.push({obj:orbit,kind:'orbit',speed:.045*(k+1)});
      }
      const pearl=mesh(structure,new THREE.IcosahedronGeometry(1.25,3),m.jade,0,7,0);pearl.userData.dynamic=true;
      animated.push({obj:pearl,kind:'pearl',speed:.2,base:7});
      for(let k=0;k<12;k++) {
        const a=k/12*Math.PI*2;
        mesh(structure,new THREE.OctahedronGeometry(.23),m.glow,Math.cos(a)*6.8,1.6,Math.sin(a)*6.8);
      }
    } else if(place.kind==='gate') {
      if (!addAsset(structure,'gate')) {
        for(const x of [-3.8,3.8]) {
          box(structure,m.marble,1.4,10,1.7,x,5,0);
          box(structure,m.gold,1.65,.28,1.9,x,1.2,0);
          box(structure,m.gold,1.65,.28,1.9,x,8.9,0);
        }
        box(structure,m.marble,10.2,1.25,2,0,10.2,0);
        curvedRoof(structure,m.roof,m.gold,12,4,11,2.2);
        box(structure,m.jade,2.7,5.8,.65,0,3.9,0);
        for(let i=0;i<7;i++)box(structure,m.gold,1.4-i*.08,.09,.08,0,2.1+i*.5,.35);
      }
    }
    for(const x of [-r*.5,r*.5]) {
      beam(root,m.wood,point(x,.6,r*.42),point(x,3.5,r*.42),.09);
      mesh(root,new THREE.SphereGeometry(.42,8,8),m.window,x,3.4,r*.42);
      mesh(root,new THREE.ConeGeometry(.55,.35,6),m.roof,x,3.85,r*.42);
    }
    mergeStatic(root);
    islands.push({root,place,anchor:point(...place.position).add(point(0,place.kind==='pagoda'?28:place.kind==='library'?19:14,0))});
  });
  const distant=new THREE.Group();scene.add(distant);
  for(let i=0;i<20;i++) {
    const x=(i%10-5)*47+(i>9?23:0), z=-175-Math.floor(i/10)*90-(i%3)*17;
    const r=12+(i%4)*3, h=54+(i%5)*14;
    mesh(distant,mountainGeometry(r,h,i*9.8+2),m.cliff,x,0,z);
    for(let j=0;j<3;j++)pine(distant,m,x+(j-1)*2,h-27,z,.55,j+i);
    if(i%4===0){
      const island=mesh(distant,cliffGeometry(7,36,i*5),m.cliff,x+13,30,z+35);
      const temple=new THREE.Group();temple.position.copy(island.position);temple.scale.setScalar(.5);distant.add(temple);building(temple,m,8,2);
    }
  }
  mergeStatic(distant);
  const cranes = createCranes(scene, imported.assets, islands);
  const motesGeometry=new THREE.BufferGeometry();
  const motePositions=new Float32Array(160*3);
  for(let i=0;i<160;i++){motePositions[i*3]=Math.sin(i*127.1)*120;motePositions[i*3+1]=15+(Math.sin(i*91.4)*.5+.5)*65;motePositions[i*3+2]=Math.cos(i*47.7)*120;}
  motesGeometry.setAttribute('position',new THREE.BufferAttribute(motePositions,3));
  const motes=new THREE.Points(motesGeometry,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:m.time},
    vertexShader:`uniform float uTime; void main(){vec3 p=position;p.y+=sin(uTime*.2+p.x)*1.2;p.x+=sin(uTime*.1+p.z)*1.8;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=clamp(210.0/-mv.z,1.0,3.8);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`void main(){float d=length(gl_PointCoord-.5);float glow=exp(-d*d*20.0);gl_FragColor=vec4(.78,.86,.67,glow*.65);}`,
  }));scene.add(motes);
  return {
    islands,
    update(time){
      m.time.value=time;
      for(const item of animated){if(item.kind==='pearl'){item.obj.position.y=item.base+Math.sin(time*.6)*.38;item.obj.rotation.y=time*.2;}else item.obj.rotation.z=time*item.speed+.6;}
      cranes.update(time);
    },
    setSky(mode){
      m.window.emissiveIntensity=mode==='night'?2.8:mode==='sunset'?1.2:.42;
      const paper = imported.materials.get('RicePaper');
      if (paper) paper.emissiveIntensity = m.window.emissiveIntensity;
      m.jade.emissiveIntensity=mode==='night'?.9:.3;m.waterTint.value.set(mode==='night'?'#607f99':mode==='sunset'?'#d8b7be':'#c0e4df');
    },
  };
}
