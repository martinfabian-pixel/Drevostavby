import * as THREE from 'three';
import { HDRLoader } from './vendor/HDRLoader.js';
import { createUnbuiltModel } from './unbuilt-model.js';
import { createUnbuiltPost } from './unbuilt-post.js';

// One continuous, reversible construction sequence. The previous forest module
// remains independent on interaktivny-svet.html; this scene owns its resources.
const section = document.querySelector('#unbuilt-story');
const mount = document.querySelector('#unbuiltCanvas');
const annotationRoot = document.querySelector('#unbuiltAnnotations');
const loader = document.querySelector('#unbuiltLoader');
const fallback = document.querySelector('#unbuiltFallback');
const progressFill = document.querySelector('#unbuiltProgress');
const chapter = document.querySelector('#unbuiltChapter');
const phaseNames = ['concept', 'structure', 'exploded', 'detail', 'realisation'];
const phaseBounds = [0, .185, .37, .575, .79, 1];
const cards = phaseNames.map(name => document.querySelector(`[data-unbuilt-phase="${name}"]`));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const mobile = coarse || window.innerWidth < 760;
const low = mobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const quality = low ? 'mobile' : 'desktop';
const assetState = { loaded: [], fallback: [], environment: 'pending' };

let renderer, scene, camera, model, floor, sun, environment, post;
let started = false, ready = false, stopped = false, inView = true;
let request = 0, previousTime = 0, raw = 0, progress = 0;
let elapsed = 0, actualDpr = 1, preferredDpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.8);
let fps = 60, frames = 0, totalFrames = 0, sampleTime = 0, slowTime = 0, error = null;
let labels = [], technicalLines = [], layers = {}, layerMaterialMap = new Map(), roofAssemblies = [], annotationSvg;
let sceneResources = [], textures = [];
let introStart = 0;
const originalPositions = new Map();
const materialBaselines = new Map();
const cameraPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const working = new THREE.Vector3();
const projected = new THREE.Vector3();

function textLoader(message) {
  const text = loader?.querySelector('[data-loader-text]');
  if (text) text.textContent = message;
}

function showFallback(reason) {
  error = reason;
  ready = false;
  stopped = true;
  if (request) cancelAnimationFrame(request);
  if (fallback) { fallback.hidden = false; fallback.removeAttribute('aria-hidden'); }
  loader?.setAttribute('hidden', '');
  section?.classList.add('unbuilt-is-fallback');
  mount?.setAttribute('aria-hidden', 'true');
  console.warn('DREVOFORM Architecture Unbuilt:', reason);
}

function scrollProgress() {
  if (!section) return 0;
  const rect = section.getBoundingClientRect();
  const distance = Math.max(1, section.offsetHeight - window.innerHeight);
  return clamp(-rect.top / distance);
}

function resize() {
  if (!renderer || !camera || !mount) return;
  const width = Math.max(1, mount.clientWidth);
  const height = Math.max(1, mount.clientHeight);
  // Bound the framebuffer, including on dense mobile and Retina displays.
  const maxPixels = low ? 1.25e6 : 2.6e6;
  actualDpr = Math.min(preferredDpr, Math.sqrt(maxPixels / (width * height)));
  renderer.setPixelRatio(actualDpr);
  renderer.setSize(width, height, false);
  post?.resize(Math.round(width * actualDpr), Math.round(height * actualDpr));
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (model) keyframes = cameraFrames();
  raw = scrollProgress();
}

