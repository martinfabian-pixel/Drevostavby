const mount = document.getElementById('world3d');
if (mount) {
  startWorld().catch(() => {
    mount.innerHTML = '<div class="world-error">3D scénu sa nepodarilo načítať. Skúste obnoviť stránku.</div>';
  });
}

async function startWorld() {
  const THREE = await import('three');
  const viewport = document.getElementById('worldViewport');
  const pins = [...document.querySelectorAll('.map-pin')];
  const panelTitle = document.getElementById('worldTitle');
  const panelLocation = document.getElementById('worldLocation');
  const panelCount = document.getElementById('worldCount');
  const panelDescription = document.getElementById('worldDescription');
  const panelAction = document.getElementById('worldAction');
  if (!viewport || !pins.length) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#19221a');
  scene.fog = new THREE.FogExp2('#19221a', 0.018);

  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.replaceChildren(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-13, 13, 7.5, -7.5, 0.1, 100);
  const target = new THREE.Vector3(0, 0.25, 0);
  let theta = 0.58;
  let phi = 0.8;
  let zoom = 1;
  const cameraDistance = 34;

  const hemisphere = new THREE.HemisphereLight('#e8edcf', '#243027', 2.25);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffe6b1', 2.7);
  sun.position.set(-10, 18, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.00035;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#afc6e0', 0.65);
  fill.position.set(12, 10, -11);
  scene.add(fill);

  const mat = (color, options = {}) => new THREE.MeshStandardMaterial({color, roughness:0.88, ...options});
  const groundMat = mat('#536044');
  const undergrowthMat = mat('#3e5039');
  const soilMat = mat('#c5ad7f');
  const trunkMat = mat('#806044');
  const pineMat = mat('#ffffff');
  const broadMat = mat('#ffffff');
  const windowMat = mat('#b8d8d1', {roughness:0.22, metalness:0.12, emissive:'#33564d', emissiveIntensity:0.24});
  const frameMat = mat('#e1d7bd');
  const limeMat = mat('#c9ed35', {emissive:'#708c14', emissiveIntensity:0.65});
  const pathPoints = [
    [-14,-8],[-11,-6.4],[-9,-4],[-6.8,-3.1],[-4,-3.2],[-1.4,-2.9],
    [1.4,-1.4],[4.2,-0.8],[6.7,0.5],[9.1,2.6],[12,4.4],[14,7.2]
  ];
  const buildings = new Map();
  const landmarkAnchors = new Map();
  const interactiveMeshes = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function terrainHeight(x, z) {
    return 0.1 * Math.sin(x * 0.39 + z * 0.21) + 0.07 * Math.cos(z * 0.51 - x * 0.19);
  }

  function addBox(group, width, height, depth, material, x, y, z, rotation = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addGround() {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), undergrowthMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.55;
    outer.receiveShadow = true;
    scene.add(outer);

    const geometry = new THREE.PlaneGeometry(30, 22, 48, 36);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = -positions.getY(i);
      positions.setZ(i, terrainHeight(x, z));
    }
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    const ground = new THREE.Mesh(geometry, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    const hillGeometry = new THREE.SphereGeometry(1, 10, 7);
    const hillMats = [mat('#344634'), mat('#42533d'), mat('#4a573d')];
    const hills = [
      [-16,-8,4.1,1.0,3.2],[-17,4,4.8,1.25,3.6],[15,-8,4.1,1.0,3.1],
      [17,5,5.2,1.25,3.8],[-9,13,5.0,1.1,3.5],[8,13,4.3,.95,3.2]
    ];
    hills.forEach((h, index) => {
      const mound = new THREE.Mesh(hillGeometry, hillMats[index % hillMats.length]);
      mound.position.set(h[0], -0.55, h[1]);
      mound.scale.set(h[2], h[3], h[4]);
      mound.receiveShadow = true;
      scene.add(mound);
    });
  }

  function addClearing(x, z, width, depth) {
    const clearing = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat('#687255'));
    clearing.rotation.x = -Math.PI / 2;
    clearing.position.set(x, terrainHeight(x,z) + 0.018, z);
    clearing.scale.set(width, depth, 1);
    clearing.receiveShadow = true;
    scene.add(clearing);
  }

  function addPath() {
    const points = pathPoints.map(([x,z]) => new THREE.Vector3(x, terrainHeight(x,z) + 0.04, z));
    const curve = new THREE.CatmullRomCurve3(points);
    const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 110, 0.18, 8, false), soilMat);
    path.receiveShadow = true;
    scene.add(path);

    const edgeCurve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, p.y - 0.035, p.z)));
    const pathEdge = new THREE.Mesh(new THREE.TubeGeometry(edgeCurve, 110, 0.235, 8, false), mat('#8d7d5f'));
    pathEdge.receiveShadow = true;
    scene.add(pathEdge);
  }

  function addRoof(group, width, depth, eave, ridge, roofMaterial, overhang = 0.22) {
    const half = width / 2 + overhang;
    const halfDepth = depth / 2 + overhang;
    const makeSlope = (vertices, indices) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const roof = new THREE.Mesh(geometry, roofMaterial);
      roof.castShadow = true;
      roof.receiveShadow = true;
      group.add(roof);
    };
    makeSlope([
      -half,eave,-halfDepth, 0,ridge,-halfDepth, 0,ridge,halfDepth, -half,eave,halfDepth
    ], [0,1,2,0,2,3]);
    makeSlope([
      0,ridge,-halfDepth, half,eave,-halfDepth, half,eave,halfDepth, 0,ridge,halfDepth
    ], [0,1,2,0,2,3]);
    addBox(group, 0.13, 0.12, depth + overhang * 1.5, roofMaterial, 0, ridge - 0.02, 0);
  }

  function addGableFace(group, width, eave, ridge, z, material) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, eave);
    shape.lineTo(width / 2, eave);
    shape.lineTo(0, ridge);
    shape.closePath();
    const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    face.position.z = z;
    face.castShadow = true;
    group.add(face);
  }

  function addWindow(group, x, y, z, width = 0.42, height = 0.43, rotation = 0) {
    addBox(group, width + 0.1, height + 0.1, 0.065, frameMat, x, y, z, rotation);
    addBox(group, width, height, 0.075, windowMat, x, y, z + (rotation === 0 ? 0.016 : 0), rotation);
    addBox(group, width + 0.16, 0.055, 0.09, frameMat, x, y + height / 2 + 0.045, z + (rotation === 0 ? 0.035 : 0), rotation);
    addBox(group, width + 0.16, 0.055, 0.09, frameMat, x, y - height / 2 - 0.045, z + (rotation === 0 ? 0.035 : 0), rotation);
  }

  function addGableHouse(definition) {
    const {id,x,z,width,depth,height,rise,wallColor,roofColor,woodColor,accentColor='#26352e'} = definition;
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x,z), z);
    group.userData.projectId = id;
    scene.add(group);
    addClearing(x, z, width * 0.78, depth * 0.82);
    const walls = mat(wallColor);
    const roof = mat(roofColor, {roughness:0.78, side:THREE.DoubleSide});
    const wood = mat(woodColor);
    const foundation = mat('#716751');
    const eave = 0.24 + height;
    const ridge = eave + rise;
    addBox(group, width + 0.28, 0.22, depth + 0.28, foundation, 0, 0.11, 0);
    addBox(group, width, height, depth, walls, 0, 0.22 + height / 2, 0);
    addGableFace(group, width, eave, ridge, depth / 2 + 0.006, walls);
    addGableFace(group, width, eave, ridge, -depth / 2 - 0.006, walls);
    addRoof(group, width, depth, eave, ridge, roof);

    const front = depth / 2 + 0.055;
    addBox(group, 0.58, 1.03, 0.075, wood, 0, 0.735, front);
    addBox(group, 0.48, 0.08, 0.11, mat('#d8bd78'), 0, 1.17, front + 0.048);
    addWindow(group, -width * 0.28, 0.22 + height * 0.56, front, 0.4, 0.43);
    addWindow(group, width * 0.28, 0.22 + height * 0.56, front, 0.4, 0.43);

    const porchWidth = Math.min(width * 0.72, 2.2);
    const porchZ = depth / 2 + 0.46;
    addBox(group, porchWidth, 0.13, 0.92, wood, 0, 0.22, porchZ);
    [-porchWidth/2 + .12, porchWidth/2 - .12].forEach(px => {
      addBox(group, 0.09, 1.15, 0.09, wood, px, 0.79, porchZ + 0.27);
    });
    addBox(group, porchWidth, 0.08, 0.1, wood, 0, 1.37, porchZ + 0.27);
    addBox(group, Math.min(0.92, width * 0.42), 0.11, 0.36, foundation, 0, 0.055, depth / 2 + 0.95);

    if (accentColor) {
      const chimney = addBox(group, 0.26, 0.8, 0.26, mat(accentColor), width * 0.28, ridge - 0.05, -depth * 0.19);
      chimney.rotation.z = -0.08;
    }
    const anchorY = ridge + 0.72;
    addFloatingMarker(group, anchorY);
    registerBuilding(id, group, {x, z, y:terrainHeight(x,z) + anchorY});
    return group;
  }

  function addPavilion(definition) {
    const {id,x,z,width,depth} = definition;
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x,z), z);
    scene.add(group);
    addClearing(x, z, width * 0.9, depth * 0.95);
    const wood = mat('#9a7049');
    const darkWood = mat('#674f38');
    const roof = mat('#39473b', {side:THREE.DoubleSide, roughness:0.82});
    addBox(group, width + 0.34, 0.18, depth + 0.34, darkWood, 0, 0.1, 0);
    const columnX = width / 2 - 0.18;
    const columnZ = depth / 2 - 0.18;
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      addBox(group, 0.16, 2.15, 0.16, wood, sx * columnX, 1.25, sz * columnZ);
    }
    addBox(group, width + 0.16, 0.18, 0.18, darkWood, 0, 2.31, -columnZ);
    addBox(group, width + 0.16, 0.18, 0.18, darkWood, 0, 2.31, columnZ);
    addBox(group, 0.18, 0.18, depth + 0.14, darkWood, -columnX, 2.31, 0);
    addBox(group, 0.18, 0.18, depth + 0.14, darkWood, columnX, 2.31, 0);
    addRoof(group, width + 0.08, depth + 0.08, 2.35, 3.18, roof, 0.35);
    addGableFace(group, width + 0.08, 2.35, 3.18, depth / 2 + 0.06, mat('#855d3d', {side:THREE.DoubleSide}));
    addGableFace(group, width + 0.08, 2.35, 3.18, -depth / 2 - 0.06, mat('#855d3d', {side:THREE.DoubleSide}));
    addBox(group, 1.2, 0.12, 0.42, darkWood, 0, 0.83, 0.03);
    addBox(group, 1.35, 0.12, 0.14, wood, 0, 0.54, 0.29);
    addFloatingMarker(group, 3.72);
    registerBuilding(id, group, {x, z, y:terrainHeight(x,z) + 3.72});
    return group;
  }

  function addStudio(definition) {
    const {id,x,z,width,depth} = definition;
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x,z), z);
    scene.add(group);
    addClearing(x,z,width * 0.8,depth * 0.9);
    const wall = mat('#c5c2ab');
    const wood = mat('#79583c');
    const roof = mat('#303b32');
    addBox(group, width + .24, .2, depth + .24, mat('#6e6650'), 0, .1, 0);
    addBox(group, width, 1.65, depth, wall, 0, 1.025, 0);
    addBox(group, width + .35, .2, depth + .35, roof, 0, 1.95, 0);
    const front = depth / 2 + .04;
    addBox(group, 1.35, 1.0, .09, windowMat, .38, 1.05, front);
    addBox(group, .62, 1.13, .1, wood, -.75, .86, front);
    for (let i=0;i<6;i++) addBox(group, .045, .88, .07, wood, -.95 + i*.08, 1.12, front + .055);
    addBox(group, width*.58, .12, .86, wood, .32, .23, depth/2 + .38);
    addFloatingMarker(group, 2.75);
    registerBuilding(id, group, {x,z,y:terrainHeight(x,z)+2.75});
    return group;
  }

  function addFloatingMarker(group, height) {
    const marker = new THREE.Group();
    marker.position.y = height;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.29,0.035,6,24), limeMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.1;
    marker.add(halo);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.04,0.53,7), limeMat);
    stem.position.y = -0.19;
    marker.add(stem);
    group.add(marker);
  }

  function registerBuilding(id, group, anchor) {
    group.userData.projectId = id;
    group.traverse(object => {
      if (!object.isMesh) return;
      object.userData.projectId = id;
      interactiveMeshes.push(object);
    });
    buildings.set(id, group);
    landmarkAnchors.set(id, new THREE.Vector3(anchor.x, anchor.y, anchor.z));
  }

  function distanceToSegment(x,z,a,b) {
    const dx = b[0]-a[0];
    const dz = b[1]-a[1];
    const length = dx*dx + dz*dz || 1;
    const t = THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/length,0,1);
    return Math.hypot(x-(a[0]+t*dx), z-(a[1]+t*dz));
  }

  function createForest() {
    let seed = 20260925;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pineTrees = [];
    const broadTrees = [];
    const clearZones = [
      [-8,-1.8,2.25],[-2.7,-4.8,2.25],[4.25,-3.2,2.75],[6.2,3.3,2.25],[-5,4.3,2.5]
    ];
    for (let attempt=0; attempt<1400 && pineTrees.length+broadTrees.length<142; attempt++) {
      const x = random()*29-14.5;
      const z = random()*21-10.5;
      if (clearZones.some(([bx,bz,r]) => Math.hypot(x-bx,z-bz)<r)) continue;
      let onPath = false;
      for (let i=0;i<pathPoints.length-1;i++) {
        if (distanceToSegment(x,z,pathPoints[i],pathPoints[i+1])<0.92) { onPath=true; break; }
      }
      if (onPath) continue;
      const item = {x,z,y:terrainHeight(x,z),scale:.72+random()*.72,rotation:random()*Math.PI*2};
      if (random()<.22) {
        item.color = random()<.5 ? '#71845b' : '#889363';
        broadTrees.push(item);
      } else {
        item.color = random()<.5 ? '#344b38' : '#40583d';
        pineTrees.push(item);
      }
    }

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scaleVector = new THREE.Vector3();
    const makeInstances = (items, geometry, material, placement) => {
      if (!items.length) return;
      const mesh = new THREE.InstancedMesh(geometry, material, items.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      items.forEach((item,index) => {
        const transform = placement(item);
        quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), item.rotation);
        scaleVector.set(transform.sx,transform.sy,transform.sz);
        matrix.compose(new THREE.Vector3(transform.x,transform.y,transform.z), quaternion, scaleVector);
        mesh.setMatrixAt(index,matrix);
        mesh.setColorAt(index,new THREE.Color(item.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
    };

    const trunkGeometry = new THREE.CylinderGeometry(.075,.13,1,5);
    const pineSmall = new THREE.ConeGeometry(.39,.92,6);
    const pineMedium = new THREE.ConeGeometry(.53,1.03,6);
    const pineLarge = new THREE.ConeGeometry(.68,1.12,6);
    makeInstances(pineTrees,trunkGeometry,trunkMat,t=>({x:t.x,y:t.y+t.scale*.48,z:t.z,sx:t.scale,sy:t.scale,sz:t.scale}));
    makeInstances(pineTrees,pineLarge,pineMat,t=>({x:t.x,y:t.y+t.scale*.78,z:t.z,sx:t.scale,sy:t.scale,sz:t.scale}));
    makeInstances(pineTrees,pineMedium,pineMat,t=>({x:t.x,y:t.y+t.scale*1.24,z:t.z,sx:t.scale*.79,sy:t.scale*.79,sz:t.scale*.79}));
    makeInstances(pineTrees,pineSmall,pineMat,t=>({x:t.x,y:t.y+t.scale*1.68,z:t.z,sx:t.scale*.59,sy:t.scale*.59,sz:t.scale*.59}));

    const broadTrunk = new THREE.CylinderGeometry(.09,.16,1.2,6);
    const crownGeometry = new THREE.IcosahedronGeometry(1,0);
    makeInstances(broadTrees,broadTrunk,trunkMat,t=>({x:t.x,y:t.y+t.scale*.58,z:t.z,sx:t.scale,sy:t.scale,sz:t.scale}));
    const broadItems = broadTrees.flatMap(t => [
      {...t,x:t.x-.23*t.scale,y:t.y+1.35*t.scale,sx:.66*t.scale,sy:.75*t.scale,sz:.65*t.scale},
      {...t,x:t.x+.23*t.scale,y:t.y+1.42*t.scale,sx:.67*t.scale,sy:.78*t.scale,sz:.67*t.scale},
      {...t,y:t.y+1.7*t.scale,sx:.65*t.scale,sy:.72*t.scale,sz:.65*t.scale}
    ]);
    makeInstances(broadItems,crownGeometry,broadMat,t=>({x:t.x,y:t.y,z:t.z,sx:t.sx,sy:t.sy,sz:t.sz}));

    const stones = [];
    for (let i=0;i<46;i++) {
      const x = random()*28-14;
      const z = random()*20-10;
      const closeToBuilding = clearZones.some(([bx,bz,r])=>Math.hypot(x-bx,z-bz)<r+.4);
      if (closeToBuilding) continue;
      stones.push({x,z,y:terrainHeight(x,z),scale:.18+random()*.28,rotation:random()*Math.PI*2,color:random()<.5?'#6c715c':'#82806a'});
    }
    makeInstances(stones,new THREE.DodecahedronGeometry(1,0),mat('#ffffff'),t=>({x:t.x,y:t.y+t.scale*.3,z:t.z,sx:t.scale*1.3,sy:t.scale*.65,sz:t.scale}));
  }

  function buildScene() {
    addGround();
    addPath();
    addPavilion({id:'vlciaren',x:-8,z:-1.8,width:2.7,depth:2.1});
    addGableHouse({id:'maka',x:-2.7,z:-4.8,width:2.35,depth:1.9,height:1.38,rise:.82,wallColor:'#8c603d',woodColor:'#68472f',roofColor:'#303a36',accentColor:'#44392d'});
    addGableHouse({id:'family',x:4.25,z:-3.2,width:3.25,depth:2.45,height:1.63,rise:.87,wallColor:'#dedbc9',woodColor:'#8f7651',roofColor:'#374239',accentColor:'#5f5545'});
    addGableHouse({id:'cabin',x:6.2,z:3.3,width:2.55,depth:2.05,height:1.38,rise:.7,wallColor:'#b07c4f',woodColor:'#704a32',roofColor:'#354439',accentColor:'#524437'});
    addStudio({id:'studio',x:-5,z:4.3,width:3.1,depth:2.4});
    createForest();
  }

  function setCamera() {
    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.x + cameraDistance * sinPhi * Math.sin(theta),
      target.y + cameraDistance * Math.cos(phi),
      target.z + cameraDistance * sinPhi * Math.cos(theta)
    );
    camera.lookAt(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }

  function positionPins() {
    const rect = renderer.domElement.getBoundingClientRect();
    pins.forEach(button => {
      const anchor = landmarkAnchors.get(button.dataset.worldId);
      if (!anchor) return;
      const point = anchor.clone().project(camera);
      const x = (point.x * .5 + .5) * rect.width;
      const y = (-point.y * .5 + .5) * rect.height;
      const visible = point.z >= -1 && point.z <= 1 && x >= 4 && x <= rect.width-4 && y >= 4 && y <= rect.height-4;
      button.hidden = !visible;
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
    });
  }

  function render() {
    setCamera();
    renderer.render(scene,camera);
    positionPins();
  }

  function resize() {
    const width = Math.max(1,viewport.clientWidth);
    const height = Math.max(1,viewport.clientHeight);
    const aspect = width/height;
    const frustumHeight = 15;
    camera.left = -frustumHeight*aspect/2;
    camera.right = frustumHeight*aspect/2;
    camera.top = frustumHeight/2;
    camera.bottom = -frustumHeight/2;
    renderer.setSize(width,height,false);
    camera.updateProjectionMatrix();
    render();
  }

  function selectProject(id) {
    const button = pins.find(pin=>pin.dataset.worldId===id);
    if (!button) return;
    pins.forEach(pin=>{
      const active = pin === button;
      pin.classList.toggle('is-active',active);
      pin.setAttribute('aria-pressed',String(active));
    });
    const index = pins.indexOf(button);
    panelLocation.textContent = button.dataset.location || 'PROJEKT';
    panelCount.textContent = `${String(index+1).padStart(2,'0')} / ${String(pins.length).padStart(2,'0')}`;
    panelTitle.textContent = button.dataset.title || 'Projekt';
    panelDescription.textContent = button.dataset.description || '';
    panelAction.href = button.dataset.href || '#projekty';
    panelAction.innerHTML = `${button.dataset.cta || 'Viac informácií'} <span>↗</span>`;
  }

  function pickBuilding(clientX,clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX-rect.left)/rect.width)*2-1, -((clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits = raycaster.intersectObjects(interactiveMeshes,false);
    if (hits.length) selectProject(hits[0].object.userData.projectId);
  }

  buildScene();
  pins.forEach(button=>{
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>selectProject(button.dataset.worldId));
  });

  const activePointers = new Map();
  let drag = null;
  let pinchDistance = 0;
  const pointerDistance = () => {
    const points = [...activePointers.values()];
    return points.length < 2 ? 0 : Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
  };
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{
    if (event.pointerType==='mouse' && event.button!==0) return;
    activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
    if (activePointers.size===1) drag={id:event.pointerId,x:event.clientX,y:event.clientY,theta,phi,moved:false};
    if (activePointers.size===2) { drag=null; pinchDistance=pointerDistance(); }
  });
  canvas.addEventListener('pointermove',event=>{
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (activePointers.size>=2) {
      const nextDistance=pointerDistance();
      if (pinchDistance>0 && nextDistance>0) zoom=THREE.MathUtils.clamp(zoom*nextDistance/pinchDistance,.78,2.2);
      pinchDistance=nextDistance;
      render();
      return;
    }
    if (!drag) return;
    const dx=event.clientX-drag.x;
    const dy=event.clientY-drag.y;
    if (Math.abs(dx)+Math.abs(dy)>4) drag.moved=true;
    theta=drag.theta-dx*.008;
    phi=THREE.MathUtils.clamp(drag.phi+dy*.007,.42,1.23);
    render();
  });
  const finishPointer=event=>{
    const wasTap=activePointers.size===1 && drag && !drag.moved;
    activePointers.delete(event.pointerId);
    if (wasTap) pickBuilding(event.clientX,event.clientY);
    drag=null;
    if (activePointers.size<2) pinchDistance=0;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup',finishPointer);
  canvas.addEventListener('pointercancel',finishPointer);
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();
    zoom=THREE.MathUtils.clamp(zoom*(event.deltaY<0?1.12:.89),.78,2.2);
    render();
  },{passive:false});

  document.querySelectorAll('[data-map-zoom]').forEach(button=>button.addEventListener('click',()=>{
    zoom=THREE.MathUtils.clamp(zoom*(button.dataset.mapZoom==='in'?1.2:.83),.78,2.2);
    render();
  }));
  document.querySelector('[data-map-reset]')?.addEventListener('click',()=>{
    theta=.58;
    phi=.8;
    zoom=1;
    render();
  });
  window.addEventListener('resize',resize);
  resize();
}
