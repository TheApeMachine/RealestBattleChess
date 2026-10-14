import * as THREE from 'three';
import { FighterRuntime } from '../types/game';
import { ArticulatedPieceRig, FirstPersonViewmodelRig } from './pieceModels';

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
    maxLife: number;
  }[];
  slashArcs: {
    mesh: THREE.Mesh;
    active: boolean;
    timer: number;
    maxDuration: number;
    spinSpeed: number;
  }[];
  debris: {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    rx: number;
    ry: number;
    active: boolean;
    timer: number;
  }[];
  auraPillars: {
    mesh: THREE.Mesh;
    active: boolean;
    timer: number;
    maxDuration: number;
  }[];
}

// Procedural gradient alpha texture for glowing crescent weapon slash trails
function createSlashArcTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.75, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createVFXPool(): VFXPool {
  const group = new THREE.Group();

  // 1. Expanding Floor Shockwave Rings
  const shockwaves: VFXPool['shockwaves'] = [];
  const ringGeo = new THREE.RingGeometry(0.35, 0.62, 40);
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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

  // 2. High-Velocity Hit Sparks
  const sparks: VFXPool['sparks'] = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.075, 0);
  for (let i = 0; i < 56; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
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
      maxLife: 0.36,
    });
  }

  // 3. Curved 3D Weapon Slash Arcs
  const slashArcs: VFXPool['slashArcs'] = [];
  const slashTex = createSlashArcTexture();
  const slashGeo = new THREE.RingGeometry(0.68, 1.38, 28, 1, 0, Math.PI * 1.15);
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      alphaMap: slashTex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(slashGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    slashArcs.push({
      mesh,
      active: false,
      timer: 0,
      maxDuration: 0.22,
      spinSpeed: 14,
    });
  }

  // 4. Bouncing 3D Stone/Marble Debris Chunks on Heavy Smashes
  const debris: VFXPool['debris'] = [];
  const debrisGeo = new THREE.DodecahedronGeometry(0.095, 0);
  for (let i = 0; i < 28; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xd6cfc2 : 0x1e293b,
      roughness: 0.5,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(debrisGeo, mat);
    mesh.castShadow = true;
    mesh.visible = false;
    group.add(mesh);
    debris.push({
      mesh,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      active: false,
      timer: 0,
    });
  }

  // 5. Rising Vertical Energy Pillars for Special Moves & Perfect Parries
  const auraPillars: VFXPool['auraPillars'] = [];
  const pillarGeo = new THREE.CylinderGeometry(0.75, 0.95, 3.8, 28, 1, true);
  pillarGeo.translate(0, 1.9, 0);
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(pillarGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    auraPillars.push({
      mesh,
      active: false,
      timer: 0,
      maxDuration: 0.55,
    });
  }

  return { group, shockwaves, sparks, slashArcs, debris, auraPillars };
}

export function spawnHitSparks(
  pool: VFXPool,
  x: number,
  y: number,
  z: number,
  colorHex: number,
  count: number = 14
) {
  let spawned = 0;
  for (const s of pool.sparks) {
    if (!s.active) {
      s.active = true;
      s.timer = 0;
      s.maxLife = 0.28 + Math.random() * 0.18;
      s.mesh.visible = true;
      s.mesh.position.set(x, y, z);
      const scale = 0.9 + Math.random() * 0.9;
      s.mesh.scale.set(scale * 1.8, scale * 0.5, scale * 0.5);
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorHex);
      mat.opacity = 1;

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 7.5;
      s.vx = Math.cos(angle) * speed;
      s.vy = 2.0 + Math.random() * 6.5;
      s.vz = (Math.random() - 0.5) * 6.0;

      spawned++;
      if (spawned >= count) break;
    }
  }
}

