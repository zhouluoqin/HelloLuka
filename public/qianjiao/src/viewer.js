import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { geometryFor, matrixFor } from './geometry.js';
import { stageFor } from './content.js?v=3';
import { AssemblyMotion } from './assembly-motion.js?v=3';
import { ScatterMotion } from './scatter-motion.js?v=3';
import { Suspension } from './suspension.js?v=3';

const views=new Set(), edgeCache=new Map();
const clamp=THREE.MathUtils.clamp;
const coarsePointer=matchMedia('(pointer: coarse)');
let scheduledFrame=0;
let studioReflection;

function scheduleRender() {
  if(!scheduledFrame&&!document.hidden)scheduledFrame=requestAnimationFrame(renderViews);
}

function renderViews(now) {
  let needsAnotherFrame=false;
  for(const view of views) {
    if(!view.visible||view.failed||(!view.dirty&&!view.animating)) {
      view.lastFrame=null;
      continue;
    }
    const elapsed=view.lastFrame===null?view.frameInterval:now-view.lastFrame;
    if(elapsed+1>=view.frameInterval) {
      view.lastFrame=now;
      view.animating=view.frame(Math.min(elapsed/1000,.25));
      view.dirty=false;
    }
    if(view.animating||view.dirty)needsAnotherFrame=true;
    else view.lastFrame=null;
  }
  scheduledFrame=0;
  if(needsAnotherFrame)scheduleRender();
}

document.addEventListener('visibilitychange',()=>{
  for(const view of views) {
    view.lastFrame=null;
    if(!document.hidden)view.invalidate();
  }
});

function reflectionMap() {
  if(studioReflection)return studioReflection;
  // A small reflection texture gives the acrylic soft highlights without a scene capture per viewer.
  const image=document.createElement('canvas');
  image.width=256;image.height=128;
  const ctx=image.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,0,image.height);
  gradient.addColorStop(0,'#eee3e5');
  gradient.addColorStop(.46,'#8b7880');
  gradient.addColorStop(1,'#4d3742');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,image.width,image.height);
  ctx.fillStyle='#fff6f2';ctx.fillRect(23,21,48,34);
  ctx.fillStyle='#e9d6e0';ctx.fillRect(159,42,58,20);
  studioReflection=new THREE.CanvasTexture(image);
  studioReflection.mapping=THREE.EquirectangularReflectionMapping;
  studioReflection.colorSpace=THREE.SRGBColorSpace;
  return studioReflection;
}

function edgesFor(code,geometry) {
  if(!edgeCache.has(code))edgeCache.set(code,new THREE.EdgesGeometry(geometry,36));
  return edgeCache.get(code);
}