function generatedEnvironment() {
  // A small linear radiance studio map is a reliable fallback if the existing
  // reconstructed landscape environment cannot be read on a device.
  const width = 256, height = 128;
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const latitude = y / height;
    for (let x = 0; x < width; x++) {
      const longitude = x / width;
      const leftPanel = Math.exp(-Math.pow((longitude - .34) / .065, 2) - Math.pow((latitude - .31) / .19, 2));
      const rightPanel = Math.exp(-Math.pow((longitude - .82) / .11, 2) - Math.pow((latitude - .39) / .21, 2));
      const i = (y * width + x) * 4;
      const base = latitude < .51 ? .11 : .024;
      data[i] = base + leftPanel * 2.3 + rightPanel * .46;
      data[i + 1] = base * .98 + leftPanel * 1.95 + rightPanel * .5;
      data[i + 2] = base * .95 + leftPanel * 1.53 + rightPanel * .56;
      data[i + 3] = 1;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

async function loadEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let hdr;
  try {
    hdr = await new HDRLoader().loadAsync('./assets/morning-sky.hdr');
    const values = hdr.image.data;
    if (!values || values.length !== hdr.image.width * hdr.image.height * 4) throw new Error('Environment dimensions do not match.');
    let peak = 0;
    for (let i = 0; i < values.length; i += 140) {
      const value = hdr.type === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat(values[i]) : values[i];
      if (!Number.isFinite(value) || value > 100) throw new Error('Environment radiance is invalid.');
      peak = Math.max(peak, value);
    }
    if (peak <= 0) throw new Error('Environment is empty.');
    assetState.environment = 'local reconstructed RGBE; not calibrated captured HDR';
    assetState.loaded.push('assets/morning-sky.hdr');
  } catch (e) {
    hdr?.dispose();
    hdr = generatedEnvironment();
    assetState.environment = 'procedural studio radiance';
    assetState.fallback.push('assets/morning-sky.hdr');
  }
  environment = pmrem.fromEquirectangular(hdr);
  scene.environment = environment.texture;
  scene.environmentIntensity = .54;
  // Rotate the original landscape radiance into a studio key-light direction.
  scene.environmentRotation.set(0, -.56, 0);
  hdr.dispose();
  pmrem.dispose();
}

async function loadTexture(path, color = false) {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(path);
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(texture);
    assetState.loaded.push(path.replace('./', ''));
    return texture;
  } catch (e) {
    assetState.fallback.push(path.replace('./', ''));
    return null;
  }
}

async function materials() {
  const [color, normal, roughness] = await Promise.all([
    loadTexture('./assets/wood-grain-color.jpg', true),
    loadTexture('./assets/wood-grain-normal.jpg'),
    loadTexture('./assets/wood-grain-roughness.jpg')
  ]);
  const timber = (tint, grain = true) => new THREE.MeshStandardMaterial({
    color: tint, map: grain ? color : null, normalMap: grain ? normal : null,
    roughnessMap: grain ? roughness : null, normalScale: new THREE.Vector2(.22, .22),
    roughness: .72, metalness: 0, envMapIntensity: .78
  });
  return {
    wood: timber('#f3dfc4'),
    woodLight: timber('#fff0dc'),
    woodDark: timber('#ba9d7c'),
    terrace: timber('#b7a38b'),
    metal: new THREE.MeshStandardMaterial({ color: '#a7abad', metalness: .84, roughness: .28 }),
    metalDark: new THREE.MeshStandardMaterial({ color: '#202629', metalness: .72, roughness: .39 }),
    roof: new THREE.MeshStandardMaterial({ color: '#32383a', metalness: .68, roughness: .43 }),
    membrane: new THREE.MeshStandardMaterial({ color: '#292c28', metalness: 0, roughness: .94 }),
    insulation: new THREE.MeshStandardMaterial({ color: '#a4a283', roughness: .98, metalness: 0 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#96958e', roughness: .91, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#e1e8e1', metalness: 0, roughness: .045,
      transmission: low ? 0 : .90, transparent: low, opacity: low ? .24 : 1,
      thickness: .018, ior: 1.52, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: !low }),
    technical: new THREE.LineBasicMaterial({ color: '#8f9b97', transparent: true, opacity: .7 }),
    accent: new THREE.MeshStandardMaterial({ color: '#b79772', metalness: .76, roughness: .32 })
  };
}

function floorNoise() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(256, 256);
  let seed = 198706;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 184 + (seed >>> 28);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(52, 52);
  textures.push(texture);
  return texture;
}

