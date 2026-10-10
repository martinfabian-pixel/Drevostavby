import * as THREE from 'three';
import {HDRLoader} from './vendor/HDRLoader.js';
import {createNature} from './forest-nature.js';
import {createForestCamera} from './forest-camera.js';
import {createBuildings,buildingDefinitions} from './forest-buildings.js';
import {createForestPost} from './forest-post.js';

const mount=document.getElementById('world3d');
const defaultPanel=mount?{
  title:document.getElementById('worldTitle').textContent,
  location:document.getElementById('worldLocation').textContent,
  count:document.getElementById('worldCount').textContent,
  description:document.getElementById('worldDescription').textContent,
  href:document.getElementById('worldAction').getAttribute('href'),
  cta:document.getElementById('worldAction').textContent.trim().replace(/\s*↗$/,''),
}:null;
let disposeWorld=()=>{},generation=0;
if(mount)boot();

async function boot(){
  const token=++generation;disposeWorld();mount.classList.remove('is-ready');
  mount.innerHTML='<div class="world-loading"><span class="world-loading-mark">D</span><strong>Vstúpte do lesa.</strong><span id="worldLoadStatus">Pripravujem svetlo a materiály…</span><span class="world-loading-line"><i></i></span></div>';
  const select=document.getElementById('worldQuality');if(select)select.disabled=true;
  try{
    const cleanup=await startWorld(token);
    if(token!==generation){cleanup?.();return;}
    disposeWorld=cleanup;if(select)select.disabled=false;
  }catch(error){
    console.error('[DREVOFORM 3D]',error);
    mount.innerHTML='<div class="world-error"><strong>3D svet sa nepodarilo otvoriť.</strong><span>Obnovte stránku alebo si pozrite projekty nižšie.</span><button type="button" id="worldRetry">Skúsiť znova</button><a href="#projekty">Pozrieť projekty ↗</a></div>';
    document.getElementById('worldRetry')?.addEventListener('click',boot,{once:true});
    if(select)select.disabled=false;
  }
}

