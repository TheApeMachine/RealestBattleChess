import * as THREE from 'three';
import { Faction, PieceType } from '../types/game';

export interface ArticulatedPieceRig {
  root: THREE.Group;
  pedestal: THREE.Mesh;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  rightArmPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  weaponGlowMeshes: THREE.Mesh[];
  specialOrbitGroup: THREE.Group;
  shieldMesh: THREE.Mesh | null;
  hpRingMesh: THREE.Mesh;
}

// Shared Lathe profile for ornate chess pedestal bases
function createPedestalGeometry(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.42, 0.0),
    new THREE.Vector2(0.42, 0.05),
    new THREE.Vector2(0.36, 0.09),
    new THREE.Vector2(0.38, 0.13),
    new THREE.Vector2(0.29, 0.18),
    new THREE.Vector2(0.0, 0.18),
  ];
  const geo = new THREE.LatheGeometry(points, 28);
  geo.computeVertexNormals();
  return geo;
}

// Shared Lathe profile for armoured torso / robe
function createTorsoGeometry(scaleWidth: number = 1.0, height: number = 0.72): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.28 * scaleWidth, 0.0),
    new THREE.Vector2(0.22 * scaleWidth, height * 0.45),
    new THREE.Vector2(0.31 * scaleWidth, height * 0.85),
    new THREE.Vector2(0.18 * scaleWidth, height),
    new THREE.Vector2(0.0, height),
  ];
  const geo = new THREE.LatheGeometry(points, 24);
  geo.computeVertexNormals();
  return geo;
}

const _pedestalGeo = createPedestalGeometry();

