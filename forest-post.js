/**
 * Depth-based occlusion, shadowed height-fog scattering and restrained grading.
 * Eight stable ray samples follow the actual sun depth map, including cutout
 * leaves. The lower quality profile skips the extra render pass entirely.
 */
export function createForestPost({THREE,renderer,scene,camera,sun,enabled=true}) {
  if(!enabled) return {render:()=>renderer.render(scene,camera),resize(){},dispose(){}};
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
  // The default framebuffer's antialiasing does not cover an offscreen pass.
  // Resolve a multisampled target before reading colour and scene depth.
  target.samples=Math.min(4,renderer.capabilities.maxSamples||4);
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const uniforms={tColor:{value:target.texture},tDepth:{value:target.depthTexture},
    resolution:{value:new THREE.Vector2(1,1)},inverseProjection:{value:camera.projectionMatrixInverse},
    projection:{value:camera.projectionMatrix},aoStrength:{value:.30},
    cameraWorld:{value:camera.matrixWorld},sunShadowMatrix:{value:new THREE.Matrix4()},
    sunShadow:{value:null},volumeEnabled:{value:0},shadowBias:{value:0},
    sunDirection:{value:new THREE.Vector3(-.56,.69,-.29).normalize()},
    scatteringColor:{value:new THREE.Color('#fff1d9')},scatteringStrength:{value:.0026},
    mistBaseHeight:{value:2.2}};
  const sunPosition=new THREE.Vector3(),sunTarget=new THREE.Vector3();
  const material=new THREE.ShaderMaterial({uniforms,defines:{DREVOFORM_VOLUME:0},depthTest:false,depthWrite:false,toneMapped:true,
    vertexShader:['varying vec2 vUv;','void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}'].join('\n'),
    fragmentShader:[
      '#include <common>',
      'uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 resolution;',
      'uniform mat4 inverseProjection;uniform mat4 projection;uniform float aoStrength;varying vec2 vUv;',
      '#if DREVOFORM_VOLUME',
      'uniform mat4 cameraWorld;uniform mat4 sunShadowMatrix;uniform sampler2DShadow sunShadow;',
      'uniform float volumeEnabled;uniform float shadowBias;uniform float scatteringStrength;uniform float mistBaseHeight;',
      'uniform vec3 sunDirection;uniform vec3 scatteringColor;',
      '#endif',
      'vec3 viewAt(vec2 uv,float d){vec4 p=inverseProjection*vec4(uv*2.0-1.0,d*2.0-1.0,1.0);return p.xyz/p.w;}',
      '#if DREVOFORM_VOLUME',
      'float visibleSun(vec3 world){vec4 projected=sunShadowMatrix*vec4(world,1.0);vec3 s=projected.xyz/projected.w;',
      ' if(any(lessThan(s,vec3(0.0)))||any(greaterThan(s,vec3(1.0))))return 1.0;',
      ' return texture(sunShadow,vec3(s.xy,s.z+shadowBias));}',
      'vec3 scatterMist(vec3 color,vec3 viewPosition){',
      ' vec3 origin=cameraWorld[3].xyz;vec3 surface=(cameraWorld*vec4(viewPosition,1.0)).xyz;',
      ' vec3 ray=surface-origin;float rayLength=min(length(ray),130.0);vec3 direction=normalize(ray);',
      ' float stepLength=rayLength/8.0;float transmittance=1.0;float scattered=0.0;',
      // A fixed screen-space offset reduces ray-step banding. No frame/time
      // component is added: fog stays stable instead of sparkling in motion.
      ' float jitter=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));',
      ' float cosine=dot(direction,sunDirection);float g=.28;',
      ' float phase=.65*(1.0-g*g)/pow(max(1.0+g*g-2.0*g*cosine,.01),1.5);',
      ' for(int i=0;i<8;i++){vec3 world=origin+direction*((float(i)+jitter)*stepLength);',
      '  float density=exp(-max(world.y-mistBaseHeight,0.0)/4.0);',
      '  float extinction=density*scatteringStrength*stepLength;',
      '  float segmentTransmission=exp(-extinction);',
      '  scattered+=transmittance*(1.0-segmentTransmission)*visibleSun(world)*phase;',
      '  transmittance*=segmentTransmission;',
      ' }return color*max(transmittance,.88)+scatteringColor*min(scattered,.085);}',
      '#endif',
      'void main(){vec3 color=texture2D(tColor,vUv).rgb;float depth=texture2D(tDepth,vUv).r;',
      ' if(depth<0.99995){vec3 p=viewAt(vUv,depth);vec3 dx=dFdx(p),dy=dFdy(p);',
      '  vec3 n=normalize(cross(dx,dy));if(n.z<0.0)n=-n;',
      '  float radius=clamp(1.7*projection[1][1]/max(-p.z,1.0),0.0015,0.060);float occlusion=0.0;',
      '  for(int i=0;i<8;i++){float angle=float(i)*2.39996323;float ring=(float(i)+1.0)/8.0;',
      '   vec2 offset=vec2(cos(angle),sin(angle))*radius*sqrt(ring);offset.x*=resolution.y/resolution.x;',
      '   vec2 sampleUV=clamp(vUv+offset,vec2(.001),vec2(.999));',
      '   vec3 q=viewAt(sampleUV,texture2D(tDepth,sampleUV).r);vec3 delta=q-p;float dist=length(delta);',
      '   float horizon=max(dot(n,delta/max(dist,.001))-.16,0.0);occlusion+=horizon*(1.0-smoothstep(.15,2.8,dist));',
      '  }color*=1.0-clamp(occlusion*.125*aoStrength,0.0,.20);}',
      '#if DREVOFORM_VOLUME',
      ' if(volumeEnabled>.5)color=scatterMist(color,viewAt(vUv,min(depth,.999999)));',
      '#endif',
      ' vec2 edge=vUv*(1.0-vUv);float vignette=pow(clamp(edge.x*edge.y*16.0,0.0,1.0),.13);color*=mix(.92,1.0,vignette);',
      ' gl_FragColor=vec4(color,1.0);',
      ' #include <tonemapping_fragment>','#include <colorspace_fragment>','}'
    ].join('\n')});
  const postScene=new THREE.Scene(),postCamera=new THREE.Camera();
  const geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,material);
  quad.frustumCulled=false;postScene.add(quad);
  return {render(){
      renderer.setRenderTarget(target);renderer.render(scene,camera);
      // The light allocates/refreshes its depth texture during the scene pass.
      const shadow=sun?.shadow?.map?.depthTexture;
      const supported=Boolean(sun?.castShadow&&shadow&&shadow.compareFunction!=null);
      if(material.defines.DREVOFORM_VOLUME!==(supported?1:0)){
        material.defines.DREVOFORM_VOLUME=supported?1:0;material.needsUpdate=true;
      }
      uniforms.volumeEnabled.value=supported?1:0;
      uniforms.sunShadow.value=supported?shadow:null;
      if(supported){
        uniforms.sunShadowMatrix.value.copy(sun.shadow.matrix);
        uniforms.shadowBias.value=sun.shadow.bias||0;
        sun.getWorldPosition(sunPosition);sun.target.getWorldPosition(sunTarget);
        uniforms.sunDirection.value.subVectors(sunPosition,sunTarget).normalize();
        uniforms.scatteringColor.value.copy(sun.color).multiplyScalar(Math.min(sun.intensity*.32,1.25));
      }
      renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
    },
    resize(w,h){target.setSize(w,h);uniforms.resolution.value.set(w,h);},
    dispose(){target.dispose();material.dispose();geometry.dispose();}};
}