async function startWorld(token){
  const viewport=document.getElementById('worldViewport'),pins=[...document.querySelectorAll('.map-pin')];
  const panel=document.querySelector('.world-panel'),title=document.getElementById('worldTitle');
  const location=document.getElementById('worldLocation'),count=document.getElementById('worldCount');
  const description=document.getElementById('worldDescription'),action=document.getElementById('worldAction');
  const select=document.getElementById('worldQuality'),status=document.getElementById('worldLoadStatus');
  const listeners=[],resources=new Set(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse=matchMedia('(pointer: coarse)').matches;
  const constrained=coarse||(navigator.deviceMemory||4)<4||(navigator.hardwareConcurrency||4)<4;
  let requested='auto';try{requested=sessionStorage.getItem('drevoform-quality')||'auto';}catch{}
  const quality=requested==='auto'?(constrained?'low':'high'):requested,high=quality==='high';
  if(select)select.value=requested;
  let dpr=Math.min(devicePixelRatio||1,high?1.65:1.2),effectiveDpr=dpr;
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:constrained?'default':'high-performance',alpha:false});
  renderer.setPixelRatio(dpr);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.info.autoReset=false;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  const canvas=renderer.domElement,loading=mount.firstElementChild;
  canvas.setAttribute('aria-label','Interaktívny les. Potiahnutím otáčate pohľad, kolieskom alebo dvoma prstami približujete. Kliknutím vyberiete stavbu.');
  mount.append(canvas);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c5cebe');scene.fog=new THREE.FogExp2('#c2cdbc',.0042);
  const camera=new THREE.PerspectiveCamera(44,1,.16,520),globalTime={value:0};
  const lightDirection=new THREE.Vector3(-45,45,38).normalize();
  function listen(node,event,handler,options){node.addEventListener(event,handler,options);listeners.push(()=>node.removeEventListener(event,handler,options));}

  const paths=[];
  function addPath(points){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)));
    paths.push(curve.getPoints(90).map(p=>[p.x,p.z]));
  }
  addPath([[-36.4,-20.8],[-28.6,-16.64],[-23.4,-10.4],[-17.68,-8.06],[-10.4,-8.32],[-3.64,-7.54],[3.64,-3.64],[10.92,-2.08],[17.42,1.3],[23.66,6.76],[31.2,11.44],[45,23]]);
  addPath([[-24,-10.4],[-23,-8],[-20.8,-4.68]]);
  addPath([[-10.4,-8.32],[-8.7,-9],[-7.02,-12.48]]);
  addPath([[10.92,-2.08],[11.2,-5],[11.05,-8.32]]);
  addPath([[23,6.5],[20,8.2],[16.12,8.58]]);
  addPath([[-17.68,-8.06],[-17,0],[-13,11.18]]);
  function distanceToSegment(x,z,a,b){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz||1;
    const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/length,0,1);
    return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
  }
  function pathDistance(x,z){
    if(x< -42||x>50||z< -26||z>28)return Infinity;
    let d=Infinity;for(const path of paths)for(let i=1;i<path.length;i++)d=Math.min(d,distanceToSegment(x,z,path[i-1],path[i]));return d;
  }
  const zones=buildingDefinitions.map(d=>({x:d.x,z:d.z,radius:d.radius+1.8}));
  const baseHeight=(x,z)=>1.3+Math.sin(x*.038)*1.35+Math.cos(z*.043)*1.1+
    Math.sin(x*.074+z*.04)*.42+Math.cos(z*.11-x*.08)*.16+
    12.8*Math.exp(-((x+62)**2+(z+48)**2)/2300)+9.5*Math.exp(-((x-57)**2+(z-63)**2)/2700);
  function terrainHeight(x,z){
    let y=baseHeight(x,z);
    for(const zone of zones){
      const distance=Math.hypot(x-zone.x,z-zone.z);
      const weight=1-THREE.MathUtils.smoothstep(distance,zone.radius*.76,zone.radius+3.2);
      if(weight>0)y=THREE.MathUtils.lerp(y,baseHeight(zone.x,zone.z),weight);
    }return y;
  }
  if(status)status.textContent='Načítavam povrchy krajiny…';
  const assetState={loaded:[],fallbacks:[]};let manifest={};
  try{const response=await fetch(new URL('./assets/manifest.json',import.meta.url));if(response.ok)manifest=await response.json();}catch{}
  const textureLoader=new THREE.TextureLoader(),anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),high?8:4);
  async function texture(url,color=true){
    if(!url)return null;
    try{
      const tex=await textureLoader.loadAsync(new URL(url,import.meta.url).href);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=anisotropy;
      tex.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;resources.add(tex);assetState.loaded.push(url);return tex;
    }catch{assetState.fallbacks.push(url);return null;}
  }
  async function maps(name){
    const item=manifest[name]||{};
    const [map,normalMap,roughnessMap]=await Promise.all([texture(item.color||item.diffuse||item.albedo),texture(item.normal,false),texture(item.roughness,false)]);
    return {map,normalMap,roughnessMap};
  }
  const [soilMaps,mossMaps,woodMaps,barkMaps,rockMaps]=await Promise.all(['soil','moss','wood','bark','rock'].map(maps));
  const foliageNames=['firPhoto','fernPhoto','firAlpha','firNormal','fernAlpha','fernNormal'];
  const foliageMaps=Object.fromEntries(await Promise.all(foliageNames.map(async name=>[name,await texture(manifest.foliage?.[name],name.endsWith('Photo'))])));
  if(token!==generation){renderer.dispose();return ()=>{};}
  function fallbackTex(kind){
    const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),image=ctx.createImageData(512,512);
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      const grain=Math.sin(x*.24+landscapeNoise(x*.008,y*.026)*9)*.5+Math.sin(x*.073+y*.003)*.25;
      const noise=landscapeNoise(x*.21,y*.21)*.54+landscapeNoise(x*.054,y*.054)*.30+landscapeNoise(x*.013,y*.013)*.16;
      const v=kind==='wood'?grain*13+(noise-.5)*9:(noise-.5)*36;
      const base=kind==='wood'?[168,146,113]:kind==='moss'?[76,85,52]:[111,98,74],i=(y*512+x)*4;
      for(let k=0;k<3;k++)image.data[i+k]=base[k]+v;image.data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    if(kind!=='wood'){
      let state=75831;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
      for(let i=0;i<3800;i++){
        const x=random()*512,y=random()*512,a=random()*Math.PI*2;
        ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=kind==='moss'?`rgba(51,62,31,${.15+random()*.30})`:`rgba(60,42,24,${.20+random()*.30})`;
        ctx.beginPath();ctx.ellipse(0,0,.5+random()*1.7,.3+random()*.7,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=anisotropy;resources.add(tex);return tex;
  }
  for(const [name,maps] of [['soil',soilMaps],['moss',mossMaps],['wood',woodMaps]])if(!maps.map){maps.map=fallbackTex(name);assetState.fallbacks.push(name+'-procedural');}
  barkMaps.map||=woodMaps.map;
  function standard(color,options={}){const m=new THREE.MeshStandardMaterial({color,roughness:.84,...options});resources.add(m);return m;}
  const materials={
    ...foliageMaps,
    wood:standard('#e8d0ad',{...woodMaps,normalScale:new THREE.Vector2(.48,.48),roughness:.77}),
    bark:standard('#e4ddd0',{...barkMaps,normalScale:new THREE.Vector2(.9,.9),roughness:.94}),
    rock:standard('#b9bab2',{...rockMaps,roughness:.94,normalScale:new THREE.Vector2(.55,.55)}),
    metal:standard('#4e5451',{metalness:.63,roughness:.47}),
    plaster:standard('#e5dfd3',{normalMap:rockMaps.normalMap,normalScale:new THREE.Vector2(.075,.075),roughness:.93}),
    glass:new THREE.MeshPhysicalMaterial({color:'#adc4bb',metalness:.15,roughness:.075,envMapIntensity:1.55,transparent:true,opacity:.8,clearcoat:1,clearcoatRoughness:.05,reflectivity:.72}),
  };resources.add(materials.glass);
  const sun=new THREE.DirectionalLight('#ffecd4',3.1);sun.position.set(-48,46,38);sun.target.position.set(-3,1,0);
  sun.castShadow=true;sun.shadow.mapSize.set(high?2048:1024,high?2048:1024);
  Object.assign(sun.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:.5,far:155});
  sun.shadow.bias=-.00008;sun.shadow.normalBias=.028;sun.shadow.radius=3;sun.shadow.autoUpdate=false;scene.add(sun,sun.target);
  scene.add(new THREE.HemisphereLight('#d5e6ec','#746e59',.45));
  const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
  const hdrURL=manifest.environment?.file||manifest.environment||manifest.hdri;let environmentTexture;
  if(typeof hdrURL==='string'){
    try{
      environmentTexture=await new HDRLoader().loadAsync(new URL(hdrURL,import.meta.url).href);
      const image=environmentTexture.image;
      if(image.data.length!==image.width*image.height*4)throw new Error('Invalid HDR pixel count');
      let sum=0,samples=0,max=0;
      for(let i=0;i<image.data.length;i+=16){
        const value=environmentTexture.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat(image.data[i]):image.data[i];
        if(!Number.isFinite(value))throw new Error('Non-finite HDR radiance');
        sum+=value;max=Math.max(max,value);samples++;
      }
      if(sum/samples>80)throw new Error('HDR exposure outside the lighting profile');
      assetState.environment={width:image.width,height:image.height,mean:sum/samples,peak:max,provenance:manifest.environment?.provenance};
      assetState.loaded.push(hdrURL);
    }catch{
      environmentTexture?.dispose();environmentTexture=null;assetState.fallbacks.push(hdrURL);
    }
  }
  if(!environmentTexture){
    const w=256,h=128,data=new Float32Array(w*h*4),sunDirection=lightDirection;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const phi=y/(h-1)*Math.PI,theta=x/w*Math.PI*2;
      const dir=new THREE.Vector3(-Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta));
      const horizon=Math.pow(1-Math.abs(dir.y),3),sunDisc=Math.pow(Math.max(0,dir.dot(sunDirection)),700)*24,i=(y*w+x)*4;
      data[i]=.35+horizon*.47+sunDisc;data[i+1]=.45+horizon*.44+sunDisc*.88;data[i+2]=.51+horizon*.27+sunDisc*.68;data[i+3]=1;
      if(dir.y<0){data[i]*=.44;data[i+1]*=.51;data[i+2]*=.35;}
    }
    environmentTexture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
    environmentTexture.mapping=THREE.EquirectangularReflectionMapping;environmentTexture.needsUpdate=true;
    assetState.fallbacks.push('generated-radiance-environment');
  }
  const environmentTarget=pmrem.fromEquirectangular(environmentTexture);scene.environment=environmentTarget.texture;scene.environmentIntensity=.68;
  environmentTexture.dispose();pmrem.dispose();
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:true,
    uniforms:{uTime:globalTime,sunDirection:{value:lightDirection}},
    vertexShader:['varying vec3 direction;','void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'].join('\n'),
    fragmentShader:[
      '#include <common>',
      'uniform vec3 sunDirection;uniform float uTime;varying vec3 direction;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
      'void main(){vec3 d=normalize(direction);float height=max(d.y,0.0);vec3 color=mix(vec3(.66,.73,.64),vec3(.22,.39,.53),pow(height,.48));',
      ' float glow=pow(max(dot(d,sunDirection),0.0),12.0);color+=vec3(.30,.19,.055)*glow;',
      ' float disc=smoothstep(.99955,.99978,dot(d,sunDirection));color+=vec3(7.0,5.7,3.5)*disc;',
      ' vec2 c=d.xz/max(d.y+.18,.12)*3.0+vec2(uTime*.0013,0.0);float cloud=noise(c)*.60+noise(c*2.02)*.26+noise(c*4.03)*.14;',
      ' float cloudMask=smoothstep(.67,.82,cloud)*smoothstep(.02,.24,d.y);color=mix(color,vec3(.91,.91,.80),cloudMask*.35);',
      ' gl_FragColor=vec4(color,1.0);','#include <tonemapping_fragment>','#include <colorspace_fragment>','}'
    ].join('\n')});
  const skyGeometry=new THREE.SphereGeometry(430,32,16),sky=new THREE.Mesh(skyGeometry,skyMaterial);
  sky.frustumCulled=false;scene.add(sky);resources.add(skyGeometry);resources.add(skyMaterial);
  if(status)status.textContent='Osádzam stavby a les…';
  const groundMaterial=standard('#ffffff',{...soilMaps,roughness:.96,normalScale:new THREE.Vector2(.56,.56)});
  groundMaterial.onBeforeCompile=shader=>{
    shader.uniforms.mossMap={value:mossMaps.map};
    shader.vertexShader='attribute float surfaceMix;attribute float pathMix;varying float vSurfaceMix;varying float vPathMix;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceMix=surfaceMix;vPathMix=pathMix;');
    shader.fragmentShader='uniform sampler2D mossMap;varying float vSurfaceMix;varying float vPathMix;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',[
      'vec4 groundColor=texture2D(map,vMapUv);vec4 mossColor=texture2D(mossMap,vMapUv*.133333);',
      'float groundLuminance=dot(groundColor.rgb,vec3(.2126,.7152,.0722));',
      'groundColor.rgb=mix(groundColor.rgb,groundLuminance*vec3(1.14,.86,.59),vPathMix*.88);',
      'diffuseColor*=mix(groundColor,mossColor,clamp(vSurfaceMix,0.0,1.0));'
    ].join('\n'));
  };groundMaterial.customProgramCacheKey=()=> 'drevoform-terrain-blend-v2';
  function landscapeNoise(x,z){
    const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
    const a=fx*fx*(3-2*fx),b=fz*fz*(3-2*fz);
    const hash=(p,q)=>{const n=Math.sin(p*127.1+q*311.7)*43758.5453;return n-Math.floor(n);};
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),a),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),a),b);
  }
  function groundTile(size,segments,outer=false){
    const geometry=new THREE.PlaneGeometry(size,size,segments,segments);geometry.rotateX(-Math.PI/2);
    const positions=geometry.attributes.position,uv=geometry.attributes.uv;
    const surface=new Float32Array(positions.count),pathWear=new Float32Array(positions.count),colors=new Float32Array(positions.count*3);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,terrainHeight(x,z));uv.setXY(i,x*.5,z*.5);
      const p=pathDistance(x,z);let clear=0;
      for(const zone of zones)clear=Math.max(clear,1-THREE.MathUtils.smoothstep(Math.hypot(x-zone.x,z-zone.z),zone.radius*.72,zone.radius+3));
      const variation=.08+.35*landscapeNoise(x*.085,z*.085)+.20*landscapeNoise(x*.21+34,z*.21-13);
      surface[i]=THREE.MathUtils.clamp(variation*(1-.75*clear)*THREE.MathUtils.smoothstep(p,.62,1.65),0,1);
      pathWear[i]=1-THREE.MathUtils.smoothstep(p,.22,.94+landscapeNoise(x*.38,z*.38)*.24);
      const shade=.83+.24*landscapeNoise(x*.12-27,z*.12+32);
      colors.set([shade,shade*.984,shade*.949],i*3);
    }
    if(outer){
      const indices=[];
      // Both grids meet exactly at 80m. Only the surrounding ring uses coarser
      // geometry; there is no overlapping terrain or exposed island edge.
      for(let z=0;z<segments;z++)for(let x=0;x<segments;x++){
        const cx=-size/2+(x+.5)*size/segments,cz=-size/2+(z+.5)*size/segments;
        if(Math.abs(cx)<80&&Math.abs(cz)<80)continue;
        const a=z*(segments+1)+x,b=a+1,c=a+segments+1,d=c+1;
        indices.push(a,c,b,b,c,d);
      }
      geometry.setIndex(indices);
    }
    geometry.setAttribute('surfaceMix',new THREE.BufferAttribute(surface,1));
    geometry.setAttribute('pathMix',new THREE.BufferAttribute(pathWear,1));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,groundMaterial);mesh.receiveShadow=true;scene.add(mesh);resources.add(geometry);
  }
  groundMaterial.vertexColors=true;
  groundTile(160,high?320:200);groundTile(640,160,true);
  const architecture=createBuildings({THREE,scene,materials,terrainHeight});
  const nature=createNature({THREE,scene,materials,quality,terrainHeight,exclusionZones:zones,pathDistance,seed:20261010,reducedMotion});
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let selectedId=null,hoverId=null,disposed=false,lastPointer=null;
  const controls=createForestCamera({THREE,camera,element:canvas,terrainHeight,buildings:architecture.buildings,quality,reducedMotion,onSelect:pickBuilding,onInteraction:()=>viewport.classList.add('has-interacted')});
  const post=createForestPost({THREE,renderer,scene,camera,sun,enabled:high});
  function setAction(text,href){action.href=href;action.replaceChildren(document.createTextNode(text+' '));const arrow=document.createElement('span');arrow.textContent='↗';action.append(arrow);}
  function selectProject(id,focus=true){
    const button=pins.find(p=>p.dataset.worldId===id);if(!button)return;selectedId=id;
    pins.forEach(pin=>{const active=pin===button;pin.classList.toggle('is-active',active);pin.setAttribute('aria-pressed',String(active));});
    location.textContent=button.dataset.location||'PROJEKT';
    count.textContent=String(pins.indexOf(button)+1).padStart(2,'0')+' / '+String(pins.length).padStart(2,'0');
    title.textContent=button.dataset.title||'Projekt';description.textContent=button.dataset.description||'';
    setAction(button.dataset.cta||'Otvoriť projekt',button.dataset.href||'#projekty');architecture.highlight(id);
    panel.classList.remove('is-changing');void panel.offsetWidth;panel.classList.add('is-changing');if(focus)controls.focus(id);
  }
  function reset(){
    selectedId=hoverId=null;controls.reset();architecture.highlight(null);
    pins.forEach(pin=>{pin.classList.remove('is-active');pin.setAttribute('aria-pressed','false');});
    title.textContent=defaultPanel.title;location.textContent=defaultPanel.location;count.textContent=defaultPanel.count;
    description.textContent=defaultPanel.description;setAction(defaultPanel.cta,defaultPanel.href);
  }
  function hitAt(clientX,clientY){
    const rect=canvas.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(architecture.interactiveMeshes,false)[0]?.object.userData.projectId||null;
  }
  function pickBuilding(x,y){const id=hitAt(x,y);if(id)selectProject(id);}
  pins.forEach((pin,i)=>{
    pin.querySelector('.pin-dot').textContent=String(i+1).padStart(2,'0');pin.setAttribute('aria-pressed','false');
    listen(pin,'click',()=>selectProject(pin.dataset.worldId));
    listen(pin,'mouseenter',()=>architecture.highlight(pin.dataset.worldId));listen(pin,'mouseleave',()=>architecture.highlight(selectedId));
    listen(pin,'focus',()=>architecture.highlight(pin.dataset.worldId));listen(pin,'blur',()=>architecture.highlight(selectedId));
  });
  document.querySelectorAll('[data-map-zoom]').forEach(button=>listen(button,'click',()=>controls.zoomBy(button.dataset.mapZoom==='in'?1:-1)));
  document.querySelectorAll('[data-map-reset]').forEach(button=>listen(button,'click',reset));
  if(select)listen(select,'change',()=>{try{sessionStorage.setItem('drevoform-quality',select.value);}catch{}boot();});
  const fullscreen=document.querySelector('[data-world-fullscreen]');
  if(fullscreen){fullscreen.hidden=!document.fullscreenEnabled;listen(fullscreen,'click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await viewport.requestFullscreen();}catch{fullscreen.hidden=true;}
  });listen(document,'fullscreenchange',()=>{fullscreen.setAttribute('aria-label',document.fullscreenElement?'Zavrieť celú obrazovku':'Otvoriť na celú obrazovku');resize();});}
  listen(canvas,'pointermove',event=>{if(event.pointerType==='mouse'&&!event.buttons)lastPointer={x:event.clientX,y:event.clientY};});
  listen(canvas,'pointerleave',()=>{lastPointer=null;hoverId=null;architecture.highlight(selectedId);canvas.classList.remove('can-select');});
  const screenPoint=new THREE.Vector3();
  function positionPins(){
    const rect=canvas.getBoundingClientRect();
    pins.forEach(button=>{
      const anchor=architecture.anchors.get(button.dataset.worldId);if(!anchor)return;
      screenPoint.copy(anchor).project(camera);const x=(screenPoint.x*.5+.5)*rect.width,y=(-screenPoint.y*.5+.5)*rect.height;
      button.hidden=!(screenPoint.z>=-1&&screenPoint.z<=1&&x>24&&x<rect.width-24&&y>60&&y<rect.height-38);
      button.style.left=x+'px';button.style.top=y+'px';button.classList.toggle('label-left',x>rect.width*.65);
      button.classList.toggle('is-hovered',button.dataset.worldId===hoverId);
    });
  }
  function resize(){
    const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);
    // Bound the multisampled HDR allocation on Retina / fullscreen monitors.
    effectiveDpr=Math.min(dpr,Math.sqrt((high?2100000:1100000)/(w*h)));
    renderer.setPixelRatio(effectiveDpr);
    renderer.setSize(w,h,false);controls.resize(w,h);const size=renderer.getDrawingBufferSize(new THREE.Vector2());post.resize(size.x,size.y);
  }
  const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
  let running=false,frameId=0,previous=0,elapsed=0,frameCount=0,average=.0167,sampleStart=0,qualityDrops=0,inView=true,lost=false;
  function frame(now){
    if(disposed||!running)return;
    const dt=previous?Math.min((now-previous)/1000,.08):.0167;previous=now;elapsed+=dt;
    controls.update(dt);globalTime.value=reducedMotion?0:elapsed;nature.update(dt,elapsed,camera);sky.position.copy(camera.position);
    if(frameCount%5===0)sun.shadow.needsUpdate=true;
    if(lastPointer&&frameCount%4===0){const id=hitAt(lastPointer.x,lastPointer.y);if(id!==hoverId){hoverId=id;architecture.highlight(id||selectedId);canvas.classList.toggle('can-select',Boolean(id));}}
    renderer.info.reset();post.render();positionPins();frameCount++;average=average*.97+dt*.03;
    if(requested==='auto'&&elapsed>7&&elapsed-sampleStart>5){sampleStart=elapsed;if(average>.031&&dpr>.85){dpr=Math.max(.85,dpr*.82);renderer.setPixelRatio(dpr);resize();qualityDrops++;}}
    frameId=requestAnimationFrame(frame);
  }
  function visibility(){
    const shouldRun=inView&&!document.hidden&&!lost;
    if(shouldRun&&!running){running=true;previous=0;frameId=requestAnimationFrame(frame);}
    else if(!shouldRun&&running){running=false;cancelAnimationFrame(frameId);}
  }
  const visibleObserver=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;visibility();},{rootMargin:'80px'});
  visibleObserver.observe(viewport);listen(document,'visibilitychange',visibility);
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();lost=true;visibility();viewport.classList.add('context-lost');});
  listen(canvas,'webglcontextrestored',()=>{lost=false;sun.shadow.needsUpdate=true;viewport.classList.remove('context-lost');visibility();});
  controls.update(.016);nature.update(.016,0,camera);sky.position.copy(camera.position);
  await renderer.compileAsync(scene,camera);sun.shadow.needsUpdate=true;post.render();positionPins();
  loading?.remove();mount.classList.add('is-ready');viewport.dataset.quality=quality;visibility();reset();
  window.__drevoformWorld={select:selectProject,reset,quality,state:()=>({
    ready:!disposed,quality,selectedId,hoverId,camera:controls.getState(),frames:frameCount,
    fps:Math.round(1/average),dpr:effectiveDpr,qualityDrops,assets:assetState,nature:nature.stats,
    render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries}})};
  return ()=>{
    disposed=true;running=false;cancelAnimationFrame(frameId);listeners.forEach(remove=>remove());
    observer.disconnect();visibleObserver.disconnect();controls.dispose();nature.dispose();architecture.dispose();post.dispose();
    environmentTarget.dispose();resources.forEach(resource=>resource.dispose?.());scene.clear();renderer.dispose();canvas.remove();window.__drevoformWorld=undefined;
  };
}
