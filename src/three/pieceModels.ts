import * as THREE from 'three';
import { Faction, PieceType } from '../types/game';

export interface ArticulatedPieceRig {
  root: THREE.Group;
  pedestal: THREE.Mesh;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  rightArmPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  capePivot: THREE.Group;
  surpriseGroup: THREE.Group;
  tesseractBadge: THREE.LineSegments;
  weaponGlowMeshes: THREE.Mesh[];
  allStandardMeshes: THREE.Mesh[];
  specialOrbitGroup: THREE.Group;
  shieldMesh: THREE.Mesh | null;
  hpRingMesh: THREE.Mesh;
}

// Shared Lathe profile for ornate chess pedestal bases
function createPedestalGeometry(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.43, 0.0),
    new THREE.Vector2(0.43, 0.05),
    new THREE.Vector2(0.37, 0.09),
    new THREE.Vector2(0.39, 0.13),
    new THREE.Vector2(0.3, 0.18),
    new THREE.Vector2(0.0, 0.18),
  ];
  const geo = new THREE.LatheGeometry(points, 32);
  geo.computeVertexNormals();
  return geo;
}

// Shared Lathe profile for armoured torso / robe
function createTorsoGeometry(scaleWidth: number = 1.0, height: number = 0.72): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.28 * scaleWidth, 0.0),
    new THREE.Vector2(0.21 * scaleWidth, height * 0.45),
    new THREE.Vector2(0.32 * scaleWidth, height * 0.85),
    new THREE.Vector2(0.18 * scaleWidth, height),
    new THREE.Vector2(0.0, height),
  ];
  const geo = new THREE.LatheGeometry(points, 28);
  geo.computeVertexNormals();
  return geo;
}

// Shared radial contact shadow texture
let _contactShadowTex: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (_contactShadowTex) return _contactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  _contactShadowTex = new THREE.CanvasTexture(canvas);
  return _contactShadowTex;
}

const _pedestalGeo = createPedestalGeometry();
const _contactShadowGeo = new THREE.PlaneGeometry(1.18, 1.18);