export class ObjectViewer {
  constructor(element,data,{kind='assembly',onSelect=()=>{},onRotateChange=()=>{},onError=()=>{}}={}) {
    this.element=element;this.data=data;this.kind=kind;this.onSelect=onSelect;this.onRotateChange=onRotateChange;this.onError=onError;
    this.meshes=[];this.visible=true;this.active=true;this.inViewport=true;this.failed=false;
    this.progress=0;this.explosionTarget=false;this.xray=false;this.lampEnabled=true;this.scrollLinked=true;
    this.manualYaw=0;
    this.dirty=true;this.animating=false;this.lastFrame=null;this.frameInterval=1000/(coarsePointer.matches?30:60);
    this.renderer=new THREE.WebGLRenderer({antialias:!coarsePointer.matches,alpha:true,powerPreference:coarsePointer.matches?'low-power':'high-performance'});
    this.renderer.setClearColor(0x000000,0);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.91;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    const canvas=this.renderer.domElement;
    canvas.setAttribute('aria-hidden','true');element.append(canvas);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(kind==='part'?32:33,1,.3,kind==='part'?2500:7000);
    this.controls=new OrbitControls(this.camera,canvas);
    // OrbitControls sets an inline touch-action; the viewport CSS owns gesture policy.
    canvas.style.removeProperty('touch-action');
    this.controls.enableZoom=kind==='part';
    this.controls.enableDamping=true;this.controls.dampingFactor=coarsePointer.matches?.15:.1;this.controls.enablePan=false;
    this.controls.minDistance=kind==='part'?12:50;this.controls.maxDistance=kind==='part'?1450:6200;this.controls.zoomSpeed=.8;
    this.controls.autoRotateSpeed=.55;
    this.controls.addEventListener('change',()=>this.invalidate());
    this.root=new THREE.Group();this.root.rotation.x=-Math.PI/2;this.root.position.y=-85;this.scene.add(this.root);
    this.scene.environment=reflectionMap();
    const hemi=new THREE.HemisphereLight(0xffffff,0x78414e,.7);this.scene.add(hemi);
    const key=new THREE.DirectionalLight(0xfff7e9,1.7);key.position.set(150,280,270);this.scene.add(key);
    const rim=new THREE.DirectionalLight(0xffe6ec,1.4);rim.position.set(-220,100,-150);this.scene.add(rim);
    const fill=new THREE.DirectionalLight(0xffffff,.5);fill.position.set(80,-90,200);this.scene.add(fill);
    this.makeMaterials();
    if(kind==='part')this.setPart('A3');
    else {
      data.scene.forEach(item=>this.addPart(item));
      this.makeCords();this.makeLamp();
      this.root.updateMatrixWorld(true);this.resize();
      this.scatter=new ScatterMotion(this);
      this.motion=new AssemblyMotion(this);
      this.setStoryPose('hero');
    }
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);
    this.intersectionObserver=new IntersectionObserver(([entry])=>{
      this.inViewport=entry.isIntersecting;
      this.setActive(this.active);
    });
    this.intersectionObserver.observe(element);
    this.bindPointer(canvas);
    if(kind==='assembly')this.bindLanternTurn();
    element.addEventListener('keydown',e=>this.onKey(e));
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.fail('三维显示暂时中断，可刷新页面重新加载');});
    element.dataset.pieces=String(this.meshes.length);
    views.add(this);this.resize();this.invalidate();
  }

  invalidate() {
    this.dirty=true;
    if(this.visible&&!this.failed)scheduleRender();
  }

  setActive(active) {
    this.active=active;
    const visible=active&&this.inViewport;
    if(this.visible===visible)return;
    this.visible=visible;
    this.lastFrame=null;
    if(visible)this.invalidate();
  }

  setStoryPose(scene,{yaw=0,tilt=0,spread=0,turnWeight=1}={}) {
    const entering=scene!==this.storyScene;
    const oldSpread=this.spread;
    const first=!this.storyScene;
    this.storyScene=scene;
    this.spread=spread;
    this.storyYaw=yaw;
    this.turnWeight=scene==='hero'?turnWeight:0;
    this.root.rotation.set(-Math.PI/2+tilt,0,yaw+this.manualYaw*this.turnWeight);
    if(entering){
      this.storyCameraPaused=false;
      this.motion.userPaused=false;
      this.controls.enabled=scene!=='hero';
      this.controls.enableZoom=scene==='assembly'&&!this.scrollLinked;
    }
    if(scene==='assembly'){
      if(entering)this.updateTransforms(true);
      return;
    }
    this.motion.guides.visible=false;
    if(entering||scene==='scatter'&&oldSpread!==spread){
      this.scatter.setPose(spread);
      this.applyStyles();
      this.setAccessories(scene==='hero'||spread===0);
      this.element.dataset.visiblePieces=String(this.meshes.length);
      this.element.dataset.placed=String(spread===0?this.meshes.length:0);
      if(scene==='scatter')this.storyCameraPaused=false;
    }
    this.element.dataset.cameraShot=scene==='hero'?'lantern':spread===1?'scattered-parts':'falling-parts';
    if(first)this.moveCamera(this.scatter.cameraPose(0),1,true);
  }

  turnLantern(delta) {
    this.manualYaw=THREE.MathUtils.euclideanModulo(this.manualYaw+delta+Math.PI,Math.PI*2)-Math.PI;
    // The top cord lies on the lantern's local Z axis, so yaw keeps its attachment point fixed.
    this.root.rotation.z=this.storyYaw+this.manualYaw*this.turnWeight;
    this.invalidate();
  }

  bindLanternTurn() {
    const area=this.element;
    let pointer=null;
    area.addEventListener('pointerdown',event=>{
      if(this.storyScene!=='hero'||event.button!==0||!event.isPrimary)return;
      pointer={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,turning:false};
      area.setPointerCapture(event.pointerId);
    });
    area.addEventListener('pointermove',event=>{
      if(this.storyScene!=='hero'||pointer?.id!==event.pointerId)return;
      if(!pointer.turning){
        const dx=Math.abs(event.clientX-pointer.startX),dy=Math.abs(event.clientY-pointer.startY);
        if(dx<5||dx<=dy)return;
        pointer.turning=true;
      }
      this.turnLantern((event.clientX-pointer.lastX)*.012);
      pointer.lastX=event.clientX;
    });
    const endTurn=event=>{if(pointer?.id===event.pointerId)pointer=null;};
    area.addEventListener('pointerup',endTurn);
    area.addEventListener('pointercancel',endTurn);
    area.addEventListener('lostpointercapture',endTurn);
  }

  setScrollLinked(active) {
    this.scrollLinked=active;
    this.controls.enableZoom=this.storyScene==='assembly'&&!active;
    this.element.dataset.scrollLinked=String(active);
  }

  pauseForOrbit() {
    if(this.storyScene==='assembly')this.motion.userPaused=true;
    else this.storyCameraPaused=true;
    if(this.controls.autoRotate){
      this.setRotate(false);
      this.onRotateChange(false);
    }
  }

  bindPointer(canvas) {
    const canSelect=this.kind==='assembly';
    const hasTooltip=this.kind==='part';
    let down=null,tooltip,lastHover=0;
    if(canSelect||hasTooltip){
      this.raycaster=new THREE.Raycaster();
      this.pointer=new THREE.Vector2();
    }
    if(hasTooltip){
      tooltip=document.createElement('span');
      tooltip.className='model-tooltip';
      tooltip.hidden=true;
      this.element.append(tooltip);
    }
    canvas.addEventListener('pointerdown',event=>{
      if(this.storyScene==='hero')return;
      if(!event.isPrimary){
        down=null;
        if(this.controls.enableZoom)this.pauseForOrbit();
        return;
      }
      down={x:event.clientX,y:event.clientY};
      if(tooltip)tooltip.hidden=true;
    });
    canvas.addEventListener('pointermove',event=>{
      if(this.storyScene==='hero')return;
      if(down){
        const dx=Math.abs(event.clientX-down.x),dy=Math.abs(event.clientY-down.y);
        const singleTouchScroll=event.pointerType==='touch'&&!document.fullscreenElement?.contains(canvas);
        if(singleTouchScroll&&(dx<8||dx<=dy)){
          // Let the browser scroll; keep this gesture out of OrbitControls until it moves sideways.
          event.stopImmediatePropagation();
          return;
        }
        if(Math.hypot(dx,dy)>7){
          down=null;
          this.pauseForOrbit();
        }
      }
      if(!tooltip||event.pointerType==='touch'||event.buttons||event.timeStamp-lastHover<60)return;
      lastHover=event.timeStamp;
      const hit=this.hit(event);
      tooltip.hidden=!hit;
      if(!hit)return;
      const item=hit.userData.item,rect=this.element.getBoundingClientRect();
      tooltip.textContent=`${item.code} · ${this.data.parts[item.code].name} / ${item.index}`;
      tooltip.style.left=Math.max(0,Math.min(event.clientX-rect.left,rect.width-170))+'px';
      tooltip.style.top=event.clientY-rect.top+'px';
    },{capture:true,passive:true});
    canvas.addEventListener('pointerup',event=>{
      const isTap=down&&event.button===0&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<=7;
      down=null;
      if(!canSelect||this.storyScene==='hero'||!isTap)return;
      const hit=this.hit(event),item=hit?.userData.item;
      if(item&&this.data.production_codes.includes(item.code)){
        this.select(item.code,item.index);
        this.onSelect(item);
      }
    });
    const clearPointer=()=>{
      down=null;
      if(tooltip)tooltip.hidden=true;
    };
    canvas.addEventListener('pointercancel',clearPointer);
    canvas.addEventListener('pointerleave',clearPointer);
    canvas.addEventListener('wheel',()=>{
      if(this.controls.enableZoom)this.pauseForOrbit();
    },{capture:true,passive:true});
  }

  makeMaterials() {
    // Alpha blending keeps the red gradient and the light behind it without a second framebuffer pass.
    const base={metalness:0,roughness:.22,transparent:true,opacity:.46,depthWrite:false,vertexColors:true,forceSinglePass:true,clearcoat:.72,clearcoatRoughness:.18,side:THREE.DoubleSide,envMapIntensity:.65};
    this.materials={
      shell:new THREE.MeshPhysicalMaterial(base),
      panel:new THREE.MeshPhysicalMaterial({...base,opacity:.38}),
      tile:new THREE.MeshPhysicalMaterial({...base,opacity:.45}),
      rail:new THREE.MeshPhysicalMaterial({...base,opacity:.62}),
      key:new THREE.MeshPhysicalMaterial({...base,opacity:.56}),
      xray:new THREE.MeshBasicMaterial({color:0xc9657d,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false}),
      selected:new THREE.MeshPhysicalMaterial({...base,color:0xb53d59,vertexColors:false,opacity:.87}),
      moving:new THREE.MeshPhysicalMaterial({...base,color:0xdb688d,vertexColors:false,opacity:.69}),
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
    edge.visible=this.kind==='part';
    mesh.name=`${item.code}-${String(item.index).padStart(2,'0')}`;
    mesh.userData={item,base,entry,exploded,stage,edge,baseMaterial:mesh.material,assembledQuaternion:mesh.quaternion.clone()};
    this.root.add(mesh);this.meshes.push(mesh);return mesh;
  }

  makeCords() {
    this.cords=new THREE.Group();this.root.add(this.cords);
    const mat=new THREE.MeshStandardMaterial({color:0xe6b7c2,roughness:.65,transparent:true,opacity:.85});
    const cord=(points,r)=>{const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));this.cords.add(new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(4,points.length*3),r,5,false),mat));};
    for(const a of this.data.rope_angles)cord([[22*Math.cos(a),22*Math.sin(a),98],[22*Math.cos(a),22*Math.sin(a),200],[0,0,221]],.32);
    cord([[0,0,221],[0,0,245]],.45);
    for(const x of [-18,18])cord([[x,0,0],[0,0,-11]],.17);
    this.suspension=new Suspension(this,this.cords,mat);
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
    if(this.lampEnabled===active&&this.element.dataset.lamp!==undefined)return;
    this.lampEnabled=active;
    if(this.innerLight){this.innerLight.visible=active;this.glow.visible=active;this.bulbMaterial.emissiveIntensity=active?1.3:0;}
    this.element.dataset.lamp=String(active);
    this.invalidate();
  }

  setAccessories(active) {
    if(this.accessories===active)return;
    this.accessories=active;
    this.cords.visible=active;
    this.lamp.visible=active;
    if(active)this.suspension.reset();
  }

  setProgress(value) {
    this.progress=clamp(value,0,10);this.element.dataset.step=this.progress.toFixed(2);
    if(this.storyScene==='assembly')this.updateTransforms();
    this.invalidate();
  }

  updateTransforms(resetPositions=false) {
    if(!this.explosionTarget){this.motion.update(this.progress,resetPositions);return;}
    this.scatter.updateShadows(false);
    this.motion.guides.visible=false;
    this.setAccessories(false);
    for(const mesh of this.meshes){
      const {base,exploded,assembledQuaternion}=mesh.userData;
      mesh.position.copy(base).add(exploded);
      mesh.quaternion.copy(assembledQuaternion);
    }
  }

  setExplosion(active) {
    this.explosionTarget=active;
    if(this.storyScene==='assembly'){
      this.updateTransforms(true);
      if(active)this.fit();
      else this.motion.reset();
    }
    this.element.dataset.exploded=String(active);
    this.invalidate();
  }

  setXray(active) {this.xray=active;this.applyStyles();this.element.dataset.xray=String(active);}
  select(code,index=1) {this.selected={code,index};this.applyStyles();this.element.dataset.selection=`${code}-${index}`;}
  clearSelection() {this.selected=null;this.applyStyles();delete this.element.dataset.selection;}
  applyStyles() {
    for(const mesh of this.meshes){const {item,edge,baseMaterial}=mesh.userData;const selected=this.selected?.code===item.code&&this.selected?.index===item.index;mesh.material=selected?this.materials.selected:this.xray?this.materials.xray:baseMaterial;edge.visible=!!(selected||this.xray||this.kind==='part');edge.material=selected?this.selectedEdgeMaterial:this.xray?this.xrayEdgeMaterial:this.edgeMaterial;}
    if(this.storyScene==='assembly'&&!this.explosionTarget)this.motion.update(this.progress);
    this.invalidate();
  }

  setPart(code) {
    this.root.clear();this.meshes=[];this.root.rotation.set(0,0,0);this.root.position.set(0,0,0);this.selected=null;
    const part=this.data.parts[code],geometry=geometryFor(part,this.data.thickness),mesh=new THREE.Mesh(geometry,this.materialFor(code));
    const center=geometry.boundingBox.getCenter(new THREE.Vector3());mesh.position.copy(center).negate();
    const edge=new THREE.LineSegments(edgesFor(code,geometry),this.edgeMaterial);mesh.add(edge);
    mesh.userData={item:{code,index:1},base:mesh.position.clone(),baseMaterial:mesh.material,edge};this.meshes.push(mesh);this.root.add(mesh);
    this.root.updateMatrixWorld(true);this.resize();this.fit();this.element.dataset.part=code;
    this.invalidate();
  }

  fit() {
    this.root.updateMatrixWorld(true);
    // Fit the assembled envelope; hidden future parts still define the full scene bounds.
    const bounds=new THREE.Box3();if(this.kind==='assembly')for(const mesh of this.meshes)bounds.expandByObject(mesh);else bounds.setFromObject(this.root);
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    if(bounds.isEmpty())return;
    const fov=THREE.MathUtils.degToRad(this.camera.fov),aspect=this.camera.aspect||1;
    const distance=Math.max(size.y,size.x/aspect,size.z*.9)*.5/Math.tan(fov/2)*(this.kind==='part'?1.4:1.24);
    const direction=this.kind==='part'?new THREE.Vector3(.23,.14,1):new THREE.Vector3(.62,.25,1);
    direction.normalize();this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,Math.max(distance,20));
    if(this.kind==='part'){
      this.controls.minDistance=Math.max(10,distance*.32);this.controls.maxDistance=Math.max(100,distance*2.8);
    }
    this.camera.lookAt(center);this.controls.update();this.savedCamera=this.camera.position.clone();this.savedTarget=center.clone();
  }

  reset() {
    this.invalidate();
    if(this.storyScene==='assembly'){if(this.explosionTarget)this.fit();else this.motion.reset();return;}
    if(this.scatter){this.storyCameraPaused=false;this.moveCamera(this.scatter.cameraPose(this.spread),1,true);return;}
    if(this.savedCamera){this.camera.position.copy(this.savedCamera);this.controls.target.copy(this.savedTarget);this.controls.update();}
  }

  moveCamera({target,direction,distance},dt,immediate=false) {
    const {camera,controls}=this;
    const position=direction.normalize().multiplyScalar(clamp(distance,controls.minDistance,controls.maxDistance)).add(target);
    const settled=camera.position.distanceToSquared(position)<.01&&controls.target.distanceToSquared(target)<.01;
    const alpha=immediate||settled?1:1-Math.exp(-dt*5.7);
    camera.position.lerp(position,alpha);controls.target.lerp(target,alpha);
    return !immediate&&!settled;
  }

  zoom(factor) {
    const vector=this.camera.position.clone().sub(this.controls.target),distance=clamp(vector.length()/factor,this.controls.minDistance,this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(vector.setLength(distance));this.controls.update();
    this.element.dataset.zoom=this.camera.position.distanceTo(this.controls.target).toFixed(1);
    this.invalidate();
  }

  setRotate(active) {
    if(this.controls.autoRotate===active)return;
    this.controls.autoRotate=active;
    this.element.dataset.rotating=String(active);
    this.invalidate();
  }

  resize() {
    const width=this.element.clientWidth,height=this.element.clientHeight;
    if(width<1||height<1)return;
    const touchDevice=coarsePointer.matches;
    const pixelBudget=touchDevice?360000:1350000;
    const pixelRatio=Math.min(devicePixelRatio,touchDevice?1:1.25,Math.sqrt(pixelBudget/(width*height)));
    if(width===this.width&&height===this.height&&pixelRatio===this.pixelRatio)return;
    this.width=width;this.height=height;this.pixelRatio=pixelRatio;
    this.frameInterval=1000/(touchDevice?30:60);
    const old=this.camera.aspect;
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    this.renderer.setDrawingBufferSize(width,height,pixelRatio);
    if(this.kind==='assembly')this.camera.setViewOffset(width,height,0,Math.min(88,height*.1),width,height);
    if(this.savedCamera&&(this.kind!=='assembly'||this.explosionTarget)&&Math.abs(old-this.camera.aspect)>.35)this.fit();
    this.invalidate();
  }

  hit(event) {
    const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.raycaster.intersectObjects(this.meshes.filter(m=>m.visible),false)[0]?.object;
  }

  onKey(e) {
    if(this.storyScene==='hero'){
      if(!['ArrowLeft','ArrowRight','0'].includes(e.key))return;
      e.preventDefault();
      this.turnLantern(e.key==='0'?-this.manualYaw:e.key==='ArrowLeft'?-.17:.17);
      return;
    }
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;
    e.preventDefault();this.pauseForOrbit();
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
    this.invalidate();
  }

  frame(dt) {
    const playing=this.onFrame?.(dt);
    let following=false;
    if(this.storyScene==='assembly'&&!this.explosionTarget)following=this.motion.camera(dt);
    if(this.scatter&&this.storyScene!=='assembly'&&!this.storyCameraPaused)following=this.moveCamera(this.scatter.cameraPose(this.spread),dt);
    const rotating=this.controls.update(dt);
    let swinging=false;
    if(this.accessories){
      const yaw=this.root.rotation.z,azimuth=this.controls.getAzimuthalAngle();
      const manualOrbit=this.controls.autoRotate||(this.storyScene==='assembly'?this.motion.userPaused:this.storyCameraPaused);
      this.hangingAngle=(this.hangingAngle??0)+yaw-(this.lastYaw??yaw)+(manualOrbit?(this.lastAzimuth??azimuth)-azimuth:0);
      swinging=this.suspension.step(dt,this.hangingAngle);
      this.lastYaw=yaw;
      this.lastAzimuth=azimuth;
    }
    this.renderer.render(this.scene,this.camera);
    if(!this.ready){
      this.ready=true;
      this.element.classList.add('is-ready');
      this.element.dataset.modelReady='true';
    }
    return !!(playing||following||rotating||swinging||this.controls.autoRotate);
  }

  fail(message) {
    this.failed=true;this.renderer.domElement.style.display='none';this.element.classList.remove('is-ready');this.element.classList.add('failed');this.element.dataset.modelReady='false';this.onError(message);
  }
}
