import * as THREE from '../vendor/three.module.js';
const cache = new Map();

export function shapeFromPart(part) {
  const toVectors=points=>points.map(([x,y])=>new THREE.Vector2(x,y));
  let outer=toVectors(part.outline);
  if(!THREE.ShapeUtils.isClockWise(outer))outer=outer.reverse();
  const shape=new THREE.Shape(outer);
  for(const contour of part.holes) {
    let hole=toVectors(contour);
    if(THREE.ShapeUtils.isClockWise(hole))hole=hole.reverse();
    shape.holes.push(new THREE.Path(hole));
  }
  return shape;
}

export function geometryFor(part,thickness=3) {
  if(cache.has(part.code))return cache.get(part.code);
  const geometry=new THREE.ExtrudeGeometry(shapeFromPart(part),{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.translate(0,0,-thickness/2);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const position=geometry.attributes.position,colors=new Float32Array(position.count*3);
  const deep=new THREE.Color(0xb81c49),clear=new THREE.Color(0xffdce8),color=new THREE.Color();
  const yMin=geometry.boundingBox.min.y,height=geometry.boundingBox.max.y-yMin||1;
  for(let i=0;i<position.count;i++){
    let t=THREE.MathUtils.clamp((position.getY(i)-yMin)/height,0,1);
    if(['B4','C4'].includes(part.code))t=1-t;
    color.copy(deep).lerp(clear,t*.88);colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  cache.set(part.code,geometry);
  return geometry;
}

export function matrixFor(item) {
  const m=new THREE.Matrix4().makeBasis(new THREE.Vector3(...item.u),new THREE.Vector3(...item.v),new THREE.Vector3(...item.normal));
  m.setPosition(...item.origin);
  return m;
}

export function partPath(part) {
  return [part.outline,...part.holes].map(loop=>'M'+loop.map(p=>p.map(n=>Number(n.toFixed(3))).join(',')).join('L')+'Z').join('');
}

export function partSvg(part) {
  const [x,y]=part.bounds;const pad=Math.max(part.width,part.height)*.07;
  return `<svg viewBox="${x-pad} ${y-pad} ${part.width+pad*2} ${part.height+pad*2}" aria-hidden="true"><path d="${partPath(part)}" fill-rule="evenodd" vector-effect="non-scaling-stroke"/></svg>`;
}
