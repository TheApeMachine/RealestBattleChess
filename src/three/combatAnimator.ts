import * as THREE from 'three';
import { FighterRuntime } from '../types/game';
import { ArticulatedPieceRig } from './pieceModels';

export interface VFXPool {
  group: THREE.Group;
  shockwaves: {
    mesh: THREE.Mesh;
    active: boolean;
    timer: number;
    maxDuration: number;
    maxScale: number;
  }[];
  sparks: {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    active: boolean;
    timer: number;
  }[];
  diagonalBeams: THREE.Group;
}

export function createVFXPool(): VFXPool {
  const group = new THREE.Group();

  const shockwaves: VFXPool['shockwaves'] = [];
  const ringGeo = new THREE.RingGeometry(0.35, 0.58, 36);
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    shockwaves.push({
      mesh,
      active: false,
      timer: 0,
      maxDuration: 0.45,
      maxScale: 5.5,
    });
  }

  const sparks: VFXPool['sparks'] = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.08, 0);
  for (let i = 0; i < 36; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(sparkGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    sparks.push({
      mesh,
      vx: 0,
      vy: 0,
      vz: 0,
      active: false,
      timer: 0,
    });
  }

  // Diagonal X-Slash Beams for Bishop/Queen specials
  const diagonalBeams = new THREE.Group();
  const beamGeo = new THREE.BoxGeometry(4.2, 0.09, 0.09);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  });
  const b1 = new THREE.Mesh(beamGeo, beamMat);
  b1.rotation.z = Math.PI / 4;
  const b2 = new THREE.Mesh(beamGeo, beamMat);
  b2.rotation.z = -Math.PI / 4;
  diagonalBeams.add(b1, b2);
  diagonalBeams.visible = false;
  group.add(diagonalBeams);

  return { group, shockwaves, sparks, diagonalBeams };
}

export function spawnHitSparks(
  pool: VFXPool,
  x: number,
  y: number,
  z: number,
  colorHex: number,
  count: number = 10
) {
  let spawned = 0;
  for (const s of pool.sparks) {
    if (!s.active) {
      s.active = true;
      s.timer = 0;
      s.mesh.visible = true;
      s.mesh.position.set(x, y, z);
      s.mesh.scale.setScalar(1.2);
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorHex);
      mat.opacity = 1;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.5;
      s.vx = Math.cos(angle) * speed;
      s.vy = 1.5 + Math.random() * 5.0;
      s.vz = (Math.random() - 0.5) * 4.0;

      spawned++;
      if (spawned >= count) break;
    }
  }
}

export function spawnShockwave(
  pool: VFXPool,
  x: number,
  y: number,
  z: number,
  colorHex: number,
  maxScale: number = 6.0
) {
  for (const sw of pool.shockwaves) {
    if (!sw.active) {
      sw.active = true;
      sw.timer = 0;
      sw.maxDuration = 0.42;
      sw.maxScale = maxScale;
      sw.mesh.visible = true;
      sw.mesh.position.set(x, y + 0.05, z);
      sw.mesh.scale.setScalar(0.5);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorHex);
      mat.opacity = 0.9;
      break;
    }
  }
}

export function updateVFXPool(pool: VFXPool, dt: number) {
  for (const sw of pool.shockwaves) {
    if (!sw.active) continue;
    sw.timer += dt;
    const progress = sw.timer / sw.maxDuration;
    if (progress >= 1) {
      sw.active = false;
      sw.mesh.visible = false;
    } else {
      const scale = THREE.MathUtils.lerp(0.6, sw.maxScale, 1 - Math.pow(1 - progress, 3));
      sw.mesh.scale.setScalar(scale);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
    }
  }

  for (const s of pool.sparks) {
    if (!s.active) continue;
    s.timer += dt;
    if (s.timer >= 0.32) {
      s.active = false;
      s.mesh.visible = false;
    } else {
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 16 * dt;
      s.mesh.rotation.x += 12 * dt;
      s.mesh.rotation.y += 12 * dt;
      const p = s.timer / 0.32;
      s.mesh.scale.setScalar(1.2 * (1 - p));
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - p;
    }
  }
}

