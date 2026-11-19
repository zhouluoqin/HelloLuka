import * as THREE from '../vendor/three.module.js';
import { matrixFor } from './geometry.js';

const clamp=THREE.MathUtils.clamp;
const smooth=t=>t*t*(3-2*t);
const vec=a=>new THREE.Vector3(...a);

// Each plate lifts from its resting pose, turns, and then slides straight into its slot.
export class AssemblyMotion {
  constructor(view) {
    this.view=view;this.data=view.data;this.follow=true;this.userPaused=false;this.activeStage=-1;
    this.actors=new Map();
    for(const mesh of view.meshes){
      const d=mesh.userData,item=d.item;
      this.actors.set(item.code+'-'+item.index,mesh);
      if(['A3','A4'].includes(item.code))d.entry.set(0,0,40);
      d.insertOffset=d.entry.clone().normalize().multiplyScalar(22);
      d.insertStart=d.base.clone().add(d.insertOffset);
      [d.phaseStart,d.phaseEnd]=this.window(mesh);
    }
    this.guides=new THREE.Group();this.guides.visible=false;view.root.add(this.guides);
    this.lineMaterial=new THREE.LineBasicMaterial({color:0xb72e4b,transparent:true,opacity:.9,depthTest:false});
  }

  window(mesh) {
    const {item,stage}=mesh.userData,c=item.code,front=item.index===6||item.index===1&&['A2','A4','A1','S1','S2','S3','C5','B1','C1','D1'].includes(c);
    if(stage===1){if(c==='A2')return [0,.28];if(c==='A4')return front?[.24,.84]:[.48,.96];return [.78,1];}
    if(stage===3){if(c==='S1'||c==='K2')return [0,.38];if(c==='A1')return [.28,.86];return [.8,1];}
    if(stage===4){if(c==='B1')return [0,.3];if(c==='B2')return front?[.2,.86]:[.47,.97];if(c==='B3')return [.42,.96];return [.78,1];}
    if(stage===7){if(c==='S2')return [0,.35];if(c==='C1')return [.25,.6];if(c==='C2'||c==='C3')return front?[.38,.92]:[.55,.98];return [.8,1];}
    if(stage===8){if(c==='C6')return front?[0,.52]:[.15,.58];return front?[.46,.94]:[.67,1];}
    if(stage===9){if(c==='S3')return [0,.55];if(c==='C5')return [.4,.94];return [.72,1];}
    return front?[0,.78]:[.79,1];
  }

  phase(mesh,progress) {
    const {stage,phaseStart,phaseEnd}=mesh.userData;
    return clamp((progress-stage+1-phaseStart)/(phaseEnd-phaseStart),0,1);
  }

  update(progress,resetPositions=false) {
    this.progress=progress;
    const stage=progress===0?0:Math.min(10,Math.ceil(progress));
    if(stage!==this.activeStage){this.activeStage=stage;this.userPaused=false;this.buildGuides(stage);}
    let placed=0;
    for(const mesh of this.view.meshes){
      const d=mesh.userData,t=this.phase(mesh,progress);
      mesh.visible=true;
      if(t===1)placed++;
      if(resetPositions||t!==d.motionPhase) {
        if(t===0){mesh.position.copy(d.flatPosition);mesh.quaternion.copy(d.flatQuaternion);}
        else if(t===1){mesh.position.copy(d.base);mesh.quaternion.copy(d.assembledQuaternion);}
        else if(t<.56){
          const u=smooth(t/.56);
          mesh.position.lerpVectors(d.flatPosition,d.insertStart,u);mesh.position.z+=Math.sin(Math.PI*u)*55;
          mesh.quaternion.slerpQuaternions(d.flatQuaternion,d.assembledQuaternion,u);
        }else{
          const insert=smooth((t-.56)/.44);
          mesh.position.copy(d.base).addScaledVector(d.insertOffset,1-insert);mesh.quaternion.copy(d.assembledQuaternion);
        }
        d.motionPhase=t;
      }
      const moving=t>0&&t<1;
      const selected=this.view.selected?.code===d.item.code&&this.view.selected?.index===d.item.index;
      mesh.material=selected?this.view.materials.selected:this.view.xray?this.view.materials.xray:moving?this.view.materials.moving:d.baseMaterial;
      d.edge.material=selected||moving?this.view.selectedEdgeMaterial:this.view.xray?this.view.xrayEdgeMaterial:this.view.edgeMaterial;
      d.edge.visible=!!(selected||moving||this.view.xray);
    }
    const stagePhase=progress-stage+1;
    if(stagePhase>.18&&stagePhase<.93&&!this.view.xray){
      const mates={1:[['A2',2]],2:[['A2',2]],3:[['A4',1]],4:[['B1',1]],5:[['B2',1],['B2',6],['B3',6]],6:[['B5',6]],7:[['C1',1]],8:[['C6',6]],9:[['S3',1]]}[stage]??[];
      for(const pair of mates){const mate=this.actors.get(pair.join('-'));if(mate&&mate.userData.motionPhase===1){mate.material=this.view.materials.selected;mate.userData.edge.material=this.view.selectedEdgeMaterial;mate.userData.edge.visible=true;}}
    }
    this.view.element.dataset.placed=String(placed);
    this.view.element.dataset.visiblePieces=String(this.view.meshes.length);
    this.view.scatter.updateShadows(progress<10);
    this.view.setAccessories(progress===10);
    this.guides.visible=stage>0&&progress-stage+1>.25&&progress-stage+1<.92;
    if(this.guides.visible&&this.pathLine){
      const sample=this.exemplar(stage,stagePhase);
      if(sample&&sample!==this.guideActor){
        this.guideActor=sample;
        const p=this.guidePoint,q=p.clone().addScaledVector(sample.userData.insertOffset,24/22);
        this.pathLine.geometry.setFromPoints([p,q]);this.pathLine.computeLineDistances();
      }
    }
  }