function studio() {
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#262a2c', roughness: .87, metalness: .04,
    roughnessMap: floorNoise(), envMapIntensity: .36 });
  floor = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.025;
  floor.receiveShadow = true;
  scene.add(floor);
  sceneResources.push(floor.geometry, floorMaterial);

  // Broad, restrained contact shading under the raised pavilion. It reinforces
  // real anchoring without a conspicuous floating display pedestal.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 256;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 18, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(0,0,0,.52)');
  gradient.addColorStop(.55, 'rgba(0,0,0,.24)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: .6,
    depthWrite: false, toneMapped: false });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 11), shadowMaterial);
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, -.019, .4);
  scene.add(contact);
  sceneResources.push(contact.geometry, shadowMaterial, shadowTexture);

  sun = new THREE.DirectionalLight('#ffe3bd', 3.45);
  sun.position.set(-7, 11, 8);
  sun.target.position.set(0, 1.3, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 36;
  sun.shadow.normalBias = .016;
  sun.shadow.bias = -.00013;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#b6cbd6', 1.3);
  rim.position.set(8, 7, -8);
  scene.add(rim);
  const fill = new THREE.HemisphereLight('#b5bfc1', '#777063', .73);
  scene.add(fill);
  const front = new THREE.DirectionalLight('#d8d4c9', .55);
  front.position.set(5, 3.5, 10);
  scene.add(front);
}

function prepareModel() {
  layers = model.layers;
  for (const [name, value] of Object.entries(layers)) {
    const group = value.group || value;
    originalPositions.set(name, group.position.clone());
    const clones = new Map();
    const uniqueMaterials = new Set();
    group.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.userData.baseCastShadow = mesh.castShadow;
      const convert = original => {
        if (!clones.has(original)) {
          const clone = original.clone();
          const baseline = { opacity: original.opacity, transparent: original.transparent,
            depthWrite: original.depthWrite, transmission: original.transmission || 0 };
          materialBaselines.set(clone, baseline);
          clones.set(original, clone);
          uniqueMaterials.add(clone);
        }
        return clones.get(original);
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    });
    layerMaterialMap.set(name, uniqueMaterials);
  }
  model.technical?.traverse(object => {
    if (!object.isLine && !object.isLineSegments) return;
    object.material = object.material.clone();
    object.material.transparent = true;
    object.material.depthWrite = false;
    object.material.depthTest = true;
    object.material.toneMapped = false;
    technicalLines.push({ object, count: object.geometry.attributes.position.count,
      opacity: object.material.opacity || 1 });
  });
  const roof = layers.roof?.group || layers.roof;
  roofAssemblies = (roof?.children || []).filter(child => child.isGroup).map(child => ({
    group: child, base: child.position.clone(), offset: {
      'roof:timber-deck': 0, 'roof:vapour-control': .24, 'roof:rigid-insulation': .51,
      'roof:waterproof-layer': .80, 'roof:standing-seam-cover': 1.05,
      'roof:seams': 1.05, 'roof:flashing': 1.05, 'roof:drainage': 1.05
    }[child.name] || 0
  }));
  createAnnotations();
}

function opacityLayer(name, amount) {
  const value = layers[name];
  if (!value) return;
  const group = value.group || value;
  group.visible = amount > .003;
  const fullyVisible = amount > .995;
  for (const material of layerMaterialMap.get(name) || []) {
    const base = materialBaselines.get(material);
    const transparent = base.transparent || !fullyVisible;
    if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
    material.opacity = base.opacity * amount;
    material.depthWrite = fullyVisible ? base.depthWrite : false;
    if ('transmission' in material) material.transmission = base.transmission * amount;
  }
  group.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = amount > .92 && mesh.userData.baseCastShadow; });
}

function moveLayer(name, vector, amount) {
  const value = layers[name];
  if (!value) return;
  const group = value.group || value;
  group.position.copy(originalPositions.get(name)).addScaledVector(vector, amount);
}

const explodedOffsets = {
  foundation: new THREE.Vector3(0, -.05, 0),
  structure: new THREE.Vector3(0, .28, 0),
  roof: new THREE.Vector3(0, 2.3, -.25),
  envelope: new THREE.Vector3(-.65, .3, -1.3),
  facade: new THREE.Vector3(-1.7, .25, 1.7),
  glazing: new THREE.Vector3(.95, .22, 1.8),
  terrace: new THREE.Vector3(0, .15, 2.65)
};

