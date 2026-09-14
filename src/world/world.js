import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAtmosphere, skies } from './atmosphere.js';
import { createWorldModels } from './models.js';
import { loadRealmAssets } from './assets.js';
import { locations } from './locations';

export async function createWorld(container) {
  const imported = await loadRealmAssets();
  const interactive = document.body.classList.contains('site-home');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: abort.signal });
  const canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  canvas.setAttribute('aria-label', interactive ? '青野洞天三维场景。拖动或用方向键环顾，滚轮或加减键缩放；也可使用洞天图录选择地点。' : '');
  if (interactive) canvas.tabIndex = 0; else canvas.setAttribute('aria-hidden','true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = skies.dawn.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const gl=renderer.getContext();
  const debugInfo=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=debugInfo?String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)):'';
  const softwareRenderer=/swiftshader|llvmpipe|software/i.test(gpu);
  if(import.meta.env.DEV)container.dataset.renderer=gpu;
  const timerExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let gpuQuery=null;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(skies.dawn.fog, .0024);
  const camera = new THREE.PerspectiveCamera(43, 1, .5, 2600);
  const overviewTarget = new THREE.Vector3(innerWidth<700?0:-17, 11, 0);
  const overviewPosition = innerWidth<700?new THREE.Vector3(125,117,325):new THREE.Vector3(76,71,195);
  camera.position.copy(overviewPosition);
  camera.lookAt(overviewTarget);
  const hemisphere = new THREE.HemisphereLight('#dceff2','#435c58',skies.dawn.ambient);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(skies.dawn.sun,skies.dawn.light);
  sun.position.set(-100,140,-60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-140,right:140,top:140,bottom:-140,near:1,far:410});
  sun.shadow.bias = -.0006;
  sun.shadow.normalBias = .3;
  sun.shadow.radius = 3;
  scene.add(sun,sun.target);
  const fill = new THREE.DirectionalLight('#a1d6ed',1.0);
  fill.position.set(80,50,90);scene.add(fill);
  const atmosphere = createAtmosphere(renderer,scene,camera);
  const models = createWorldModels(scene,locations,imported);
  const envScene = new THREE.Scene();
  const envSky = atmosphere.sky.clone();
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment = pmrem.fromScene(envScene, 0, .1, 2500);
  scene.environment = environment.texture;
  scene.environmentIntensity = .6;
  const controls = new OrbitControls(camera,canvas);
  controls.target.copy(overviewTarget);
  controls.enablePan=false;
  controls.enableDamping=true;
  controls.dampingFactor=.075;
  controls.minDistance=42;
  controls.maxDistance=460;
  controls.minPolarAngle=.35;
  controls.maxPolarAngle=1.31;
  controls.rotateSpeed=.40;
  controls.zoomSpeed=.65;
  controls.enabled=interactive;
  const pins=[...document.querySelectorAll('[data-pin]')].map(element=>({element,island:models.islands.find(i=>i.place.id===element.dataset.pin)}));
  const vector=new THREE.Vector3();
  let frame=0, disposed=false, hidden=document.hidden, readerOpen=false, elapsed=0, previous=0, invalid=true;
  let transition=null, selected=null, inspecting=false, skyMode='dawn', quality='auto';
  let width=innerWidth,height=innerHeight,pixelRatio=1, cloudSteps=56;
  let renderedFrames=0, sampleStart=0, slowSamples=0, autoScale=1;
  let pendingFrame=false;
  const isStill=()=>motionQuery.matches||document.documentElement.dataset.motion==='off';
  const isPaused=()=>hidden||readerOpen||disposed;

  function resize() {
    const previousWidth=width;
    width=container.clientWidth||innerWidth;height=container.clientHeight||innerHeight;
    const small=width<700;
    if((previousWidth<700)!==small){
      overviewPosition.set(...(small?[125,117,325]:[76,71,195]));
      overviewTarget.x=small?0:-17;
      if(!selected){camera.position.copy(overviewPosition);controls.target.copy(overviewTarget);}else travel(selected,inspecting);
    }
    const base=quality==='high'?Math.min(devicePixelRatio,1.35):quality==='low'?.85:small?Math.min(devicePixelRatio,1.3):1;
    pixelRatio=base;
    cloudSteps=quality==='high'?80:quality==='low'?28:small?40:56;
    if(!interactive){pixelRatio=Math.min(pixelRatio,.7);cloudSteps=28;}
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width,height,false);
    let cloudScale=quality==='high'?.65:quality==='low'?.28:small?.38:.40;
    if(quality==='auto'&&softwareRenderer){cloudScale=.24;cloudSteps=28;}
    if(quality==='auto'){cloudScale*=autoScale;cloudSteps=Math.round(cloudSteps*Math.max(.65,autoScale));}
    atmosphere.resize(width,height,pixelRatio,cloudSteps,cloudScale,quality==='high'?4:2);
    camera.aspect=width/height;
    camera.fov=small?57:43;
    camera.updateProjectionMatrix();
    invalid=true;requestFrame();
  }
  const resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(container);

  function updatePins() {
    camera.updateMatrixWorld();
    for(const {element,island} of pins){
      vector.copy(island.anchor).project(camera);
      const visible=vector.z<1&&vector.z>-1&&Math.abs(vector.x)<1.1&&Math.abs(vector.y)<1.05;
      element.style.setProperty('--pin-x',`${(vector.x*.5+.5)*width}px`);
      element.style.setProperty('--pin-y',`${(-vector.y*.5+.5)*height}px`);
      element.classList.toggle('is-offscreen',!visible);
      element.tabIndex=visible?0:-1;
    }
  }

  function requestFrame() {
    if(pendingFrame||isPaused())return;
    pendingFrame=true;frame=requestAnimationFrame(render);
  }
  function render(now) {
    pendingFrame=false;
    if(isPaused())return;
    const delta=previous?Math.min((now-previous)/1000,2):0;
    previous=now;
    if(!isStill())elapsed+=delta;
    let cameraChanged=false;
    if(transition){
      const progress=isStill()?1:Math.min(1,(now-transition.start)/1800);
      const t=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
      camera.position.lerpVectors(transition.fromCamera,transition.toCamera,t);
      controls.target.lerpVectors(transition.fromTarget,transition.toTarget,t);
      cameraChanged=true;
      if(progress===1){transition=null;controls.enabled=interactive;}
    }
    cameraChanged=controls.update()||cameraChanged;
    if(!isStill()||invalid||cameraChanged){
      models.update(elapsed);
      const drawStart=performance.now();
      if(gpuQuery&&gl.getQueryParameter(gpuQuery,gl.QUERY_RESULT_AVAILABLE)){
        if(!gl.getParameter(timerExtension.GPU_DISJOINT_EXT)){
          const gpuMs=gl.getQueryParameter(gpuQuery,gl.QUERY_RESULT)/1e6;
          if(import.meta.env.DEV)container.dataset.gpuMs=gpuMs.toFixed(1);
          if(quality==='auto'){
            // GPU duration excludes browser throttling when the window is occluded.
            slowSamples=gpuMs>30?slowSamples+1:0;
            if(slowSamples>=3&&autoScale>.55){autoScale=Math.max(.55,autoScale-.15);slowSamples=0;resize();}
          }
        }
        gl.deleteQuery(gpuQuery);gpuQuery=null;
      }
      const measure=timerExtension&&!gpuQuery;
      if(measure){gpuQuery=gl.createQuery();gl.beginQuery(timerExtension.TIME_ELAPSED_EXT,gpuQuery);}
      atmosphere.render(elapsed);
      if(measure)gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
      if(import.meta.env.DEV){container.dataset.renderMs=(performance.now()-drawStart).toFixed(1);container.dataset.frame=String(Number(container.dataset.frame||0)+1);}
      updatePins();
      invalid=false;
      if(!container.classList.contains('is-ready')){
        container.classList.add('is-ready');
        document.dispatchEvent(new CustomEvent('realm:ready'));
      }
      if(quality==='auto'&&!isStill()&&interactive){
        if(!sampleStart)sampleStart=now;
        renderedFrames++;
        if(now-sampleStart>2500){
          const fps=renderedFrames*1000/(now-sampleStart);
          if(import.meta.env.DEV)container.dataset.fps=fps.toFixed(1);
          sampleStart=now;renderedFrames=0;
        }
      }
    }
    if(!isStill()||transition||cameraChanged)requestFrame();
  }

  function travel(id, close = false) {
    const place=locations.find(p=>p.id===id);
    selected=place?.id||null;
    inspecting=!!place&&close;
    controls.minDistance=inspecting?(place.id==='ferry'?4:12):place?28:42;
    const heightOffset=width<700?(place?.kind==='pagoda'?0:place?.kind==='library'?-4:-8):5;
    const offset=inspecting?(place.id==='ferry'?new THREE.Vector3(0,3.2,10):new THREE.Vector3(0,place.kind==='pagoda'?13:place.kind==='library'?8:5,0)):new THREE.Vector3(width<700?0:10,heightOffset,0);
    const toTarget=place?new THREE.Vector3(...place.position).add(offset):overviewTarget.clone();
    const distance=inspecting?(place.id==='ferry'?9:place.kind==='pagoda'?40:place.kind==='library'?42:26):(place?.kind==='pagoda'?80:place?.kind==='library'?79:65);
    const direction=inspecting&&place.id==='ferry'?new THREE.Vector3(1,.36,.8):new THREE.Vector3(.48,inspecting?.34:.47,.91);
    const toCamera=place?toTarget.clone().add(direction.normalize().multiplyScalar(width<700?distance*(inspecting?1.35:1.13):distance)):overviewPosition.clone();
    const shadowCenter=inspecting?toTarget:new THREE.Vector3();
    sun.target.position.copy(shadowCenter);
    sun.position.copy(shadowCenter).add(new THREE.Vector3(-100,140,-60));
    const shadowExtent=inspecting?36:140;
    Object.assign(sun.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias=inspecting?.045:.3;
    sun.shadow.bias=inspecting?-.00012:-.0006;
    renderer.shadowMap.needsUpdate=true;
    controls.enabled=false;
    transition={start:performance.now(),fromCamera:camera.position.clone(),fromTarget:controls.target.clone(),toCamera,toTarget};
    invalid=true;requestFrame();
  }
  function setSky(mode) {
    if(!skies[mode])return;
    skyMode=mode;
    const preset=skies[mode];
    atmosphere.setSky(mode);models.setSky(mode);
    sun.color.set(preset.sun);sun.intensity=preset.light;
    hemisphere.intensity=preset.ambient;
    fill.intensity=mode==='night'?.4:1;
    scene.fog.color.set(preset.fog);
    renderer.toneMappingExposure=preset.exposure;
    environment.dispose();
    environment=pmrem.fromScene(envScene,0,.1,2500);
    scene.environment=environment.texture;
    renderer.shadowMap.needsUpdate=true;
    invalid=true;requestFrame();
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let pointerDown=null;
  listen(canvas,'pointerdown',event=>{pointerDown={x:event.clientX,y:event.clientY};});
  listen(canvas,'pointerup',event=>{
    if(!interactive||!pointerDown||Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>6)return;
    pointer.set(event.clientX/width*2-1,-event.clientY/height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(models.islands.map(i=>i.root),true);
    if(hits.length){let root=hits[0].object;while(root.parent&&root.parent!==scene)root=root.parent;document.dispatchEvent(new CustomEvent('realm:select',{detail:root.name}));}
    pointerDown=null;
  });
  listen(canvas,'keydown',event=>{
    const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'];
    if(!keys.includes(event.key)||!interactive)return;
    event.preventDefault();transition=null;controls.enabled=true;
    const offset=camera.position.clone().sub(controls.target);
    const spherical=new THREE.Spherical().setFromVector3(offset);
    if(event.key==='ArrowLeft')spherical.theta-=.10;
    if(event.key==='ArrowRight')spherical.theta+=.10;
    if(event.key==='ArrowUp')spherical.phi=Math.max(controls.minPolarAngle,spherical.phi-.06);
    if(event.key==='ArrowDown')spherical.phi=Math.min(controls.maxPolarAngle,spherical.phi+.06);
    if(event.key==='+'||event.key==='=')spherical.radius=Math.max(controls.minDistance,spherical.radius*.9);
    if(event.key==='-')spherical.radius=Math.min(controls.maxDistance,spherical.radius*1.1);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    invalid=true;requestFrame();
  });
  controls.addEventListener('change',()=>{invalid=true;requestFrame();});
  listen(document,'realm:travel',event=>travel(event.detail));
  listen(document,'realm:inspect',event=>travel(event.detail,true));
  listen(document,'realm:sky',event=>setSky(event.detail));
  listen(document,'realm:wind',event=>{atmosphere.setWind(event.detail);invalid=true;requestFrame();});
  listen(document,'realm:quality',event=>{quality=event.detail;autoScale=1;resize();});
  listen(document,'realm:reader',event=>{readerOpen=event.detail;previous=0;if(readerOpen){cancelAnimationFrame(frame);pendingFrame=false;}else{invalid=true;requestFrame();}});
  listen(document,'visibilitychange',()=>{hidden=document.hidden;previous=0;if(hidden){cancelAnimationFrame(frame);pendingFrame=false;}else requestFrame();});
  listen(motionQuery,'change',()=>{invalid=true;requestFrame();});
  const observer=new MutationObserver(()=>{invalid=true;requestFrame();});
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  function dispose() {
    if(disposed)return;
    disposed=true;cancelAnimationFrame(frame);abort.abort();resizeObserver.disconnect();observer.disconnect();controls.dispose();
    atmosphere.dispose();environment.dispose();pmrem.dispose();
    if(gpuQuery)gl.deleteQuery(gpuQuery);
    const geometries=new Set(),materials=new Set();
    scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);if(obj.material)materials.add(obj.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    renderer.dispose();canvas.remove();
  }
  listen(canvas,'webglcontextlost',event=>{
    event.preventDefault();dispose();container.classList.remove('is-ready');
    document.dispatchEvent(new CustomEvent('realm:fallback'));
  });
  listen(window,'pagehide',event=>{if(event.persisted){hidden=true;cancelAnimationFrame(frame);pendingFrame=false;}else dispose();});
  listen(window,'pageshow',()=>{hidden=false;previous=0;requestFrame();});
  container.prepend(canvas);
  renderer.shadowMap.needsUpdate=true;
  quality=document.querySelector('[data-quality][aria-pressed="true"]')?.dataset.quality||'auto';
  resize();
  try {const stored=localStorage.getItem('qy_sky');if(skies[stored])setSky(stored);}catch{}
  try {atmosphere.setWind(localStorage.getItem('qy_wind')||'breeze');}catch{}
  const initial=location.hash.slice(1);
  if(locations.some(p=>p.id===initial))travel(initial,document.getElementById('world-ui')?.dataset.inspecting==='true');
  return {dispose,travel,setSky};
}
