/**
 * Architecture remains separate from the landscape. The two named projects use
 * the supplied construction drawings; the other three retain their old massing.
 * Dimensioned references: Vlčiareň side elevation and Maka 4.06m floor drawing.
 */
export const buildingDefinitions = [
  {id:'vlciaren', x:-20.8, z:-4.68, radius:7.1, height:5.6, kind:'pavilion'},
  {id:'maka', x:-7.02, z:-12.48, radius:4.7, height:6.0, kind:'shelter'},
  {id:'family', x:11.05, z:-8.32, radius:6.4, height:7.12, kind:'house', width:8.45, depth:6.37, eave:4.86, rise:2.26, white:true},
  {id:'cabin', x:16.12, z:8.58, radius:5.5, height:6.03, kind:'house', width:6.63, depth:5.33, eave:4.21, rise:1.82},
  {id:'studio', x:-13, z:11.18, radius:6.5, height:5.3, kind:'studio'},
];

export function createBuildings({THREE, scene, materials, terrainHeight}) {
  const buildings = new Map();
  const anchors = new Map();
  const interactiveMeshes = [];
  const boxGeometry = new THREE.BoxGeometry(1,1,1);
  const resources = new Set([boxGeometry]);
  const up = new THREE.Vector3(0,1,0);
  const tempDirection = new THREE.Vector3();
  const contactTexture = makeContactTexture();

  function material(base, color) {
    const value = base.clone();
    if(color) value.color.set(color);
    value.emissive = new THREE.Color(0x000000);
    value.emissiveIntensity = 0;
    if(base===materials.wood)value.userData.woodGrain=true;
    resources.add(value);
    return value;
  }
  function palette() {
    return {
      wood: Array.from({length:6},(_,i)=>material(materials.wood,new THREE.Color('#fff4e3').multiplyScalar(.84+i*.031))),
      dark: material(materials.wood,'#a6a08f'),
      roof: material(materials.metal,'#494e4c'),
      steel: material(materials.metal,'#636967'),
      wall: material(materials.plaster,'#d8d3c5'),
      concrete: material(materials.rock,'#aaa89d'),
      glass: material(materials.glass),
      interior: new THREE.MeshStandardMaterial({color:'#222622',roughness:.92}),
    };
  }
  function box(group,w,h,d,mat,x,y,z,rotation=0) {
    const mesh = new THREE.Mesh(boxGeometry,mat);
    mesh.scale.set(w,h,d);
    mesh.position.set(x,y,z);
    mesh.rotation.y=rotation;
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  }
  function beam(group,a,b,w,d,mat) {
    tempDirection.subVectors(b,a);
    const mesh=box(group,w,tempDirection.length(),d,mat,0,0,0);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(up,tempDirection.normalize());
    return mesh;
  }
  function quad(group,points,mat) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
    geometry.setIndex([0,2,1,0,3,2]);
    geometry.computeVertexNormals();
    resources.add(geometry);
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  }
  function gable(group,width,eave,ridge,z,mat,back=false) {
    const geometry=new THREE.BufferGeometry();
    const points=[-width/2,eave,z,width/2,eave,z,0,ridge,z];
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));
    geometry.setIndex(back?[0,2,1]:[0,1,2]);
    geometry.computeVertexNormals();
    resources.add(geometry);
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
  }
  function planks(group,w,h,depth,y,mats,z,spacing=.235,rotation=0) {
    const n=Math.ceil(w/spacing);
    for(let i=0;i<n;i++) {
      const x=-w/2+(i+.5)*w/n;
      const mesh=box(group,w/n-.008,h,depth,mats[i%mats.length],x,y,z,rotation);
      if(rotation) mesh.position.set(z,y,x);
    }
  }
  function deck(group,w,d,y,mats,z=0) {
    const n=Math.ceil(d/.16);
    for(let i=0;i<n;i++) box(group,w,.09,d/n-.007,mats[i%mats.length],0,y,z-d/2+(i+.5)*d/n);
  }
  function windowFrame(group,x,y,z,w,h,p,rotation=0) {
    const paneGroup=new THREE.Group();
    paneGroup.position.set(x,y,z);
    paneGroup.rotation.y=rotation;
    group.add(paneGroup);
    box(paneGroup,w+.14,h+.14,.08,p.interior,0,0,-.055);
    box(paneGroup,w,h,.017,p.glass,0,0,.001);
    box(paneGroup,.07,h+.18,.08,p.dark,-w/2-.035,0,.025);
    box(paneGroup,.07,h+.18,.08,p.dark,w/2+.035,0,.025);
    box(paneGroup,w+.18,.07,.08,p.dark,0,h/2+.035,.025);
    box(paneGroup,w+.2,.045,.16,p.steel,0,-h/2-.04,.07);
  }
  function roof(group,w,d,eave,ridge,p,wooden=false) {
    const half=w/2+.25, hd=d/2+.28;
    const roofMat=wooden?p.dark:p.roof;
    quad(group,[[-half,eave,-hd],[0,ridge,-hd],[0,ridge,hd],[-half,eave,hd]],roofMat);
    quad(group,[[0,ridge,-hd],[half,eave,-hd],[half,eave,hd],[0,ridge,hd]],roofMat);
    const vector=(x,y,z)=>new THREE.Vector3(x,y,z);
    for(const side of [-1,1]) {
      for(const end of [-hd,hd]) beam(group,vector(side*half,eave-.04,end),vector(0,ridge-.04,end),.11,.10,p.dark);
      box(group,.08,.13,hd*2,p.dark,side*half,eave-.065,0);
    }
    box(group,.15,.085,d+.62,p.dark,0,ridge+.018,0);
    // Standing seams / overlapping timber laths follow the actual roof slope.
    const rows=Math.ceil((2*hd)/(wooden?.16:.56));
    for(let i=0;i<=rows;i++) {
      const z=-hd+i*(2*hd)/rows;
      for(const side of [-1,1]) beam(group,vector(side*half,eave+.025,z),vector(0,ridge+.025,z),wooden?.13:.019,wooden?.047:.027,wooden?p.wood[i%6]:p.roof);
    }
    if(!wooden) {
      for(const side of [-1,1]) {
        const gutter=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,d+.65,12,1,true),p.steel);
        gutter.rotation.x=Math.PI/2;
        gutter.position.set(side*(half+.025),eave-.08,0);
        gutter.castShadow=true;group.add(gutter);
        box(group,.085,eave-.2,.085,p.steel,side*(half-.11),(eave-.2)/2,d/2-.08);
      }
    }
  }
  function addHouse(def,p,group) {
    const w=def.width,d=def.depth,e=def.eave,r=e+def.rise,base=.55;
    box(group,w+.13,.42,d+.13,p.concrete,0,.22,0);
    box(group,w,e-base,d,p.wall,0,base+(e-base)/2,0);
    if(!def.white) {
      planks(group,w,e-base,.09,base+(e-base)/2,p.wood,d/2+.047);
      planks(group,w,e-base,.09,base+(e-base)/2,p.wood,-d/2-.047);
      for(const side of [-1,1]) {
        for(let i=0;i<Math.ceil(d/.23);i++) {
          const z=-d/2+(i+.5)*d/Math.ceil(d/.23);
          box(group,.08,e-base,d/Math.ceil(d/.23)-.008,p.wood[(i+2)%6],side*(w/2+.037),base+(e-base)/2,z);
        }
      }
    }
    gable(group,w,e,r,d/2+.009,def.white?p.wall:p.dark);
    gable(group,w,e,r,-d/2-.009,def.white?p.wall:p.dark,true);
    const count=Math.ceil(w/.23);
    if(!def.white) for(let i=0;i<count;i++) {
      const x=-w/2+(i+.5)*w/count;
      const h=def.rise*(1-Math.abs(x)/(w/2));
      if(h>.03) {
        box(group,w/count-.009,h,.08,p.wood[(i+3)%6],x,e+h/2,d/2+.058);
        box(group,w/count-.009,h,.08,p.wood[(i+1)%6],x,e+h/2,-d/2-.058);
      }
    }
    roof(group,w,d,e,r,p);
    const front=d/2+.13;
    box(group,1.51,2.65,.12,p.dark,0,1.9,front);
    for(let i=0;i<8;i++) box(group,1.35/8-.008,2.5,.04,p.wood[(i+2)%6],-.675+(i+.5)*1.35/8,1.88,front+.071);
    box(group,.025,.24,.034,p.steel,.49,1.68,front+.1);
    windowFrame(group,-w*.28,base+(e-base)*.56,front,1.04,1.12,p);
    windowFrame(group,w*.28,base+(e-base)*.56,front,1.04,1.12,p);
    const pw=Math.min(w*.72,5.72),pz=d/2+1.20;
    box(group,pw,.23,2.39,p.dark,0,.5,pz);
    deck(group,pw,2.39,.66,p.wood,pz);
    for(const sx of [-1,1]) {
      box(group,.23,2.99,.23,p.dark,sx*(pw/2-.3),2.05,pz+.7);
      box(group,.045,.09,.03,p.steel,sx*(pw/2-.3),3.25,pz+.835);
    }
    box(group,pw,.21,.26,p.dark,0,3.55,pz+.7);
    box(group,2.35,.27,.94,p.concrete,0,.15,d/2+2.48);
    box(group,1.85,.2,.52,p.concrete,0,.35,d/2+2.20);
    box(group,.65,1.8,.65,p.roof,w*.28,r-.1,-d*.19);
    box(group,.81,.09,.81,p.steel,w*.28,r+.82,-d*.19);
  }
  function addShelter(p,group) {
    const w=4.3,d=4.3,e=3.15,r=5.95;
    // Eight ground screws / steel grillage, square timber construction.
    for(const x of [-1.85,-.63,.63,1.85]) for(const z of [-1.85,1.85]) {
      box(group,.13,.57,.13,p.steel,x,.28,z);
      box(group,.22,.065,.22,p.steel,x,.54,z);
    }
    box(group,w,.18,d,p.steel,0,.57,0);
    box(group,w,2.44,d,p.dark,0,1.94,0);
    for(const side of [-1,1]) {
      for(let i=0;i<22;i++) box(group,.06,2.44,d/22-.008,p.wood[i%6],side*(w/2+.035),1.94,-d/2+(i+.5)*d/22);
      planks(group,w,2.44,.08,1.94,p.wood,side*(d/2+.04),.20);
    }
    gable(group,w,e,r,d/2+.01,p.dark);
    gable(group,w,e,r,-d/2-.01,p.dark,true);
    for(let i=0;i<22;i++) {
      const x=-w/2+(i+.5)*w/22;
      const h=(r-e)*(1-Math.abs(x)/(w/2));
      for(const side of [-1,1]) box(group,w/22-.009,h,.075,p.wood[(i+1)%6],x,e+h/2,side*(d/2+.049));
    }
    roof(group,w,d,e,r,p,true);
    // Double entrance doors, raised broad step and the rear ribbon window.
    const front=d/2+.13;
    box(group,1.7,2.05,.085,p.dark,0,1.74,front);
    for(let i=0;i<10;i++) box(group,.164,1.98,.05,p.wood[(i+3)%6],-.85+(i+.5)*1.7/10,1.74,front+.045);
    box(group,.02,2.05,.05,p.steel,0,1.74,front+.075);
    box(group,.03,.22,.04,p.steel,.075,1.76,front+.1);
    windowFrame(group,0,4.16,front,1.05,.72,p);
    windowFrame(group,0,1.85,-d/2-.135,3.74,.82,p,Math.PI);
    deck(group,4.7,1.2,.59,p.wood,d/2+.48);
    deck(group,4.7,.85,.31,p.wood,d/2+1.15);
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,1.28,16),p.roof);
    pipe.position.set(-.96,5.71,-.70);pipe.castShadow=true;group.add(pipe);
    box(group,.3,.05,.3,p.steel,-.96,6.38,-.70);
  }
  function addPavilion(p,group) {
    // The supplied Vlčiareň elevation is a single descending roof (11.39m long,
    // high end 5.497m / low end 1.533m); preserve that distinctive structure.
    const length=11.39,width=4.2;
    const heightAt=x=>5.497-(x+length/2)/length*(5.497-1.533);
    deck(group,length+3.1,width,.21,p.wood,0);
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    for(const x of [-length/2,-length/6,length/6,length/2]) for(const z of [-width/2,width/2]) {
      const h=heightAt(x);
      box(group,.18,h,.18,p.wood[2],x,h/2+.14,z);
      box(group,.27,.08,.27,p.steel,x,.14,z);
      box(group,.21,.35,.035,p.steel,x,.33,z+.10);
      for(const y of [.25,.43]) box(group,.018,.018,.043,p.steel,x,y,z+.13);
    }
    for(const z of [-width/2,width/2]) {
      beam(group,V(-length/2,5.5,z),V(length/2,1.53,z),.19,.18,p.dark);
      beam(group,V(-length/2,2.76,z),V(-length/6,2.76,z),.16,.16,p.wood[1]);
      beam(group,V(-length/6,2.76,z),V(length/2,.3,z),.16,.16,p.wood[1]);
    }
    const n=42;
    for(let i=0;i<n;i++) {
      const x=-length/2+(i+.5)*length/n;
      box(group,.15,.15,width+.38,p.wood[i%6],x,heightAt(x),0);
    }
    quad(group,[[-length/2-.22,5.62,-width/2-.30],[length/2+.22,1.64,-width/2-.30],[length/2+.22,1.64,width/2+.30],[-length/2-.22,5.62,width/2+.30]],p.roof);
    for(let i=0;i<18;i++) {
      const z=-width/2-.3+i*(width+.6)/17;
      beam(group,V(-length/2-.22,5.65,z),V(length/2+.22,1.67,z),.022,.025,p.roof);
    }
    for(const x of [-3.7,-.2,3.2]) {
      box(group,2.50,.13,.76,p.wood[2],x,.91,0);
      for(const sx of [-.95,.95]) box(group,.13,.77,.55,p.dark,x+sx,.47,0);
      for(const z of [-.77,.77]) {
        box(group,2.7,.1,.34,p.wood[4],x,.54,z);
        for(const sx of [-1,1]) box(group,.1,.39,.26,p.dark,x+sx,.3,z);
      }
    }
  }
  function addStudio(p,group) {
    const w=8.06,d=6.24;
    box(group,w+.6,.52,d+.6,p.concrete,0,.26,0);
    box(group,w,4.29,d,p.wall,0,2.665,0);
    box(group,w+.91,.52,d+.91,p.roof,0,5.07,0);
    const front=d/2+.14;
    windowFrame(group,.99,2.73,front,3.51,2.60,p);
    box(group,1.61,2.94,.13,p.dark,-1.95,2.23,front);
    for(let i=0;i<14;i++) box(group,.068,2.29,.17,p.wood[i%6],-2.8+i*.17,2.91,front+.14);
    deck(group,w*.58,2.23,.64,p.wood,d/2+.99);
    for(const x of [-3.9,3.9]) box(group,.036,4.4,.07,p.dark,x,2.65,front+.05);
  }
  function makeContactTexture() {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createRadialGradient(64,64,20,64,64,64);
    gradient.addColorStop(0,'rgba(25,26,19,0.30)');gradient.addColorStop(.6,'rgba(25,26,19,0.12)');gradient.addColorStop(1,'rgba(25,26,19,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const texture=new THREE.CanvasTexture(canvas);resources.add(texture);return texture;
  }
  function merge(group) {
    // One draw per material, rather than hundreds of draw calls for cladding.
    group.updateMatrixWorld(true);
    const batches=new Map(),inverse=group.matrixWorld.clone().invert(),normal=new THREE.Matrix3();
    group.traverse(mesh=>{
      if(!mesh.isMesh || mesh.userData.noBatch) return;
      const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      if(mesh.material.userData.woodGrain && g.attributes.uv){
        // The photographed grain runs along U. Each member follows its own
        // longest local axis, so tall facade boards and horizontal beams share
        // a consistent physical grain scale without repeating a whole wall.
        const scales=[mesh.scale.x,mesh.scale.y,mesh.scale.z];
        const long=scales.indexOf(Math.max(...scales));
        const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
        const offset=(Math.sin(mesh.position.x*7.13+mesh.position.y*3.67+mesh.position.z*11.81)*.5+.5)*2.9;
        for(let i=0;i<p.count;i++){
          const point=[p.getX(i),p.getY(i),p.getZ(i)],normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
          const face=normal.indexOf(Math.max(...normal));
          const grain=face===long?[0,1,2].find(a=>a!==face):long;
          const across=[0,1,2].find(a=>a!==face&&a!==grain);
          uv.setXY(i,(point[grain]+.5)*scales[grain]*.25+offset,(point[across]+.5)*scales[across]/.19);
        }
      }
      const matrix=inverse.clone().multiply(mesh.matrixWorld);
      g.applyMatrix4(matrix);
      const bucket=batches.get(mesh.material)||{p:[],n:[],uv:[],meshes:[]};
      bucket.p.push(...g.attributes.position.array);bucket.n.push(...g.attributes.normal.array);
      if(g.attributes.uv) bucket.uv.push(...g.attributes.uv.array);
      else for(let i=0;i<g.attributes.position.count;i++) bucket.uv.push(0,0);
      bucket.meshes.push(mesh);batches.set(mesh.material,bucket);g.dispose();
    });
    for(const [mat,b] of batches) {
      b.meshes.forEach(mesh=>{mesh.removeFromParent();if(mesh.geometry!==boxGeometry)mesh.geometry.dispose();});
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
      geo.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));
      geo.computeBoundingSphere();resources.add(geo);
      const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    }
  }
  buildingDefinitions.forEach(def=>{
    const p=palette();
    p.roof.side=THREE.DoubleSide;
    const group=new THREE.Group();
    group.name=def.id;group.position.set(def.x,terrainHeight(def.x,def.z),def.z);
    if(def.kind==='pavilion') addPavilion(p,group);
    else if(def.kind==='shelter') addShelter(p,group);
    else if(def.kind==='studio') addStudio(p,group);
    else addHouse(def,p,group);
    merge(group);
    group.traverse(mesh=>{if(mesh.isMesh){mesh.userData.projectId=def.id;interactiveMeshes.push(mesh);}});
    const center=new THREE.Vector3(def.x,group.position.y,def.z);
    buildings.set(def.id,{group,center,radius:def.radius,height:def.height,materials:Object.values(p).flat()});
    anchors.set(def.id,center.clone().add(new THREE.Vector3(0,def.height+.75,0)));
    scene.add(group);
    const contact=new THREE.Mesh(new THREE.PlaneGeometry(def.radius*2.25,def.radius*1.9),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,opacity:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    contact.rotation.x=-Math.PI/2;contact.position.copy(center);contact.position.y+=.012;
    scene.add(contact);resources.add(contact.geometry);resources.add(contact.material);
  });
  let highlighted=null;
  function highlight(id) {
    if(id===highlighted)return;
    if(highlighted) buildings.get(highlighted)?.materials.forEach(mat=>{if(mat.emissive)mat.emissiveIntensity=0;});
    highlighted=id;
    if(id) buildings.get(id)?.materials.forEach(mat=>{if(mat.emissive){mat.emissive.set('#afa17f');mat.emissiveIntensity=.055;}});
  }
  return {buildings,anchors,interactiveMeshes,highlight,
    dispose(){buildings.forEach(b=>b.group.removeFromParent());resources.forEach(item=>item.dispose?.());}};
}