function createAnnotations() {
  if (!annotationRoot) return;
  const ns = 'http://www.w3.org/2000/svg';
  annotationSvg = document.createElementNS(ns, 'svg');
  annotationSvg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
  annotationSvg.setAttribute('aria-hidden', 'true');
  annotationRoot.append(annotationSvg);
  const supplied = (model.detail?.labels || []).map(entry => ({ ...entry, phase: 'detail' }));
  const titles = { foundation: 'Kotvenie / základ', structure: 'Nosná konštrukcia', roof: 'Strešná skladba',
    envelope: 'Obvodový plášť', facade: 'Odvetraná fasáda', glazing: 'Presklenie', terrace: 'Drevená terasa' };
  for (const [layer, anchor] of Object.entries(model.anchors || {})) {
    supplied.push({ text: titles[layer] || layer, position: anchor, layer, phase: 'exploded' });
  }
  labels = supplied.map((entry, index) => {
    const node = document.createElement('div');
    node.className = 'unbuilt-annotation';
    node.setAttribute('aria-hidden', 'true');
    const number = document.createElement('span');
    number.className = 'unbuilt-annotation__index';
    number.textContent = String(supplied.filter(item => item.phase === entry.phase).indexOf(entry) + 1).padStart(2, '0');
    const title = document.createElement('span');
    title.className = 'unbuilt-annotation__text';
    title.textContent = entry.text || entry.label || entry.title || '';
    node.style.maxWidth = low ? '132px' : '185px';
    node.append(number, title);
    annotationRoot.append(node);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('stroke', '#b09b7f');
    line.setAttribute('stroke-width', '.7');
    line.setAttribute('stroke-opacity', '.55');
    annotationSvg.append(line);
    const anchor = entry.position || entry.anchor || entry.target || model.detail.target;
    return { node, line, entry, position: anchor.clone ? anchor.clone() : new THREE.Vector3(...anchor), index };
  });
}

function updateAnnotations(p) {
  const detailVisibility = smooth(.62, .67, p) * (1 - smooth(.755, .8, p));
  const explodedVisibility = smooth(.415, .46, p) * (1 - smooth(.555, .615, p));
  const width = mount.clientWidth, height = mount.clientHeight;
  const mountRect = mount.getBoundingClientRect(), rootRect = annotationRoot?.getBoundingClientRect();
  if (!rootRect) return;
  const dx = mountRect.left - rootRect.left, dy = mountRect.top - rootRect.top;
  labels.forEach((label, index) => {
    const visibility = label.entry.phase === 'exploded' ? explodedVisibility : detailVisibility;
    projected.copy(label.position);
    const layer = layers[label.entry.layer]?.group || layers[label.entry.layer];
    if (layer) projected.add(layer.position);
    if (label.entry.layer === 'roof') projected.y += .51 * smooth(.345, .51, p) * (1 - smooth(.79, .915, p));
    projected.project(camera);
    const localX = (projected.x * .5 + .5) * width;
    const localY = (-projected.y * .5 + .5) * height;
    const x = localX + dx, y = localY + dy;
    const visible = projected.z < 1 && projected.z > -1 && localX > 5 && localX < width - 5 && localY > 10 && localY < height - 10;
    const phaseIndex = labels.filter(item => item.entry.phase === label.entry.phase).indexOf(label);
    const phaseCount = label.entry.phase === 'exploded' ? 7 : (model.detail?.labels?.length || 5);
    const offsetX = label.entry.offset?.[0] ?? (phaseIndex % 2 ? 42 : -132);
    const offsetY = label.entry.offset?.[1] ?? (phaseIndex - phaseCount / 2) * (low ? 19 : 30);
    // Seven assemblies use deliberate editorial positions instead of stacking
    // labels on the same projected beam. Detail labels stay close to the cut.
    const layout = { foundation: [.05, .74], structure: [.28, .45], roof: [.48, .20],
      envelope: [.66, .44], facade: [.02, .58], glazing: [.69, .67], terrace: [.20, .84] }[label.entry.layer];
    const desiredX = layout ? dx + layout[0] * width : x + offsetX;
    const desiredY = layout ? dy + layout[1] * height : y + offsetY;
    const labelX = clamp(desiredX, dx + 12, Math.max(dx + 12, rootRect.width - (low ? 145 : 205)));
    const labelY = clamp(desiredY, dy + 24, dy + height - 72);
    label.node.style.transform = `translate3d(${labelX.toFixed(1)}px,${labelY.toFixed(1)}px,0)`;
    label.node.style.opacity = String(visible ? visibility : 0);
    label.node.style.setProperty('--anchor-x', `${(x - labelX).toFixed(1)}px`);
    label.node.style.setProperty('--anchor-y', `${(y - labelY).toFixed(1)}px`);
    label.line.setAttribute('x1', x.toFixed(1));
    label.line.setAttribute('y1', y.toFixed(1));
    label.line.setAttribute('x2', (labelX + 11).toFixed(1));
    label.line.setAttribute('y2', (labelY + 3).toFixed(1));
    label.line.setAttribute('opacity', visible ? String(visibility) : '0');
  });
}