  exemplar(stage,phase) {
    const pair={1:phase<.28?['A2',1]:['A4',1],2:['A3',6],3:['A1',1],4:['B2',6],5:['B5',6],6:['B4',6],7:phase<.4?['S2',1]:['C2',6],8:phase<.48?['C6',6]:['C4',6],9:phase<.4?['S3',1]:['C5',1],10:['D1',1]}[stage];
    return pair?this.actors.get(pair.join('-')):null;
  }

  buildGuides(stage) {
    for(const child of this.guides.children)child.geometry?.dispose();
    this.pathLine?.material.dispose();
    this.guides.clear();this.pathLine=null;this.guideActor=null;
    if(!stage)return;
    const specs={1:['A2',2,[59,0,4.5],1],2:['A2',2,[43.1,-24.9,4.5],1],3:['A1',1,[59,0,100],1],4:['B1',1,[20.6,-35.7,119],1],5:['B4',6,[47.7,-27.5,133],2],6:['B4',6,[47.7,-27.5,133],2],7:['C1',1,[17.5,-30.3,158],1],8:['C4',6,[39.7,-22.9,171],2],9:['C5',1,[10,0,190],1],10:['D1',1,[95,0,108],1]}[stage];
    if(!specs)return;
    const [code,index,near,count]=specs,item=this.data.scene.find(i=>i.code===code&&i.index===index),part=this.data.parts[code],m=matrixFor(item),point=vec(near);
    this.guidePoint=point;
    let holes=part.holes.map(h=>({h,center:h.reduce((v,p)=>v.add(new THREE.Vector3(p[0],p[1],0)),new THREE.Vector3()).multiplyScalar(1/h.length).applyMatrix4(m)}));
    holes.sort((a,b)=>a.center.distanceToSquared(point)-b.center.distanceToSquared(point));
    if(code==='B4'||code==='C4')holes=part.holes.slice(0,2).map(h=>({h}));
    for(const {h} of holes.slice(0,count)){const pts=h.map(([x,y])=>new THREE.Vector3(x,y,-1.58).applyMatrix4(m));const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),this.lineMaterial);line.renderOrder=10;this.guides.add(line);}
    this.pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([point,point.clone().add(new THREE.Vector3(0,0,22))]),new THREE.LineDashedMaterial({color:0xc4425c,dashSize:2,gapSize:1,transparent:true,opacity:.6,depthTest:false}));this.pathLine.renderOrder=10;this.pathLine.computeLineDistances();this.guides.add(this.pathLine);
  }

  world(p){return new THREE.Vector3(p.x,p.z-85,-p.y);}

  camera(dt,immediate=false) {
    if(!this.follow||this.userPaused)return false;
    const stage=this.activeStage,phase=this.progress-stage+1;
    let target,direction,distance;
    const aspect=this.view.camera.aspect||1;
    if(stage===0){
      ({target,direction,distance}=this.view.scatter.cameraPose(1));
    }
    else {
      const sample=this.exemplar(stage,phase),d=sample?.userData;
      const joints={1:[59,0,5],2:[43,-25,4],3:[59,0,101],4:[23,-38,119],5:[47.7,-27.5,133],6:[47.7,-27.5,134],7:[24,-28,158],8:[39.7,-22.9,171],9:[10,0,194],10:[95,0,108]};
      const joint=this.world(vec(joints[stage]));
      direction=new THREE.Vector3(.87,stage===6||stage===8?.83:.46,.8);
      distance=stage===5?165:stage===6?155:stage===8?145:180;
      if(d){
        const localCenter=sample.geometry.boundingSphere.center.clone().multiply(sample.scale).applyQuaternion(sample.quaternion).add(sample.position);
        const movingCenter=this.world(localCenter);
        const local=d.motionPhase,blend=smooth(clamp((local-.42)/.32,0,1));target=movingCenter.lerp(joint,blend);
        const p=this.data.parts[d.item.code];distance=THREE.MathUtils.lerp(Math.max(p.width,p.height)*2.6+70,distance,blend);
        if(local<.35)direction.set(.2,1.4,1);
      }else target=joint;
      if(phase>.91){const t=smooth((phase-.91)/.09);target.lerp(new THREE.Vector3(0,20,0),t);distance=THREE.MathUtils.lerp(distance,590,t);direction.lerp(new THREE.Vector3(.68,.3,1),t);}
      // Portrait screens keep the current joint within the narrower horizontal field.
      if(aspect<1)distance/=Math.max(aspect,.55);
      if(this.progress<.24){
        const ready=this.view.scatter.cameraPose(1),t=smooth(this.progress/.24);
        target.lerp(ready.target,1-t);
        direction.lerp(ready.direction,1-t);
        distance=THREE.MathUtils.lerp(ready.distance,distance,t);
      }
      if(this.progress===10)({target,direction,distance}=this.view.scatter.cameraPose(0));
    }
    const shot=stage===0?'scattered-parts':phase>.91?'assembled':'joint-'+stage;
    this.view.element.dataset.cameraShot=shot;
    return this.view.moveCamera({target,direction,distance},dt,immediate);
  }

  setFollow(active){this.follow=active;this.userPaused=false;}
  reset(){this.userPaused=false;const follow=this.follow;this.follow=true;this.camera(1,true);this.follow=follow;}
}