export function spawnSlashArc(
  pool: VFXPool,
  x: number,
  y: number,
  z: number,
  facing: 1 | -1,
  colorHex: number,
  style: 'horizontal' | 'overhead' | 'cyclone'
) {
  for (const arc of pool.slashArcs) {
    if (!arc.active) {
      arc.active = true;
      arc.timer = 0;
      arc.maxDuration = style === 'cyclone' ? 0.34 : 0.2;
      arc.spinSpeed = (style === 'cyclone' ? 22 : 14) * facing;
      arc.mesh.visible = true;
      arc.mesh.position.set(x + facing * 0.35, y, z);

      if (style === 'horizontal') {
        arc.mesh.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.35, 0, facing === 1 ? -0.6 : Math.PI - 0.6);
        arc.mesh.scale.setScalar(1.05);
      } else if (style === 'overhead') {
        arc.mesh.rotation.set(0.2, facing === 1 ? 0 : Math.PI, -0.5);
        arc.mesh.scale.setScalar(1.3);
      } else {
        arc.mesh.rotation.set(Math.PI / 2, 0, 0);
        arc.mesh.scale.setScalar(1.55);
      }

      const mat = arc.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorHex);
      mat.opacity = 0.95;
      break;
    }
  }
}

export function spawnGroundDebris(
  pool: VFXPool,
  x: number,
  z: number,
  count: number = 8
) {
  let spawned = 0;
  for (const d of pool.debris) {
    if (!d.active) {
      d.active = true;
      d.timer = 0;
      d.mesh.visible = true;
      d.mesh.position.set(
        x + (Math.random() - 0.5) * 0.8,
        0.08,
        z + (Math.random() - 0.5) * 0.8
      );
      d.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 4.2;
      d.vx = Math.cos(angle) * spd;
      d.vy = 4.2 + Math.random() * 4.8;
      d.vz = Math.sin(angle) * spd;
      d.rx = (Math.random() - 0.5) * 16;
      d.ry = (Math.random() - 0.5) * 16;

      spawned++;
      if (spawned >= count) break;
    }
  }
}

