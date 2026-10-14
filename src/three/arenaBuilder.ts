import * as THREE from 'three';

export interface BoardArenaRig {
  group: THREE.Group;
  tiles: THREE.Mesh[][];
  tileOriginalY: number[][];
  highlightMeshes: Map<string, THREE.Mesh>;
  threatSigilMeshes: Map<string, THREE.Mesh>;
  duelRingGroup: THREE.Group;
  duelBarrierMesh: THREE.Mesh;
  columnsInstanced: THREE.InstancedMesh;
  spotAttacker: THREE.SpotLight;
  spotDefender: THREE.SpotLight;
  volumetricConeAttacker: THREE.Mesh;
  volumetricConeDefender: THREE.Mesh;
  clashPointLight: THREE.PointLight;
  ambientParticles: THREE.Points;
  tesseractLines: THREE.LineSegments;
  tesseractVerts4D: [number, number, number, number][];
  tesseractEdgeIndices: [number, number][];
}

export const TILE_SIZE = 1.35;
export const BOARD_OFFSET = (7 * TILE_SIZE) / 2;

export function boardToWorld(row: number, col: number, target?: THREE.Vector3): THREE.Vector3 {
  const x = col * TILE_SIZE - BOARD_OFFSET;
  const z = row * TILE_SIZE - BOARD_OFFSET;
  if (target) {
    return target.set(x, 0, z);
  }
  return new THREE.Vector3(x, 0, z);
}

function createProceduralMarbleTextures(
  renderer: THREE.WebGLRenderer,
  isLight: boolean
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Restrained, tactile travertine/obsidian albedo so tiles never blow out under lighting
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  if (isLight) {
    grad.addColorStop(0, '#9e9587');
    grad.addColorStop(0.5, '#918879');
    grad.addColorStop(1, '#857c6d');
  } else {
    grad.addColorStop(0, '#141822');
    grad.addColorStop(0.5, '#1a202c');
    grad.addColorStop(1, '#10141d');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 24; i++) {
    ctx.strokeStyle = isLight
      ? i % 3 === 0
        ? 'rgba(180, 135, 50, 0.28)'
        : 'rgba(65, 58, 48, 0.25)'
      : i % 3 === 0
      ? 'rgba(56, 189, 248, 0.14)'
      : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1 + (i % 3);

    bCtx.strokeStyle = i % 2 === 0 ? '#969696' : '#686868';
    bCtx.lineWidth = 2;

    ctx.beginPath();
    bCtx.beginPath();
    let x = Math.random() * 512;
    let y = 0;
    ctx.moveTo(x, y);
    bCtx.moveTo(x, y);
    while (y < 512) {
      y += 24;
      x += (Math.random() - 0.5) * 44;
      ctx.lineTo(x, y);
      bCtx.lineTo(x, y);
    }
    ctx.stroke();
    bCtx.stroke();
  }

  ctx.strokeStyle = isLight ? 'rgba(195, 145, 45, 0.45)' : 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 488, 488);

  bCtx.strokeStyle = '#ffffff';
  bCtx.lineWidth = 8;
  bCtx.strokeRect(10, 10, 492, 492);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