function segment(p, keyframes) {
  let a = keyframes[0], b = keyframes[keyframes.length - 1];
  for (let i = 1; i < keyframes.length; i++) {
    if (p <= keyframes[i].p) { a = keyframes[i - 1]; b = keyframes[i]; break; }
  }
  const t = smooth(a.p, b.p, p);
  cameraPosition.copy(a.position).lerp(b.position, t);
  cameraTarget.copy(a.target).lerp(b.target, t);
}

function cameraFrames() {
  const target = model.detail?.target || new THREE.Vector3(-4.5, 1.55, 2.1);
  const direction = (model.detail?.direction || new THREE.Vector3(-.85, .18, .65)).clone().normalize();
  const detailPosition = target.clone().addScaledVector(direction, low ? 7.4 : 5.05);
  const detailEnding = target.clone().addScaledVector(direction, low ? 7.6 : 5.15);
  detailEnding.y += .17;
  const overviewScale = (low ? 1.44 : 1.15) * Math.max(1, (low ? .74 : 1.03) / camera.aspect);
  const pos = (x, y, z) => new THREE.Vector3(x * overviewScale, y * overviewScale, z * overviewScale);
  const aim = (x = 0, y = 1.4, z = 0) => new THREE.Vector3(x, y, z);
  return [
    { p: 0, position: pos(13.4, 8.4, 14.5), target: aim(0, 1.2, 0) },
    { p: .185, position: pos(12.6, 7.3, 13.8), target: aim(0, 1.55, 0) },
    { p: .37, position: pos(12, 7.6, 14.4), target: aim(0, 1.75, .15) },
    { p: .51, position: pos(13.3, 10.2, 15.6), target: aim(0, 2.6, .3) },
    { p: .575, position: pos(8.6, 7.2, 13.6), target: aim(-.75, 2.1, .5) },
    { p: .675, position: detailPosition, target: target.clone() },
    { p: .765, position: detailEnding, target: target.clone().add(new THREE.Vector3(0, .05, 0)) },
    { p: .905, position: pos(11.8, 6.3, 13.8), target: aim(0, 1.7, .2) },
    { p: 1, position: pos(11.2, 5.8, 13.2), target: aim(0, 1.65, .2) }
  ];
}

