/**
 * ARCHITECTURE UNBUILT — original demonstration pavilion, not a built project.
 * Metric, independently animated assemblies. Rounded members, actual layers,
 * ventilated cavity, steel shoes and fasteners are modelled as real geometry.
 * No external models, textures or scene globals are loaded by this module.
 */
export function createUnbuiltModel({THREE, materials = {}, quality = 'high'}) {
  const detailed = !['low','mobile','economy'].includes(quality);
  const group = new THREE.Group();
  group.name = 'Architecture Unbuilt / demonstration pavilion';
  group.userData.isDemonstration = true;
  const layerNames = ['foundation','structure','roof','envelope','facade','glazing','terrace'];
  const layers = Object.fromEntries(layerNames.map(name => {
    const assembly = new THREE.Group();
    assembly.name = name;
    assembly.userData.layer = name;
    group.add(assembly);
    return [name, assembly];
  }));
  const resources = new Set();
  const sourceGeometry = new Map();
  const bins = new Map();
  const materialByName = new Map();
  const coverMeshes = [];
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const up = v(0,1,0);
  const technical = new THREE.Group();
  technical.name = 'technical';
  group.add(technical);
  const linePoints = [];
  const axisPoints = [];
  let componentCount = 0;

  // The caller owns source textures. Only the cloned materials and geometries
  // created here are disposed here; this prevents cross-scene texture disposal.
  const fallback = {
    wood: {color:'#bea279',roughness:.64},
    woodDark: {color:'#847159',roughness:.71},
    woodLight: {color:'#d1bb93',roughness:.72},
    metal: {color:'#939995',roughness:.32,metalness:.93},
    metalDark: {color:'#343939',roughness:.39,metalness:.8},
    roof: {color:'#626763',roughness:.64,metalness:.55},
    membrane: {color:'#303737',roughness:.98},
    insulation: {color:'#bcb093',roughness:1},
    concrete: {color:'#99978c',roughness:.97},
    terrace: {color:'#a98b67',roughness:.75},
    technical: {color:'#c7d6cf',roughness:1},
    accent: {color:'#c6a681',roughness:.6}
  };
  function material(name, tint = null, unique = '') {
    const key = `${name}:${tint || ''}:${unique}`;
    if (materialByName.has(key)) return materialByName.get(key);
    let result;
    if (materials[name]?.isMaterial) result = materials[name].clone();
    else if (name === 'glass') result = new THREE.MeshPhysicalMaterial({
      color:'#c5d6d2',roughness:.065,metalness:0,transmission:.65,
      transparent:true,opacity:.72,ior:1.52,thickness:.024,
      clearcoat:1,clearcoatRoughness:.04,side:THREE.DoubleSide,depthWrite:false
    });
    else result = new THREE.MeshStandardMaterial(fallback[name] || fallback.wood);
    if (tint) result.color.multiply(new THREE.Color(tint));
    result.name = `unbuilt-${name}${unique ? `-${unique}` : ''}`;
    result.userData = {...result.userData, baseOpacity:result.opacity ?? 1, assemblyMaterial:name};
    if (['wood','woodDark','woodLight','terrace'].includes(name)) result.userData.woodGrain = true;
    resources.add(result);
    materialByName.set(key,result);
    return result;
  }
  const palette = {
    wood: Array.from({length:5},(_,i)=>material('wood',new THREE.Color().setScalar(.92+i*.018).getStyle())),
    light:material('woodLight'), dark:material('woodDark'),
    steel:material('metal'), black:material('metalDark'), roof:material('roof'),
    membrane:material('membrane'), insulation:material('insulation'),
    concrete:material('concrete'), glass:material('glass'),
    deck:Array.from({length:4},(_,i)=>material('terrace',new THREE.Color().setScalar(.90+i*.025).getStyle())),
    edge:material('accent')
  };
  function grainUV(geometry,w,h,d) {
    const p=geometry.getAttribute('position'), n=geometry.getAttribute('normal');
    const dims=[w,h,d], grain=dims.indexOf(Math.max(...dims));
    const uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++) {
      const values=[p.getX(i),p.getY(i),p.getZ(i)];
      const normals=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
      let transverse=grain===0?1:0;
      for(let j=0;j<3;j++) if(j!==grain && normals[j]<normals[transverse]) transverse=j;
      uv[i*2]=(values[grain]+dims[grain]*.5)/4;
      uv[i*2+1]=(values[transverse]+dims[transverse]*.5)/.19;
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    return geometry;
  }
  function roundedGeometry(w,h,d,bevel=.004,wood=false) {
    const r=Math.min(bevel,w*.13,h*.13,d*.13);
    const key=`rounded:${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}:${r.toFixed(5)}:${wood}`;
    if(sourceGeometry.has(key)) return sourceGeometry.get(key);
    let geometry;
    if(r<.00005) geometry=new THREE.BoxGeometry(w,h,d);
    else {
      const shape=new THREE.Shape();
      const hx=w*.5-r, hy=h*.5-r, corner=r*.42;
      shape.moveTo(-hx+corner,-hy);
      shape.lineTo(hx-corner,-hy);
      shape.quadraticCurveTo(hx,-hy,hx,-hy+corner);
      shape.lineTo(hx,hy-corner);
      shape.quadraticCurveTo(hx,hy,hx-corner,hy);
      shape.lineTo(-hx+corner,hy);
      shape.quadraticCurveTo(-hx,hy,-hx,hy-corner);
      shape.lineTo(-hx,-hy+corner);
      shape.quadraticCurveTo(-hx,-hy,-hx+corner,-hy);
      geometry=new THREE.ExtrudeGeometry(shape,{
        depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,
        bevelSegments:detailed?2:1,curveSegments:detailed?2:1
      });
      geometry.translate(0,0,-d*.5+r);
    }
    if(wood) grainUV(geometry,w,h,d);
    geometry.clearGroups();
    sourceGeometry.set(key,geometry);
    resources.add(geometry);
    return geometry;
  }
  function cylinderGeometry(radius,length,segments=12,open=false) {
    const key=`cylinder:${radius}:${length}:${segments}:${open}`;
    if(sourceGeometry.has(key)) return sourceGeometry.get(key);
    const geometry=new THREE.CylinderGeometry(radius,radius,length,segments,1,open);
    sourceGeometry.set(key,geometry); resources.add(geometry);
    return geometry;
  }
  function pushGeometry(layer,geometry,mat,position,rotation=null,part='') {
    componentCount++;
    const key=`${layer}:${mat.uuid}:${part}`;
    if(!bins.has(key)) bins.set(key,{layer,mat,part,geometries:[]});
    if(rotation?.isQuaternion) quaternion.copy(rotation);
    else quaternion.setFromEuler(new THREE.Euler(...(rotation || [0,0,0])));
    matrix.compose(position,quaternion,v(1,1,1));
    const transformed=geometry.clone();
    // Each board samples a different section of the same licensed timber
    // photograph. Grain still follows the member; knots do not line up in an
    // artificial repeating row across the whole facade or terrace.
    if(mat.userData.woodGrain) {
      const uv=transformed.getAttribute('uv');
      const seed=position.x*47.331+position.y*113.217+position.z*23.771;
      const hash=value=>{const n=Math.sin(value)*43758.5453;return n-Math.floor(n);};
      const uOffset=hash(seed+.731),vOffset=hash(seed+18.319)*.69;
      const mirror=hash(seed+3.17)>.5?-1:1;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*mirror+uOffset,uv.getY(i)+vOffset);
    }
    transformed.applyMatrix4(matrix);
    bins.get(key).geometries.push(transformed);
  }
  function box(layer,w,h,d,mat,x,y,z,rotation=null,bevel=.004,part='') {
    pushGeometry(layer,roundedGeometry(w,h,d,bevel,!!mat.userData.woodGrain),mat,v(x,y,z),rotation,part);
  }
  function beam(layer,a,b,width,depth,mat,part='') {
    direction.subVectors(b,a);
    quaternion.setFromUnitVectors(up,direction.clone().normalize());
    pushGeometry(layer,roundedGeometry(width,direction.length(),depth,.0035,!!mat.userData.woodGrain),mat,a.clone().add(b).multiplyScalar(.5),quaternion,part);
  }
  function cylinder(layer,r,length,mat,a,b,segments=12,part='') {
    direction.subVectors(b,a);
    quaternion.setFromUnitVectors(up,direction.clone().normalize());
    pushGeometry(layer,cylinderGeometry(r,length,segments),mat,a.clone().add(b).multiplyScalar(.5),quaternion,part);
  }
  function bolt(layer,x,y,z,axis='z',diameter=.022,length=.07,part='') {
    const half=axis==='x'?v(length*.5,0,0):axis==='y'?v(0,length*.5,0):v(0,0,length*.5);
    const center=v(x,y,z);
    cylinder(layer,diameter*.5,length,palette.steel,center.clone().sub(half),center.clone().add(half),detailed?12:8,part);
    const end=center.clone().add(half);
    const headVec=half.clone().normalize().multiplyScalar(.007);
    cylinder(layer,diameter*.89,.014,palette.steel,end.clone(),end.clone().add(headVec.multiplyScalar(2)),6,part);
    const washer=end.clone().sub(half.clone().normalize().multiplyScalar(.004));
    const washerVec=half.clone().normalize().multiplyScalar(.0017);
    cylinder(layer,diameter*1.05,.0034,palette.steel,washer.clone().sub(washerVec),washer.clone().add(washerVec),detailed?16:8,part);
  }
  function line(a,b,array=linePoints) { array.push(a.x,a.y,a.z,b.x,b.y,b.z); }
  function outlineBox(x,y,z,w,h,d) {
    const points=[];
    for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]) points.push(v(x+sx*w*.5,y+sy*h*.5,z+sz*d*.5));
    for(let i=0;i<8;i++)for(let j=i+1;j<8;j++) {
      let diff=0; for(const axis of ['x','y','z']) if(points[i][axis]!==points[j][axis]) diff++;
      if(diff===1)line(points[i],points[j]);
    }
  }
  function dimension(a,b,tickDirection,tick=.09) {
    line(a,b,axisPoints);
    for(const endpoint of [a,b]) line(endpoint.clone().addScaledVector(tickDirection,-tick),endpoint.clone().addScaledVector(tickDirection,tick),axisPoints);
  }

  // A low foundation is expressed as independent piers and a suspended floor,
  // rather than visually burying the timber into a monolithic ground slab.
  const postXs=[-4.32,-1.44,1.44,4.32];
  const postZs=[-2.32,2.32];
  for(const x of postXs)for(const z of postZs) {
    box('foundation',.62,.18,.62,palette.concrete,x,.005,z,null,.017);
    box('foundation',.36,.24,.36,palette.concrete,x,.215,z,null,.008);
    box('foundation',.31,.014,.31,palette.steel,x,.343,z,null,.0018);
    // Two U-shoe plates keep the end grain above the concrete and ventilated.
    for(const s of [-1,1]) {
      box('foundation',.012,.25,.22,palette.steel,x+s*.113,.465,z,null,.0015);
      for(const dy of [-.062,.062])bolt('foundation',x+s*.112,.477+dy,z,'x',.019,.07);
    }
    box('foundation',.2,.014,.22,palette.steel,x,.354,z,null,.0015);
    for(const sx of [-.113,.113])for(const sz of [-.113,.113]) bolt('foundation',x+sx,.358,z+sz,'y',.019,.063);
  }
  // Steel perimeter and regularly spaced floor joists support the floor panels.
  for(const z of postZs)box('foundation',8.92,.14,.095,palette.black,0,.38,z,null,.0025);
  for(let i=0;i<=12;i++)box('foundation',.075,.14,4.7,palette.black,-4.32+i*.72,.38,0,null,.002);
  box('foundation',8.95,.036,4.95,palette.dark,0,.466,0,null,.002);
  const floorRows=33;
  for(let i=0;i<floorRows;i++)box('foundation',8.9,.022,4.9/floorRows-.0028,palette.wood[i%5],0,.495,-2.45+(i+.5)*4.9/floorRows,null,.0012);
  // An integrated bench makes the pavilion scale legible without staged people.
  box('foundation',6.2,.07,.47,palette.light,.30,.93,-1.92,null,.009);
  for(const x of [-2.5,.4,3.1])for(const z of [-2.08,-1.76])box('foundation',.035,.35,.035,palette.black,x,.72,z,null,.003);
  for(let i=0;i<6;i++)box('foundation',6.2,.105,.03,palette.wood[i%5],.30,1.05+i*.11,-2.13,null,.003);

  // Primary glulam grid. Eight posts carry longitudinal edge beams; seven
  // transverse rafters span the five-metre depth. Joints use concealed plates.
  for(const x of postXs)for(const z of postZs) {
    const top=3.115+z*.028;
    box('structure',.20,top-.36,.20,palette.wood[(postXs.indexOf(x)+1)%5],x,(top+.36)*.5,z,null,.0055);
    outlineBox(x,(top+.36)*.5,z,.20,top-.36,.20);
  }
  for(const z of postZs) {
    const y=3.065+z*.028;
    box('structure',8.9,.36,.22,palette.wood[z<0?1:3],0,y,z,null,.005);
    outlineBox(0,y,z,8.9,.36,.22);
  }
  for(const x of [-4.32,4.32])beam('structure',v(x,3.08,-2.43),v(x,3.216,2.43),.18,.28,palette.wood[2]);
  for(let i=0;i<8;i++) {
    const x=-4.34+i*1.24;
    beam('structure',v(x,3.09,-2.62),v(x,3.237,2.62),.12,.28,palette.wood[i%5]);
    // Flush bent plate hangers at each supporting beam.
    for(const z of postZs) {
      const y=3.06+z*.028;
      box('structure',.145,.012,.11,palette.steel,x,y-.10,z,null,.0008);
      for(const side of [-1,1]) {
        box('structure',.007,.19,.10,palette.steel,x+side*.064,y-.008,z,null,.0007);
        if(detailed || i%2===0)for(const dy of [-.046,.044])bolt('structure',x+side*.066,y+dy,z,'x',.010,.029);
      }
    }
  }
  // Lateral stability is concealed in the two solid elevations, not improvised
  // as diagonal props crossing the transparent frontage.
  for(const bay of [[-4.32,-1.44],[-1.44,1.44],[1.44,4.32]]) {
    beam('structure',v(bay[0]+.16,.62,-2.32),v(bay[1]-.16,2.86,-2.32),.085,.07,palette.dark);
    beam('structure',v(bay[0]+.16,2.86,-2.32),v(bay[1]-.16,.62,-2.32),.055,.045,palette.dark);
  }
  beam('structure',v(-4.32,.64,-2.12),v(-4.32,2.82,2.10),.09,.065,palette.dark);
  // Every exposed beam/post connection receives real steel hardware.
  for(const x of postXs)for(const z of postZs) {
    const y=3.055+z*.028;
    for(const side of [-1,1]) {
      box('structure',.29,.19,.010,palette.steel,x,y-.032,z+side*.116,null,.0015);
      for(const dx of [-.082,.082])for(const dy of [-.047,.047])bolt('structure',x+dx,y+dy-.032,z+side*.12,'z',.014,.028);
    }
  }
  // Substructure studs align with the insulation module. End stud is revealed
  // in the detail, while the complete solid walls remain fully closed initially.
  for(let i=0;i<=15;i++)box('structure',.055,2.53,.145,palette.wood[i%5],-4.38+i*.584,.50+2.53*.5,-2.365,null,.002);
  for(let i=0;i<=8;i++)box('structure',.145,2.53,.055,palette.wood[i%5],-4.365,1.765,-2.36+i*.59,null,.002);

  // Roof assembly remains independently addressable by named subgroups. This
  // is a warm roof with visible OSB deck, insulation, waterproofing and seamed
  // metal finish. All normals and the real roof fall follow +z upward.
  function roofPanel(name,y,thickness,mat,w=9.55,d=5.64) {
    const part=`roof:${name}`;
    box('roof',w,thickness,d,mat,0,y,0,[-Math.atan(.028),0,0],.003,part);
  }
  roofPanel('timber-deck',3.275,.044,palette.light);
  roofPanel('vapour-control',3.302,.009,palette.membrane);
  roofPanel('rigid-insulation',3.365,.115,palette.insulation,9.49,5.58);
  roofPanel('waterproof-layer',3.431,.012,palette.membrane);
  roofPanel('standing-seam-cover',3.458,.016,palette.roof);
  for(let i=0;i<=18;i++)beam('roof',v(-4.72+i*.524,3.385,-2.84),v(-4.72+i*.524,3.543,2.84),.014,.031,palette.roof,'roof:seams');
  for(const x of [-4.76,4.76]) {
    beam('roof',v(x,3.324,-2.85),v(x,3.484,2.85),.036,.15,palette.roof,'roof:flashing');
    beam('roof',v(x,3.237,-2.86),v(x,3.397,2.86),.021,.034,palette.black,'roof:flashing');
  }
  for(const z of [-2.835,2.835]) {
    box('roof',9.57,.147,.035,palette.roof,0,3.405+z*.028,z,null,.003,'roof:flashing');
    box('roof',9.57,.026,.064,palette.black,0,3.32+z*.028,z-.015,null,.002,'roof:flashing');
  }
  // Folded rear gutter with drain connection: a shallow U channel with a real
  // opening reads correctly from above and in the final three-quarter shot.
  box('roof',9.48,.014,.15,palette.roof,0,3.228,-2.88,null,.001,'roof:drainage');
  for(const z of [-2.958,-2.815])box('roof',9.49,.075,.013,palette.roof,0,3.259,z,null,.001,'roof:drainage');
  cylinder('roof',.044,2.77,palette.roof,v(4.57,.38,-2.89),v(4.57,3.15,-2.89),detailed?16:10,'roof:drainage');
  for(const y of [.65,1.65,2.65])box('roof',.104,.02,.074,palette.black,4.57,y,-2.85,null,.001,'roof:drainage');

  // Solid envelope: interior lining / 145 mm timber-fibre insulation /
  // windproof membrane. North wall and west wall are separately oriented.
  const wallBottom=.51,wallTop=3.025,wallH=wallTop-wallBottom,wallY=(wallTop+wallBottom)*.5;
  box('envelope',8.9,wallH,.019,palette.light,0,wallY,-2.27,null,.001);
  for(let i=0;i<15;i++)box('envelope',.527,wallH,.145,palette.insulation,-4.09+i*.584,wallY,-2.373,null,.001);
  box('envelope',8.96,wallH,.008,palette.membrane,0,wallY,-2.454,null,.0003);
  // West wall detail uses staggered endings near the southern corner. The
  // individual cover pieces close the gaps for all other storytelling stages.
  const westLayers=[
    {name:'lining',x:-4.272,t:.019,mat:palette.light,end:2.41},
    {name:'insulation',x:-4.370,t:.145,mat:palette.insulation,end:2.25},
    {name:'membrane',x:-4.454,t:.008,mat:palette.membrane,end:2.03}
  ];
  for(const layer of westLayers) {
    const z0=-2.45,mainLength=layer.end-z0;
    box('envelope',layer.t,wallH,mainLength,layer.mat,layer.x,wallY,(layer.end+z0)*.5,null,.0007);
    if(layer.end<2.45) {
      const coverMat=material(layer.mat.userData.assemblyMaterial,null,`cutaway-${layer.name}`);
      box('envelope',layer.t,wallH,2.45-layer.end,coverMat,layer.x,wallY,(2.45+layer.end)*.5,null,.0007,`cover:${layer.name}`);
    }
  }
  // Mineral-fibre seams and timber-grain lining board joints are genuine edges.
  for(let i=1;i<15;i++)box('envelope',.002,wallH,.006,palette.dark,-4.38+i*.584,wallY,-2.257,null,.0001);

  // Ventilated facade: vertical battens preserve a continuous 40 mm cavity.
  // Open bottom/top slot with perforated insect mesh is visibly expressed.
  for(let i=0;i<=15;i++)box('facade',.045,wallH,.04,palette.dark,-4.38+i*.584,wallY,-2.485,null,.002);
  for(let i=0;i<=8;i++) {
    const z=-2.35+i*.59;
    box('facade',.04,wallH,.045,palette.dark,-4.485,wallY,z,null,.002,z>1.75?'cover:batten':'');
  }
  const boardPitch=.136;
  const northCount=Math.floor(9.02/boardPitch);
  for(let i=0;i<northCount;i++) {
    const x=-4.49+(i+.5)*9.02/northCount;
    box('facade',9.02/northCount-.011,wallH+.045,.028,palette.wood[(i*3)%5],x,wallY-.003,-2.523,null,.003);
    // Stainless countersunk fixing dots remain restrained at normal distance.
    if(detailed && i%2===0)for(const y of [.79,1.65,2.62])cylinder('facade',.0032,.003,palette.black,v(x,y,-2.54),v(x,y,-2.543),8);
  }
  const westCount=Math.floor(4.98/boardPitch);
  for(let i=0;i<westCount;i++) {
    const z=-2.47+(i+.5)*4.98/westCount;
    const cover=z>1.74;
    const mat=cover?material('wood',new THREE.Color().setScalar(.92+(i%5)*.018).getStyle(),`cutaway-board-${i}`):palette.wood[(i*2)%5];
    box('facade',.028,wallH+.045,4.98/westCount-.011,mat,-4.523,wallY-.003,z,null,.003,cover?`cover:board-${i}`:'');
    if(detailed && !cover)for(const y of [.79,1.65,2.62])cylinder('facade',.0032,.003,palette.black,v(-4.54,y,z),v(-4.543,y,z),8);
  }
  for(const y of [.53,2.985]) {
    box('facade',9.03,.035,.046,palette.black,0,y,-2.489,null,.001);
    box('facade',.046,.035,4.98,palette.black,-4.489,y,0,null,.001);
    if(detailed) {
      for(let i=0;i<90;i++)box('facade',.030,.013,.0014,palette.steel,-4.44+i*.099,y,-2.514,null,0);
      for(let i=0;i<48;i++)box('facade',.0014,.013,.030,palette.steel,-4.514,y,-2.35+i*.10,null,0);
    }
  }
  // Floating metal corner cover is independent of the lining behind it.
  box('facade',.044,wallH+.07,.044,palette.black,-4.542,wallY,-2.542,null,.002);

  // Front and east curtain-wall, with separate profiles, caps, gaskets, sill,
  // double pane edges and two real sliding panels. No opaque fake windows.
  const glassBottom=.53,glassTop=2.875,glassY=(glassBottom+glassTop)*.5;
  function mullion(x,z,width=.055,side=false) {
    box('glazing',side?.13:width,glassTop-glassBottom+.16,side?width:.13,palette.black,x,glassY,z,null,.0025);
    if(detailed)box('glazing',side?.006:width*.75,glassTop-glassBottom+.13,side?width*.75:.006,palette.steel,x+(side?.069:0),glassY,z+(side?0:.069),null,.001);
  }
  const frontEdges=[-4.26,-2.86,-1.44,0,1.44,2.86,4.26];
  for(const x of frontEdges)mullion(x,2.393);
  for(const y of [glassBottom-.025,glassTop+.025])box('glazing',8.58,.059,.14,palette.black,0,y,2.393,null,.0025);
  for(let i=0;i<frontEdges.length-1;i++) {
    const left=frontEdges[i]+.031,right=frontEdges[i+1]-.031,slide=i===3 || i===4;
    const paneZ=2.409+(slide?.035:0);
    box('glazing',right-left,glassTop-glassBottom-.025,.018,palette.glass,(left+right)*.5,glassY,paneZ,null,.0015);
    if(detailed) {
      box('glazing',right-left,.003,.023,palette.steel,(left+right)*.5,glassTop-.027,paneZ,null,.0004);
      box('glazing',right-left,.003,.023,palette.steel,(left+right)*.5,glassBottom+.027,paneZ,null,.0004);
    }
    if(slide) {
      for(const x of [left+.014,right-.014])box('glazing',.031,glassTop-glassBottom,.06,palette.black,x,glassY,paneZ,null,.002);
      box('glazing',.025,.35,.025,palette.steel,right-.058,1.57,paneZ+.055,null,.005);
      cylinder('glazing',.0105,.065,palette.steel,v(right-.058,1.74,paneZ+.023),v(right-.058,1.74,paneZ+.088),12);
      cylinder('glazing',.0105,.065,palette.steel,v(right-.058,1.40,paneZ+.023),v(right-.058,1.40,paneZ+.088),12);
    }
  }
  const sideEdges=[-2.26,-.75,.75,2.26];
  for(const z of sideEdges)mullion(4.393,z,.055,true);
  for(const y of [glassBottom-.025,glassTop+.025])box('glazing',.14,.059,4.61,palette.black,4.393,y,0,null,.0025);
  for(let i=0;i<sideEdges.length-1;i++)box('glazing',.018,glassTop-glassBottom-.025,sideEdges[i+1]-sideEdges[i]-.064,palette.glass,4.409,glassY,(sideEdges[i]+sideEdges[i+1])*.5,null,.0015);
  box('glazing',8.72,.018,.21,palette.roof,0,.512,2.463,null,.002);
  box('glazing',.21,.018,4.75,palette.roof,4.463,.512,0,null,.002);
  // Rails and weather seals are visible beneath the door leaves.
  for(const z of [2.38,2.44,2.50])box('glazing',4.31,.009,.016,palette.steel,1.40,.54,z,null,.001);
  for(const z of [2.365,2.426])box('glazing',8.55,.018,.008,palette.membrane,0,2.868,z,null,.0005);

  // L-shaped terrace boards with open 6 mm joints, independent support frame,
  // hidden clips, ventilated fascia and two broad access steps.
  const deckWidth=11.18,deckCenter=.55,deckFront=4.58,deckRear=2.49,deckTop=.50;
  const frontRows=14;
  for(let i=0;i<frontRows;i++) {
    const z=deckRear+(i+.5)*(deckFront-deckRear)/frontRows;
    box('terrace',deckWidth,.036,(deckFront-deckRear)/frontRows-.006,palette.deck[i%4],deckCenter,deckTop-.018,z,null,.0025);
  }
  const sideRows=35;
  for(let i=0;i<sideRows;i++) {
    const z=-2.45+(i+.5)*4.93/sideRows;
    box('terrace',1.5,.036,4.93/sideRows-.006,palette.deck[(i+1)%4],5.39,deckTop-.018,z,null,.0025);
  }
  for(let i=0;i<=14;i++)box('terrace',.052,.13,2.09,palette.dark,-4.97+i*(11.02/14),.37,3.535,null,.003);
  for(let i=0;i<=5;i++)box('terrace',1.52,.13,.052,palette.dark,5.39,.37,-2.3+i*.94,null,.003);
  for(const z of [2.78,4.39])box('terrace',deckWidth,.14,.065,palette.black,deckCenter,.258,z,null,.002);
  for(const z of [-2.28,0,2.28])box('terrace',1.53,.13,.06,palette.black,5.39,.258,z,null,.002);
  for(const x of [-4.62,-1.40,1.82,4.78])for(const z of [2.80,4.37]) {
    box('terrace',.15,.025,.15,palette.steel,x,.125,z,null,.002);
    cylinder('terrace',.019,.105,palette.steel,v(x,.139,z),v(x,.244,z),12);
    cylinder('terrace',.037,.011,palette.black,v(x,.242,z),v(x,.253,z),12);
  }
  for(const z of [-2.26,0,2.26]) {
    box('terrace',.15,.025,.15,palette.steel,5.58,.125,z,null,.002);
    cylinder('terrace',.019,.105,palette.steel,v(5.58,.139,z),v(5.58,.244,z),12);
  }
  box('terrace',deckWidth+.01,.135,.025,palette.deck[1],deckCenter,.386,4.594,null,.0025);
  box('terrace',.025,.135,7.08,palette.deck[2],6.151,.386,1.065,null,.0025);
  for(let step=0;step<2;step++) {
    const top=.17+step*.145,z=5.13-step*.31;
    for(let row=0;row<2;row++)box('terrace',2.8,.034,.143,palette.deck[(row+step)%4],.75,top-.017,z+(row-.5)*.15,null,.0025);
    box('terrace',2.8,.13,.021,palette.deck[2],.75,top-.081,z+.158,null,.002);
    for(const x of [-.43,.75,1.93])box('terrace',.064,top-.052,.25,palette.black,x,(top-.052)*.5+.02,z,null,.002);
  }
  if(detailed)for(let i=0;i<14;i++)for(const x of [-4.55,-1.42,1.71,4.82]) {
    const z=deckRear+(i+.5)*(deckFront-deckRear)/14;
    cylinder('terrace',.0024,.0015,palette.steel,v(x,deckTop+.0004,z),v(x,deckTop+.0019,z),8);
  }

  // Extra exposed fasteners in the close-up: membrane lap/tape, rivets,
  // batten screws, sill flashing and a recessed metal post shoe remain actual
  // geometry rather than drawn-on technical decoration.
  box('envelope',.003,wallH,.052,palette.membrane,-4.459,wallY,1.49,null,.0003);
  for(const y of [.73,1.37,2.04,2.70])bolt('facade',-4.487,y,1.68,'x',.007,.04);
  box('facade',.070,.025,.22,palette.roof,-4.489,.527,2.28,null,.001);
  box('facade',.016,.045,.22,palette.black,-4.52,.519,2.28,null,.001);

  // Genuine world-space technical geometry: frame edges, axes, roof slope,
  // floor perimeter and dimension ticks. The scene can progressively reveal
  // any LineSegments by changing drawRange in pairs, without texture text.
  outlineBox(0,.477,0,9,.048,5);
  outlineBox(0,3.387,0,9.55,.22,5.64);
  for(const x of postXs)line(v(x,0,-3.10),v(x,0,3.12),axisPoints);
  for(const z of postZs)line(v(-5.12,0,z),v(5.12,0,z),axisPoints);
  dimension(v(-4.5,.015,3.08),v(4.5,.015,3.08),v(0,0,1));
  dimension(v(-5.03,.015,-2.5),v(-5.03,.015,2.5),v(1,0,0));
  dimension(v(-5.1,.5,2.5),v(-5.1,3.5,2.5),v(1,0,0));
  for(const x of [-4.5,4.5])line(v(x,.015,2.6),v(x,.015,3.24),axisPoints);
  for(const z of [-2.5,2.5])line(v(-4.62,.015,z),v(-5.2,.015,z),axisPoints);
  // Leader lines within the facade close-up are a separate group so a story can
  // show labels precisely in stage four without adding clutter to the outline.
  const detailLinePoints=[];
  const detailLabels=[
    {id:'cladding',text:'Drevený obklad · 28 mm',position:v(-4.55,2.55,1.60)},
    {id:'cavity',text:'Odvetraná medzera · 40 mm',position:v(-4.49,2.10,1.81)},
    {id:'membrane',text:'Difúzne otvorená membrána',position:v(-4.455,1.70,2.04)},
    {id:'insulation',text:'Drevovláknitá izolácia · 145 mm',position:v(-4.38,1.20,2.25)},
    {id:'anchor',text:'Oceľová pätka · odvetrané uloženie',position:v(-4.32,.43,2.32)}
  ];
  for(const label of detailLabels)line(label.position,label.position.clone().add(v(-.28,.055,.21)),detailLinePoints);

  // Consolidate each independent assembly by material. Geometry is already in
  // model space, therefore assembly origins stay zero for predictable explode.
  let triangles=0,drawCalls=0;
  const roofSubgroups=new Map();
  for(const bin of bins.values()) {
    let count=0;
    const flat=bin.geometries.map(geometry=>{
      const result=geometry.index?geometry.toNonIndexed():geometry;
      count+=result.getAttribute('position').count;
      return result;
    });
    const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
    let cursor=0;
    for(let i=0;i<flat.length;i++) {
      const geom=flat[i],p=geom.getAttribute('position'),n=geom.getAttribute('normal'),uv=geom.getAttribute('uv');
      positions.set(p.array,cursor*3); normals.set(n.array,cursor*3);
      if(uv)uvs.set(uv.array,cursor*2);
      cursor+=p.count;
      if(geom!==bin.geometries[i])geom.dispose();
      bin.geometries[i].dispose();
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    resources.add(geometry);
    const mesh=new THREE.Mesh(geometry,bin.mat);
    mesh.name=bin.part || `${bin.layer}:${bin.mat.name}`;
    mesh.userData.layer=bin.layer;
    mesh.castShadow=bin.mat!==palette.glass;
    mesh.receiveShadow=true;
    let parent=layers[bin.layer];
    if(bin.part.startsWith('roof:')) {
      if(!roofSubgroups.has(bin.part)) {
        const sub=new THREE.Group(); sub.name=bin.part; sub.userData.layer='roof';
        layers.roof.add(sub); roofSubgroups.set(bin.part,sub);
      }
      parent=roofSubgroups.get(bin.part);
    }
    parent.add(mesh);
    if(bin.part.startsWith('cover:')) {
      mesh.userData.cutawayCover=true;
      mesh.userData.baseOpacity=bin.mat.opacity;
      // Batten cover deliberately receives its own material so a detail fade
      // never makes all other battens transparent.
      if(bin.part==='cover:batten') {
        mesh.material=bin.mat.clone(); resources.add(mesh.material);
      }
      coverMeshes.push(mesh);
    }
    triangles+=count/3; drawCalls++;
  }
  function technicalLines(name,points,color,opacity) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false});
    mat.name=`technical-${name}`; mat.userData.baseOpacity=opacity;
    const lines=new THREE.LineSegments(geometry,mat);
    lines.name=name; lines.userData.originalCount=geometry.getAttribute('position').count;
    lines.renderOrder=2; technical.add(lines);
    resources.add(geometry);resources.add(mat);
    return lines;
  }
  technicalLines('outlines',linePoints,'#c6d1ca',.62);
  technicalLines('axes-and-dimensions',axisPoints,'#a38a6a',.40);
  const detailLines=technicalLines('detail-leaders',detailLinePoints,'#d0bc99',.72);
  detailLines.visible=false;
  const anchors = {
    foundation:v(-2.6,.27,2.55),structure:v(-3.35,2.25,2.32),
    roof:v(1.35,3.55,-.25),envelope:v(-4.43,1.9,.5),
    facade:v(-4.55,1.5,1.65),glazing:v(2.1,1.70,2.45),
    terrace:v(1.8,.50,4.1)
  };
  const detail = {
    target:v(-4.50,1.55,2.10),direction:v(-.85,.18,.65).normalize(),
    labels:detailLabels,coverMeshes,lines:detailLines,
    setCutaway(amount) {
      const value=THREE.MathUtils.clamp(typeof amount==='boolean'?(amount?1:0):amount,0,1);
      for(const mesh of coverMeshes) {
        mesh.visible=value<.995;
        const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        for(const mat of mats) {
          mat.transparent=true;
          mat.opacity=(mesh.userData.baseOpacity??1)*(1-value);
          mat.depthWrite=value<.02;
        }
      }
      detailLines.visible=value>.05;
      detailLines.material.opacity=.72*value;
    }
  };
  const stats={drawCalls,triangles:Math.round(triangles),components:componentCount,
    layers:layerNames.length,roofAssemblies:roofSubgroups.size,
    model:'Original metric demonstration pavilion; 9 × 5 m',
    source:'Parametric bevelled architectural geometry, not an imported project model'};
  group.userData.stats=stats;
  let disposed=false;
  return {group,layers,technical,detail,anchors,stats,dispose(){
    if(disposed)return;disposed=true;
    for(const item of resources)item.dispose();
    group.removeFromParent();
  }};
}