export function createArticulatedPiece(type: PieceType, faction: Faction): ArticulatedPieceRig {
  const root = new THREE.Group();

  const isWhite = faction === 'w';

  // Calibrated PBR Materials (restrained albedo & envMapIntensity so white pieces never blow out)
  const primaryArmorMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0xc8c0b0 : 0x181c26,
    roughness: isWhite ? 0.42 : 0.38,
    metalness: isWhite ? 0.22 : 0.68,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.5,
  });

  const secondaryTrimMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0xc68a22 : 0x991b1b,
    roughness: 0.24,
    metalness: 0.85,
    anisotropy: 0.65,
    envMapIntensity: 0.6,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0x3b4659 : 0x0b0e14,
    roughness: 0.68,
    metalness: 0.78,
    envMapIntensity: 0.45,
  });

  const capeFabricMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0x1e3a8a : 0x450a0a,
    roughness: 0.85,
    metalness: 0.05,
    sheen: 0.5,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(isWhite ? 0x60a5fa : 0xf87171),
    side: THREE.DoubleSide,
    envMapIntensity: 0.3,
  });

  const energyAccentColor = isWhite ? 0x38bdf8 : 0xf43f5e;
  const energyMat = new THREE.MeshStandardMaterial({
    color: energyAccentColor,
    emissive: energyAccentColor,
    emissiveIntensity: 0.75, // Restrained glow!
    roughness: 0.2,
    metalness: 0.1,
  });

  const weaponGlowMeshes: THREE.Mesh[] = [];
  const allStandardMeshes: THREE.Mesh[] = [];

  const registerMesh = (m: THREE.Mesh) => {
    allStandardMeshes.push(m);
    return m;
  };

  // 0. Soft Contact Shadow Plane at Ground Level
  const shadowMesh = new THREE.Mesh(
    _contactShadowGeo,
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.006;
  root.add(shadowMesh);

  // 1. Pedestal Base
  const pedestal = registerMesh(new THREE.Mesh(_pedestalGeo, darkSteelMat));
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  root.add(pedestal);

  const baseTrim = registerMesh(
    new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.024, 14, 36), secondaryTrimMat)
  );
  baseTrim.rotation.x = Math.PI / 2;
  baseTrim.position.y = 0.12;
  pedestal.add(baseTrim);

  const lowerRim = registerMesh(
    new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 10, 36), secondaryTrimMat)
  );
  lowerRim.rotation.x = Math.PI / 2;
  lowerRim.position.y = 0.03;
  pedestal.add(lowerRim);

  // Tactical HP / Selection Floor Ring
  const hpRingGeo = new THREE.RingGeometry(0.46, 0.52, 40);
  const hpRingMat = new THREE.MeshBasicMaterial({
    color: isWhite ? 0xf59e0b : 0xf43f5e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const hpRingMesh = new THREE.Mesh(hpRingGeo, hpRingMat);
  hpRingMesh.rotation.x = -Math.PI / 2;
  hpRingMesh.position.y = 0.016;
  root.add(hpRingMesh);

  // 2. Body Pivot
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.18;
  root.add(bodyPivot);

  const scaleConfig: Record<PieceType, { w: number; h: number }> = {
    p: { w: 0.86, h: 0.64 },
    n: { w: 0.98, h: 0.78 },
    b: { w: 0.92, h: 0.84 },
    r: { w: 1.26, h: 0.86 },
    q: { w: 1.04, h: 0.96 },
    k: { w: 1.16, h: 1.0 },
  };
  const { w: torsoW, h: torsoH } = scaleConfig[type];

  const torsoMesh = registerMesh(new THREE.Mesh(createTorsoGeometry(torsoW, torsoH), primaryArmorMat));
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const tasset = registerMesh(
      new THREE.Mesh(new THREE.BoxGeometry(0.14 * torsoW, 0.22, 0.04), secondaryTrimMat)
    );
    tasset.position.set(
      Math.sin(angle) * 0.24 * torsoW,
      torsoH * 0.25,
      Math.cos(angle) * 0.24 * torsoW
    );
    tasset.rotation.y = angle;
    tasset.rotation.x = -0.18;
    bodyPivot.add(tasset);
  }

  // Flowing Battle Cape
  const capePivot = new THREE.Group();
  capePivot.position.set(0, torsoH * 0.88, -0.18 * torsoW);
  bodyPivot.add(capePivot);

  const capeGeo = new THREE.PlaneGeometry(0.46 * torsoW, torsoH * 0.92, 4, 6);
  const posAttr = capeGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const py = posAttr.getY(i);
    const px = posAttr.getX(i);
    posAttr.setZ(i, -Math.pow(py - torsoH * 0.46, 2) * 0.18 - Math.abs(px) * 0.12);
  }
  capeGeo.computeVertexNormals();
  const capeMesh = registerMesh(new THREE.Mesh(capeGeo, capeFabricMat));
  capeMesh.position.set(0, -torsoH * 0.44, -0.04);
  capeMesh.rotation.x = 0.14;
  capeMesh.castShadow = true;
  capePivot.add(capeMesh);

  // Chest Cuirass
  const chestPlate = registerMesh(
    new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * torsoW, 1), secondaryTrimMat)
  );
  chestPlate.scale.set(1.12, 1.22, 0.55);
  chestPlate.position.set(0, torsoH * 0.68, 0.14 * torsoW);
  chestPlate.castShadow = true;
  bodyPivot.add(chestPlate);

  const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 0), energyMat);
  coreGem.position.set(0, torsoH * 0.7, 0.25 * torsoW);
  bodyPivot.add(coreGem);
  weaponGlowMeshes.push(coreGem);

  // Layered Pauldrons
  const pauldronGeo =
    type === 'r'
      ? new THREE.BoxGeometry(0.26, 0.28, 0.3)
      : new THREE.SphereGeometry(0.15 * torsoW, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.65);

  for (const side of [-1, 1]) {
    const pauldron = registerMesh(new THREE.Mesh(pauldronGeo, secondaryTrimMat));
    pauldron.position.set(side * (0.29 * torsoW), torsoH * 0.86, 0);
    pauldron.rotation.z = -side * 0.35;
    pauldron.castShadow = true;
    bodyPivot.add(pauldron);
  }

  // 3. Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, torsoH + 0.04, 0);
  bodyPivot.add(headGroup);

  // Surprise Exclamation Badge "!"
  const surpriseGroup = new THREE.Group();
  surpriseGroup.position.set(0, 0.72, 0);
  surpriseGroup.visible = false;
  headGroup.add(surpriseGroup);

  const exclMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const exclBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.14, 4, 8), exclMat);
  exclBar.position.y = 0.09;
  const exclDot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), exclMat);
  exclDot.position.y = -0.04;
  surpriseGroup.add(exclBar, exclDot);

  // 4D Tesseract Wireframe Badge above piece when shifted in 4D (W or Z axis)
  const tessGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.28, 0.28, 0.28));
  const tessMat = new THREE.LineBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.9,
  });
  const tesseractBadge = new THREE.LineSegments(tessGeo, tessMat);
  tesseractBadge.position.set(0, 0.68, 0);
  tesseractBadge.visible = false;
  headGroup.add(tesseractBadge);

  const helmMesh = registerMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.16 * Math.min(1.1, torsoW), 22, 18), primaryArmorMat)
  );
  helmMesh.scale.set(0.92, 1.15, 1.05);
  helmMesh.position.y = 0.14;
  helmMesh.castShadow = true;
  headGroup.add(helmMesh);

  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.036, 0.12), energyMat);
  visorMesh.position.set(0, 0.15, 0.12);
  headGroup.add(visorMesh);
  weaponGlowMeshes.push(visorMesh);

  if (type === 'p') {
    const crest = registerMesh(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 14), secondaryTrimMat));
    crest.position.set(0, 0.32, 0);
    headGroup.add(crest);
  } else if (type === 'n') {
    const snout = registerMesh(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.29, 6), secondaryTrimMat));
    snout.rotation.x = Math.PI * 0.38;
    snout.position.set(0, 0.18, 0.18);
    headGroup.add(snout);

    const maneShape = new THREE.Shape();
    maneShape.moveTo(0, 0);
    maneShape.quadraticCurveTo(0.19, 0.24, -0.06, 0.4);
    maneShape.quadraticCurveTo(-0.23, 0.2, -0.12, 0);
    const maneGeo = new THREE.ExtrudeGeometry(maneShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    maneGeo.center();
    const mane = new THREE.Mesh(maneGeo, energyMat);
    mane.rotation.y = Math.PI / 2;
    mane.position.set(0, 0.32, -0.06);
    headGroup.add(mane);
    weaponGlowMeshes.push(mane);
  } else if (type === 'b') {
    const mitre = registerMesh(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.38, 18), primaryArmorMat));
    mitre.position.set(0, 0.34, 0);
    headGroup.add(mitre);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.022, 14, 36), energyMat);
    halo.position.set(0, 0.36, -0.1);
    headGroup.add(halo);
    weaponGlowMeshes.push(halo);
  } else if (type === 'r') {
    const crownBase = registerMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.18, 0.18, 8), secondaryTrimMat)
    );
    crownBase.position.set(0, 0.3, 0);
    headGroup.add(crownBase);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const merlon = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.095), primaryArmorMat));
      merlon.position.set(Math.cos(angle) * 0.15, 0.42, Math.sin(angle) * 0.15);
      headGroup.add(merlon);
    }
  } else if (type === 'q') {
    const coronet = registerMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.14, 0.17, 16, 1, true), secondaryTrimMat)
    );
    coronet.position.set(0, 0.31, 0);
    headGroup.add(coronet);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pearl = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), energyMat);
      pearl.position.set(Math.cos(a) * 0.19, 0.42, Math.sin(a) * 0.19);
      headGroup.add(pearl);
      weaponGlowMeshes.push(pearl);
    }
  } else if (type === 'k') {
    const imperialCrown = registerMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.16, 0.21, 8), secondaryTrimMat)
    );
    imperialCrown.position.set(0, 0.32, 0);
    headGroup.add(imperialCrown);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.25, 0.058), energyMat);
    crossV.position.set(0, 0.53, 0);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.058, 0.058), energyMat);
    crossH.position.set(0, 0.55, 0);
    headGroup.add(crossV, crossH);
    weaponGlowMeshes.push(crossV, crossH);
  }

  // 4. Right Arm & Weapon
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.32 * torsoW, torsoH * 0.82, 0);
  bodyPivot.add(rightArmPivot);

  const rightForearm = registerMesh(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 8, 14), darkSteelMat)
  );
  rightForearm.position.set(0.04, -0.14, 0.1);
  rightForearm.rotation.x = Math.PI * 0.35;
  rightArmPivot.add(rightForearm);

  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0.04, -0.22, 0.26);
  rightArmPivot.add(weaponGroup);

  if (type === 'p') {
    const shaft = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 1.18, 12), darkSteelMat));
    shaft.rotation.x = Math.PI * 0.45;
    shaft.position.z = 0.36;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 8), energyMat);
    tip.rotation.x = Math.PI * 0.45;
    tip.position.set(0, 0.09, 1.0);
    weaponGroup.add(shaft, tip);
    weaponGlowMeshes.push(tip);
  } else if (type === 'n') {
    const lanceCone = registerMesh(new THREE.Mesh(new THREE.ConeGeometry(0.095, 1.28, 14), secondaryTrimMat));
    lanceCone.rotation.x = Math.PI * 0.47;
    lanceCone.position.z = 0.54;
    const guardBell = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.145, 0.17, 14), primaryArmorMat));
    guardBell.rotation.x = Math.PI * 0.47;
    guardBell.position.z = 0.05;
    const spiralRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 10, 28), energyMat);
    spiralRing.position.z = 0.66;
    weaponGroup.add(lanceCone, guardBell, spiralRing);
    weaponGlowMeshes.push(spiralRing);
  } else if (type === 'b') {
    const staff = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.34, 12), secondaryTrimMat));
    staff.rotation.x = Math.PI * 0.38;
    staff.position.set(0, 0.18, 0.36);
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 12, 28, Math.PI * 1.3), energyMat);
    crescent.position.set(0, 0.43, 0.86);
    crescent.rotation.y = Math.PI / 2;
    weaponGroup.add(staff, crescent);
    weaponGlowMeshes.push(crescent);
  } else if (type === 'r') {
    const handle = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.12, 12), darkSteelMat));
    handle.rotation.x = Math.PI * 0.42;
    handle.position.set(0, 0.1, 0.36);
    const maulHead = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.48), secondaryTrimMat));
    maulHead.position.set(0, 0.22, 0.88);
    const impactFace = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.065), energyMat);
    impactFace.position.set(0, 0.22, 1.12);
    weaponGroup.add(handle, maulHead, impactFace);
    weaponGlowMeshes.push(impactFace);
  } else if (type === 'q') {
    const pole = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.42, 12), secondaryTrimMat));
    pole.rotation.x = Math.PI * 0.43;
    pole.position.set(0, 0.15, 0.43);
    const axeBlade = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), energyMat);
    axeBlade.scale.set(0.25, 1.35, 1.15);
    axeBlade.position.set(0, 0.3, 1.0);
    weaponGroup.add(pole, axeBlade);
    weaponGlowMeshes.push(axeBlade);
  } else if (type === 'k') {
    const hilt = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 12), secondaryTrimMat));
    hilt.rotation.x = Math.PI * 0.45;
    const crossguard = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.055, 0.075), secondaryTrimMat));
    crossguard.position.set(0, 0.04, 0.15);
    const blade = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.03, 1.18), primaryArmorMat));
    blade.position.set(0, 0.14, 0.74);
    blade.rotation.x = -0.08;
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.036, 1.08), energyMat);
    fuller.position.set(0, 0.14, 0.74);
    fuller.rotation.x = -0.08;
    weaponGroup.add(hilt, crossguard, blade, fuller);
    weaponGlowMeshes.push(fuller);
  }

  // 5. Left Arm
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.32 * torsoW, torsoH * 0.82, 0);
  bodyPivot.add(leftArmPivot);

  const leftForearm = registerMesh(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.22, 8, 12), darkSteelMat)
  );
  leftForearm.position.set(-0.04, -0.14, 0.1);
  leftForearm.rotation.x = Math.PI * 0.35;
  leftArmPivot.add(leftForearm);

  let shieldMesh: THREE.Mesh | null = null;
  if (type === 'p' || type === 'r' || type === 'k') {
    const shieldGeo =
      type === 'r'
        ? new THREE.BoxGeometry(0.11, 0.64, 0.46)
        : new THREE.CylinderGeometry(0.25, 0.19, 0.06, 8);
    shieldMesh = registerMesh(new THREE.Mesh(shieldGeo, secondaryTrimMat));
    if (type !== 'r') {
      shieldMesh.rotation.z = Math.PI / 2;
    }
    shieldMesh.position.set(-0.14, -0.12, 0.24);
    shieldMesh.castShadow = true;
    leftArmPivot.add(shieldMesh);
  } else if (type === 'n') {
    const offLance = registerMesh(new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.98, 12), secondaryTrimMat));
    offLance.rotation.x = Math.PI * 0.47;
    offLance.position.set(-0.06, -0.18, 0.52);
    leftArmPivot.add(offLance);
  }

  // 6. Special Orbiting Rig
  const specialOrbitGroup = new THREE.Group();
  specialOrbitGroup.position.set(0, torsoH * 0.65, 0);
  bodyPivot.add(specialOrbitGroup);

  if (type === 'q') {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sword = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.4, 4), energyMat);
      sword.position.set(Math.cos(angle) * 0.54, Math.sin(angle * 2) * 0.08, Math.sin(angle) * 0.54);
      sword.rotation.x = Math.PI * 0.15;
      specialOrbitGroup.add(sword);
      weaponGlowMeshes.push(sword);
    }
  }

  return {
    root,
    pedestal,
    bodyPivot,
    headGroup,
    rightArmPivot,
    leftArmPivot,
    capePivot,
    surpriseGroup,
    tesseractBadge,
    weaponGlowMeshes,
    allStandardMeshes,
    specialOrbitGroup,
    shieldMesh,
    hpRingMesh,
  };
}