export function createBoardArena(renderer: THREE.WebGLRenderer): BoardArenaRig {
  const group = new THREE.Group();

  const lightTex = createProceduralMarbleTextures(renderer, true);
  const darkTex = createProceduralMarbleTextures(renderer, false);

  const lightTileMat = new THREE.MeshPhysicalMaterial({
    map: lightTex.map,
    bumpMap: lightTex.bumpMap,
    bumpScale: 0.015,
    roughness: 0.46,
    metalness: 0.1,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.45,
  });

  const darkTileMat = new THREE.MeshPhysicalMaterial({
    map: darkTex.map,
    bumpMap: darkTex.bumpMap,
    bumpScale: 0.018,
    roughness: 0.34,
    metalness: 0.38,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.5,
  });

  const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.985, 0.46, TILE_SIZE * 0.985);
  const tiles: THREE.Mesh[][] = [];
  const tileOriginalY: number[][] = [];
  const highlightMeshes = new Map<string, THREE.Mesh>();
  const threatSigilMeshes = new Map<string, THREE.Mesh>();

  const highlightGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.88, TILE_SIZE * 0.88);
  const sigilGeo = new THREE.RingGeometry(0.28, 0.39, 4);

  for (let r = 0; r < 8; r++) {
    tiles[r] = [];
    tileOriginalY[r] = [];
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const tile = new THREE.Mesh(tileGeo, isLight ? lightTileMat : darkTileMat);
      const pos = boardToWorld(r, c);
      tile.position.set(pos.x, -0.23, pos.z);
      tile.receiveShadow = true;
      tile.castShadow = true;
      tile.userData = { type: 'tile', row: r, col: c };
      group.add(tile);
      tiles[r][c] = tile;
      tileOriginalY[r][c] = -0.23;

      const hlMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const hlMesh = new THREE.Mesh(highlightGeo, hlMat);
      hlMesh.rotation.x = -Math.PI / 2;
      hlMesh.position.set(pos.x, 0.012, pos.z);
      hlMesh.visible = false;
      group.add(hlMesh);
      highlightMeshes.set(`${r}_${c}`, hlMesh);

      // 4D Unseen Cross-Dimensional Threat Sigil (rotating diamond on tiles threatened from another W/Z slice!)
      const sigilMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const sigilMesh = new THREE.Mesh(sigilGeo, sigilMat);
      sigilMesh.rotation.x = -Math.PI / 2;
      sigilMesh.position.set(pos.x, 0.025, pos.z);
      sigilMesh.visible = false;
      group.add(sigilMesh);
      threatSigilMeshes.set(`${r}_${c}`, sigilMesh);
    }
  }

  // Grand Chessboard Outer Frame
  const boardSpan = 8 * TILE_SIZE + 0.95;
  const frameGeo = new THREE.BoxGeometry(boardSpan, 0.44, boardSpan);
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f131d,
    roughness: 0.45,
    metalness: 0.78,
    clearcoat: 0.4,
    envMapIntensity: 0.45,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.y = -0.26;
  frameMesh.receiveShadow = true;
  group.add(frameMesh);

  const goldTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0xc88d28,
    roughness: 0.25,
    metalness: 0.85,
    envMapIntensity: 0.5,
  });
  const outerBorderRing = new THREE.Mesh(
    new THREE.BoxGeometry(boardSpan + 0.14, 0.16, boardSpan + 0.14),
    goldTrimMat
  );
  outerBorderRing.position.y = -0.22;
  group.add(outerBorderRing);

  const sanctuaryFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 32, 0.8, 64),
    new THREE.MeshStandardMaterial({
      color: 0x07090e,
      roughness: 0.85,
      metalness: 0.3,
    })
  );
  sanctuaryFloor.position.y = -0.88;
  sanctuaryFloor.receiveShadow = true;
  group.add(sanctuaryFloor);

  // Instanced Perimeter Colosseum Monoliths
  const pillarCount = 24;
  const pillarGeo = new THREE.BoxGeometry(0.88, 5.8, 0.88);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x161b26,
    roughness: 0.6,
    metalness: 0.65,
  });
  const columnsInstanced = new THREE.InstancedMesh(pillarGeo, pillarMat, pillarCount);
  columnsInstanced.castShadow = true;
  columnsInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const colColor = new THREE.Color();
  for (let i = 0; i < pillarCount; i++) {
    const angle = (i / pillarCount) * Math.PI * 2;
    const radius = 13.5 + (i % 2) * 0.6;
    dummy.position.set(Math.cos(angle) * radius, 1.8, Math.sin(angle) * radius);
    dummy.rotation.y = -angle;
    const hScale = 0.85 + (i % 3) * 0.14;
    dummy.scale.set(1, hScale, 1);
    dummy.updateMatrix();
    columnsInstanced.setMatrixAt(i, dummy.matrix);

    colColor.setHSL(0.6, 0.2, 0.12 + (i % 3) * 0.03);
    columnsInstanced.setColorAt(i, colColor);
  }
  columnsInstanced.instanceMatrix.needsUpdate = true;
  if (columnsInstanced.instanceColor) columnsInstanced.instanceColor.needsUpdate = true;
  columnsInstanced.computeBoundingSphere();
  group.add(columnsInstanced);

  // Duel Ring Group
  const duelRingGroup = new THREE.Group();
  duelRingGroup.position.y = -2.5;
  group.add(duelRingGroup);

  const arenaRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(4.4, 0.075, 16, 64),
    goldTrimMat
  );
  arenaRingMesh.rotation.x = Math.PI / 2;
  arenaRingMesh.position.y = 0.04;
  duelRingGroup.add(arenaRingMesh);

  const innerRuneRing = new THREE.Mesh(
    new THREE.RingGeometry(4.15, 4.28, 48),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  innerRuneRing.rotation.x = -Math.PI / 2;
  innerRuneRing.position.y = 0.02;
  duelRingGroup.add(innerRuneRing);

  const barrierMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const duelBarrierMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 1.35, 48, 1, true),
    barrierMat
  );
  duelBarrierMesh.position.y = 0.68;
  duelBarrierMesh.renderOrder = 5;
  duelRingGroup.add(duelBarrierMesh);

  // Focused Cinematic Fight SpotLights & Volumetric Light Cones (calibrated intensity!)
  const spotAttacker = new THREE.SpotLight(0xfffbeb, 0, 22, Math.PI / 6.5, 0.65, 1.6);
  spotAttacker.position.set(-2.5, 8.5, 1.5);
  spotAttacker.castShadow = true;
  spotAttacker.shadow.bias = -0.0002;
  group.add(spotAttacker);
  group.add(spotAttacker.target);

  const spotDefender = new THREE.SpotLight(0xffe4e6, 0, 22, Math.PI / 6.5, 0.65, 1.6);
  spotDefender.position.set(2.5, 8.5, 1.5);
  spotDefender.castShadow = false;
  group.add(spotDefender);
  group.add(spotDefender.target);

  const coneGeo = new THREE.ConeGeometry(1.8, 8.5, 32, 1, true);
  coneGeo.translate(0, -4.25, 0);

  const coneMatAttacker = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const volumetricConeAttacker = new THREE.Mesh(coneGeo, coneMatAttacker);
  volumetricConeAttacker.position.copy(spotAttacker.position);
  group.add(volumetricConeAttacker);

  const coneMatDefender = new THREE.MeshBasicMaterial({
    color: 0xfda4af,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const volumetricConeDefender = new THREE.Mesh(coneGeo, coneMatDefender);
  volumetricConeDefender.position.copy(spotDefender.position);
  group.add(volumetricConeDefender);

  const clashPointLight = new THREE.PointLight(0xf59e0b, 0, 8, 2);
  clashPointLight.position.set(0, 1.4, 0);
  group.add(clashPointLight);

  // Floating Atmospheric Embers
  const particleCount = 140;
  const pPositions = new Float32Array(particleCount * 3);
  const pColors = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3] = (Math.random() - 0.5) * 18;
    pPositions[i * 3 + 1] = Math.random() * 6.5;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 18;

    const isGold = i % 2 === 0;
    pColors[i * 3] = isGold ? 0.95 : 0.35;
    pColors[i * 3 + 1] = isGold ? 0.7 : 0.75;
    pColors[i * 3 + 2] = isGold ? 0.25 : 0.95;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

  const pMat = new THREE.PointsMaterial({
    size: 0.065,
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const ambientParticles = new THREE.Points(pGeo, pMat);
  group.add(ambientParticles);

  // 4D Mathematical Tesseract (8-Cell Hypercube) Stereographic Projector
  const tesseractVerts4D: [number, number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    tesseractVerts4D.push([
      i & 1 ? 1 : -1,
      i & 2 ? 1 : -1,
      i & 4 ? 1 : -1,
      i & 8 ? 1 : -1,
    ]);
  }
  const tesseractEdgeIndices: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      // Connect vertices differing in exactly 1 bit (1 axis of the 4D hypercube)
      const diff = i ^ j;
      if (diff === 1 || diff === 2 || diff === 4 || diff === 8) {
        tesseractEdgeIndices.push([i, j]);
      }
    }
  }

  const tessPositions = new Float32Array(tesseractEdgeIndices.length * 2 * 3);
  const tessGeo = new THREE.BufferGeometry();
  tessGeo.setAttribute('position', new THREE.BufferAttribute(tessPositions, 3));
  const tessMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
  });
  const tesseractLines = new THREE.LineSegments(tessGeo, tessMat);
  tesseractLines.position.set(0, 4.2, -7.5);
  group.add(tesseractLines);

  return {
    group,
    tiles,
    tileOriginalY,
    highlightMeshes,
    threatSigilMeshes,
    duelRingGroup,
    duelBarrierMesh,
    columnsInstanced,
    spotAttacker,
    spotDefender,
    volumetricConeAttacker,
    volumetricConeDefender,
    clashPointLight,
    ambientParticles,
    tesseractLines,
    tesseractVerts4D,
    tesseractEdgeIndices,
  };
}

