import * as THREE from 'three';

export interface BoardArenaRig {
  group: THREE.Group;
  tiles: THREE.Mesh[][];
  tileOriginalY: number[][];
  highlightMeshes: Map<string, THREE.Mesh>;
  duelRingGroup: THREE.Group;
  duelBarrierMesh: THREE.Mesh;
  columnsInstanced: THREE.InstancedMesh;
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

function createProceduralMarbleTexture(
  renderer: THREE.WebGLRenderer,
  isLight: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isLight ? '#d8d3c8' : '#181c26';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle marble veins
  ctx.strokeStyle = isLight ? 'rgba(180, 155, 110, 0.22)' : 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    let x = Math.random() * 256;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < 256) {
      y += 24;
      x += (Math.random() - 0.5) * 36;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Fine border inset
  ctx.strokeStyle = isLight ? 'rgba(217, 155, 38, 0.35)' : 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 244);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  return texture;
}

export function createBoardArena(renderer: THREE.WebGLRenderer): BoardArenaRig {
  const group = new THREE.Group();

  const lightTex = createProceduralMarbleTexture(renderer, true);
  const darkTex = createProceduralMarbleTexture(renderer, false);

  const lightTileMat = new THREE.MeshPhysicalMaterial({
    map: lightTex,
    roughness: 0.22,
    metalness: 0.1,
    clearcoat: 0.5,
    clearcoatRoughness: 0.15,
  });

  const darkTileMat = new THREE.MeshPhysicalMaterial({
    map: darkTex,
    roughness: 0.28,
    metalness: 0.35,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });

  const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.45, TILE_SIZE * 0.98);
  const tiles: THREE.Mesh[][] = [];
  const tileOriginalY: number[][] = [];
  const highlightMeshes = new Map<string, THREE.Mesh>();

  const highlightGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.88, TILE_SIZE * 0.88);

  for (let r = 0; r < 8; r++) {
    tiles[r] = [];
    tileOriginalY[r] = [];
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const tile = new THREE.Mesh(tileGeo, isLight ? lightTileMat : darkTileMat);
      const pos = boardToWorld(r, c);
      tile.position.set(pos.x, -0.225, pos.z);
      tile.receiveShadow = true;
      tile.castShadow = true;
      tile.userData = { type: 'tile', row: r, col: c };
      group.add(tile);
      tiles[r][c] = tile;
      tileOriginalY[r][c] = -0.225;

      // Selection / Valid Move highlight overlay (using polygonOffset to prevent coplanar Z-fighting)
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
    }
  }

  // Grand Chessboard Outer Frame (Basalt & Brushed Gold Bevel)
  const boardSpan = 8 * TILE_SIZE + 0.9;
  const frameGeo = new THREE.BoxGeometry(boardSpan, 0.42, boardSpan);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f131d,
    roughness: 0.55,
    metalness: 0.75,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.y = -0.26;
  frameMesh.receiveShadow = true;
  group.add(frameMesh);

  // Outer Sanctuary Floor Platform (extends into fog so board never floats in a void)
  const sanctuaryFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 32, 0.8, 48),
    new THREE.MeshStandardMaterial({
      color: 0x090b10,
      roughness: 0.85,
      metalness: 0.3,
    })
  );
  sanctuaryFloor.position.y = -0.88;
  sanctuaryFloor.receiveShadow = true;
  group.add(sanctuaryFloor);

  // Instanced Perimeter Colosseum Monoliths (24 architectural pillars encircling the sanctuary)
  const pillarCount = 24;
  const pillarGeo = new THREE.BoxGeometry(0.85, 5.5, 0.85);
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

  // Duel Ring Group (rises smoothly when transitioning to FIGHT phase)
  const duelRingGroup = new THREE.Group();
  duelRingGroup.position.y = -2.5; // Hidden below board during CHESS_VIEW
  group.add(duelRingGroup);

  const ringTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99b26,
    roughness: 0.18,
    metalness: 0.9,
  });

  const arenaRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(6.8, 0.12, 16, 64),
    ringTrimMat
  );
  arenaRingMesh.rotation.x = Math.PI / 2;
  arenaRingMesh.position.y = 0.08;
  duelRingGroup.add(arenaRingMesh);

  // Translucent energy barrier cylinder around the combat stage
  const barrierMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const duelBarrierMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(6.8, 6.8, 2.2, 48, 1, true),
    barrierMat
  );
  duelBarrierMesh.position.y = 1.1;
  duelBarrierMesh.renderOrder = 5;
  duelRingGroup.add(duelBarrierMesh);

  return {
    group,
    tiles,
    tileOriginalY,
    highlightMeshes,
    duelRingGroup,
    duelBarrierMesh,
    columnsInstanced,
  };
}
