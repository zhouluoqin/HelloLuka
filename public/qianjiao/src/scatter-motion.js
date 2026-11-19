import * as THREE from '../vendor/three.module.js';

const { clamp, lerp, degToRad } = THREE.MathUtils;
const FLOOR = -64;
const GRAVITY = 910;
const REBOUND = .21;
const DURATION = 1.85;
const smooth = t => t * t * (3 - 2 * t);
const vertical = new THREE.Vector3(0, 0, 1);

function seededRandom() {
  let seed = 130137;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function subtractFootprint(free, used) {
  const spaces = [];
  for (const area of free) {
    if (used.left >= area.right || used.right <= area.left || used.top >= area.bottom || used.bottom <= area.top) {
      spaces.push(area);
      continue;
    }
    if (used.left > area.left) spaces.push({ ...area, right: used.left });
    if (used.right < area.right) spaces.push({ ...area, left: used.right });
    if (used.top > area.top) spaces.push({ ...area, bottom: used.top });
    if (used.bottom < area.bottom) spaces.push({ ...area, top: used.bottom });
  }
  return spaces.filter((a, index) => !spaces.some((b, other) => other !== index
    && a.left >= b.left && a.top >= b.top && a.right <= b.right && a.bottom <= b.bottom
    && (other < index || a.left > b.left || a.top > b.top || a.right < b.right || a.bottom < b.bottom)));
}

function packFootprints(footprints, width, height) {
  let free = [{ left: -width / 2, top: -height / 2, right: width / 2, bottom: height / 2 }];
  const placed = [];
  for (const item of footprints) {
    let best = null;
    for (const area of free) {
      for (const rotated of [false, true]) {
        const w = rotated ? item.height : item.width, h = rotated ? item.width : item.height;
        const dx = area.right - area.left - w, dy = area.bottom - area.top - h;
        if (dx < 0 || dy < 0) continue;
        const left = area.left + dx * item.cornerX, top = area.top + dy * item.cornerY;
        const distance = Math.hypot(left + w / 2, top + h / 2);
        const score = Math.min(dx, dy) + Math.max(dx, dy) * .15 + distance * .12;
        if (!best || score < best.score) best = { left, top, right: left + w, bottom: top + h, rotated, score };
      }
    }
    if (!best) return null;
    placed.push(best);
    free = subtractFootprint(free, best);
  }
  return placed;
}

function restingPositions(actors, random) {
  const footprints = actors.map(actor => {
    const angle = (random() - .5) * .65;
    const c = Math.cos(angle), s = Math.abs(Math.sin(angle));
    const width = (actor.half.x * c + actor.half.y * s + 4) * 2;
    const height = (actor.half.x * s + actor.half.y * c + 4) * 2;
    return { actor, angle, width, height, cornerX: Number(random() > .5), cornerY: Number(random() > .5) };
  }).sort((a, b) => b.width * b.height - a.width * a.height);

  let scale = 1, placed;
  do {
    placed = packFootprints(footprints, 840 * scale, 660 * scale);
    scale *= 1.13;
  } while (!placed);

  const left = Math.min(...placed.map(p => p.left)), right = Math.max(...placed.map(p => p.right));
  const top = Math.min(...placed.map(p => p.top)), bottom = Math.max(...placed.map(p => p.bottom));
  for (const [index, { actor, angle }] of footprints.entries()) {
    const box = placed[index];
    const x = (box.left + box.right - left - right) / 2 + (random() - .5) * 6;
    const y = (box.top + box.bottom - top - bottom) / 2 + (random() - .5) * 6;
    actor.rest = new THREE.Vector3(x, y, FLOOR + actor.half.z);
    actor.restRotation = new THREE.Quaternion().setFromAxisAngle(vertical, angle + (box.rotated ? Math.PI / 2 : 0));
    actor.mesh.userData.flatQuaternion = actor.restRotation;
    actor.mesh.userData.flatPosition = actor.rest.clone().sub(actor.center.clone().applyQuaternion(actor.restRotation));
  }
  return { x: (right - left) / 2, y: (bottom - top) / 2 };
}

function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(146,54,89,.65)');
  gradient.addColorStop(.53, 'rgba(146,54,89,.24)');
  gradient.addColorStop(1, 'rgba(146,54,89,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class ScatterMotion {
  constructor(view) {
    this.view = view;
    const random = seededRandom();
    this.actors = view.meshes.map(mesh => {
      const half = mesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(.5);
      const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).multiply(mesh.scale);
      const start = center.clone().applyQuaternion(mesh.quaternion).add(mesh.position);
      const launch = 77 + random() * 65;
      const fall = (launch + Math.sqrt(launch ** 2 + 2 * GRAVITY * (start.z - FLOOR - half.z))) / GRAVITY;
      return {
        mesh, center, half, start, launch, fall,
        delay: random() * .47 + (1 - clamp(start.z / 210, 0, 1)) * .12,
        twist: (random() * 2 - 1) * 2.45,
        impactSpeed: GRAVITY * fall - launch,
      };
    });
    this.extent = restingPositions(this.actors, random);
    this.center = new THREE.Vector3();
    this.spin = new THREE.Quaternion();
    this.spinAngle = new THREE.Euler();
    this.shadow = new THREE.Object3D();
    this.ground = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: .32, depthWrite: false, toneMapped: false }),
      this.actors.length,
    );
    this.ground.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ground.frustumCulled = false;
    this.ground.renderOrder = -1;
    this.ground.visible = false;
    view.root.add(this.ground);
  }

  setPose(amount) {
    const time = amount * DURATION;
    for (const actor of this.actors) {
      const { mesh, start, rest, center, half, restRotation, launch, fall } = actor;
      const { base, assembledQuaternion, flatPosition } = mesh.userData;
      const age = time - actor.delay;
      mesh.visible = true;
      if (age <= 0) {
        mesh.position.copy(base);
        mesh.quaternion.copy(assembledQuaternion);
        continue;
      }
      const impact = actor.impactSpeed * REBOUND;
      const bounceTime = 2 * impact / GRAVITY;
      const bounceAge = age - fall;
      if (bounceAge >= bounceTime) {
        mesh.position.copy(flatPosition);
        mesh.quaternion.copy(restRotation);
        continue;
      }
      const t = clamp(age / fall, 0, 1);
      const wobble = Math.sin(Math.PI * t) * actor.twist;
      this.spin.setFromEuler(this.spinAngle.set(wobble * .6, wobble * .45, wobble));
      mesh.quaternion.slerpQuaternions(assembledQuaternion, restRotation, smooth(t)).multiply(this.spin);
      this.center.lerpVectors(start, rest, smooth(t));
      const { x, y, z, w } = mesh.quaternion;
      const clearance = Math.abs(2 * (x * z - y * w)) * half.x
        + Math.abs(2 * (y * z + x * w)) * half.y
        + Math.abs(1 - 2 * (x * x + y * y)) * half.z;
      const height = age < fall ? start.z + (launch - GRAVITY * age / 2) * age
        : rest.z + (impact - GRAVITY * bounceAge / 2) * bounceAge;
      this.center.z = Math.max(FLOOR + clearance, height);
      mesh.position.copy(center).applyQuaternion(mesh.quaternion).negate().add(this.center);
    }
    this.updateShadows(amount > 0);
  }

  updateShadows(active) {
    this.ground.visible = active;
    if (!active) return;
    for (const [index, actor] of this.actors.entries()) {
      const { mesh, center, half, restRotation } = actor;
      this.center.copy(center).applyQuaternion(mesh.quaternion).add(mesh.position);
      const contact = 1 - clamp((this.center.z - half.z - FLOOR) / 70, 0, 1);
      this.shadow.position.set(this.center.x + 2, this.center.y - 2, FLOOR - .08);
      this.shadow.quaternion.copy(restRotation);
      this.shadow.scale.set((half.x + 7) * 1.12 * contact, (half.y + 7) * 1.12 * contact, 1);
      this.shadow.updateMatrix();
      this.ground.setMatrixAt(index, this.shadow.matrix);
    }
    this.ground.instanceMatrix.needsUpdate = true;
  }

  cameraPose(amount) {
    const { camera } = this.view;
    const t = smooth(clamp(amount * 1.28, 0, 1));
    const aspect = camera.aspect;
    const fov = 2 * Math.tan(degToRad(camera.fov) / 2);
    const upright = Math.max(633, 283 / (fov * aspect));
    const spread = Math.max((this.extent.x + 42) * 2 / (fov * aspect), (this.extent.y + 84) * 2 / fov) * 1.14;
    return {
      target: new THREE.Vector3(0, lerp(9, FLOOR - 85, t), 0),
      direction: new THREE.Vector3(.62, .25, 1).lerp(new THREE.Vector3(.08, 1.65, .91), t),
      distance: lerp(upright, spread, t),
    };
  }
}