export function spawnAuraPillar(
  pool: VFXPool,
  x: number,
  z: number,
  colorHex: number
) {
  for (const p of pool.auraPillars) {
    if (!p.active) {
      p.active = true;
      p.timer = 0;
      p.maxDuration = 0.55;
      p.mesh.visible = true;
      p.mesh.position.set(x, 0, z);
      p.mesh.scale.set(0.4, 1.0, 0.4);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorHex);
      mat.opacity = 0.85;
      break;
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
    if (s.timer >= s.maxLife) {
      s.active = false;
      s.mesh.visible = false;
    } else {
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 18 * dt;
      s.mesh.rotation.x += 14 * dt;
      s.mesh.rotation.y += 14 * dt;
      const p = s.timer / s.maxLife;
      s.mesh.scale.setScalar(1.3 * (1 - p));
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - p;
    }
  }

  for (const arc of pool.slashArcs) {
    if (!arc.active) continue;
    arc.timer += dt;
    const p = arc.timer / arc.maxDuration;
    if (p >= 1) {
      arc.active = false;
      arc.mesh.visible = false;
    } else {
      arc.mesh.rotation.z += arc.spinSpeed * dt;
      (arc.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.95;
    }
  }

  for (const d of pool.debris) {
    if (!d.active) continue;
    d.timer += dt;
    if (d.timer >= 0.85) {
      d.active = false;
      d.mesh.visible = false;
    } else {
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.vy -= 22 * dt;
      if (d.mesh.position.y < 0.04) {
        d.mesh.position.y = 0.04;
        d.vy = -d.vy * 0.45;
        d.vx *= 0.7;
        d.vz *= 0.7;
      }
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.y += d.ry * dt;
      const p = d.timer / 0.85;
      if (p > 0.6) {
        d.mesh.scale.setScalar((1 - p) * 2.2);
      }
    }
  }

  for (const pillar of pool.auraPillars) {
    if (!pillar.active) continue;
    pillar.timer += dt;
    const p = pillar.timer / pillar.maxDuration;
    if (p >= 1) {
      pillar.active = false;
      pillar.mesh.visible = false;
    } else {
      const xz = THREE.MathUtils.lerp(0.5, 2.2, 1 - Math.pow(1 - p, 2));
      pillar.mesh.scale.set(xz, 1.0 + p * 0.6, xz);
      pillar.mesh.rotation.y += 8 * dt;
      (pillar.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.75;
    }
  }
}

export function animateFighterRig(
  rig: ArticulatedPieceRig,
  fighter: FighterRuntime,
  elapsedTime: number,
  dt: number
) {
  const { bodyPivot, headGroup, rightArmPivot, leftArmPivot, capePivot, specialOrbitGroup } = rig;
  rig.surpriseGroup.visible = false;

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
  let targetCapeX = 0.16 + Math.sin(elapsedTime * 4) * 0.06;

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
      targetCapeX = 0.48 + Math.sin(elapsedTime * 12) * 0.1;
      break;
    }
    case 'walk_back': {
      targetBodyRotX = -0.1;
      targetRightArmX = -0.25;
      targetLeftArmX = -0.35;
      targetCapeX = 0.08;
      break;
    }
    case 'dash_fwd': {
      targetBodyRotX = 0.42;
      targetRightArmX = -0.65;
      targetLeftArmX = 0.35;
      targetCapeX = 0.95;
      break;
    }
    case 'dash_back': {
      targetBodyRotX = -0.32;
      targetRightArmX = 0.45;
      targetLeftArmX = -0.5;
      targetCapeX = 0.15;
      break;
    }
    case 'jump': {
      targetBodyRotX = -0.18;
      targetRightArmX = -0.75;
      targetLeftArmX = -0.55;
      targetCapeX = 0.85;
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
      targetCapeX = 0.75;
      break;
    }
    case 'light_1':
    case 'light_3': {
      const thrustArc = Math.sin(p * Math.PI);
      targetBodyRotX = 0.22 * thrustArc;
      targetBodyRotY = -0.35 * thrustArc;
      targetRightArmX = -1.35 * thrustArc;
      targetRightArmY = -0.2 * thrustArc;
      targetCapeX = 0.55 * thrustArc + 0.2;
      break;
    }
    case 'light_2': {
      const cleaveArc = Math.sin(p * Math.PI);
      targetBodyRotY = 0.55 * cleaveArc;
      targetRightArmX = -1.1 * cleaveArc;
      targetRightArmZ = -0.75 * cleaveArc;
      targetCapeX = 0.65 * cleaveArc + 0.2;
      break;
    }
    case 'heavy_1':
    case 'heavy_2': {
      if (p < 0.35) {
        const windup = p / 0.35;
        targetBodyRotX = -0.28 * windup;
        targetRightArmX = -2.2 * windup;
      } else {
        const smash = (p - 0.35) / 0.65;
        const curve = Math.sin(smash * Math.PI);
        targetBodyRotX = 0.38 * curve;
        targetRightArmX = -2.2 + 2.0 * Math.min(1, smash * 1.6);
        targetCapeX = 0.85 * curve + 0.2;
      }
      break;
    }
    case 'combo_finisher': {
      targetBodyRotY = p * Math.PI * 2;
      targetBodyRotX = 0.28 * Math.sin(p * Math.PI);
      targetRightArmX = -1.45;
      targetRightArmZ = -0.55;
      targetLeftArmX = -0.9;
      targetCapeX = 1.05;
      break;
    }
    case 'special': {
      targetBodyRotY = p * Math.PI * 4;
      targetBodyRotX = 0.32 * Math.sin(p * Math.PI);
      targetRightArmX = -1.65;
      targetLeftArmX = -1.25;
      targetCapeX = 1.15;
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
      targetCapeX = 0.45 + Math.sin(elapsedTime * 6) * 0.15;
      break;
    }
    case 'defeat': {
      targetBodyRotX = 1.15;
      targetHeadX = 0.45;
      targetRightArmX = 0.5;
      break;
    }
  }

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
  capePivot.rotation.x = THREE.MathUtils.damp(capePivot.rotation.x, targetCapeX, 14, dt);

  // 4D W-Phase Shift visual displacement & Quantum Superposition Rings
  const isPhased4D = fighter.wPhaseTimerMs > 0;
  rig.tesseractBadge.visible = isPhased4D || fighter.temporalEchoTimerMs > 0;
  rig.quantumWaveGroup.visible = isPhased4D || fighter.temporalEchoTimerMs > 0;
  if (rig.tesseractBadge.visible) {
    rig.tesseractBadge.rotation.y += dt * 4.5;
    rig.tesseractBadge.rotation.x += dt * 3.2;
    rig.quantumWaveGroup.rotation.y += dt * 3.8;
    rig.quantumWaveGroup.rotation.z += dt * 2.6;
  }

  for (const mesh of rig.allStandardMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const targetOpacity = isPhased4D ? 0.38 : 1.0;
    if (Math.abs(mat.opacity - targetOpacity) > 0.01) {
      mat.transparent = targetOpacity < 0.99;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 16, dt);
      mat.needsUpdate = true;
    }
  }

  const isPowerMove =
    fighter.action === 'special' ||
    fighter.action === 'combo_finisher' ||
    fighter.action === 'parry_flash' ||
    fighter.superArmorActive;

  for (const glowMesh of rig.weaponGlowMeshes) {
    const mat = glowMesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = isPowerMove ? 2.1 : fighter.hitFlashTimerMs > 0 ? 2.6 : 1.1;
  }
}

