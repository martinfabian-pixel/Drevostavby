/** Small, depth-based contact occlusion. No bloom or temporal image history. */
export function createUnbuiltPost({ THREE, renderer, scene, camera, enabled = true }) {
  if (!enabled) return { render: () => renderer.render(scene, camera), resize() {}, dispose() {} };
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  target.samples = Math.min(4, renderer.capabilities.maxSamples || 4);
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const uniforms = {
    tColor: { value: target.texture }, tDepth: { value: target.depthTexture },
    inverseProjection: { value: camera.projectionMatrixInverse }, projection: { value: camera.projectionMatrix },
    resolution: { value: new THREE.Vector2(1, 1) }, strength: { value: .46 }
  };
  const material = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, toneMapped: true,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      #include <common>
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform mat4 inverseProjection;
      uniform mat4 projection;
      uniform vec2 resolution;
      uniform float strength;
      vec3 viewAt(vec2 uv,float depth){
        vec4 point=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);
        return point.xyz/point.w;
      }
      void main(){
        vec3 color=texture2D(tColor,vUv).rgb;
        float depth=texture2D(tDepth,vUv).r;
        if(depth<.99995){
          vec3 p=viewAt(vUv,depth);
          vec3 n=normalize(cross(dFdx(p),dFdy(p)));
          if(n.z<0.)n=-n;
          float radius=clamp(.78*projection[1][1]/max(-p.z,1.),.001,.065);
          float occlusion=0.;
          for(int i=0;i<8;i++){
            float angle=float(i)*2.39996323;
            float ring=sqrt((float(i)+.6)/8.);
            vec2 offset=vec2(cos(angle),sin(angle))*radius*ring;
            offset.x*=resolution.y/resolution.x;
            vec2 sampleUV=clamp(vUv+offset,vec2(.001),vec2(.999));
            vec3 q=viewAt(sampleUV,texture2D(tDepth,sampleUV).r);
            vec3 delta=q-p;
            float distance=length(delta);
            float horizon=max(dot(n,delta/max(distance,.001))-.12,0.);
            occlusion+=horizon*(1.-smoothstep(.04,1.1,distance));
          }
          color*=1.-clamp(occlusion*.125*strength,0.,.19);
        }
        vec2 edge=vUv*(1.-vUv);
        float vignette=pow(clamp(edge.x*edge.y*16.,0.,1.),.13);
        color*=mix(.95,1.,vignette);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const postScene = new THREE.Scene(), postCamera = new THREE.Camera();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  postScene.add(quad);
  return {
    render() {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
    resize(width, height) { target.setSize(width, height); uniforms.resolution.value.set(width, height); },
    dispose() { target.dispose(); material.dispose(); geometry.dispose(); }
  };
}