/**
 * Rotates the 16 vertices of the 4D Tesseract in 4D planes (XW, YW, ZW)
 * and stereographically projects them into 3D space!
 */
export function update4DTesseractProjection(
  rig: BoardArenaRig,
  elapsedTime: number,
  activeW: number,
  activeZ: number
) {
  const angleXW = elapsedTime * 0.55 + activeW * 0.85;
  const angleYW = elapsedTime * 0.38 + activeZ * 0.75;
  const angleXY = elapsedTime * 0.25;

  const cosXW = Math.cos(angleXW);
  const sinXW = Math.sin(angleXW);
  const cosYW = Math.cos(angleYW);
  const sinYW = Math.sin(angleYW);
  const cosXY = Math.cos(angleXY);
  const sinXY = Math.sin(angleXY);

  const projected3D: [number, number, number][] = [];
  const cameraDist4D = 2.6;
  const scale = 1.65;

  for (let i = 0; i < 16; i++) {
    let [x, y, z, w] = rig.tesseractVerts4D[i];

    // Rotate in XY
    const x1 = x * cosXY - y * sinXY;
    const y1 = x * sinXY + y * cosXY;
    x = x1;
    y = y1;

    // Rotate in XW (4th dimension!)
    const x2 = x * cosXW - w * sinXW;
    const w2 = x * sinXW + w * cosXW;
    x = x2;
    w = w2;

    // Rotate in YW (4th dimension!)
    const y3 = y * cosYW - w * sinYW;
    const w3 = y * sinYW + w * cosYW;
    y = y3;
    w = w3;

    // Stereographic 4D -> 3D projection
    const factor = scale / (cameraDist4D - w);
    projected3D.push([x * factor, y * factor, z * factor]);
  }

  const posAttr = rig.tesseractLines.geometry.attributes.position as THREE.BufferAttribute;
  for (let e = 0; e < rig.tesseractEdgeIndices.length; e++) {
    const [vA, vB] = rig.tesseractEdgeIndices[e];
    const pA = projected3D[vA];
    const pB = projected3D[vB];
    posAttr.setXYZ(e * 2, pA[0], pA[1], pA[2]);
    posAttr.setXYZ(e * 2 + 1, pB[0], pB[1], pB[2]);
  }
  posAttr.needsUpdate = true;

  const mat = rig.tesseractLines.material as THREE.LineBasicMaterial;
  if (activeW > 0) {
    mat.color.setHex(0x38bdf8); // Ana (+W) Cyan
    mat.opacity = 0.55;
  } else if (activeW < 0) {
    mat.color.setHex(0xc084fc); // Kata (-W) Violet
    mat.opacity = 0.55;
  } else if (activeZ > 0) {
    mat.color.setHex(0x34d399); // Astral (+Z) Emerald
    mat.opacity = 0.55;
  } else {
    mat.color.setHex(0xf59e0b); // Prime (0,0) Gold
    mat.opacity = 0.25;
  }
}