/**
 * Animates the First-Person Weapon & Shield Viewmodel Rig attached in front of the player's camera
 * during First-Person Visor Combat Mode!
 */
export function animateFirstPersonViewmodel(
  vm: FirstPersonViewmodelRig,
  fighter: FighterRuntime,
  elapsedTime: number,
  dt: number
) {
  const p =
    fighter.actionDurationMs > 0
      ? Math.min(1, fighter.actionTimerMs / fighter.actionDurationMs)
      : 0;

  const walkBobX =
    fighter.action === 'walk_fwd' || fighter.action === 'walk_back'
      ? Math.cos(elapsedTime * 11) * 0.035
      : Math.cos(elapsedTime * 2.4) * 0.008;
  const walkBobY =
    fighter.action === 'walk_fwd' || fighter.action === 'walk_back'
      ? Math.abs(Math.sin(elapsedTime * 11)) * 0.04
      : Math.sin(elapsedTime * 2.4) * 0.012;

  // Default resting poses for Right Weapon Hand and Left Shield Hand
  let rPosX = 0.42 + walkBobX;
  let rPosY = -0.34 - walkBobY;
  let rPosZ = -0.68;
  let rRotX = 0.08;
  let rRotY = -0.15;
  let rRotZ = -0.08;

  let lPosX = -0.42 - walkBobX;
  let lPosY = -0.34 - walkBobY;
  let lPosZ = -0.62;
  let lRotX = 0.05;
  let lRotY = 0.22;
  let lRotZ = 0.06;

  switch (fighter.action) {
    case 'light_1':
    case 'light_3': {
      const thrust = Math.sin(p * Math.PI);
      rPosX = 0.42 - thrust * 0.24;
      rPosY = -0.3 + thrust * 0.1;
      rPosZ = -0.68 - thrust * 0.45;
      rRotX = -0.55 * thrust;
      rRotY = -0.15 + thrust * 0.35;
      break;
    }
    case 'light_2': {
      const slash = Math.sin(p * Math.PI);
      rPosX = 0.42 - slash * 0.55;
      rPosY = -0.26 + slash * 0.08;
      rPosZ = -0.68 - slash * 0.32;
      rRotZ = -0.95 * slash;
      rRotY = 0.65 * slash;
      break;
    }
    case 'heavy_1':
    case 'heavy_2': {
      if (p < 0.35) {
        const windup = p / 0.35;
        rPosY = -0.34 + windup * 0.32;
        rPosZ = -0.68 + windup * 0.15;
        rRotX = 0.75 * windup;
      } else {
        const cleave = Math.sin(((p - 0.35) / 0.65) * Math.PI);
        rPosX = 0.42 - cleave * 0.32;
        rPosY = -0.02 - cleave * 0.42;
        rPosZ = -0.68 - cleave * 0.52;
        rRotX = -1.05 * cleave;
      }
      break;
    }
    case 'combo_finisher':
    case 'special': {
      const surge = Math.sin(p * Math.PI);
      rPosX = 0.12;
      rPosY = -0.18 + surge * 0.12;
      rPosZ = -0.68 - surge * 0.58;
      rRotX = -0.85 * surge;
      rRotZ = p * Math.PI * 2;
      lPosX = -0.25;
      lPosY = -0.22 + surge * 0.1;
      break;
    }
    case 'block': {
      // Raise Left Shield / Ward directly across the center of the First-Person Visor!
      lPosX = -0.12;
      lPosY = -0.14;
      lPosZ = -0.48;
      lRotY = 0.65;
      lRotX = 0.15;
      rPosX = 0.48;
      rPosY = -0.38;
      break;
    }
    case 'parry_flash': {
      const bash = Math.sin(p * Math.PI);
      lPosX = -0.08 + bash * 0.18;
      lPosY = -0.12 + bash * 0.08;
      lPosZ = -0.46 - bash * 0.25;
      lRotY = 0.85;
      break;
    }
    case 'hitstun': {
      const recoil = Math.sin(p * Math.PI);
      rPosY = -0.45 - recoil * 0.12;
      lPosY = -0.45 - recoil * 0.12;
      rRotZ = 0.35 * recoil;
      break;
    }
  }

  const dampSpd = 26;
  vm.rightHandGroup.position.set(
    THREE.MathUtils.damp(vm.rightHandGroup.position.x, rPosX, dampSpd, dt),
    THREE.MathUtils.damp(vm.rightHandGroup.position.y, rPosY, dampSpd, dt),
    THREE.MathUtils.damp(vm.rightHandGroup.position.z, rPosZ, dampSpd, dt)
  );
  vm.rightHandGroup.rotation.set(
    THREE.MathUtils.damp(vm.rightHandGroup.rotation.x, rRotX, dampSpd, dt),
    THREE.MathUtils.damp(vm.rightHandGroup.rotation.y, rRotY, dampSpd, dt),
    THREE.MathUtils.damp(vm.rightHandGroup.rotation.z, rRotZ, dampSpd, dt)
  );

  vm.leftHandGroup.position.set(
    THREE.MathUtils.damp(vm.leftHandGroup.position.x, lPosX, dampSpd, dt),
    THREE.MathUtils.damp(vm.leftHandGroup.position.y, lPosY, dampSpd, dt),
    THREE.MathUtils.damp(vm.leftHandGroup.position.z, lPosZ, dampSpd, dt)
  );
  vm.leftHandGroup.rotation.set(
    THREE.MathUtils.damp(vm.leftHandGroup.rotation.x, lRotX, dampSpd, dt),
    THREE.MathUtils.damp(vm.leftHandGroup.rotation.y, lRotY, dampSpd, dt),
    THREE.MathUtils.damp(vm.leftHandGroup.rotation.z, lRotZ, dampSpd, dt)
  );

  const isPower =
    fighter.action === 'special' ||
    fighter.action === 'combo_finisher' ||
    fighter.action === 'parry_flash' ||
    fighter.wPhaseTimerMs > 0;

  for (const gm of vm.weaponGlowMeshes) {
    const mat = gm.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = isPower ? 2.2 : 1.0;
  }
}