let keyframes = [];
function animateStory(p) {
  const explosion = smooth(.345, .51, p) * (1 - smooth(.79, .915, p));
  const reveal = {
    foundation: smooth(.11, .19, p),
    structure: smooth(.16, .28, p),
    roof: smooth(.25, .355, p),
    envelope: smooth(.265, .365, p),
    facade: smooth(.285, .375, p),
    glazing: smooth(.3, .385, p),
    terrace: smooth(.255, .365, p)
  };
  for (const name of Object.keys(layers)) {
    opacityLayer(name, reveal[name] ?? 1);
    const detailReturn = ['facade', 'envelope'].includes(name) ? 1 - smooth(.575, .655, p) : 1;
    if (explodedOffsets[name]) moveLayer(name, explodedOffsets[name], explosion * detailReturn);
  }
  for (const assembly of roofAssemblies) {
    assembly.group.position.copy(assembly.base);
    assembly.group.position.y += assembly.offset * explosion;
  }
  const technicalOpacity = (1 - smooth(.20, .345, p)) * .67;
  const introDrawing = reduced ? .90 : .90 * smooth(.16, 2.5, elapsed - introStart);
  const drawing = Math.max(introDrawing, smooth(.008, .165, p));
  for (const item of technicalLines) {
    item.object.visible = technicalOpacity > .002;
    item.object.material.opacity = item.opacity * technicalOpacity;
    item.object.geometry.setDrawRange(0, Math.floor(item.count * drawing / 2) * 2);
  }
  const detailAmount = smooth(.605, .665, p) * (1 - smooth(.755, .817, p));
  model.detail?.setCutaway?.(detailAmount);
  if (model.detail?.coverMeshes) {
    for (const mesh of model.detail.coverMeshes) {
      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materialList) {
        const base = materialBaselines.get(material);
        if (!base) continue;
        const layerReveal = reveal[mesh.userData.layer] ?? 1;
        material.opacity = base.opacity * (1 - detailAmount) * layerReveal;
        const transparent = base.transparent || detailAmount > .001 || layerReveal < .995;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.depthWrite = detailAmount < .001 && layerReveal > .995 && base.depthWrite;
      }
      mesh.visible = detailAmount < .998;
      mesh.castShadow = detailAmount < .08 && reveal.facade > .92 && mesh.userData.baseCastShadow;
    }
  }
  segment(p, keyframes);
  // An intro drift is deliberately small and fades before the construction.
  const intro = reduced ? 1 : smooth(0, 2.8, elapsed - introStart);
  if (p < .06 && intro < 1) {
    cameraPosition.addScaledVector(new THREE.Vector3(1.1, .45, .6), (1 - intro) * (1 - smooth(.01, .06, p)));
  }
  // Keep the lower architectural detail above the physical ground.
  cameraPosition.y = Math.max(1.1, cameraPosition.y);
  camera.position.copy(cameraPosition);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  updateAnnotations(p);
  updateText(p);
}

function updateText(p) {
  let index = phaseBounds.findIndex((end, i) => i > 0 && p < end) - 1;
  if (index < 0) index = 4;
  section.dataset.phase = phaseNames[index];
  cards.forEach((card, i) => {
    if (!card) return;
    const enter = i === 0 ? 1 : smooth(phaseBounds[i] - .027, phaseBounds[i] + .023, p);
    const leave = i === 4 ? 1 : 1 - smooth(phaseBounds[i + 1] - .027, phaseBounds[i + 1] + .023, p);
    const opacity = enter * leave;
    card.style.setProperty('--phase-opacity', opacity.toFixed(4));
    card.style.opacity = String(opacity);
    card.style.visibility = opacity > .002 ? 'visible' : 'hidden';
    card.style.pointerEvents = opacity > .5 ? 'auto' : 'none';
    card.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    card.dataset.active = i === index ? 'true' : 'false';
  });
  if (progressFill) progressFill.style.width = `${(p * 100).toFixed(3)}%`;
  if (chapter) chapter.textContent = `${String(index + 1).padStart(2, '0')} / 05`;
}

function frame(time) {
  request = 0;
  if (stopped || !ready || !inView || document.hidden) return;
  const dt = previousTime ? Math.min(.06, (time - previousTime) / 1000) : 1 / 60;
  previousTime = time;
  elapsed += dt;
  raw = scrollProgress();
  progress += (raw - progress) * (reduced ? 1 : 1 - Math.exp(-dt * 8.5));
  if (Math.abs(raw - progress) < .00005) progress = raw;
  animateStory(progress);
  renderer.info.reset();
  post.render();
  totalFrames++;
  frames++;
  sampleTime += dt;
  if (sampleTime >= 1) {
    fps = Math.round(frames / sampleTime * 10) / 10;
    if (fps < 37) slowTime += sampleTime;
    else slowTime = Math.max(0, slowTime - sampleTime * 1.5);
    if (slowTime > 3 && preferredDpr > .85) {
      preferredDpr = Math.max(.85, preferredDpr - .15);
      resize();
      slowTime = 0;
    }
    frames = 0;
    sampleTime = 0;
  }
  // Nothing changes once the scroll settles. Let the GPU rest until the next
  // scroll/resize/visibility event; the intro remains alive for its full drift.
  if (Math.abs(raw - progress) > .000045 || elapsed - introStart < 3.1) request = requestAnimationFrame(frame);
}