/**
 * Updates how a piece renders based on its 4D hypercube distance (deltaW, deltaZ)
 * from the player's currently viewed 3D slice!
 * - (0, 0): Solid physical warrior in the current 3D slice.
 * - |deltaW| > 0 or |deltaZ| > 0: Translucent 4D Phase-Projection with Ana (Cyan) or Kata (Violet) spectral tint!
 */
export function updatePiece4DAppearance(
  rig: ArticulatedPieceRig,
  deltaW: number,
  deltaZ: number,
  isPhaseShiftedInFight: boolean = false
) {
  const dist4D = Math.abs(deltaW) + Math.abs(deltaZ);
  const isPhased = dist4D > 0 || isPhaseShiftedInFight;

  rig.tesseractBadge.visible = isPhased;
  if (isPhased) {
    const badgeMat = rig.tesseractBadge.material as THREE.LineBasicMaterial;
    // +W (Ana) = Cyan (#38bdf8), -W (Kata) = Violet (#a855f7), Z-shift = Emerald (#34d399)
    badgeMat.color.setHex(deltaW > 0 ? 0x38bdf8 : deltaW < 0 ? 0xa855f7 : 0x34d399);
  }

  const targetOpacity = isPhaseShiftedInFight
    ? 0.38
    : dist4D === 0
    ? 1.0
    : dist4D === 1
    ? 0.36
    : 0.16;

  for (const m of rig.allStandardMeshes) {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.transparent !== isPhased) {
      mat.transparent = isPhased;
      mat.depthWrite = !isPhased;
      mat.needsUpdate = true;
    }
    mat.opacity = targetOpacity;
  }
}
