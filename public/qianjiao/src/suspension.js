import * as THREE from '../vendor/three.module.js';

const { clamp } = THREE.MathUtils;
const DOWN = new THREE.Vector3(0, 0, -1);
const WORLD_DOWN = new THREE.Vector3(0, -1, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const GRAVITY = 980;

export class Suspension {
  constructor(view, cords, material) {
    this.view = view;
    this.gravity = new THREE.Vector3();
    this.inverse = new THREE.Quaternion();
    this.direction = new THREE.Vector3();
    this.swing = new THREE.Quaternion();
    this.holeWorld = new THREE.Vector3();
    const thread = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    this.hangers = view.meshes.filter(mesh => mesh.userData.item.module === 'drops').map(mesh => {
      const { item, assembledQuaternion, base } = mesh.userData;
      const holeContour = view.data.parts[item.code].holes[0];
      const hole = holeContour.reduce((p, [x, y]) => p.add(new THREE.Vector3(x, y, 0)), new THREE.Vector3())
        .multiplyScalar(1 / holeContour.length).multiply(mesh.scale);
      const bottom = item.code === 'D3';
      const length = bottom ? 15 : 20;
      const pivot = hole.clone().applyQuaternion(assembledQuaternion).add(base).addScaledVector(DOWN, -length);
      const cord = new THREE.Mesh(thread, material);
      cords.add(cord);
      return {
        mesh, hole, pivot, length, cord, bottom,
        radius: bottom ? new THREE.Vector2(9, 0) : new THREE.Vector2(pivot.x, pivot.y),
        slope: new THREE.Vector2(),
        speed: new THREE.Vector2(),
      };
    });
    this.target = new THREE.Vector2();
    this.reset();
  }

  reset() {
    this.angle = undefined;
    this.angularSpeed = 0;
    for (const hanger of this.hangers) {
      hanger.slope.set(0, 0);
      hanger.speed.set(0, 0);
      this.position(hanger);
    }
  }

  position({ mesh, hole, pivot, length, cord, bottom, slope }) {
    this.direction.set(slope.x, slope.y, -1).normalize();
    this.swing.setFromUnitVectors(DOWN, this.direction);
    mesh.quaternion.multiplyQuaternions(this.swing, mesh.userData.assembledQuaternion);
    this.holeWorld.copy(pivot).addScaledVector(this.direction, length);
    mesh.position.copy(hole).applyQuaternion(mesh.quaternion).negate().add(this.holeWorld);
    cord.position.lerpVectors(pivot, this.holeWorld, .5);
    cord.quaternion.setFromUnitVectors(Y_AXIS, this.direction);
    const radius = bottom ? .18 : .22;
    cord.scale.set(radius, length, radius);
  }

  step(dt, angle) {
    const elapsed = clamp(dt, 1 / 120, 1 / 15);
    const change = angle - (this.angle ?? angle);
    this.angle = angle;
    const turn = clamp(Math.atan2(Math.sin(change), Math.cos(change)) / elapsed, -6, 6);
    const previousSpeed = this.angularSpeed;
    this.angularSpeed += (turn - previousSpeed) * (1 - Math.exp(-elapsed * 16));
    if (Math.abs(this.angularSpeed) < .002) this.angularSpeed = 0;
    const angularAcceleration = clamp((this.angularSpeed - previousSpeed) / elapsed, -14, 14);
    const centrifugal = this.angularSpeed ** 2;
    this.gravity.copy(WORLD_DOWN).applyQuaternion(this.inverse.copy(this.view.root.quaternion).invert());
    const steps = Math.ceil(elapsed / .012), step = elapsed / steps;
    let moving = this.angularSpeed !== 0;
    for (const hanger of this.hangers) {
      const { radius, slope, speed, bottom } = hanger;
      this.target.set(
        this.gravity.x + (centrifugal * radius.x + angularAcceleration * radius.y) / GRAVITY,
        this.gravity.y + (centrifugal * radius.y - angularAcceleration * radius.x) / GRAVITY,
      ).clampLength(0, bottom ? .29 : .93);
      const spring = bottom ? 36 : 18;
      const damping = bottom ? 5.8 : 4.4;
      for (let i = 0; i < steps; i++) {
        speed.x += ((this.target.x - slope.x) * spring - speed.x * damping) * step;
        speed.y += ((this.target.y - slope.y) * spring - speed.y * damping) * step;
        slope.addScaledVector(speed, step);
      }
      const settling = slope.distanceToSquared(this.target) > 0.000001 || speed.lengthSq() > 0.000006;
      if (!settling) {
        slope.copy(this.target);
        speed.set(0, 0);
      }
      this.position(hanger);
      moving ||= settling;
    }
    return moving;
  }
}
