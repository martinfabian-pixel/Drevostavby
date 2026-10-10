/**
 * Woodland dressing for the DREVOFORM scene. All textures and geometry are local
 * and deterministic; the scene does not depend on a third-party asset host.
 */
export function createNature({THREE, scene, materials = {}, quality = 'high', terrainHeight,
  exclusionZones = [], pathDistance = () => Infinity, seed = 20261010, reducedMotion = false}) {
  const tier = typeof quality === 'string' ? quality : (quality.tier || quality.name || 'high');
  const level = tier === 'low' ? 0 : tier === 'medium' ? 1 : 2;
  const desiredTrees = Math.max(60, typeof quality === 'object' && quality.treeCount
    ? quality.treeCount : [180, 300, 450][level]);
  const root = new THREE.Group();
  root.name = 'Living woodland';
  scene.add(root);
  const geometries = new Set();
  const ownedMaterials = new Set();
  const textures = new Set();
  const chunks = [];
  const animated = [];
  const windUniform = {value: 0};
  const rand = randomGenerator(seed);
  const ground = (x,z) => terrainHeight(x,z);
  const v3 = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
  const treePalette = [0x889272,0x748468,0x657660,0x92a077,0x748260];
  const dummy = new THREE.Object3D();
  const scratchColor = new THREE.Color();
  const stats = {trees:0, spruce:0, birch:0, deciduous:0, grass:0, ferns:0, shrubs:0, rocks:0,
    chunks:0, quality:tier, visibleTreeBatches:0, textureSource:'Locally generated leaf, needle and bark atlases'};

  function randomGenerator(initial) {
    let state = initial >>> 0;
    return () => {state += 0x6D2B79F5; let t=state; t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;};
  }
  function color(hex, factor=1) {return new THREE.Color(hex).multiplyScalar(factor);}
  function ownMaterial(m) {ownedMaterials.add(m); return m;}
  function canvasTexture(width,height,draw) {
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d'); draw(ctx,width,height);
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=[2,4,8][level]; texture.generateMipmaps=true;
    texture.minFilter=THREE.LinearMipmapLinearFilter; texture.magFilter=THREE.LinearFilter;
    textures.add(texture); return texture;
  }
  const barkTexture = canvasTexture(256,512,(ctx,w,h) => {
    const r=randomGenerator(seed+102); ctx.fillStyle='#655a49'; ctx.fillRect(0,0,w,h);
    for(let i=0;i<460;i++) {
      let x=r()*w, y=r()*h; const light=39+Math.floor(r()*43);
      ctx.strokeStyle=`rgba(${light+15},${light+8},${light},${0.18+r()*0.44})`;
      ctx.lineWidth=.6+r()*4; ctx.beginPath(); ctx.moveTo(x,y);
      const length=15+r()*90;
      for(let j=1;j<7;j++) ctx.lineTo(x+Math.sin(j*1.7+i)*2,y+length*j/6);
      ctx.stroke();
      if(i%4===0) {ctx.strokeStyle='rgba(169,151,115,.17)';ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(x+3,y);ctx.lineTo(x+2,y+length);ctx.stroke();}
    }
    for(let i=0;i<1200;i++) {ctx.fillStyle=r()>.5?'rgba(24,22,18,.12)':'rgba(189,166,125,.10)';
      ctx.fillRect(r()*w,r()*h,.5+r()*2,.5+r()*3);}
  });
  barkTexture.wrapS=barkTexture.wrapT=THREE.RepeatWrapping;
  barkTexture.repeat.set(2,3);
  const birchTexture=canvasTexture(256,512,(ctx,w,h) => {
    const r=randomGenerator(seed+110); ctx.fillStyle='#c0c1b1';ctx.fillRect(0,0,w,h);
    for(let i=0;i<340;i++) {let y=r()*h,x=r()*w;ctx.fillStyle=`rgba(39,41,33,${.15+r()*.62})`;
      ctx.fillRect(x,y,2+r()*26,.6+r()*3);if(i%8===0)ctx.fillRect(x-1,y-3,3+r()*4,10+r()*16);}
    for(let i=0;i<200;i++) {ctx.strokeStyle='rgba(225,225,199,.24)';ctx.lineWidth=.6;
      ctx.beginPath();let x=r()*w,y=r()*h;ctx.moveTo(x,y);ctx.lineTo(x+r()*20,y+2);ctx.stroke();}
  });
  birchTexture.wrapS=birchTexture.wrapT=THREE.RepeatWrapping;birchTexture.repeat.set(1,4);
  const needleTexture=canvasTexture(512,256,(ctx,w,h) => {
    const r=randomGenerator(seed+210);
    // Dense, irregular shoots preserve alpha coverage in the lower mip levels.
    // Fine needles decorate an opaque twig silhouette; thin lines on their own
    // disappear when a whole forest is seen from the overview camera.
    const shoots=[];
    for(let side=-1;side<=1;side+=2)for(let k=0;k<13;k++) {
      const x=.055+k*.064+r()*.016,y=.54-k*.010;
      const taper=Math.sin((k+1)/15*Math.PI)*.76+.24;
      shoots.push({x,y,tx:x+.085+r()*.135,ty:y+side*(.19+r()*.20)*taper});
    }
    function stem(x,y,tx,ty,width) {ctx.strokeStyle='#574e35';ctx.lineWidth=width;
      ctx.beginPath();ctx.moveTo(x*w,y*h);ctx.lineTo(tx*w,ty*h);ctx.stroke();}
    stem(.025,.55,.98,.405,3.5);
    shoots.forEach(s => {
      const dx=s.tx-s.x,dy=s.ty-s.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
      const dark=48+Math.floor(r()*28),body=.036+r()*.016;
      ctx.fillStyle=`rgb(${dark+3},${dark+22},${dark-5})`;
      ctx.beginPath();
      for(let side=-1;side<=1;side+=2)for(let j=0;j<18;j++) {
        const t=side===-1?j/17:1-j/17;
        const thickness=body*(.38+.62*Math.sin(t*Math.PI))*(.75+r()*.45);
        const x=s.x+dx*t+nx*thickness*side,y=s.y+dy*t+ny*thickness*side;
        if(side===-1&&j===0)ctx.moveTo(x*w,y*h);else ctx.lineTo(x*w,y*h);
      }
      ctx.closePath();ctx.fill();
      stem(s.x,s.y,s.tx,s.ty,1.7);
      for(let j=0;j<42;j++) {
        const t=(j+.15)/42,x=s.x+dx*t,y=s.y+dy*t,side=j%2?1:-1;
        const needle=.032+r()*.037,along=.009+r()*.020;
        const shade=54+Math.floor(r()*32);
        ctx.strokeStyle=`rgb(${shade+5},${shade+24},${shade-1})`;
        ctx.lineWidth=2.4+r()*2.0;ctx.beginPath();ctx.moveTo(x*w,y*h);
        ctx.lineTo((x+nx*needle*side+dx/len*along)*w,(y+ny*needle*side+dy/len*along)*h);ctx.stroke();
        if(j%5===0) {ctx.strokeStyle='rgba(158,170,121,.66)';ctx.lineWidth=.9;ctx.stroke();}
      }
    });
  });
  function leafAtlas(birch) {
    return canvasTexture(512,512,(ctx,w,h) => {
      const r=randomGenerator(seed+(birch?322:311));
      ctx.strokeStyle='#63573b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.12,h*.83);
      ctx.bezierCurveTo(w*.32,h*.58,w*.63,h*.38,w*.88,h*.17);ctx.stroke();
      for(let i=0;i<126;i++) {
        const t=.09+r()*.84,side=i%2?1:-1;
        const ax=.12+.74*t, ay=.84-.67*t;
        const cx=ax+(.040+r()*.19)*side,cy=ay+(.035+r()*.12)*side;
        ctx.strokeStyle='rgba(85,82,48,.85)';ctx.lineWidth=1.15;ctx.beginPath();
        ctx.moveTo(ax*w,ay*h);ctx.lineTo(cx*w,cy*h);ctx.stroke();
        ctx.save();ctx.translate(cx*w,cy*h);ctx.rotate(-.6+side*.75+r()*.35);
        const lw=(birch?.050:.063)*w*(.76+r()*.54), lh=lw*(birch?1.46:1.62);
        const gradient=ctx.createLinearGradient(-lw*.6,0,lw*.6,0);
        const shade=68+Math.floor(r()*23);gradient.addColorStop(0,`rgb(${shade+1},${shade+22},${shade-7})`);
        gradient.addColorStop(.49,`rgb(${shade+25},${shade+41},${shade+4})`);
        gradient.addColorStop(.54,`rgb(${shade+7},${shade+29},${shade-2})`);
        gradient.addColorStop(1,`rgb(${shade-7},${shade+12},${shade-15})`);
        ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(0,-lh*.57);
        ctx.bezierCurveTo(lw*.68,-lh*.08,lw*.49,lh*.24,0,lh*.48);
        ctx.bezierCurveTo(-lw*.49,lh*.26,-lw*.67,-lh*.09,0,-lh*.57);ctx.fill();
        ctx.strokeStyle='rgba(175,186,111,.45)';ctx.lineWidth=.55;ctx.beginPath();
        ctx.moveTo(0,-lh*.46);ctx.lineTo(0,lh*.43);ctx.stroke();
        for(let j=-2;j<3;j++) {ctx.beginPath();ctx.moveTo(0,j*lh*.14);
          ctx.lineTo(lw*.32,j*lh*.14-lh*.13);ctx.moveTo(0,j*lh*.14);
          ctx.lineTo(-lw*.32,j*lh*.14-lh*.13);ctx.stroke();}
        ctx.restore();
      }
    });
  }
  const broadTexture=leafAtlas(false), birchLeafTexture=leafAtlas(true);
  const grassTexture=canvasTexture(256,256,(ctx,w,h) => {
    const r=randomGenerator(seed+400);
    for(let i=0;i<42;i++) {
      const x=.25+r()*.5,tipx=x+(r()-.5)*.7,tipy=.04+r()*.5;
      const shade=74+Math.floor(r()*32);
      ctx.strokeStyle=`rgba(${shade+8},${shade+19},${shade-8},.94)`;
      ctx.lineWidth=1.8+r()*3.2;ctx.beginPath();ctx.moveTo(x*w,h*.97);
      ctx.quadraticCurveTo(x*w+(tipx-x)*w*.5,h*.57,tipx*w,tipy*h);ctx.stroke();
      if(i%5===0) {ctx.fillStyle='rgba(160,145,94,.83)';ctx.beginPath();
        ctx.ellipse(tipx*w,tipy*h,1.1,5.8,(tipx-x)*.9,0,Math.PI*2);ctx.fill();}
    }
  });

  function windShader(shader, bendHeight = 9) {
    shader.uniforms.uNatureTime=windUniform;
    shader.uniforms.uNatureBendHeight={value:bendHeight};
    shader.vertexShader='uniform float uNatureTime;\nuniform float uNatureBendHeight;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 natureWorld = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        natureWorld = instanceMatrix * natureWorld;
      #endif
      natureWorld = modelMatrix * natureWorld;
      float natureFlex = smoothstep(0.04, uNatureBendHeight, max(position.y, 0.0));
      float natureWind = sin(natureWorld.x * 0.092 + natureWorld.z * 0.074 + uNatureTime * 0.74);
      float natureFlutter = sin(natureWorld.x * 0.71 - natureWorld.z * 0.38 + uNatureTime * 1.45);
      transformed.x += (natureWind * 0.085 + natureFlutter * 0.019) * natureFlex;
      transformed.z += sin(natureWorld.z * 0.11 + uNatureTime * 0.55) * 0.034 * natureFlex;
    `);
  }
  function foliageMaterial(map,base=0xffffff,bendHeight=9) {
    const m=ownMaterial(new THREE.MeshStandardMaterial({map,color:base,roughness:.97,metalness:0,
      side:THREE.DoubleSide,alphaTest:.20,alphaToCoverage:true,depthWrite:true,vertexColors:true,
      envMapIntensity:.35}));
    m.userData.natureBendHeight=bendHeight;
    m.onBeforeCompile=shader=>windShader(shader,bendHeight); m.customProgramCacheKey=()=> 'drevoform-foliage-wind-v2';
    // Small leaf transmission: shade is still provided by the scene's physical
    // lights; this avoids opaque, nearly black backs of sunlit foliage.
    const baseCompile=m.onBeforeCompile;
    m.onBeforeCompile=shader => {
      baseCompile(shader);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
        'outgoingLight += diffuseColor.rgb * 0.045;\n#include <opaque_fragment>');
    };
    return m;
  }
  const foliageMats=[foliageMaterial(needleTexture),foliageMaterial(birchLeafTexture),foliageMaterial(broadTexture)];
  const farFoliageMats=foliageMats.map(source=>{
    const m=ownMaterial(source.clone());m.alphaTest=.10;m.alphaToCoverage=false;
    m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;
    return m;
  });
  const grassMat=foliageMaterial(grassTexture,0xe0dfc7,.80);
  foliageMats[1].envMapIntensity=.47;foliageMats[2].envMapIntensity=.47;
  farFoliageMats[1].envMapIntensity=.47;farFoliageMats[2].envMapIntensity=.47;
  const hasFirPhoto=!!(materials.firPhoto&&materials.firAlpha);
  const hasFernPhoto=!!(materials.fernPhoto&&materials.fernAlpha);
  function photographedFoliage(photo,alpha,normal,bendHeight=9) {
    const m=foliageMaterial(photo,0xffffff,bendHeight);
    // The local photo PNGs already contain the cutout alpha channel. Applying
    // the same mask again would square its mip alpha and erase fine needles.
    m.alphaTest=.11;
    if(normal){m.normalMap=normal;m.normalScale.set(.32,.32);}
    m.envMapIntensity=.43;
    return m;
  }
  const firPhotoMat=hasFirPhoto?photographedFoliage(materials.firPhoto,materials.firAlpha,materials.firNormal):null;
  const fernPhotoMat=hasFernPhoto?photographedFoliage(materials.fernPhoto,materials.fernAlpha,materials.fernNormal,.88):null;
  const fernMat=ownMaterial(new THREE.MeshStandardMaterial({color:0x708062,roughness:.97,
    side:THREE.DoubleSide,vertexColors:true,envMapIntensity:.28}));
  fernMat.onBeforeCompile=shader=>windShader(shader,.8);fernMat.customProgramCacheKey=()=> 'drevoform-fern-wind-v2';
  const barkMat=materials.bark ? ownMaterial(materials.bark.clone()) : ownMaterial(new THREE.MeshStandardMaterial({map:barkTexture,
    roughness:1,color:0xa29b86,envMapIntensity:.2}));
  barkMat.vertexColors=true;
  const birchMat=ownMaterial(new THREE.MeshStandardMaterial({map:birchTexture,roughness:.98,
    color:0xcdd0c0,vertexColors:true,envMapIntensity:.25}));
  const depthPairs=new Map();
  function matchingShadow(m) {
    if(depthPairs.has(m))return depthPairs.get(m);
    const options={map:m.map,alphaMap:m.alphaMap,alphaTest:m.alphaTest,side:THREE.DoubleSide};
    const depth=ownMaterial(new THREE.MeshDepthMaterial({...options,depthPacking:THREE.RGBADepthPacking}));
    const distance=ownMaterial(new THREE.MeshDistanceMaterial(options));
    depth.onBeforeCompile=shader=>windShader(shader,m.userData.natureBendHeight||9);
    distance.onBeforeCompile=shader=>windShader(shader,m.userData.natureBendHeight||9);
    depth.customProgramCacheKey=()=> 'drevoform-wind-depth-v2';
    distance.customProgramCacheKey=()=> 'drevoform-wind-distance-v2';
    const pair={depth,distance};depthPairs.set(m,pair);return pair;
  }

  class Builder {
    constructor(){this.p=[];this.n=[];this.uv=[];this.c=[];}
    vertex(p,n,u,v,c) {this.p.push(p.x,p.y,p.z);this.n.push(n.x,n.y,n.z);this.uv.push(u,v);
      this.c.push(c.r,c.g,c.b);}
    tri(a,b,c,na,nb,nc,ua,ub,uc,shade) {this.vertex(a,na,...ua,shade);this.vertex(b,nb,...ub,shade);this.vertex(c,nc,...uc,shade);}
    quad(a,b,c,d,shade,uvs=[[0,0],[1,0],[1,1],[0,1]]) {
      const normal=v3().subVectors(b,a).cross(v3().subVectors(d,a)).normalize();
      this.tri(a,b,c,normal,normal,normal,uvs[0],uvs[1],uvs[2],shade);
      this.tri(a,c,d,normal,normal,normal,uvs[0],uvs[2],uvs[3],shade);
    }
    tube(points,r0,r1,sides=6,shade=color(0xffffff), uvScale=1) {
      const rings=[];
      for(let i=0;i<points.length;i++) {
        const tangent=v3().subVectors(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]).normalize();
        const axis=Math.abs(tangent.y)>.94?v3(1,0,0):v3(0,1,0);
        const side=v3().crossVectors(tangent,axis).normalize(),up=v3().crossVectors(side,tangent).normalize();
        const radius=THREE.MathUtils.lerp(r0,r1,i/(points.length-1));
        const ring=[];
        for(let j=0;j<=sides;j++) {const a=j/sides*Math.PI*2,n=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up,Math.sin(a));
          ring.push({p:points[i].clone().addScaledVector(n,radius),n,u:j/sides,v:i/(points.length-1)*uvScale});}
        rings.push(ring);
      }
      for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++) {
        const a=rings[i][j],b=rings[i+1][j],c=rings[i+1][j+1],d=rings[i][j+1];
        this.tri(a.p,b.p,c.p,a.n,b.n,c.n,[a.u,a.v],[b.u,b.v],[c.u,c.v],shade);
        this.tri(a.p,c.p,d.p,a.n,c.n,d.n,[a.u,a.v],[c.u,c.v],[d.u,d.v],shade);
      }
    }
    card(center, direction, width, height, tilt, shade,uvs) {
      const right=direction.clone().normalize();
      let normal=v3().crossVectors(right,v3(0,1,0));
      if(normal.lengthSq()<.001)normal.set(1,0,0);normal.normalize();
      const up=v3().crossVectors(normal,right).normalize().applyAxisAngle(right,tilt);
      const a=center.clone().addScaledVector(right,-width/2).addScaledVector(up,-height/2);
      const b=center.clone().addScaledVector(right,width/2).addScaledVector(up,-height/2);
      const c=center.clone().addScaledVector(right,width/2).addScaledVector(up,height/2);
      const d=center.clone().addScaledVector(right,-width/2).addScaledVector(up,height/2);
      this.quad(a,b,c,d,shade,uvs);
    }
    curvedCard(center,direction,width,height,tilt,shade) {
      const right=direction.clone().normalize();
      let normal=v3().crossVectors(right,v3(0,1,0));
      if(normal.lengthSq()<.001)normal.set(1,0,0);normal.normalize();
      const up=v3().crossVectors(normal,right).normalize().applyAxisAngle(right,tilt);
      const bendNormal=v3().crossVectors(right,up).normalize();
      const at=(u,v)=>center.clone().addScaledVector(right,(u-.5)*width).addScaledVector(up,(v-.5)*height)
        .addScaledVector(bendNormal,Math.sin(u*Math.PI)*width*.095);
      // A shallow fold changes both leaf-cluster silhouette and light response.
      // It avoids the perfectly flat dark rectangular planes seen in the old
      // crown, while preserving the same locally generated leaf alpha atlas.
      for(let j=0;j<2;j++) {const u0=j*.5,u1=(j+1)*.5;
        this.quad(at(u0,0),at(u1,0),at(u1,1),at(u0,1),shade,
          [[u0,0],[u1,0],[u1,1],[u0,1]]);}
    }
    geometry() {const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
      g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));
      g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);return g;}
  }

  function makeSpruce(variant,lod) {
    const r=randomGenerator(seed+1000+variant*913),bark=new Builder(),leaves=new Builder(),detail=new Builder();
    const h=13.2+variant*.9,spread=3.35+variant*.32;
    const trunkSegments=lod===0?13:8;
    const trunkPoints=Array.from({length:trunkSegments},(_,i)=>{
      const t=i/(trunkSegments-1);return v3(Math.sin(t*3.5+variant)*.08*t,h*t,Math.cos(t*4)*.06*t);});
    bark.tube(trunkPoints,.21,.016,lod===0?10:6,color(0xffffff),3);
    const rings=[14,10,9][lod];
    for(let k=0;k<rings;k++) {
      const t=.2+k/(rings-1)*.77,y=h*t;
      const branchCount=lod===0?6+Math.floor(r()*3):lod===1?6:5;
      const length=spread*Math.pow(1-t,.72)*(0.9+r()*.21);
      const spin=r()*Math.PI*2;
      for(let j=0;j<branchCount;j++) {
        const a=spin+j/branchCount*Math.PI*2+(r()-.5)*.24;
        const dir=v3(Math.cos(a),0,Math.sin(a));
        const end=dir.clone().multiplyScalar(length).add(v3(0,y-.26-length*.15,0));
        const start=v3(.03*Math.sin(y),y,.025*Math.cos(y));
        const mid=dir.clone().multiplyScalar(length*.56).add(v3(0,y-.23-length*.2,0));
        if(lod<2)bark.tube([start,start.clone().lerp(mid,.5),mid,end],.026*(1-t)+.006,.005,
          lod===0?5:4,color(0xc9c6b6),.75);
        const cards=[4,3,3][lod];
        for(let q=0;q<cards;q++) {
          const u=.26+q/(cards-1)*.71;
          const p=start.clone().lerp(end,u);p.y-=Math.sin(u*Math.PI)*.16;
          const width=Math.max(.52,length*.69)*(1-u*.17)*(lod===2?1.32:1);
          const shade=color(0xffffff,.82+r()*.30);
          leaves.card(p,dir,width,.54+width*.35,(r()-.5)*1.35,shade);
          // The second shoot is close to horizontal and keeps the foliage
          // volumetric when the visitor looks down from the initial camera.
          leaves.card(p.clone().add(v3(0,.028,0)),dir,width*.95,.52+width*.27,
            Math.PI*.5+(r()-.5)*.44,shade);
          if(lod===0 && q>0) {
            const side=v3(-dir.z,.12,dir.x).multiplyScalar((q%2?1:-1)*.22);
            leaves.card(p.clone().add(side),dir.clone().addScaledVector(side,.9),width*.74,.44,
              Math.PI*.40+(r()-.5)*.75,shade);
          }
          if(hasFirPhoto&&lod<2) {
            const crop=[[.180,.435,.026,.315],[.630,.970,.025,.369],[.302,.647,.398,.789],
              [.626,.966,.433,.844]][(k+j+q+variant)%4];
            const [u0,u1,y0,y1]=crop,v0=1-y1,v1=1-y0;
            // Each atlas crop contains one photographed twig. The UV quarter
            // turn aligns its stem with the actual outward-growing branch.
            const uv=[[u0,v0],[u0,v1],[u1,v1],[u1,v0]];
            const photoWidth=width*.81;
            detail.card(p.clone().add(v3(0,.048,0)),dir,photoWidth,photoWidth*.78,
              .18+(r()-.5)*1.5,color(0xffffff,1.00+r()*.22),uv);
            if(lod===0)detail.card(p.clone().add(v3(0,.09,0)),dir,photoWidth*.87,photoWidth*.72,
              Math.PI*.5+(r()-.5)*.42,color(0xffffff,1.02+r()*.18),uv);
          }
        }
      }
    }
    // Exposed roots flare into the soil rather than a cylinder cut off at ground.
    if(lod===0)for(let j=0;j<5;j++) {
      const a=j/5*Math.PI*2+r()*.3,d=v3(Math.cos(a),0,Math.sin(a));
      bark.tube([v3(0,.2,0),d.clone().multiplyScalar(.33).add(v3(0,.06,0)),
        d.clone().multiplyScalar(.7+r()*.4).add(v3(0,-.045,0))],.13,.025,6,color(0xbbb8aa),.4);
    }
    return {bark:bark.geometry(),leaves:leaves.geometry(),detail:hasFirPhoto&&lod<2?detail.geometry():null,height:h};
  }
  function makeDeciduous(variant,lod,isBirch) {
    const r=randomGenerator(seed+2100+variant*929+(isBirch?400:0));
    const bark=new Builder(),leaves=new Builder();const h=(isBirch?12.8:11.6)+variant*.9;
    const lean=(r()-.5)*.65;
    const trunkSegments=lod===0?12:7;
    const points=Array.from({length:trunkSegments},(_,i)=>{const t=i/(trunkSegments-1);
      return v3(lean*t*t,h*t,Math.sin(t*2.5)*.14);});
    bark.tube(points,isBirch?.13:.24,.023,lod===0?9:6,color(0xffffff),2.5);
    const branchCount=[31,19,12][lod];
    for(let j=0;j<branchCount;j++) {
      const t=.31+r()*.57,y=h*t,a=j*2.399963+r()*.42;
      const reach=(isBirch?2.95:3.95)*Math.pow(Math.sin((t-.18)*Math.PI),.59)*(0.72+r()*.40);
      const dir=v3(Math.cos(a),0,Math.sin(a));
      const start=v3(lean*t*t,y,Math.sin(t*2.5)*.14);
      const end=start.clone().addScaledVector(dir,reach).add(v3(0,.6+r()*.7,0));
      const mid=start.clone().lerp(end,.58);mid.y-=isBirch?.03:.19;
      if(lod<2)bark.tube([start,mid,end],.027+.026*(1-t),.007,lod===0?6:4,
        color(isBirch?0xffffff:0xd8d4bd),.8);
      const cards=[8,5,4][lod];
      for(let q=0;q<cards;q++) {
        const u=.57+r()*.48,p=start.clone().lerp(end,u);
        const scatter=isBirch?.66:.88;
        p.add(v3((r()-.5)*scatter,(r()-.5)*scatter,(r()-.5)*scatter));
        const angle=a+(r()-.5)*1.9;
        const direction=v3(Math.cos(angle),.1+(r()-.5)*.35,Math.sin(angle));
        const size=(isBirch?1.10:1.30)*(.88+r()*.27)*(lod===2?1.22:1);
        const shade=color(0xffffff,.86+r()*.24);
        const tilt=(r()-.5)*Math.PI*1.45;
        if(lod<2)leaves.curvedCard(p,direction,size,size*(isBirch?1.08:.94),tilt,shade);
        else leaves.card(p,direction,size,size*(isBirch?1.08:.94),tilt,shade);
        if(q%2===0)leaves.card(p.clone().add(v3(.035,.04,-.025)),direction,size*.90,size*.88,
          Math.PI*.5+(r()-.5)*.56,shade);
      }
    }
    if(lod===0&&!isBirch)for(let j=0;j<5;j++) {
      const a=j/5*Math.PI*2,d=v3(Math.cos(a),0,Math.sin(a));
      bark.tube([v3(0,.25,0),d.clone().multiplyScalar(.45).add(v3(0,.055,0)),
        d.clone().multiplyScalar(1.0).add(v3(0,-.05,0))],.13,.019,6,color(0xbcb9aa),.5);
    }
    return {bark:bark.geometry(),leaves:leaves.geometry(),height:h};
  }
  const variants=Array.from({length:6},(_,index)=>{
    const species=Math.floor(index/2),variant=index%2;
    return Array.from({length:3},(_,lod)=> species===0?makeSpruce(variant,lod):makeDeciduous(variant,lod,species===1));
  });

  function clearOfBuilding(x,z,extra=0) {
    return exclusionZones.every(zone=>Math.hypot(x-zone.x,z-zone.z)>zone.radius+extra);
  }
  function forbiddenTree(x,z) {
    if(!clearOfBuilding(x,z,.35) || pathDistance(x,z)<3.1)return true;
    // Keep a short sightline in front of each facade for the initial overview.
    // The visitor can still orbit freely; only planting is adjusted here.
    return exclusionZones.some(zone=>{
      const dx=x-zone.x,dz=z-zone.z;
      const along=dx*.565+dz*.825,across=dx*.825-dz*.565;
      return along>0&&along<22&&Math.abs(across)<6.1;
    });
  }
  function chunkKey(x,z,size=40) {return `${Math.floor((x+100)/size)}:${Math.floor((z+100)/size)}`;}
  const treeBins=new Map();
  const positions=[];
  function plantTree(x,z,{young=false}={}) {
    const speciesRoll=rand(),species=speciesRoll<(young?.57:.72)?0:speciesRoll<.91?1:2;
    const variant=species*2+(rand()>.5?1:0),scale=young?.57+rand()*.26:.66+rand()*.60;
    const p={x,z,y:ground(x,z)-.035,scale,rotation:rand()*Math.PI*2,variant,
      shade:.77+rand()*.29};positions.push(p);
    const key=chunkKey(x,z);if(!treeBins.has(key))treeBins.set(key,[]);treeBins.get(key).push(p);
    stats.trees++;stats[['spruce','birch','deciduous'][species]]++;
  }
  // Small irregular groves bring the forest into the architectural clearing.
  // These trees are younger and lower, so the five project silhouettes remain
  // legible while their surroundings read as woodland rather than a lawn.
  const groveCenters=[[-33,-5],[-24,-22],[-11,-29],[6,-27],[27,-18],
    [31,3],[29,23],[4,24],[-21,25],[-2,7],[-32,16]];
  const youngCount=[20,24,29][level];
  for(let attempt=0;positions.length<youngCount&&attempt<youngCount*50;attempt++) {
    const center=groveCenters[attempt%groveCenters.length];
    const a=rand()*Math.PI*2,d=1+rand()*5.0,x=center[0]+Math.cos(a)*d,z=center[1]+Math.sin(a)*d;
    if(forbiddenTree(x,z)||positions.some(p=>Math.hypot(x-p.x,z-p.z)<3.1))continue;
    plantTree(x,z,{young:true});
  }
  for(let attempt=0;positions.length<desiredTrees&&attempt<desiredTrees*80;attempt++) {
    const x=(rand()-.5)*194,z=(rand()-.5)*194;
    if(forbiddenTree(x,z))continue;
    const inCampus=Math.abs(x)<43&&Math.abs(z)<32;
    const grove=.58+.21*Math.sin(x*.084+z*.054)+.19*Math.sin(z*.118-x*.077);
    if(rand()>grove*(inCampus?.53:.92))continue;
    if(positions.some(p=>Math.hypot(x-p.x,z-p.z)<(inCampus?3.9:3.1)))continue;
    plantTree(x,z,{young:inCampus&&rand()<.78});
  }
  function createInstances(geometry,material,items,{shadows=false,receive=true}={}) {
    const mesh=new THREE.InstancedMesh(geometry,material,items.length);
    mesh.castShadow=shadows;mesh.receiveShadow=receive;mesh.frustumCulled=true;
    items.forEach((p,i)=>{
      dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.rotation||0,p.rz||0);
      if(p.sx)dummy.scale.set(p.sx,p.sy,p.sz);else dummy.scale.setScalar(p.scale||1);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      scratchColor.setHex(p.color||0xffffff).multiplyScalar(p.shade||1);mesh.setColorAt(i,scratchColor);
    });
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
    if(material.alphaTest>0) {const pair=matchingShadow(material);mesh.customDepthMaterial=pair.depth;mesh.customDistanceMaterial=pair.distance;}
    return mesh;
  }
  for(const [key,items]of treeBins) {
    const [cx,cz]=key.split(':').map(Number);
    const chunk={center:v3(cx*40-80,ground(cx*40-80,cz*40-80),cz*40-80),lods:[],distance:1000};
    for(let lod=0;lod<3;lod++) {
      const group=new THREE.Group();group.name=`Forest ${key} LOD ${lod}`;
      for(let variant=0;variant<6;variant++) {
        const trees=items.filter(p=>p.variant===variant);if(!trees.length)continue;
        const species=Math.floor(variant/2),model=variants[variant][lod];
        const trunk=createInstances(model.bark,species===1?birchMat:barkMat,trees);
        const foliage=createInstances(model.leaves,lod===2?farFoliageMats[species]:foliageMats[species],trees);
        trunk.name='Tapered trunks and branches';foliage.name='Individual cutout foliage';
        group.add(trunk,foliage);
        if(model.detail){const detail=createInstances(model.detail,firPhotoMat,trees);
          detail.name='Photographed spruce twig detail';group.add(detail);}
      }
      group.visible=lod===2;root.add(group);chunk.lods.push(group);
    }
    chunks.push(chunk);
  }
  stats.chunks=chunks.length;

  function grassGeometry() {
    const b=new Builder();
    for(let j=0;j<3;j++) {const a=j/3*Math.PI,d=v3(Math.cos(a),0,Math.sin(a));
      b.card(v3(0,.18,0),d,.61,.41,.04,color(0xffffff,.89+j*.045));}
    return b.geometry();
  }
  function fernGeometry() {
    const b=new Builder(),r=randomGenerator(seed+801);
    for(let j=0;j<7;j++) {
      const a=j/7*Math.PI*2+r()*.25,dir=v3(Math.cos(a),0,Math.sin(a));
      const side=v3(-dir.z,0,dir.x),len=.65+r()*.36;
      for(let k=0;k<12;k++) {
        const t=.08+k/12*.89,p=dir.clone().multiplyScalar(len*t);
        p.y=.03+Math.sin(t*Math.PI*.8)*len*.57;
        const width=.13*Math.sin(t*Math.PI)*(.9+r()*.25);
        for(const sign of [-1,1]) {
          const stem=p.clone().addScaledVector(dir,-.018);
          const tip=p.clone().addScaledVector(side,width*sign).addScaledVector(dir,len*.08);
          tip.y+=.035;
          const mid=stem.clone().lerp(tip,.54);
          const half=v3().crossVectors(v3().subVectors(tip,stem),v3(0,1,0)).normalize().multiplyScalar(.027*(1-t*.6));
          b.quad(stem,mid.clone().add(half),tip,mid.clone().sub(half),color(0xffffff,.7+r()*.32));
        }
      }
    }
    return b.geometry();
  }
  function photographedFernGeometry() {
    const b=new Builder(),r=randomGenerator(seed+819);
    const crops=[[.067,.247,.118,.988],[.286,.445,.047,.839],[.709,.898,.027,.987]];
    for(let j=0;j<8;j++) {
      const a=j/8*Math.PI*2+r()*.32,dir=v3(Math.cos(a),0,Math.sin(a)),side=v3(-dir.z,0,dir.x);
      const len=.72+r()*.33,crop=crops[j%crops.length],[u0,u1,y0,y1]=crop;
      const v0=1-y1,v1=1-y0;
      const at=t=>dir.clone().multiplyScalar(len*Math.sin(t*1.18)).add(v3(0,.038+len*Math.sin(t*Math.PI*.61)*.88,0));
      const width=len*.29;
      for(let k=0;k<11;k++) {
        const t0=k/11,t1=(k+1)/11,p0=at(t0),p1=at(t1);
        const a0=p0.clone().addScaledVector(side,-width*.5),b0=p0.clone().addScaledVector(side,width*.5);
        const c1=p1.clone().addScaledVector(side,width*.5),d1=p1.clone().addScaledVector(side,-width*.5);
        const z0=THREE.MathUtils.lerp(v0,v1,t0),z1=THREE.MathUtils.lerp(v0,v1,t1);
        b.quad(a0,b0,c1,d1,color(0xffffff,.91+r()*.15),[[u0,z0],[u1,z0],[u1,z1],[u0,z1]]);
      }
    }
    return b.geometry();
  }
  const grassGeo=grassGeometry(),fernGeo=hasFernPhoto?photographedFernGeometry():fernGeometry();
  const undergrowthBins=new Map();
  const grassCount=[1600,3300,5900][level],fernCount=[110,240,420][level],shrubCount=[35,70,115][level];
  function sampleFloor(count,radius,minimumPath,maximumPath) {
    const items=[];
    for(let attempt=0;items.length<count&&attempt<count*30;attempt++) {
      const x=(rand()-.5)*radius*2,z=(rand()-.5)*radius*2;
      if(!clearOfBuilding(x,z,-.5))continue;
      const d=pathDistance(x,z);if(d<minimumPath||d>maximumPath)continue;
      items.push({x,z,y:ground(x,z)+.016,scale:.55+rand()*.84,rotation:rand()*Math.PI*2,
        shade:.72+rand()*.33});
    }return items;
  }
  const forestTrees=positions.filter(p=>Math.abs(p.x)<66&&Math.abs(p.z)<66);
  const vegetationPatches=[];
  const patchCount=[23,37,53][level];
  for(let i=0;i<patchCount;i++) {
    let x,z,kind;
    if(i%3!==0&&forestTrees.length) {
      const tree=forestTrees[Math.floor(rand()*forestTrees.length)],a=rand()*Math.PI*2;
      x=tree.x+Math.cos(a)*(1+rand()*3);z=tree.z+Math.sin(a)*(1+rand()*3);kind='shade';
    } else {
      kind='edge';
      for(let attempt=0;attempt<160;attempt++) {
        x=(rand()-.5)*116;z=(rand()-.5)*116;
        const d=pathDistance(x,z);
        if(d>1.4&&d<4.8&&clearOfBuilding(x,z,-1.4))break;
      }
    }
    vegetationPatches.push({x,z,kind,rx:3.0+rand()*5.2,rz:1.5+rand()*3.7,
      angle:rand()*Math.PI*2,shade:.83+rand()*.27});
  }
  function sampleVegetation(count,type) {
    const items=[];
    const edgePatches=vegetationPatches.filter(p=>p.kind==='edge');
    const shadePatches=vegetationPatches.filter(p=>p.kind==='shade');
    for(let attempt=0;items.length<count&&attempt<count*35;attempt++) {
      const useEdge=type==='grass'?rand()<.48:rand()<.18;
      const pool=useEdge?edgePatches:shadePatches;
      const patch=pool[Math.floor(rand()*pool.length)]||vegetationPatches[0];
      const a=rand()*Math.PI*2,d=Math.sqrt(rand()),lx=Math.cos(a)*d*patch.rx,lz=Math.sin(a)*d*patch.rz;
      const x=patch.x+Math.cos(patch.angle)*lx-Math.sin(patch.angle)*lz;
      const z=patch.z+Math.sin(patch.angle)*lx+Math.cos(patch.angle)*lz;
      if(!clearOfBuilding(x,z,type==='grass'?-1.8:-.45))continue;
      const path=pathDistance(x,z);
      if(path<(type==='grass'?1.1:type==='fern'?1.65:2.6))continue;
      if(useEdge&&path>6.1)continue;
      // Shared low-frequency variation produces continuous masses and gaps,
      // while the individual blades/fronds still vary in scale and direction.
      const lush=.66+.22*Math.sin(x*.55+z*.18)+.12*Math.cos(z*.71-x*.27);
      if(rand()>lush*(1-.35*d))continue;
      const scale=type==='grass'?.67+rand()*.69:type==='fern'?.58+rand()*.84:.66+rand()*.72;
      items.push({x,z,y:ground(x,z)+.014,scale,rotation:rand()*Math.PI*2,
        shade:patch.shade*(.88+rand()*.19)});
    }
    return items;
  }
  const grasses=sampleVegetation(grassCount,'grass');
  const ferns=sampleVegetation(fernCount,'fern');
  const shrubs=sampleVegetation(shrubCount,'shrub');
  grasses.forEach(p=>{
    const growth=(Math.sin(p.x*.37+p.z*.22)+Math.cos(p.z*.46-p.x*.17)+2)*.25;
    // Continuous patches alternate low grass and taller seed-bearing blades.
    // Every plant keeps its original position and rotation.
    if(growth>.58){p.sx=p.scale*.82;p.sy=p.scale*(1.5+growth*.73);p.sz=p.scale*.82;}
  });
  for(const [kind,list]of [['grass',grasses],['ferns',ferns]]) {
    for(const p of list) {const key=chunkKey(p.x,p.z,32);
      if(!undergrowthBins.has(key))undergrowthBins.set(key,{grass:[],ferns:[]});undergrowthBins.get(key)[kind].push(p);}
  }
  for(const [key,bin]of undergrowthBins) {
    const [cx,cz]=key.split(':').map(Number),group=new THREE.Group();
    if(bin.grass.length)group.add(createInstances(grassGeo,grassMat,bin.grass,{shadows:false}));
    if(bin.ferns.length)group.add(createInstances(fernGeo,fernPhotoMat||fernMat,bin.ferns,{shadows:false}));
    root.add(group);animated.push({group,center:v3(cx*32-84,0,cz*32-84),kind:'floor'});
  }
  stats.grass=grasses.length;stats.ferns=ferns.length;
  // Shrubs reuse a scaled broadleaf skeleton and remain true meshes, with empty
  // space between every individual twig/leaf card.
  if(shrubs.length) {
    const model=variants[4][2],list=shrubs.map(p=>({...p,scale:p.scale*.115}));
    root.add(createInstances(model.bark,barkMat,list),createInstances(model.leaves,foliageMats[2],list));
    stats.shrubs=shrubs.length;
  }
  const rockGeo=new THREE.IcosahedronGeometry(1,2);
  const rockPos=rockGeo.getAttribute('position'),rRock=randomGenerator(seed+610);
  for(let i=0;i<rockPos.count;i++) {
    const x=rockPos.getX(i),y=rockPos.getY(i),z=rockPos.getZ(i);
    const factor=.90+.12*Math.sin(x*9+y*7+z*5)+.07*Math.sin(z*13-x*8);
    rockPos.setXYZ(i,x*factor,y*factor*.64,z*factor);
  }
  rockGeo.computeVertexNormals();rockGeo.computeBoundingSphere();geometries.add(rockGeo);
  const rockMat=materials.rock?ownMaterial(materials.rock.clone()):ownMaterial(new THREE.MeshStandardMaterial({color:0x969a8e,
    roughness:.96,envMapIntensity:.2}));
  const rocks=sampleFloor([55,100,170][level],65,1.15,Infinity).map(p=>({...p,
    y:p.y-.08,scale:.16+rRock()*.68,rx:rRock()*.4,rz:rRock()*.6,
    color:treePalette[Math.floor(rRock()*treePalette.length)]}));
  if(rocks.length)root.add(createInstances(rockGeo,rockMat,rocks,{shadows:level>0}));stats.rocks=rocks.length;

  // A few weathered fallen branches supply visual scale without taking over the
  // clean architectural clearings. Their ends are hidden below the ground.
  const logB=new Builder();logB.tube([v3(-1.9,.13,0),v3(0,.15,.02),v3(1.7,.12,-.04)],.13,.095,9,color(0xffffff),2.7);
  for(let j=0;j<4;j++) {let x=-1.2+j*.72;logB.tube([v3(x,.14,0),v3(x+.14,.24,.17),v3(x+.19,.22,.28)],.045,.016,5,color(0xc5bdab),.35);}
  const logs=sampleFloor(level>0?7:3,57,5,Infinity).map(p=>({...p,scale:.7+rand()*.5,shade:.72}));
  if(logs.length)root.add(createInstances(logB.geometry(),barkMat,logs,{shadows:level>0}));

  const mistTexture=canvasTexture(128,128,(ctx,w,h)=>{
    const gradient=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.5);
    gradient.addColorStop(0,'rgba(224,229,215,.26)');gradient.addColorStop(.4,'rgba(224,229,215,.14)');
    gradient.addColorStop(1,'rgba(224,229,215,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  });
  const mistMaterial=ownMaterial(new THREE.MeshBasicMaterial({map:mistTexture,color:0xc8d0c0,
    transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,fog:true}));
  const mistGeo=new THREE.PlaneGeometry(1,1);geometries.add(mistGeo);
  const mist=[];
  if(level>0)for(let i=0;i<[0,5,8][level];i++) {
    const x=(rand()-.5)*135,z=(rand()-.5)*120,mesh=new THREE.Mesh(mistGeo,mistMaterial);
    mesh.position.set(x,ground(x,z)+2.4+rand()*2,z);
    mesh.scale.set(20+rand()*12,7+rand()*4,1);mesh.renderOrder=2;
    root.add(mesh);mist.push({mesh,x,z,phase:rand()*Math.PI*2});
  }
  if(hasFirPhoto||hasFernPhoto)stats.textureSource='CC0 photographed fir and fern PBR atlases with procedural distant silhouettes';

  // Distant woodland forms a continuous horizon beyond the detailed clearing.
  // These batches always use the inexpensive twig silhouette LOD, receive no
  // shadows, and need no per-frame distance calculations. Each 80m batch still
  // has an exact instanced bound, so Three.js can cull it outside the frustum.
  const farRand=randomGenerator(seed+92003),distantCount=[260,600,1100][level];
  const distantBins=new Map(),distantPositions=[],spatialFar=new Map();
  const cellKey=(x,z)=>`${Math.floor(x/5)}:${Math.floor(z/5)}`;
  function distantOverlap(x,z) {
    const cx=Math.floor(x/5),cz=Math.floor(z/5);
    for(let ix=cx-1;ix<=cx+1;ix++)for(let iz=cz-1;iz<=cz+1;iz++) {
      const cell=spatialFar.get(`${ix}:${iz}`);if(!cell)continue;
      if(cell.some(p=>Math.hypot(x-p.x,z-p.z)<4.2))return true;
    }
    return positions.some(p=>Math.abs(x-p.x)<3.1&&Math.abs(z-p.z)<3.1&&Math.hypot(x-p.x,z-p.z)<3.1);
  }
  for(let attempt=0;distantPositions.length<distantCount&&attempt<distantCount*45;attempt++) {
    const a=farRand()*Math.PI*2;
    // Slightly denser near the existing forest boundary, progressively more
    // spaced on the distant slopes. Uneven groves avoid concentric rings.
    const radius=farRand()<.56?85+farRand()*62:147+farRand()*98;
    const x=Math.cos(a)*radius,z=Math.sin(a)*radius;
    const grove=.65+.20*Math.sin(x*.049+z*.026)+.15*Math.sin(z*.061-x*.043);
    if(farRand()>grove||distantOverlap(x,z))continue;
    const speciesRoll=farRand(),species=speciesRoll<.76?0:speciesRoll<.92?1:2;
    const p={x,z,y:ground(x,z)-.04,scale:.74+farRand()*.66,rotation:farRand()*Math.PI*2,
      shade:.76+farRand()*.32,variant:species*2};
    distantPositions.push(p);
    const spatialKey=cellKey(x,z);if(!spatialFar.has(spatialKey))spatialFar.set(spatialKey,[]);
    spatialFar.get(spatialKey).push(p);
    const key=chunkKey(x,z,80);if(!distantBins.has(key))distantBins.set(key,[]);
    distantBins.get(key).push(p);
  }
  for(const [key,list]of distantBins) {
    const group=new THREE.Group();group.name=`Distant forest ${key}`;
    for(const variant of [0,2,4]) {
      const trees=list.filter(p=>p.variant===variant);if(!trees.length)continue;
      const species=variant/2,model=variants[variant][2];
      group.add(createInstances(model.bark,species===1?birchMat:barkMat,trees,{shadows:false,receive:false}),
        createInstances(model.leaves,farFoliageMats[species],trees,{shadows:false,receive:false}));
    }
    root.add(group);
  }
  stats.distantTrees=distantPositions.length;stats.distantChunks=distantBins.size;
  stats.totalTrees=stats.trees+stats.distantTrees;

  let lastLOD=-Infinity;
  let disposed=false;
  const distance2D=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function update(dt,elapsed,camera) {
    if(disposed)return;
    windUniform.value=reducedMotion?0:elapsed;
    // LOD selection is throttled; shader motion remains smooth every frame.
    if(elapsed-lastLOD>.25 || lastLOD===-Infinity) {
      lastLOD=elapsed;stats.visibleTreeBatches=0;
      for(const chunk of chunks) {
        const distance=camera.position.distanceTo(chunk.center);
        const nearThreshold=[24,40,50][level],midThreshold=[72,94,105][level];
        const lod=distance<nearThreshold?0:distance<midThreshold?1:2;
        chunk.lods.forEach((group,index)=>{
          group.visible=index===lod;
          if(index===lod) {
            for(const mesh of group.children)mesh.castShadow=distance<[105,74,91][level]&&
              distance2D(chunk.center,v3(0,0,0))<[40,64,64][level];
            stats.visibleTreeBatches+=group.children.length;
          }
        });
      }
      for(const item of animated) {
        item.group.visible=camera.position.distanceTo(item.center)<[75,100,122][level];
      }
    }
    for(const wisp of mist) {
      if(!reducedMotion) {
        wisp.mesh.position.x=wisp.x+Math.sin(elapsed*.019+wisp.phase)*2.5;
        wisp.mesh.position.z=wisp.z+Math.cos(elapsed*.012+wisp.phase)*1.7;
      }
      wisp.mesh.quaternion.copy(camera.quaternion);
    }
  }
  function dispose() {
    if(disposed)return;disposed=true;scene.remove(root);
    root.traverse(object=>{if(object.isInstancedMesh)object.dispose?.();});
    for(const g of geometries)g.dispose();for(const m of ownedMaterials)m.dispose();for(const t of textures)t.dispose();
  }
  return {update,stats,dispose};
}