function resume() {
  if (!ready || stopped || !inView || document.hidden || request) return;
  previousTime = 0;
  request = requestAnimationFrame(frame);
}

async function init() {
  if (started || !section || !mount) return;
  started = true;
  textLoader('Pripravujem architektonický príbeh');
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: low ? 'low-power' : 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.09;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.info.autoReset = false;
    renderer.domElement.setAttribute('aria-label', 'Interaktívny architektonický model ovládaný posúvaním stránky');
    renderer.domElement.setAttribute('role', 'img');
    mount.append(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#191c1e');
    scene.fog = new THREE.Fog('#191c1e', 32, 95);
    camera = new THREE.PerspectiveCamera(low ? 39 : 36, 1, .08, 150);
    resize();
    const materialSet = await materials();
    await loadEnvironment();
    studio();
    model = createUnbuiltModel({ THREE, materials: materialSet, quality });
    scene.add(model.group);
    prepareModel();
    post = createUnbuiltPost({ THREE, renderer, scene, camera, enabled: !low });
    resize();
    keyframes = cameraFrames();
    raw = progress = scrollProgress();
    animateStory(progress);
    textLoader('Dokončujem svetlo a materiály');
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    ready = true;
    introStart = elapsed;
    section.classList.add('unbuilt-is-ready');
    loader?.setAttribute('hidden', '');
    fallback?.setAttribute('hidden', '');
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      showFallback('Grafický kontext bol prerušený. Technický náhľad zostáva dostupný.');
    });
    resume();
  } catch (e) {
    showFallback(e.message || 'WebGL nie je na tomto zariadení dostupné.');
  }
}

window.__unbuiltStory = {
  state: () => ({ ready, renderingReady: ready, rendering: !!request, inView, progress, raw, phase: phaseNames[
    Math.max(0, Math.min(4, phaseBounds.findIndex((end, i) => i > 0 && progress < end) - 1 < 0 ? 4 : phaseBounds.findIndex((end, i) => i > 0 && progress < end) - 1))
  ], quality, fps, dpr: actualDpr, error, assets: assetState,
    camera: camera ? { position: camera.position.toArray(), target: cameraTarget.toArray(), near: camera.near, far: camera.far } : null,
    renderCalls: renderer?.info.render.calls || 0, triangles: renderer?.info.render.triangles || 0,
    frames: totalFrames, introComplete: elapsed - introStart >= 3.1,
    model: model?.stats || null }),
  setProgress: value => {
    if (!section) return;
    const top = window.scrollY + section.getBoundingClientRect().top;
    const distance = Math.max(1, section.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + clamp(value) * distance, behavior: 'instant' });
    raw = scrollProgress();
    resume();
  },
  dispose: () => {
    stopped = true;
    if (request) cancelAnimationFrame(request);
    observation?.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    for (const set of layerMaterialMap.values()) for (const material of set) material.dispose();
    for (const item of technicalLines) item.object.material.dispose();
    model?.dispose?.();
    environment?.dispose();
    post?.dispose();
    sceneResources.forEach(resource => resource.dispose?.());
    textures.forEach(texture => texture.dispose());
    renderer?.dispose();
    renderer?.domElement.remove();
    labels.forEach(label => label.node.remove());
    annotationSvg?.remove();
  }
};

let resizeFrame = 0;
function onResize() { if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; resize(); resume(); }); }
function onScroll() { raw = scrollProgress(); resume(); }
function onVisibility() { if (document.hidden) { if (request) cancelAnimationFrame(request); request = 0; previousTime = 0; } else resume(); }
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('visibilitychange', onVisibility);

const observation = section && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    inView = entry.isIntersecting;
    if (inView) { if (!started) init(); else resume(); }
    else { if (request) cancelAnimationFrame(request); request = 0; previousTime = 0; }
  }
}, { threshold: 0, rootMargin: '100px 0px' }) : null;
if (observation) observation.observe(section);
else init();