export function animateFighterRig(
  rig: ArticulatedPieceRig,
  fighter: FighterRuntime,
  elapsedTime: number,
  dt: number
) {
  const { bodyPivot, headGroup, rightArmPivot, leftArmPivot, specialOrbitGroup } = rig;
  const p =
    fighter.actionDurationMs > 0
      ? Math.min(1, fighter.actionTimerMs / fighter.actionDurationMs)
      : 0;

  let targetBodyRotX = 0;
  let targetBodyRotY = 0;
  let targetBodyRotZ = 0;
  let targetRightArmX = 0;
  let targetRightArmY = 0;
  let targetRightArmZ = 0;
  let targetLeftArmX = 0;
  let targetLeftArmY = 0;
  let targetHeadX = 0;

  // Orbiting blades for Queen
  if (fighter.spec.type === 'q') {
    const orbitSpeed = fighter.action === 'special' ? 14.0 : 2.2;
    specialOrbitGroup.rotation.y += dt * orbitSpeed;
    const radiusScale = fighter.action === 'special' ? 1.0 + Math.sin(p * Math.PI) * 2.6 : 1.0;
    specialOrbitGroup.scale.setScalar(radiusScale);
  }

  switch (fighter.action) {
    case 'idle': {
      targetBodyRotX = Math.sin(elapsedTime * 3.5) * 0.04;
      targetRightArmX = Math.sin(elapsedTime * 3.5 + 0.5) * 0.08 - 0.15;
      targetLeftArmX = -Math.sin(elapsedTime * 3.5) * 0.06 - 0.1;
      break;
    }
    case 'walk_fwd': {
      targetBodyRotX = 0.16;
      targetRightArmX = Math.sin(elapsedTime * 11) * 0.25 - 0.2;
      targetLeftArmX = -Math.sin(elapsedTime * 11) * 0.25 - 0.15;
      break;
    }
    case 'walk_back': {
      targetBodyRotX = -0.1;
      targetRightArmX = -0.25;
      targetLeftArmX = -0.35;
      break;
    }
    case 'dash_fwd': {
      targetBodyRotX = 0.42;
      targetRightArmX = -0.65;
      targetLeftArmX = 0.35;
      break;
    }
    case 'dash_back': {
      targetBodyRotX = -0.32;
      targetRightArmX = 0.45;
      targetLeftArmX = -0.5;
      break;
    }
    case 'jump': {
      targetBodyRotX = -0.18;
      targetRightArmX = -0.75;
      targetLeftArmX = -0.55;
      break;
    }
    case 'block': {
      targetBodyRotX = -0.08;
      targetBodyRotY = -0.35;
      targetLeftArmX = -0.95;
      targetLeftArmY = 0.55;
      targetRightArmX = -0.55;
      break;
    }
    case 'parry_flash': {
      targetBodyRotY = 0.45;
      targetLeftArmX = -1.2;
      targetLeftArmY = -0.45;
      targetRightArmX = -0.9;
      break;
    }
    case 'light_1':
    case 'light_3': {
      // Fast forward thrust / slash
      const thrustArc = Math.sin(p * Math.PI);
      targetBodyRotX = 0.22 * thrustArc;
      targetBodyRotY = -0.35 * thrustArc;
      targetRightArmX = -1.35 * thrustArc;
      targetRightArmY = -0.2 * thrustArc;
      break;
    }
    case 'light_2': {
      // Backhand horizontal cleave
      const cleaveArc = Math.sin(p * Math.PI);
      targetBodyRotY = 0.55 * cleaveArc;
      targetRightArmX = -1.1 * cleaveArc;
      targetRightArmZ = -0.75 * cleaveArc;
      break;
    }
    case 'heavy_1':
    case 'heavy_2': {
      // Windup then overhead crushing swing
      if (p < 0.35) {
        const windup = p / 0.35;
        targetBodyRotX = -0.28 * windup;
        targetRightArmX = -2.2 * windup;
      } else {
        const smash = (p - 0.35) / 0.65;
        const curve = Math.sin(smash * Math.PI);
        targetBodyRotX = 0.38 * curve;
        targetRightArmX = -2.2 + 2.0 * Math.min(1, smash * 1.6);
      }
      break;
    }
    case 'combo_finisher': {
      // Full 360 spinning cyclone + weapon extension
      targetBodyRotY = p * Math.PI * 2;
      targetBodyRotX = 0.28 * Math.sin(p * Math.PI);
      targetRightArmX = -1.45;
      targetRightArmZ = -0.55;
      targetLeftArmX = -0.9;
      break;
    }
    case 'special': {
      // Signature Tactical-Value Special choreography
      targetBodyRotY = p * Math.PI * 4;
      targetBodyRotX = 0.32 * Math.sin(p * Math.PI);
      targetRightArmX = -1.65;
      targetLeftArmX = -1.25;
      break;
    }
    case 'hitstun': {
      const recoil = Math.sin(p * Math.PI);
      targetBodyRotX = -0.42 * recoil;
      targetHeadX = -0.35 * recoil;
      targetRightArmX = 0.4 * recoil;
      targetLeftArmX = 0.4 * recoil;
      break;
    }
    case 'knockdown': {
      const fall = Math.sin(p * Math.PI);
      targetBodyRotX = -0.85 * fall;
      targetBodyRotZ = 0.35 * fall;
      break;
    }
    case 'victory': {
      targetRightArmX = -2.4 + Math.sin(elapsedTime * 5) * 0.15;
      targetBodyRotX = -0.12;
      break;
    }
    case 'defeat': {
      targetBodyRotX = 1.15;
      targetHeadX = 0.45;
      targetRightArmX = 0.5;
      break;
    }
  }

  // Smooth exponential damping on all limb joints
  const k = 22;
  bodyPivot.rotation.x = THREE.MathUtils.damp(bodyPivot.rotation.x, targetBodyRotX, k, dt);
  bodyPivot.rotation.y = THREE.MathUtils.damp(bodyPivot.rotation.y, targetBodyRotY, k, dt);
  bodyPivot.rotation.z = THREE.MathUtils.damp(bodyPivot.rotation.z, targetBodyRotZ, k, dt);

  rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, targetRightArmX, k, dt);
  rightArmPivot.rotation.y = THREE.MathUtils.damp(rightArmPivot.rotation.y, targetRightArmY, k, dt);
  rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, targetRightArmZ, k, dt);

  leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, targetLeftArmX, k, dt);
  leftArmPivot.rotation.y = THREE.MathUtils.damp(leftArmPivot.rotation.y, targetLeftArmY, k, dt);
  headGroup.rotation.x = THREE.MathUtils.damp(headGroup.rotation.x, targetHeadX, k, dt);

  // Boost weapon emissive intensity during attacks, parries, or specials
  const isPowerMove =
    fighter.action === 'special' ||
    fighter.action === 'combo_finisher' ||
    fighter.action === 'parry_flash' ||
    fighter.superArmorActive;

  for (const glowMesh of rig.weaponGlowMeshes) {
    const mat = glowMesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = isPowerMove ? 3.8 : fighter.hitFlashTimerMs > 0 ? 4.5 : 1.7;
  }
}
