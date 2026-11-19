import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { geometryFor, matrixFor } from './geometry.js';
import { stageFor } from './content.js';
import { AssemblyMotion } from './assembly-motion.js';

const views=new Set(), edgeCache=new Map();
const clamp=THREE.MathUtils.clamp;
const ease=t=>1-(1-t)**3;
let lastFrame=0;
function tick(now) {
  const dt=Math.min((now-lastFrame)/1000,2)||.016;lastFrame=now;
  for(const view of views)if(view.visible&&!view.failed&&!document.hidden)view.frame(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function edgesFor(code,geometry) {
  if(!edgeCache.has(code))edgeCache.set(code,new THREE.EdgesGeometry(geometry,36));
  return edgeCache.get(code);
}

export class ObjectViewer {
  constructor(element,data,{kind='product',onSelect=()=>{},onRotateChange=()=>{},onError=()=>{}}={}) {
    this.element=element;this.data=data;this.kind=kind;this.onSelect=onSelect;this.onRotateChange=onRotateChange;this.onError=onError;
    this.meshes=[];this.visible=true;this.failed=false;this.progress=0;this.explosion=0;this.explosionTarget=0;this.bay=0;this.xray=false;this.lampEnabled=true;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
    this.renderer.setClearColor(0x000000,0);
    this.renderer.shadowMap.enabled=false;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.91;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    const canvas=this.renderer.domElement;
    canvas.setAttribute('aria-hidden','true');element.append(canvas);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(kind==='part'?32:33,1,.3,2500);
    this.controls=new OrbitControls(this.camera,canvas);
    if(kind==='hero'){this.controls.enableZoom=false;canvas.style.touchAction='pan-y';}
    this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.enablePan=false;
    this.controls.minDistance=12;this.controls.maxDistance=1450;this.controls.zoomSpeed=.8;
    this.controls.autoRotate=['product','hero'].includes(kind)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls.autoRotateSpeed=.55;
    this.controls.addEventListener('start',()=>{if(this.controls.autoRotate){this.controls.autoRotate=false;this.onRotateChange(false);}});
    this.root=new THREE.Group();this.root.rotation.x=-Math.PI/2;this.root.position.y=-85;this.scene.add(this.root);
    const pmrem=new THREE.PMREMGenerator(this.renderer), room=new RoomEnvironment();
    this.environment=pmrem.fromScene(room,.025).texture;this.scene.environment=this.environment;
    room.dispose();pmrem.dispose();
    const hemi=new THREE.HemisphereLight(0xffffff,0x78414e,.7);this.scene.add(hemi);
    const key=new THREE.DirectionalLight(0xfff7e9,1.7);key.position.set(150,280,270);this.scene.add(key);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-230,right:230,top:250,bottom:-230,near:1,far:900});key.shadow.normalBias=.18;key.shadow.bias=-.00004;
    const rim=new THREE.DirectionalLight(0xffe6ec,1.4);rim.position.set(-220,100,-150);this.scene.add(rim);
    const fill=new THREE.DirectionalLight(0xffffff,.5);fill.position.set(80,-90,200);this.scene.add(fill);
    this.makeMaterials();
    if(kind==='part')this.setPart('A3');
    else {
      let sceneItems=data.scene;
      if(kind==='bay') {
        sceneItems=sceneItems.filter(i=>(i.code==='B2'&&[1,2].includes(i.index))||(['B3','B5','B4'].includes(i.code)&&i.index===1));
        const a=Math.PI/6;
        sceneItems=[{code:'T9',index:1,origin:[0,0,119],u:[-Math.sin(a),Math.cos(a),0],v:[Math.cos(a),Math.sin(a),0],normal:[0,0,1],module:'B'},...sceneItems];
      }
      sceneItems.forEach(item=>this.addPart(item));
      if(kind!=='bay'){this.makeCords();this.makeLamp();}
      this.root.updateMatrixWorld(true);this.resize();
      if(kind==='assembly'){this.motion=new AssemblyMotion(this);this.setProgress(0);}else this.fit();
      if(kind==='bay')this.setBay(0,true);
    }
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);
    this.intersectionObserver=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;},{rootMargin:'100px'});this.intersectionObserver.observe(element);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.down=null;
    this.tooltip=document.createElement('span');this.tooltip.className='model-tooltip';this.tooltip.hidden=true;element.append(this.tooltip);
    canvas.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY};this.tooltip.hidden=true;});
    canvas.addEventListener('pointerup',e=>{
      if(this.kind==='hero')return;
      if(!this.down||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>7)return;
      const hit=this.hit(e);if(hit&&data.production_codes.includes(hit.userData.item.code)){this.select(hit.userData.item.code,hit.userData.item.index);this.onSelect(hit.userData.item);}
      this.down=null;
    });
    canvas.addEventListener('pointermove',e=>{
      if(e.pointerType==='touch'||e.buttons){this.tooltip.hidden=true;return;}
      const hit=this.hit(e);this.tooltip.hidden=!hit;
      if(hit){const item=hit.userData.item;this.tooltip.textContent=`${item.code} · ${data.parts[item.code].name} / ${item.index}`;const rect=element.getBoundingClientRect();this.tooltip.style.left=Math.min(e.clientX-rect.left,rect.width-170)+'px';this.tooltip.style.top=e.clientY-rect.top+'px';}
    });
    canvas.addEventListener('pointerleave',()=>{this.tooltip.hidden=true;this.down=null;});
    element.addEventListener('keydown',e=>this.onKey(e));
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.fail('三维显示暂时中断，可刷新页面重新加载。');});
    element.classList.add('is-ready');element.dataset.modelReady='true';element.dataset.pieces=String(this.meshes.length);
    views.add(this);this.resize();
  }

  makeMaterials() {
    const base={metalness:0,roughness:.13,transmission:.58,transparent:true,opacity:.68,depthWrite:false,vertexColors:true,forceSinglePass:true,thickness:3,attenuationColor:new THREE.Color(0xdc3d6b),attenuationDistance:65,ior:1.49,clearcoat:1,clearcoatRoughness:.12,side:THREE.DoubleSide,envMapIntensity:.85};
    this.materials={
      shell:new THREE.MeshPhysicalMaterial({...base,color:0xffffff}),
      panel:new THREE.MeshPhysicalMaterial({...base,color:0xffffff,opacity:.56,roughness:.14}),
      tile:new THREE.MeshPhysicalMaterial({...base,color:0xffffff,opacity:.65}),
      rail:new THREE.MeshPhysicalMaterial({...base,color:0xffffff,opacity:.78,transmission:.4}),
      key:new THREE.MeshPhysicalMaterial({...base,color:0xffffff,opacity:.76}),
      trial:new THREE.MeshPhysicalMaterial({...base,color:0xfff1f6,opacity:.6}),
      xray:new THREE.MeshBasicMaterial({color:0xc9657d,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false}),
      selected:new THREE.MeshPhysicalMaterial({...base,color:0xb53d59,vertexColors:false,opacity:.9,transmission:.12,roughness:.2}),
      moving:new THREE.MeshPhysicalMaterial({...base,color:0xdb688d,vertexColors:false,opacity:.8,transmission:.28,roughness:.17}),
    };
    this.edgeMaterial=new THREE.LineBasicMaterial({color:0x995266,transparent:true,opacity:.1});
    this.xrayEdgeMaterial=new THREE.LineBasicMaterial({color:0xc27087,transparent:true,opacity:.58,depthWrite:false});
    this.selectedEdgeMaterial=new THREE.LineBasicMaterial({color:0x932b49,transparent:true,opacity:.8});
  }

  materialFor(code) {
    if(code==='A3')return this.materials.panel;
    if(code==='B4'||code==='C4')return this.materials.tile;
    if(code==='B5'||code==='C6')return this.materials.rail;
    if(code.startsWith('K'))return this.materials.key;
    if(code==='T9')return this.materials.trial;
    return this.materials.shell;
  }

  addPart(item) {
    const part=this.data.parts[item.code],geometry=geometryFor(part,this.data.thickness),mesh=new THREE.Mesh(geometry,this.materialFor(item.code));
    mesh.castShadow=false;mesh.receiveShadow=false;
    const m=matrixFor(item);m.decompose(mesh.position,mesh.quaternion,mesh.scale);
    const base=mesh.position.clone(),center=geometry.boundingSphere.center.clone().applyMatrix4(m);
    const radial=new THREE.Vector3(center.x,center.y,0);if(radial.length()<1)radial.set(1,0,0);radial.normalize();
    const stage=stageFor(item),entry=new THREE.Vector3(0,0,62);
    if(['A3','A4'].includes(item.code))entry.copy(radial).multiplyScalar(68);
    if(item.code.startsWith('K'))entry.copy(new THREE.Vector3(...item.u)).multiplyScalar(34);
    if(['B4','C4'].includes(item.code))entry.set(...item.normal).multiplyScalar(-52);
    if(['B5','C6'].includes(item.code))entry.set(...this.data.scene.find(i=>i.code===item.code[0]+'4'&&i.index===item.index).normal).multiplyScalar(-44);
    if(item.code.startsWith('D'))entry.copy(radial).multiplyScalar(45).add(new THREE.Vector3(0,0,-24));
    const spread=(item.code.startsWith('K')?88:['A1','A2','B1','C1'].includes(item.code)?12:48);
    const exploded=radial.clone().multiplyScalar(spread).add(new THREE.Vector3(0,0,(stage-4)*24));
    const edge=new THREE.LineSegments(edgesFor(item.code,geometry),this.edgeMaterial);mesh.add(edge);
    edge.visible=['bay','part'].includes(this.kind);
    mesh.name=`${item.code}-${String(item.index).padStart(2,'0')}`;
    mesh.userData={item,base,entry,exploded,stage,edge,baseMaterial:mesh.material};
    this.root.add(mesh);this.meshes.push(mesh);return mesh;
  }

  makeCords() {
    this.cords=new THREE.Group();this.root.add(this.cords);
    const mat=new THREE.MeshStandardMaterial({color:0xe6b7c2,roughness:.65,transparent:true,opacity:.85});
    const cord=(points,r)=>{const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));this.cords.add(new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(4,points.length*3),r,5,false),mat));};
    for(const a of this.data.rope_angles)cord([[22*Math.cos(a),22*Math.sin(a),98],[22*Math.cos(a),22*Math.sin(a),200],[0,0,221]],.32);
    cord([[0,0,221],[0,0,245]],.45);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;cord([[95*Math.cos(a),95*Math.sin(a),128],[95*Math.cos(a),95*Math.sin(a),108]],.21);}
    for(const x of [-18,18])cord([[x,0,0],[0,0,-11],[0,0,-26]],.17);
  }

  makeLamp() {
    this.lamp=new THREE.Group();this.lamp.position.set(0,0,53);this.root.add(this.lamp);
    this.bulbMaterial=new THREE.MeshStandardMaterial({color:0xd5395c,emissive:0xe61c4c,emissiveIntensity:1.3,roughness:.36});
    const bulb=new THREE.Mesh(new THREE.CapsuleGeometry(9,23,5,20),this.bulbMaterial);bulb.rotation.x=Math.PI/2;this.lamp.add(bulb);
    const socket=new THREE.Mesh(new THREE.CylinderGeometry(7,7,6,18),new THREE.MeshStandardMaterial({color:0xbb8490,roughness:.5}));socket.rotation.x=Math.PI/2;socket.position.z=-23;this.lamp.add(socket);
    this.innerLight=new THREE.PointLight(0xff3158,2400,155,2);this.lamp.add(this.innerLight);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d'),gradient=context.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,80,110,.65)');gradient.addColorStop(.3,'rgba(255,65,105,.24)');gradient.addColorStop(1,'rgba(255,50,90,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    this.glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xff738c,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending}));this.glow.scale.set(75,75,1);this.lamp.add(this.glow);
    this.setLamp(true);
  }

  setLamp(active) {
    this.lampEnabled=active;
    if(this.innerLight){this.innerLight.visible=active;this.glow.visible=active;this.bulbMaterial.emissiveIntensity=active?1.3:0;}
    this.element.dataset.lamp=String(active);
  }

  setProgress(value) {
    this.progress=clamp(value,0,10);this.element.dataset.step=this.progress.toFixed(2);
    this.updateTransforms();
  }

  updateTransforms() {
    if(this.kind==='part')return;
    if(this.kind==='assembly'&&!this.explosionTarget&&this.explosion<.001){this.motion?.update(this.progress);return;}
    if(this.kind==='bay') {
      const tile=this.meshes.find(m=>m.userData.item.code==='B4'),rail=this.meshes.find(m=>m.userData.item.code==='B5');
      tile.visible=this.bay>0;tile.position.copy(tile.userData.base).addScaledVector(this.bayDirection,this.bayTileOffset||0);
      rail.position.copy(rail.userData.base).addScaledVector(this.bayDirection,this.bayRailOffset||0);return;
    }
    let placed=0;
    const grouped={};for(const mesh of this.meshes){const stage=mesh.userData.stage;(grouped[stage]??=[]).push(mesh);}
    for(const mesh of this.meshes){
      const {base,entry,exploded,stage}=mesh.userData;
      if(this.kind==='assembly')mesh.quaternion.copy(mesh.userData.assembledQuaternion);
      let phase=this.kind==='assembly'?clamp(this.progress-stage+1,0,1):1;
      if(phase>0&&phase<1){const siblings=grouped[stage];phase=clamp(phase*1.25-(siblings.indexOf(mesh)/siblings.length)*.23,0,1);}
      mesh.visible=phase>0;
      mesh.position.copy(base).addScaledVector(entry,1-ease(phase)).addScaledVector(exploded,this.explosion);
      if(phase>=.995)placed++;
    }
    if(this.cords)this.cords.visible=(this.kind!=='assembly'||this.progress>=9.99)&&this.explosion<.08;
    this.element.dataset.placed=String(placed);
  }

  setExplosion(active) {
    this.explosionTarget=active?1:0;
    if(active){this.motion?.trays&&(this.motion.trays.visible=false);this.motion?.guides&&(this.motion.guides.visible=false);this.motion?.update(10);this.progress=10;this.explosion=1;this.updateTransforms();this.fit();}
    else {this.explosion=0;if(this.motion)this.motion.trays.visible=true;this.updateTransforms();this.motion?.reset();}
    this.element.dataset.exploded=String(active);
  }

  setXray(active) {this.xray=active;this.applyStyles();this.element.dataset.xray=String(active);}
  select(code,index=1) {this.selected={code,index};this.applyStyles();this.element.dataset.selection=`${code}-${index}`;}
  clearSelection() {this.selected=null;this.applyStyles();delete this.element.dataset.selection;}
  applyStyles() {
    for(const mesh of this.meshes){const {item,edge,baseMaterial}=mesh.userData;const selected=this.selected?.code===item.code&&this.selected?.index===item.index;mesh.material=selected?this.materials.selected:this.xray?this.materials.xray:baseMaterial;edge.visible=!!(selected||this.xray||['bay','part'].includes(this.kind));edge.material=selected?this.selectedEdgeMaterial:this.xray?this.xrayEdgeMaterial:this.edgeMaterial;}
  }

  setBay(step,immediate=false) {
    this.bay=step;
    this.bayDirection=new THREE.Vector3(...this.data.scene.find(i=>i.code==='B4'&&i.index===1).normal).negate();
    this.bayTileTarget=step===1?23:0;this.bayRailTarget=step===0?17:0;
    if(immediate){this.bayTileOffset=this.bayTileTarget;this.bayRailOffset=this.bayRailTarget;}
    this.element.dataset.bay=String(step);this.updateTransforms();
  }

  setPart(code) {
    this.root.clear();this.meshes=[];this.root.rotation.set(0,0,0);this.root.position.set(0,0,0);this.selected=null;
    const part=this.data.parts[code],geometry=geometryFor(part,this.data.thickness),mesh=new THREE.Mesh(geometry,this.materialFor(code));
    const center=geometry.boundingBox.getCenter(new THREE.Vector3());mesh.position.copy(center).negate();
    const edge=new THREE.LineSegments(edgesFor(code,geometry),this.edgeMaterial);mesh.add(edge);
    mesh.userData={item:{code,index:1},base:mesh.position.clone(),baseMaterial:mesh.material,edge};this.meshes.push(mesh);this.root.add(mesh);
    this.root.updateMatrixWorld(true);this.resize();this.fit();this.element.dataset.part=code;
  }

  fit() {
    this.root.updateMatrixWorld(true);
    // Fit the assembled envelope; hidden future parts still define the full scene bounds.
    const bounds=new THREE.Box3();if(this.kind==='assembly')for(const mesh of this.meshes)bounds.expandByObject(mesh);else bounds.setFromObject(this.root);
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    if(bounds.isEmpty())return;
    const fov=THREE.MathUtils.degToRad(this.camera.fov),aspect=this.camera.aspect||1;
    const distance=Math.max(size.y,size.x/aspect,size.z*.9)*.5/Math.tan(fov/2)*(this.kind==='part'?1.4:1.24);
    const direction=this.kind==='part'?new THREE.Vector3(.23,.14,1):this.kind==='bay'?new THREE.Vector3(.5,.7,1):new THREE.Vector3(.62,.25,1);
    direction.normalize();this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,Math.max(distance,20));
    this.controls.minDistance=Math.max(10,distance*.32);this.controls.maxDistance=Math.max(100,distance*2.8);
    this.camera.lookAt(center);this.controls.update();this.savedCamera=this.camera.position.clone();this.savedTarget=center.clone();
  }

  reset() {
    if(this.kind==='assembly'&&this.motion&&!this.explosionTarget){this.motion.reset();return;}
    if(this.kind==='assembly'&&this.explosionTarget){this.explosion=0;this.updateTransforms();this.fit();return;}
    if(this.savedCamera){this.camera.position.copy(this.savedCamera);this.controls.target.copy(this.savedTarget);this.controls.update();}
  }

  zoom(factor) {
    const vector=this.camera.position.clone().sub(this.controls.target),distance=clamp(vector.length()/factor,this.controls.minDistance,this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(vector.setLength(distance));this.controls.update();
    this.element.dataset.zoom=this.camera.position.distanceTo(this.controls.target).toFixed(1);
  }

  setRotate(active) {this.controls.autoRotate=active;this.element.dataset.rotating=String(active);}
  resize() {
    const {width,height}=this.element.getBoundingClientRect();if(width<1||height<1)return;
    const old=this.camera.aspect;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);
    if(this.kind==='assembly')this.camera.setViewOffset(width,height,0,Math.min(75,height*.08),width,height);
    if(this.savedCamera&&Math.abs(old-this.camera.aspect)>.35)this.fit();
  }

  hit(event) {
    const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.raycaster.intersectObjects(this.meshes.filter(m=>m.visible),false)[0]?.object;
  }

  onKey(e) {
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;
    e.preventDefault();this.controls.autoRotate=false;this.onRotateChange(false);
    if(this.motion)this.motion.userPaused=true;
    if(e.key==='+'||e.key==='=')return this.zoom(1.13);
    if(e.key==='-')return this.zoom(1/1.13);
    if(e.key==='0')return this.reset();
    const offset=this.camera.position.clone().sub(this.controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    if(e.key==='ArrowLeft')spherical.theta-=.13;
    if(e.key==='ArrowRight')spherical.theta+=.13;
    if(e.key==='ArrowUp')spherical.phi=clamp(spherical.phi-.13,.12,Math.PI-.12);
    if(e.key==='ArrowDown')spherical.phi=clamp(spherical.phi+.13,.12,Math.PI-.12);
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));this.controls.update();
    this.element.dataset.orbit=`${spherical.theta.toFixed(2)},${spherical.phi.toFixed(2)}`;
  }

  frame(dt) {
    this.onFrame?.(dt);
    if(Math.abs(this.explosion-this.explosionTarget)>.0001){this.explosion=THREE.MathUtils.damp(this.explosion,this.explosionTarget,5,dt);this.updateTransforms();}
    if(this.kind==='bay'){this.bayTileOffset=THREE.MathUtils.damp(this.bayTileOffset||0,this.bayTileTarget,5,dt);this.bayRailOffset=THREE.MathUtils.damp(this.bayRailOffset||0,this.bayRailTarget,5,dt);this.updateTransforms();}
    if(this.motion&&!this.explosionTarget)this.motion.camera(dt);
    if(this.innerLight&&this.lampEnabled)this.innerLight.intensity=2400*(1+Math.sin(performance.now()*.0014)*.025);
    this.controls.update(dt);this.renderer.render(this.scene,this.camera);
  }

  fail(message) {
    this.failed=true;this.renderer.domElement.style.display='none';this.element.classList.remove('is-ready');this.element.classList.add('failed');this.element.dataset.modelReady='false';this.onError(message);
  }
}