export function createArticulatedPiece(type: PieceType, faction: Faction): ArticulatedPieceRig {
  const root = new THREE.Group();

  // Faction PBR Materials (varying roughness by >= 0.25 between primary armor, secondary trim, and glowing accents)
  const isWhite = faction === 'w';

  const primaryArmorMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0xf4f1ea : 0x181b24,
    roughness: isWhite ? 0.38 : 0.42,
    metalness: isWhite ? 0.25 : 0.65,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });

  const secondaryTrimMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0xd99b26 : 0x991b1b,
    roughness: 0.14,
    metalness: 0.92,
    anisotropy: 0.75,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0x475569 : 0x090b10,
    roughness: 0.68,
    metalness: 0.8,
  });

  const energyAccentColor = isWhite ? 0x38bdf8 : 0xf43f5e;
  const energyMat = new THREE.MeshStandardMaterial({
    color: energyAccentColor,
    emissive: energyAccentColor,
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.1,
  });

  const weaponGlowMeshes: THREE.Mesh[] = [];

  // 1. Pedestal Base (flush at y = 0)
  const pedestal = new THREE.Mesh(_pedestalGeo, darkSteelMat);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  root.add(pedestal);

  // Pedestal trim ring
  const baseTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.022, 12, 32),
    secondaryTrimMat
  );
  baseTrim.rotation.x = Math.PI / 2;
  baseTrim.position.y = 0.12;
  pedestal.add(baseTrim);

  // Tactical HP / Selection Floor Ring (offset slightly above ground to prevent Z-fighting)
  const hpRingGeo = new THREE.RingGeometry(0.45, 0.51, 36);
  const hpRingMat = new THREE.MeshBasicMaterial({
    color: isWhite ? 0xf59e0b : 0xf43f5e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const hpRingMesh = new THREE.Mesh(hpRingGeo, hpRingMat);
  hpRingMesh.rotation.x = -Math.PI / 2;
  hpRingMesh.position.y = 0.015;
  root.add(hpRingMesh);

  // 2. Body Pivot (starts above pedestal at y = 0.18)
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.18;
  root.add(bodyPivot);

  // Scale adjustments by piece archetype
  const scaleConfig: Record<PieceType, { w: number; h: number }> = {
    p: { w: 0.85, h: 0.62 },
    n: { w: 0.98, h: 0.76 },
    b: { w: 0.92, h: 0.82 },
    r: { w: 1.25, h: 0.84 },
    q: { w: 1.02, h: 0.94 },
    k: { w: 1.15, h: 0.98 },
  };
  const { w: torsoW, h: torsoH } = scaleConfig[type];

  const torsoMesh = new THREE.Mesh(createTorsoGeometry(torsoW, torsoH), primaryArmorMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  // Chest Cuirass / Plackart Accent
  const chestPlate = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22 * torsoW, 1),
    secondaryTrimMat
  );
  chestPlate.scale.set(1.1, 1.2, 0.55);
  chestPlate.position.set(0, torsoH * 0.68, 0.14 * torsoW);
  chestPlate.castShadow = true;
  bodyPivot.add(chestPlate);

  // Glowing Core Sigil on Chest
  const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), energyMat);
  coreGem.position.set(0, torsoH * 0.7, 0.24 * torsoW);
  bodyPivot.add(coreGem);
  weaponGlowMeshes.push(coreGem);

  // Pauldrons (Left & Right shoulders)
  const pauldronGeo =
    type === 'r'
      ? new THREE.BoxGeometry(0.24, 0.26, 0.28)
      : new THREE.SphereGeometry(0.14 * torsoW, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65);

  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(pauldronGeo, secondaryTrimMat);
    pauldron.position.set(side * (0.28 * torsoW), torsoH * 0.86, 0);
    pauldron.rotation.z = -side * 0.35;
    pauldron.castShadow = true;
    bodyPivot.add(pauldron);
  }

  // 3. Head & Distinctive Piece Silhouette Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, torsoH + 0.04, 0);
  bodyPivot.add(headGroup);

  // Base Helmet
  const helmMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16 * Math.min(1.1, torsoW), 20, 16),
    primaryArmorMat
  );
  helmMesh.scale.set(0.92, 1.15, 1.05);
  helmMesh.position.y = 0.14;
  helmMesh.castShadow = true;
  headGroup.add(helmMesh);

  // Glowing Visor Slit
  const visorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.035, 0.12),
    energyMat
  );
  visorMesh.position.set(0, 0.15, 0.12);
  headGroup.add(visorMesh);
  weaponGlowMeshes.push(visorMesh);

  // Archetype-Specific Head Crest
  if (type === 'p') {
    // Vanguard Squire Crest
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 12), secondaryTrimMat);
    crest.position.set(0, 0.32, 0);
    headGroup.add(crest);
  } else if (type === 'n') {
    // Tempest Lancer: Sculpted Warhorse Mane & Snout Visor
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), secondaryTrimMat);
    snout.rotation.x = Math.PI * 0.38;
    snout.position.set(0, 0.18, 0.18);
    headGroup.add(snout);

    const maneShape = new THREE.Shape();
    maneShape.moveTo(0, 0);
    maneShape.quadraticCurveTo(0.18, 0.22, -0.06, 0.38);
    maneShape.quadraticCurveTo(-0.22, 0.2, -0.12, 0);
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
    // Arcane Inquisitor: Tall Mitre + Floating Sanctified Halo
    const mitre = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 16), primaryArmorMat);
    mitre.position.set(0, 0.34, 0);
    headGroup.add(mitre);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 12, 32), energyMat);
    halo.position.set(0, 0.36, -0.1);
    headGroup.add(halo);
    weaponGlowMeshes.push(halo);
  } else if (type === 'r') {
    // Citadel Bastion: Crowned Battlement Crenellations
    const crownBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.18, 0.18, 8),
      secondaryTrimMat
    );
    crownBase.position.set(0, 0.3, 0);
    headGroup.add(crownBase);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.09), primaryArmorMat);
      merlon.position.set(Math.cos(angle) * 0.15, 0.42, Math.sin(angle) * 0.15);
      headGroup.add(merlon);
    }
  } else if (type === 'q') {
    // Sovereign Valkyrie: Coronet Spike Diadem + Winged Finials
    const coronet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.14, 0.16, 16, 1, true),
      secondaryTrimMat
    );
    coronet.position.set(0, 0.31, 0);
    headGroup.add(coronet);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pearl = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), energyMat);
      pearl.position.set(Math.cos(a) * 0.19, 0.41, Math.sin(a) * 0.19);
      headGroup.add(pearl);
      weaponGlowMeshes.push(pearl);
    }
  } else if (type === 'k') {
    // Eternal Monarch: Grand Imperial Crown + Sovereign Cross
    const imperialCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.2, 8),
      secondaryTrimMat
    );
    imperialCrown.position.set(0, 0.32, 0);
    headGroup.add(imperialCrown);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.24, 0.055), energyMat);
    crossV.position.set(0, 0.52, 0);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.055), energyMat);
    crossH.position.set(0, 0.54, 0);
    headGroup.add(crossV, crossH);
    weaponGlowMeshes.push(crossV, crossH);
  }

  // 4. Right Arm & Signature Primary Weapon Pivot
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.32 * torsoW, torsoH * 0.82, 0);
  bodyPivot.add(rightArmPivot);

  const rightForearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.065, 0.24, 6, 12),
    darkSteelMat
  );
  rightForearm.position.set(0.04, -0.14, 0.1);
  rightForearm.rotation.x = Math.PI * 0.35;
  rightArmPivot.add(rightForearm);

  // Build Signature Weapon along +Z / +Y of rightArmPivot
  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0.04, -0.22, 0.26);
  rightArmPivot.add(weaponGroup);

  if (type === 'p') {
    // Estoc Spear
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 1.15, 10), darkSteelMat);
    shaft.rotation.x = Math.PI * 0.45;
    shaft.position.z = 0.35;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 6), energyMat);
    tip.rotation.x = Math.PI * 0.45;
    tip.position.set(0, 0.09, 0.98);
    weaponGroup.add(shaft, tip);
    weaponGlowMeshes.push(tip);
  } else if (type === 'n') {
    // Voltaic Jousting Lance
    const lanceCone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 1.25, 12), secondaryTrimMat);
    lanceCone.rotation.x = Math.PI * 0.47;
    lanceCone.position.z = 0.52;
    const guardBell = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.14, 0.16, 12), primaryArmorMat);
    guardBell.rotation.x = Math.PI * 0.47;
    guardBell.position.z = 0.05;
    const spiralRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 24), energyMat);
    spiralRing.position.z = 0.65;
    weaponGroup.add(lanceCone, guardBell, spiralRing);
    weaponGlowMeshes.push(spiralRing);
  } else if (type === 'b') {
    // Sanctified Diagonal Glaive
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 12), secondaryTrimMat);
    staff.rotation.x = Math.PI * 0.38;
    staff.position.set(0, 0.18, 0.35);
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 10, 24, Math.PI * 1.3), energyMat);
    crescent.position.set(0, 0.42, 0.85);
    crescent.rotation.y = Math.PI / 2;
    weaponGroup.add(staff, crescent);
    weaponGlowMeshes.push(crescent);
  } else if (type === 'r') {
    // Colossal Siege Maul
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 10), darkSteelMat);
    handle.rotation.x = Math.PI * 0.42;
    handle.position.set(0, 0.1, 0.35);
    const maulHead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.46), secondaryTrimMat);
    maulHead.position.set(0, 0.22, 0.86);
    const impactFace = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.06), energyMat);
    impactFace.position.set(0, 0.22, 1.1);
    weaponGroup.add(handle, maulHead, impactFace);
    weaponGlowMeshes.push(impactFace);
  } else if (type === 'q') {
    // Royal Halberd
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.4, 12), secondaryTrimMat);
    pole.rotation.x = Math.PI * 0.43;
    pole.position.set(0, 0.15, 0.42);
    const axeBlade = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), energyMat);
    axeBlade.scale.set(0.25, 1.3, 1.1);
    axeBlade.position.set(0, 0.3, 0.98);
    weaponGroup.add(pole, axeBlade);
    weaponGlowMeshes.push(axeBlade);
  } else if (type === 'k') {
    // Greatsword of Sovereignty
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 10), secondaryTrimMat);
    hilt.rotation.x = Math.PI * 0.45;
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.07), secondaryTrimMat);
    crossguard.position.set(0, 0.04, 0.14);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 1.15), primaryArmorMat);
    blade.position.set(0, 0.14, 0.72);
    blade.rotation.x = -0.08;
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.034, 1.05), energyMat);
    fuller.position.set(0, 0.14, 0.72);
    fuller.rotation.x = -0.08;
    weaponGroup.add(hilt, crossguard, blade, fuller);
    weaponGlowMeshes.push(fuller);
  }

  // 5. Left Arm & Shield / Offhand Pivot
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.32 * torsoW, torsoH * 0.82, 0);
  bodyPivot.add(leftArmPivot);

  const leftForearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.06, 0.22, 6, 12),
    darkSteelMat
  );
  leftForearm.position.set(-0.04, -0.14, 0.1);
  leftForearm.rotation.x = Math.PI * 0.35;
  leftArmPivot.add(leftForearm);

  let shieldMesh: THREE.Mesh | null = null;
  if (type === 'p' || type === 'r' || type === 'k') {
    const shieldGeo =
      type === 'r'
        ? new THREE.BoxGeometry(0.1, 0.62, 0.44)
        : new THREE.CylinderGeometry(0.24, 0.18, 0.06, 8);
    shieldMesh = new THREE.Mesh(shieldGeo, secondaryTrimMat);
    if (type !== 'r') {
      shieldMesh.rotation.z = Math.PI / 2;
    }
    shieldMesh.position.set(-0.14, -0.12, 0.24);
    shieldMesh.castShadow = true;
    leftArmPivot.add(shieldMesh);
  } else if (type === 'n') {
    // Secondary Off-hand Lance for Knight
    const offLance = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.95, 10), secondaryTrimMat);
    offLance.rotation.x = Math.PI * 0.47;
    offLance.position.set(-0.06, -0.18, 0.52);
    leftArmPivot.add(offLance);
  }

  // 6. Special Orbiting Rig (e.g. Queen's 8 Floating Crown Blades, Bishop's Prisms)
  const specialOrbitGroup = new THREE.Group();
  specialOrbitGroup.position.set(0, torsoH * 0.65, 0);
  bodyPivot.add(specialOrbitGroup);

  if (type === 'q') {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sword = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.38, 4), energyMat);
      sword.position.set(Math.cos(angle) * 0.52, Math.sin(angle * 2) * 0.08, Math.sin(angle) * 0.52);
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
    weaponGlowMeshes,
    specialOrbitGroup,
    shieldMesh,
    hpRingMesh,
  };
}
