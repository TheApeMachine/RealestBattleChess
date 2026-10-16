import * as THREE from 'three';
import {
  AcademicShirtState,
  DryCleaningTicket,
  UniversityRoomId,
} from '../types/game';

export type AcademicArchetype =
  | 'DR_PAWN'
  | 'GRAD_TOBY'
  | 'PROF_BISHOP'
  | 'CHAIR_QUEEN'
  | 'PROF_ROOK'
  | 'BARISTA'
  | 'CLEANER_CLERK'
  | 'UNDERGRAD'
  | 'PATRON';

export interface HumanAcademicRig {
  root: THREE.Group;
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  jacketMesh: THREE.Mesh;
  sweaterMesh: THREE.Mesh;
  shirtChestMesh: THREE.Mesh;
  coffeeStainGroup: THREE.Group;
  necktieMesh: THREE.Mesh;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  heldCoffeeCupGroup: THREE.Group;
  leftPupilGroup: THREE.Group;
  rightPupilGroup: THREE.Group;
  eyebrowLeft: THREE.Mesh;
  eyebrowRight: THREE.Mesh;
  labelCanvas: HTMLCanvasElement;
  labelTex: THREE.CanvasTexture;
  labelSprite: THREE.Sprite;
  lastLabelText: string;
}

export interface UniversityOfficeRig {
  rootGroup: THREE.Group;
  walkableFloorMesh: THREE.Mesh;
  rainPoints: THREE.Points;
  rainVelocities: Float32Array;
  windowDropletsMesh: THREE.Mesh;
  chalkboardCanvas: HTMLCanvasElement;
  chalkboardTex: THREE.CanvasTexture;
  crtScreenCanvas: HTMLCanvasElement;
  crtScreenTex: THREE.CanvasTexture;
  seminarBoardCanvas: HTMLCanvasElement;
  seminarBoardTex: THREE.CanvasTexture;
  cafeteriaBoardCanvas: HTMLCanvasElement;
  cafeteriaBoardTex: THREE.CanvasTexture;
  cleanerBoardCanvas: HTMLCanvasElement;
  cleanerBoardTex: THREE.CanvasTexture;
  coffeeMachineGroup: THREE.Group;
  coffeeLedMat: THREE.MeshBasicMaterial;
  labEquipmentGroup: THREE.Group;
  oscilloscopeScreenCanvas: HTMLCanvasElement;
  oscilloscopeScreenTex: THREE.CanvasTexture;
  cleanerClosedShutter: THREE.Mesh;
  cleanerHangingShirtGroup: THREE.Group;
  deskLampLight: THREE.PointLight;
  windowMoonLight: THREE.SpotLight;
  fluorescentLight: THREE.PointLight;
  cafeteriaLight: THREE.PointLight;
  seminarLight: THREE.PointLight;
  cleanerLight: THREE.PointLight;

  // Human Character Rigs (Sculpted Bespoke Academic Models)
  drPawnRig: HumanAcademicRig;
  tobyRig: HumanAcademicRig;
  bishopRig: HumanAcademicRig;
  queenRig: HumanAcademicRig;
  rookRig: HumanAcademicRig;
  cashierRig: HumanAcademicRig;
  cleanerClerkRig: HumanAcademicRig;
  distractedStudentRig: HumanAcademicRig;
  queueNpcRigs: HumanAcademicRig[];

  // Coffee spill particle burst
  coffeeSplashPoints: THREE.Points;
  coffeeSplashVelocities: Float32Array;
  coffeeSplashTimerSec: number;

  // Room architecture groups for the final Reality Shatter sequence
  shatterableGroups: { group: THREE.Object3D; basePos: THREE.Vector3; driftDir: THREE.Vector3 }[];

  lastChalkSignature: string;
  lastCafeteriaSignature: string;
  lastCleanerSignature: string;
  lastSeminarSignature: string;
}

export const UNIVERSITY_ROOM_CENTERS: Record<
  UniversityRoomId,
  { x: number; z: number; label: string; subtitle: string }
> = {
  OFFICE_4B: {
    x: -10.0,
    z: -4.0,
    label: 'Room 4B · Dr. Pawn’s Office',
    subtitle: 'Chalkboard Proof Workbench, Pine Mail Terminal & 1987 Coffee Machine',
  },
  FACULTY_CORRIDOR: {
    x: 0.0,
    z: 1.4,
    label: 'Peano Hall · Faculty Corridor',
    subtitle: 'Central Hallway Connecting Office 4B, Seminar Room 204, Cafeteria & Dry Cleaners',
  },
  SEMINAR_ROOM_204: {
    x: 0.0,
    z: -4.0,
    label: 'Seminar Room 204',
    subtitle: '14:30 Departmental & Quantum Lab Access Review (Prof. Bishop & Chairwoman Queen)',
  },
  CAFETERIA: {
    x: 11.0,
    z: -3.8,
    label: 'The Lagrange Point Cafeteria',
    subtitle: 'Live Coffee Queue ($4.50) · Beware Distracted Undergraduates Carrying Textbooks',
  },
  DRY_CLEANER: {
    x: 11.0,
    z: 7.0,
    label: 'Perseus Dry Cleaners & Haberdashery',
    subtitle: 'Open 08:30–17:30 · Express Stain Removal ($28.50, 75m) or New Oxford Shirt ($68.00)',
  },
};

export function getRoomAtWorldPos(x: number, z: number): UniversityRoomId {
  if (z < -0.75) {
    if (x < -5.0) return 'OFFICE_4B';
    if (x <= 5.2) return 'SEMINAR_ROOM_204';
    return 'CAFETERIA';
  }
  if (z > 3.7 && x > 5.0) {
    return 'DRY_CLEANER';
  }
  return 'FACULTY_CORRIDOR';
}

// ============================================================================
// 1. PROCEDURAL SURFACE RELIEF & ALBEDO TEXTURES (TWEED, OXFORD WEAVE, PARQUET)
// ============================================================================

let _herringboneTweedTex: THREE.CanvasTexture | null = null;
function getSharedHerringboneTweedTexture(): THREE.CanvasTexture {
  if (_herringboneTweedTex) return _herringboneTweedTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const colW = 16;
  const rowH = 8;
  for (let col = 0; col < size / colW; col++) {
    const x0 = col * colW;
    const dir = col % 2 === 0 ? 1 : -1;
    for (let row = -2; row < size / rowH + 2; row++) {
      const y0 = row * rowH;
      ctx.strokeStyle = row % 2 === 0 ? '#b4b4b4' : '#525252';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + colW, y0 + dir * rowH);
      ctx.stroke();

      // Subtle wool fleck grain
      ctx.fillStyle = (col + row) % 3 === 0 ? '#d4d4d4' : '#404040';
      ctx.fillRect(x0 + 4, (y0 + size) % size, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _herringboneTweedTex = tex;
  return tex;
}

let _oxfordWeaveTex: THREE.CanvasTexture | null = null;
function getSharedOxfordWeaveTexture(): THREE.CanvasTexture {
  if (_oxfordWeaveTex) return _oxfordWeaveTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, size, size);

  // Pinpoint basketweave relief
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const bright = ((x + y) / 4) % 2 === 0;
      ctx.fillStyle = bright ? '#a8a8a8' : '#6c6c6c';
      ctx.fillRect(x, y, 3, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _oxfordWeaveTex = tex;
  return tex;
}

let _suedeGrainTex: THREE.CanvasTexture | null = null;
function getSharedSuedeGrainTexture(): THREE.CanvasTexture {
  if (_suedeGrainTex) return _suedeGrainTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7c7c7c';
  ctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random suede nap & pebble grain
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 3200; i++) {
    const x = nextRand() * size;
    const y = nextRand() * size;
    const r = 1.0 + nextRand() * 2.2;
    ctx.fillStyle = nextRand() > 0.5 ? '#9e9e9e' : '#585858';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Saddle-stitched border groove
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(14, 14, size - 28, size - 28);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _suedeGrainTex = tex;
  return tex;
}

let _parquetFloorTex: THREE.CanvasTexture | null = null;
function getSharedParquetFloorTexture(): THREE.CanvasTexture {
  if (_parquetFloorTex) return _parquetFloorTex;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2d1e17';
  ctx.fillRect(0, 0, size, size);

  const plankW = 64;
  const plankH = 16;
  const tones = ['#38251c', '#2f1f17', '#422c21', '#261812', '#3b281e'];
  let idx = 0;
  for (let y = 0; y < size; y += plankH) {
    const offset = ((y / plankH) % 2) * (plankW / 2);
    for (let x = -plankW; x < size + plankW; x += plankW) {
      ctx.fillStyle = tones[idx++ % tones.length];
      ctx.fillRect(x + offset, y, plankW - 2, plankH - 1.5);
      // Wood grain streaks
      ctx.strokeStyle = 'rgba(18, 10, 6, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + offset + 4, y + plankH * 0.4);
      ctx.lineTo(x + offset + plankW - 6, y + plankH * 0.55);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 7);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _parquetFloorTex = tex;
  return tex;
}

let _persianRugTex: THREE.CanvasTexture | null = null;
function getSharedPersianRugTexture(): THREE.CanvasTexture {
  if (_persianRugTex) return _persianRugTex;
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Deep Crimson & Burgundy Woven Base
  ctx.fillStyle = '#4a121b';
  ctx.fillRect(0, 0, w, h);

  // Ornate Gold & Navy Borders
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 14;
  ctx.strokeRect(34, 34, w - 68, h - 68);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, w - 96, h - 96);

  // Central Geometric Medallion (subtle 4D tesseract motif woven into the Persian rug!)
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -105);
  ctx.lineTo(145, 0);
  ctx.lineTo(0, 105);
  ctx.lineTo(-145, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-48, -48, 96, 96);
  ctx.strokeRect(-26, -26, 52, 52);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _persianRugTex = tex;
  return tex;
}

let _checkerTileTex: THREE.CanvasTexture | null = null;
function getSharedCheckerTileTexture(): THREE.CanvasTexture {
  if (_checkerTileTex) return _checkerTileTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const tile = 64;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const isLight = ((x + y) / tile) % 2 === 0;
      ctx.fillStyle = isLight ? '#475569' : '#1e293b';
      ctx.fillRect(x, y, tile, tile);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, tile, tile);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _checkerTileTex = tex;
  return tex;
}

// ============================================================================
// 2. BESPOKE SCULPTED HUMAN ACADEMIC GEOMETRY BUILDERS (ZERO BOXY PRIMITIVES)
// ============================================================================

// Master Anatomical Torso Profile (Shared by Shirt, Waistcoat, Jacket, Lapels & Necktie for ZERO Z-fighting!)
function sampleTorsoRadius(y: number): number {
  const stops: [number, number][] = [
    [-0.06, 0.182],
    [0.0, 0.176], // Waistband / hips
    [0.12, 0.165], // Tailored natural waist suppression
    [0.26, 0.179], // Ribcage
    [0.4, 0.191], // Pectoral chest
    [0.465, 0.193], // Deltoid shoulder level
    [0.525, 0.138], // Clavicle / trapezius slope
    [0.565, 0.074], // Neck collar stand base
  ];
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [y0, r0] = stops[i];
    const [y1, r1] = stops[i + 1];
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0);
      const smoothT = t * t * (3 - 2 * t);
      return THREE.MathUtils.lerp(r0, r1, smoothT);
    }
  }
  return stops[stops.length - 1][1];
}

function getTorsoEllipticalRadii(
  y: number,
  radialOffset: number = 0
): { rx: number; rz: number } {
  const base = sampleTorsoRadius(y);
  // Transition smoothly from wide anatomical ribcage oval (1.04 x 0.68) to round neck collar stand (0.96 x 0.88)
  const neckBlend = THREE.MathUtils.smoothstep(y, 0.46, 0.565);
  const xAspect = THREE.MathUtils.lerp(1.04, 0.96, neckBlend);
  const zAspect = THREE.MathUtils.lerp(0.68, 0.88, neckBlend);
  return {
    rx: base * xAspect + radialOffset,
    rz: base * zAspect + radialOffset,
  };
}

function getTorsoFrontZ(x: number, y: number, radialOffset: number = 0): number {
  const { rx, rz } = getTorsoEllipticalRadii(y, radialOffset);
  const ratio = Math.min(0.97, Math.abs(x) / Math.max(0.01, rx));
  return rz * Math.sqrt(Math.max(0, 1 - ratio * ratio));
}

// Helper: Builds a 100% closed, manifold, thick open-front garment shell (zero triangle folding, zero Z-fighting)
function buildSolidOpenGarmentGeometry(
  yMin: number,
  yMax: number,
  ySteps: number,
  phiSteps: number,
  innerOffset: number,
  outerOffset: number,
  getThetaOpen: (y: number) => number
): THREE.BufferGeometry {
  const ringStride = phiSteps + 1;
  const wallVertCount = (ySteps + 1) * ringStride;
  const positions = new Float32Array(wallVertCount * 2 * 3);
  const uvs = new Float32Array(wallVertCount * 2 * 2);

  const setVert = (idx: number, x: number, y: number, z: number, u: number, v: number) => {
    positions[idx * 3 + 0] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    uvs[idx * 2 + 0] = u;
    uvs[idx * 2 + 1] = v;
  };

  for (let j = 0; j <= ySteps; j++) {
    const v = j / ySteps;
    const y = THREE.MathUtils.lerp(yMin, yMax, v);
    const thetaOpen = getThetaOpen(y);
    const outerRadii = getTorsoEllipticalRadii(y, outerOffset);
    const innerRadii = getTorsoEllipticalRadii(y, innerOffset);

    for (let k = 0; k <= phiSteps; k++) {
      const u = k / phiSteps;
      // Sweep monotonically from front-right (+X, +Z) around back (-Z) to front-left (-X, +Z)
      const phi = thetaOpen + u * (Math.PI * 2 - thetaOpen * 2);
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const outIdx = j * ringStride + k;
      setVert(outIdx, sinP * outerRadii.rx, y, cosP * outerRadii.rz, u, v);

      const inIdx = wallVertCount + j * ringStride + k;
      setVert(inIdx, sinP * innerRadii.rx, y, cosP * innerRadii.rz, u, v);
    }
  }

  const indices: number[] = [];
  const addQuad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, d, b, c, d);
  };

  // 1. Outer & Inner Garment Walls
  for (let j = 0; j < ySteps; j++) {
    for (let k = 0; k < phiSteps; k++) {
      const o0 = j * ringStride + k;
      const o1 = o0 + 1;
      const o2 = (j + 1) * ringStride + k + 1;
      const o3 = (j + 1) * ringStride + k;
      addQuad(o0, o3, o2, o1);

      const i0 = wallVertCount + o0;
      const i1 = wallVertCount + o1;
      const i2 = wallVertCount + o2;
      const i3 = wallVertCount + o3;
      addQuad(i0, i1, i2, i3);
    }
  }

  // 2. Stitch Right Front Opening Edge (k = 0) & Left Front Opening Edge (k = phiSteps)
  for (let j = 0; j < ySteps; j++) {
    const rOut0 = j * ringStride;
    const rOut1 = (j + 1) * ringStride;
    const rIn0 = wallVertCount + rOut0;
    const rIn1 = wallVertCount + rOut1;
    addQuad(rOut0, rIn0, rIn1, rOut1);

    const lOut0 = j * ringStride + phiSteps;
    const lOut1 = (j + 1) * ringStride + phiSteps;
    const lIn0 = wallVertCount + lOut0;
    const lIn1 = wallVertCount + lOut1;
    addQuad(lOut0, lOut1, lIn1, lIn0);
  }

  // 3. Stitch Bottom Hem (j = 0) & Top Collar Rim (j = ySteps)
  for (let k = 0; k < phiSteps; k++) {
    const bOut0 = k;
    const bOut1 = k + 1;
    const bIn0 = wallVertCount + bOut0;
    const bIn1 = wallVertCount + bOut1;
    addQuad(bOut0, bOut1, bIn1, bIn0);

    const tOut0 = ySteps * ringStride + k;
    const tOut1 = tOut0 + 1;
    const tIn0 = wallVertCount + tOut0;
    const tIn1 = wallVertCount + tOut1;
    addQuad(tOut0, tIn0, tIn1, tOut1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Anatomical Dress-Shirt Torso (Smooth closed inner layer at radialOffset = 0)
function createTailoredShirtTorsoGeometry(): THREE.BufferGeometry {
  const ySteps = 20;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.002, 0.0)];
  for (let j = 0; j <= ySteps; j++) {
    const y = (j / ySteps) * 0.565;
    pts.push(new THREE.Vector2(sampleTorsoRadius(y), y));
  }
  pts.push(new THREE.Vector2(0.002, 0.565));

  const geo = new THREE.LatheGeometry(pts, 36);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const base = Math.max(0.001, sampleTorsoRadius(vy));
    const { rx, rz } = getTorsoEllipticalRadii(vy, 0);
    pos.setXYZ(i, (vx / base) * rx, vy, (vz / base) * rz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Jacket V-Opening Half-Angle Profile (Shared by Jacket Shell & Lapels)
function getJacketThetaOpen(y: number): number {
  if (y >= 0.14) {
    const t = THREE.MathUtils.clamp((y - 0.14) / 0.415, 0, 1);
    return 0.11 + Math.pow(t, 1.12) * 0.54;
  } else {
    const t = THREE.MathUtils.clamp((0.14 - y) / 0.195, 0, 1);
    return 0.11 + Math.pow(t, 1.35) * 0.28;
  }
}

// Sculpted Tailored Single-Breasted Tweed Suit Jacket Shell (Solid thick manifold at radialOffset 0.017..0.028)
function createTailoredJacketShellGeometry(): THREE.BufferGeometry {
  return buildSolidOpenGarmentGeometry(
    -0.05,
    0.555,
    24,
    40,
    0.017,
    0.028,
    getJacketThetaOpen
  );
}

// Sculpted Academic Wool Waistcoat / Vest worn beneath the open tweed blazer (radialOffset 0.006..0.014)
function createTailoredWaistcoatGeometry(): THREE.BufferGeometry {
  return buildSolidOpenGarmentGeometry(
    0.015,
    0.535,
    18,
    32,
    0.006,
    0.014,
    (y: number) => {
      if (y >= 0.19) {
        const t = THREE.MathUtils.clamp((y - 0.19) / 0.345, 0, 1);
        return 0.05 + Math.pow(t, 1.15) * 0.66;
      }
      const t = THREE.MathUtils.clamp((0.19 - y) / 0.175, 0, 1);
      return 0.05 + t * 0.18;
    }
  );
}

// Sculpted Notched Jacket Lapel projected directly onto the outer Tweed Jacket chest contour
function createNotchedLapelGeometry(isRight: boolean): THREE.ExtrudeGeometry {
  const dir = isRight ? 1 : -1;
  const s = new THREE.Shape();
  // Coordinates in Torso space (y from 0.15 waist button up to 0.52 collar gorge)
  s.moveTo(dir * 0.022, 0.15); // Waist button origin
  s.lineTo(dir * 0.068, 0.32);
  s.lineTo(dir * 0.106, 0.41); // Lower lapel peak
  s.lineTo(dir * 0.078, 0.435); // Crisp Savile Row lapel notch
  s.lineTo(dir * 0.096, 0.465); // Upper collar gorge peak
  s.lineTo(dir * 0.064, 0.525); // Collar stand wrap
  s.lineTo(dir * 0.044, 0.515);
  s.lineTo(dir * 0.018, 0.19);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 6,
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.002,
    bevelSegments: 2,
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    // Project onto the exact outer surface of the jacket shell (radialOffset = 0.0285)
    const surfaceZ = getTorsoFrontZ(vx, vy, 0.0285);
    pos.setZ(i, surfaceZ + vz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Four-in-Hand Silk Necktie projected directly onto the Dress Shirt chest contour
function createSilkNecktieGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  // Coordinates in Torso space (y = 0.535 collar knot down to y = 0.155 diamond point)
  s.moveTo(-0.022, 0.535);
  s.lineTo(0.022, 0.535);
  s.lineTo(0.014, 0.485); // Base of four-in-hand knot
  s.lineTo(0.031, 0.21); // Flaring tie blade
  s.lineTo(0, 0.155); // Classic diamond point tip
  s.lineTo(-0.031, 0.21);
  s.lineTo(-0.014, 0.485);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 6,
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.0025,
    bevelSegments: 2,
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const knotLift = vy > 0.48 ? 0.006 : 0.003;
    const surfaceZ = getTorsoFrontZ(vx, vy, knotLift);
    pos.setZ(i, surfaceZ + vz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Organic Multi-Lobe Coffee Stain Geometry projected onto the Dress Shirt chest contour
function createOrganicCoffeeStainGeometry(
  radius: number,
  seed: number,
  centerX: number,
  centerY: number,
  scaleX: number = 1,
  scaleY: number = 1
): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const pts = 24;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wobble =
      1.0 +
      0.26 * Math.sin(a * 3 + seed) +
      0.16 * Math.cos(a * 5 - seed * 1.7) +
      0.1 * Math.sin(a * 8 + seed * 2.3);
    const rx = centerX + Math.cos(a) * radius * wobble * scaleX;
    const ry = centerY + Math.sin(a) * radius * wobble * 1.2 * scaleY;
    if (i === 0) s.moveTo(rx, ry);
    else s.lineTo(rx, ry);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: 0.002,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.001,
    bevelSegments: 1,
  });
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    pos.setZ(i, getTorsoFrontZ(vx, vy, 0.0155) + vz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Crew-Neck Ribbed University Sweatshirt (worn when shirt is at Perseus Dry Cleaners)
function createSweatshirtGeometry(): THREE.BufferGeometry {
  const ySteps = 20;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.002, -0.02)];
  for (let j = 0; j <= ySteps; j++) {
    const y = -0.02 + (j / ySteps) * 0.585;
    pts.push(new THREE.Vector2(sampleTorsoRadius(y) + 0.018, y));
  }
  pts.push(new THREE.Vector2(0.002, 0.565));

  const geo = new THREE.LatheGeometry(pts, 36);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const base = Math.max(0.001, sampleTorsoRadius(vy) + 0.018);
    const { rx, rz } = getTorsoEllipticalRadii(vy, 0.02);
    pos.setXYZ(i, (vx / base) * rx, vy, (vz / base) * rz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Tailored Jacket Sleeve Segment with Integrated Hemispherical Ball-Joint Top Cap (Zero joint gaps!)
function createTailoredSleeveGeometry(
  topR: number,
  botR: number,
  length: number
): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0.002, -length),
    new THREE.Vector2(botR, -length),
    new THREE.Vector2(botR * 1.03, -length * 0.8),
    new THREE.Vector2((topR + botR) * 0.52, -length * 0.45),
    new THREE.Vector2(topR, 0.0),
    // Integrated hemispherical ball-joint cap above y = 0 so shoulder & elbow rotations are 100% seamless!
    new THREE.Vector2(topR * 0.92, topR * 0.36),
    new THREE.Vector2(topR * 0.7, topR * 0.68),
    new THREE.Vector2(topR * 0.36, topR * 0.88),
    new THREE.Vector2(0.002, topR * 0.94),
  ];
  const geo = new THREE.LatheGeometry(points, 24);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Curved Cognac Suede Elbow Patch conformed to the outer sleeve radius
function createSculptedElbowPatchGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const rx = 0.032;
  const ry = 0.052;
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: 0.005,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  geo.center();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    // Curve cleanly around the back of the sleeve (-Z)
    pos.setZ(i, vz + vx * vx * 7.5);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Pleated Trouser Leg with Integrated Ball-Joint Cap & Cuffed Hem
function createPleatedTrouserLegGeometry(length: number): THREE.BufferGeometry {
  const topR = 0.084;
  const points = [
    new THREE.Vector2(0.002, -length),
    new THREE.Vector2(0.07, -length), // Turn-up trouser cuff bottom
    new THREE.Vector2(0.074, -length + 0.03), // Turn-up trouser cuff lip
    new THREE.Vector2(0.068, -length + 0.034),
    new THREE.Vector2(0.074, -length * 0.55), // Knee taper
    new THREE.Vector2(0.084, -length * 0.18), // Upper thigh volume
    new THREE.Vector2(topR, 0.0),
    // Integrated ball-joint cap above y = 0 so hip & knee rotations never expose flat gaps
    new THREE.Vector2(topR * 0.9, topR * 0.35),
    new THREE.Vector2(topR * 0.65, topR * 0.65),
    new THREE.Vector2(0.002, topR * 0.82),
  ];
  const geo = new THREE.LatheGeometry(points, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const frontBackCrease = vy < 0 ? Math.exp(-vx * vx * 900) * 0.008 * Math.sign(vz) : 0;
    pos.setXYZ(i, vx * 0.95, vy, vz * 1.05 + frontBackCrease);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Leather Oxford Brogue Dress Shoe with Heel Block, Welt & Arched Instep
function createOxfordShoeGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.044, -0.065);
  s.quadraticCurveTo(-0.052, -0.01, -0.042, 0.03);
  s.quadraticCurveTo(-0.054, 0.09, -0.032, 0.145);
  s.quadraticCurveTo(0, 0.175, 0.032, 0.145);
  s.quadraticCurveTo(0.054, 0.09, 0.042, 0.03);
  s.quadraticCurveTo(0.052, -0.01, 0.044, -0.065);
  s.quadraticCurveTo(0, -0.078, -0.044, -0.065);

  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 2,
    depth: 0.052,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.01,
    bevelSegments: 3,
  });
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    if (vy > 0.015) {
      const toeSlope = vz > 0.02 ? Math.min(0.038, (vz - 0.02) * 0.28) : 0;
      const archCrown = Math.exp(-vx * vx * 600) * 0.012;
      pos.setY(i, vy - toeSlope + archCrown);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// Shared Cranial Displacement Helper (Guarantees Hair & Skull match with zero face-slicing triangles!)
function deformHumanSkullPoint(
  nx: number,
  ny: number,
  nz: number,
  baseR: number
): { x: number; y: number; z: number } {
  let vx = nx * baseR * 0.91;
  let vy = ny * baseR * 1.14;
  let vz = nz * baseR;

  // Sculpted Zygomatic Cheekbones & Tapered Mandible / Jawline toward a defined Chin
  if (ny < 0.05 && ny > -0.35 && nz > 0.2) {
    const cheekSwell =
      Math.exp(-Math.pow((ny + 0.12) * 5.5, 2)) *
      Math.exp(-Math.pow((Math.abs(nx) - 0.55) * 3.5, 2));
    vx += Math.sign(vx) * cheekSwell * 0.008;
    vz += cheekSwell * 0.005;
  }
  if (ny < -0.1) {
    const jawTaper = 1.0 - Math.min(0.36, (-ny - 0.1) * 0.42);
    vx *= jawTaper;
    if (nz > 0.2 && ny < -0.48) {
      vz += 0.012 * Math.max(0, 1.0 - Math.abs(vx) / (baseR * 0.55));
    }
  }

  // Sculpted Supraorbital Brow Ridge & Recessed Orbital Eye Sockets
  if (nz > 0.42 && ny > -0.06 && ny < 0.32) {
    const browFactor = Math.exp(-Math.pow((ny - 0.19) * 8.5, 2));
    const socketDist = Math.hypot(Math.abs(nx) - 0.34, (ny - 0.04) * 1.2);
    const socketRecess = Math.exp(-socketDist * socketDist * 18);
    vz += browFactor * 0.009 - socketRecess * 0.01;
  }

  if (nz < -0.5 && ny < 0.0) {
    vz *= 0.92;
  }

  return { x: vx, y: vy, z: vz };
}

// Sculpted Anatomical Human Cranium with Jawline, Cheekbones, Brow Ridge & Chin
function createSculptedHumanHeadGeometry(): THREE.BufferGeometry {
  const r = 0.138;
  const geo = new THREE.SphereGeometry(r, 36, 30);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / r;
    const ny = pos.getY(i) / r;
    const nz = pos.getZ(i) / r;
    const p = deformHumanSkullPoint(nx, ny, nz, r);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Smoothly Blended Academic Coiffure (Uses C1-continuous smoothstep over the skull surface — ZERO face-slicing shards!)
function createSculptedAcademicHairGeometry(archetype: AcademicArchetype): THREE.BufferGeometry {
  const r = 0.138;
  const geo = new THREE.SphereGeometry(r, 40, 32);
  const pos = geo.attributes.position;
  const isReceding = archetype === 'PROF_BISHOP' || archetype === 'PROF_ROOK';
  const isUpdo = archetype === 'CHAIR_QUEEN';

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / r;
    const ny = pos.getY(i) / r;
    const nz = pos.getZ(i) / r;

    // Start from the exact underlying skull surface
    const skull = deformHumanSkullPoint(nx, ny, nz, r);

    // Compute smooth continuous hair coverage weight in [0, 1] (0 = bare face/ears/neck, 1 = full hair volume)
    const sidePartBias = nx > 0.1 ? 0.06 : -0.02;
    const hairlineY = (isReceding ? 0.44 : 0.28) + sidePartBias;

    // Front face cutout weight: smoothly transitions across the forehead & temples
    const frontFaceMask =
      THREE.MathUtils.smoothstep(nz, 0.08, 0.34) *
      (1.0 - THREE.MathUtils.smoothstep(ny, hairlineY - 0.12, hairlineY + 0.08)) *
      (1.0 - THREE.MathUtils.smoothstep(Math.abs(nx), 0.64, 0.86));

    // Ear cutout weight around side of head
    const earDist = Math.hypot(ny + 0.06, nz + 0.02);
    const earMask =
      THREE.MathUtils.smoothstep(Math.abs(nx), 0.72, 0.9) *
      (1.0 - THREE.MathUtils.smoothstep(earDist, 0.16, 0.3));

    // Lower neck / chin cutout weight
    const lowerChinMask =
      (1.0 - THREE.MathUtils.smoothstep(ny, -0.68, -0.45)) *
      THREE.MathUtils.smoothstep(nz, -0.25, 0.15);

    const bareSkinWeight = Math.min(1.0, Math.max(frontFaceMask, earMask, lowerChinMask));
    const hairCoverage = 1.0 - bareSkinWeight;

    // Subtle organic hair waves only where hairCoverage > 0
    const strandWave =
      hairCoverage *
      (Math.sin(nx * 18 + ny * 8 + nz * 12) * 0.0022 +
        Math.cos(nx * 28 - nz * 14) * 0.0012);

    // Radial offset relative to the skull: +11mm..+18mm in hair regions, smoothly tucking -9mm inside the skull under bare skin
    const partGroove = ny > 0.15 ? Math.exp(-Math.pow((nx + 0.32) * 8, 2)) * 0.006 : 0;
    const crownBoost =
      ny > 0 ? Math.sin(ny * Math.PI * 0.5) * (isUpdo ? 0.018 : 0.012) - partGroove : 0;
    const radialOffset = THREE.MathUtils.lerp(-0.009, 0.011 + crownBoost, hairCoverage) + strandWave;

    const len = Math.max(0.001, Math.hypot(skull.x, skull.y, skull.z));
    const scale = (len + radialOffset) / len;
    pos.setXYZ(
      i,
      skull.x * scale,
      skull.y * scale + hairCoverage * crownBoost * 0.45,
      skull.z * scale
    );
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Anatomical Nose with Smooth Bridge & Rounded Tip (No negative bevel inversions!)
function createSculptedNoseGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.016, 0.048, 16, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i); // -0.024 (base/nostrils) to +0.024 (top bridge)
    const vz = pos.getZ(i);
    const t = (0.024 - vy) / 0.048; // 0 at top bridge, 1 at nose tip
    const widthScale = 0.55 + 0.45 * Math.sin(t * Math.PI * 0.85);
    const forwardProtrusion = vz > 0 ? vz * (0.4 + 0.95 * Math.pow(t, 0.85)) : vz * 0.25;
    pos.setXYZ(i, vx * widthScale, vy, forwardProtrusion);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Natural Human Lips (Upper Cupid's Bow + Lower Lip Contour)
function createSculptedMouthGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.021, 0.0);
  s.quadraticCurveTo(-0.009, 0.0055, -0.003, 0.0035);
  s.lineTo(0, 0.002);
  s.lineTo(0.003, 0.0035);
  s.quadraticCurveTo(0.009, 0.0055, 0.021, 0.0);
  s.quadraticCurveTo(0.01, -0.0055, 0, -0.006);
  s.quadraticCurveTo(-0.01, -0.0055, -0.021, 0.0);

  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.0015,
    bevelSegments: 2,
  });
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setZ(i, vz - vx * vx * 9.5);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Curved Eyebrow Arch
function createSculptedEyebrowGeometry(isRight: boolean): THREE.ExtrudeGeometry {
  const dir = isRight ? 1 : -1;
  const s = new THREE.Shape();
  s.moveTo(-dir * 0.018, -0.002);
  s.quadraticCurveTo(dir * 0.003, 0.006, dir * 0.021, -0.001);
  s.lineTo(dir * 0.019, -0.005);
  s.quadraticCurveTo(dir * 0.002, 0.001, -dir * 0.018, -0.006);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0012,
    bevelSegments: 1,
  });
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// 3. ARTICULATED HUMAN ACADEMIC CHARACTER BUILDER WITH ARCHETYPE SIGNATURES
// ============================================================================

function createHumanAcademicCharacter(config: {
  archetype: AcademicArchetype;
  nameTag: string;
  roleTag: string;
  jacketColor: number;
  trouserColor: number;
  tieColor: number;
  hairColor: number;
  skinColor?: number;
  elbowPatchColor?: number;
  eyeColor?: number;
  hasGlasses?: boolean;
}): HumanAcademicRig {
  const root = new THREE.Group();
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.78, 0);
  root.add(pelvisGroup);

  // Soft Ground Contact Shadow Disc beneath feet (prevents floating!)
  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.006;
  root.add(contactShadow);

  const torsoGroup = new THREE.Group();
  pelvisGroup.add(torsoGroup);

  const tweedTex = getSharedHerringboneTweedTexture();
  const oxfordTex = getSharedOxfordWeaveTexture();
  const suedeTex = getSharedSuedeGrainTexture();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: config.skinColor ?? 0xe8be9e,
    roughness: 0.58,
    metalness: 0.02,
    clearcoat: 0.08,
    clearcoatRoughness: 0.65,
  });
  const jacketMat = new THREE.MeshPhysicalMaterial({
    color: config.jacketColor,
    roughness: 0.86,
    metalness: 0.03,
    bumpMap: tweedTex,
    bumpScale: 0.012,
    sheen: 0.35,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(config.jacketColor).offsetHSL(0, 0, 0.08),
  });
  const waistcoatMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.jacketColor).offsetHSL(0.02, -0.08, -0.1),
    roughness: 0.82,
    metalness: 0.03,
    bumpMap: tweedTex,
    bumpScale: 0.008,
  });
  const sweaterMat = new THREE.MeshPhysicalMaterial({
    color: 0x581c28, // Woven burgundy UGA sweatshirt worn when shirt is at the dry cleaners
    roughness: 0.9,
    metalness: 0.02,
    bumpMap: tweedTex,
    bumpScale: 0.015,
    sheen: 0.35,
  });
  // Warm natural ivory/ecru pinpoint Oxford cotton
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xe6e1d6,
    roughness: 0.74,
    metalness: 0.01,
    bumpMap: oxfordTex,
    bumpScale: 0.004,
  });
  const trouserMat = new THREE.MeshPhysicalMaterial({
    color: config.trouserColor,
    roughness: 0.78,
    metalness: 0.04,
    bumpMap: tweedTex,
    bumpScale: 0.009,
    sheen: 0.3,
  });
  const shoeMat = new THREE.MeshPhysicalMaterial({
    color: 0x23140d,
    roughness: 0.32,
    metalness: 0.1,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
  });
  const patchMat = new THREE.MeshStandardMaterial({
    color: config.elbowPatchColor ?? 0x8b4513,
    roughness: 0.88,
    metalness: 0.04,
    bumpMap: suedeTex,
    bumpScale: 0.012,
  });
  const tieMat = new THREE.MeshPhysicalMaterial({
    color: config.tieColor,
    roughness: 0.38,
    metalness: 0.06,
    sheen: 0.75,
    sheenRoughness: 0.4,
    clearcoat: 0.12,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc27803,
    roughness: 0.28,
    metalness: 0.82,
  });

  // --------------------------------------------------------------------------
  // 1. SCULPTED OXFORD DRESS SHIRT TORSO, WAISTCOAT VEST, COLLAR & NECKTIE
  // --------------------------------------------------------------------------
  const shirtChestMesh = new THREE.Mesh(createTailoredShirtTorsoGeometry(), shirtMat);
  shirtChestMesh.position.set(0, 0.02, 0);
  shirtChestMesh.castShadow = true;
  shirtChestMesh.receiveShadow = true;
  torsoGroup.add(shirtChestMesh);

  // Tailored Academic Wool Waistcoat / Vest layered cleanly at radialOffset 0.006..0.014
  const waistcoatMesh = new THREE.Mesh(createTailoredWaistcoatGeometry(), waistcoatMat);
  waistcoatMesh.castShadow = true;
  waistcoatMesh.receiveShadow = true;
  shirtChestMesh.add(waistcoatMesh);

  const pearlButtonMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.18,
    clearcoat: 0.9,
  });
  // Waistcoat & Shirt Buttons projected directly onto the torso contour
  for (let b = 0; b < 4; b++) {
    const by = 0.06 + b * 0.045;
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 10),
      pearlButtonMat
    );
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, by, getTorsoFrontZ(0, by, 0.015));
    shirtChestMesh.add(btn);
  }

  // Sculpted Turn-Down Shirt Collar Band hugging the neck base (y = 0.56)
  const collarStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.071, 0.075, 0.038, 24),
    shirtMat
  );
  collarStand.scale.set(0.96, 1, 0.88);
  collarStand.position.set(0, 0.562, 0.0);
  shirtChestMesh.add(collarStand);

  // Neat Spread Collar Points tucked right over the top of the tie knot
  for (const side of [-1, 1]) {
    const collarWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.034, 0.006),
      shirtMat
    );
    const cy = 0.545;
    const cx = side * 0.024;
    collarWing.position.set(cx, cy, getTorsoFrontZ(cx, cy, 0.008));
    collarWing.rotation.set(0.28, side * 0.36, -side * 0.28);
    shirtChestMesh.add(collarWing);
  }

  // Leather Belt & Brass Buckle at Waistband (y = 0.02)
  const beltRadii = getTorsoEllipticalRadii(0.01, 0.015);
  const beltTorso = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.034, 28),
    shoeMat
  );
  beltTorso.scale.set(beltRadii.rx, 1, beltRadii.rz);
  beltTorso.position.set(0, 0.028, 0);
  torsoGroup.add(beltTorso);

  const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.038, 0.012), brassMat);
  beltBuckle.position.set(0, 0.028, beltRadii.rz + 0.004);
  torsoGroup.add(beltBuckle);

  // Sculpted Silk Necktie projected directly onto the chest curve
  const necktieMesh = new THREE.Mesh(createSilkNecktieGeometry(), tieMat);
  necktieMesh.position.set(0, 0.02, 0);
  necktieMesh.castShadow = true;
  torsoGroup.add(necktieMesh);

  // Gold Tie Bar Clip at y = 0.36
  const tieClip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.007, 0.008), brassMat);
  tieClip.position.set(0.003, 0.36, getTorsoFrontZ(0, 0.36, 0.01));
  necktieMesh.add(tieClip);

  // --------------------------------------------------------------------------
  // 2. MULTI-LAYERED ORGANIC COFFEE STAIN SPLOTCHES (CONFORMED TO SHIRT CHEST)
  // --------------------------------------------------------------------------
  const coffeeStainGroup = new THREE.Group();
  coffeeStainGroup.position.set(0, 0.02, 0);
  const darkCoffeeMat = new THREE.MeshStandardMaterial({
    color: 0x3b1d0a,
    roughness: 0.72,
    metalness: 0.04,
  });
  const ringCoffeeMat = new THREE.MeshStandardMaterial({
    color: 0x6b3410,
    roughness: 0.85,
    metalness: 0.02,
  });
  const outerSplash = new THREE.Mesh(
    createOrganicCoffeeStainGeometry(0.075, 1.2, 0.018, 0.36),
    ringCoffeeMat
  );
  const innerCoreSplash = new THREE.Mesh(
    createOrganicCoffeeStainGeometry(0.048, 2.5, 0.02, 0.365),
    darkCoffeeMat
  );
  const dripRun1 = new THREE.Mesh(
    createOrganicCoffeeStainGeometry(0.022, 4.4, 0.038, 0.25, 0.6, 1.7),
    ringCoffeeMat
  );
  const dripRun2 = new THREE.Mesh(
    createOrganicCoffeeStainGeometry(0.018, 5.9, -0.028, 0.23, 0.55, 1.5),
    darkCoffeeMat
  );
  coffeeStainGroup.add(outerSplash, innerCoreSplash, dripRun1, dripRun2);
  coffeeStainGroup.visible = false;
  torsoGroup.add(coffeeStainGroup);

  // --------------------------------------------------------------------------
  // 3. BESPOKE OPEN-FRONT TWEED SUIT JACKET WITH CONFORMED LAPELS & POCKETS
  // --------------------------------------------------------------------------
  const jacketGroup = new THREE.Group();
  jacketGroup.position.set(0, 0.02, 0);

  const jacketShell = new THREE.Mesh(createTailoredJacketShellGeometry(), jacketMat);
  jacketShell.castShadow = true;
  jacketShell.receiveShadow = true;
  jacketGroup.add(jacketShell);

  // Left & Right Sculpted Notched Lapels projected directly onto the jacket chest surface
  const lapelL = new THREE.Mesh(createNotchedLapelGeometry(false), jacketMat);
  lapelL.castShadow = true;
  const lapelR = new THREE.Mesh(createNotchedLapelGeometry(true), jacketMat);
  lapelR.castShadow = true;
  jacketGroup.add(lapelL, lapelR);

  // Breast Welt Pocket with Folded Pocket Square & Fountain Pen (projected onto jacket chest at x = -0.105, y = 0.37)
  const pocketZ = getTorsoFrontZ(-0.105, 0.37, 0.029);
  const breastPocketWelt = new THREE.Mesh(
    new THREE.BoxGeometry(0.064, 0.012, 0.008),
    jacketMat
  );
  breastPocketWelt.position.set(-0.105, 0.37, pocketZ);
  breastPocketWelt.rotation.y = -0.32;
  breastPocketWelt.rotation.z = 0.06;
  jacketGroup.add(breastPocketWelt);

  const pocketSquare = new THREE.Mesh(
    new THREE.ConeGeometry(0.02, 0.032, 4),
    tieMat
  );
  pocketSquare.position.set(-0.11, 0.39, pocketZ - 0.001);
  pocketSquare.rotation.y = -0.32;
  pocketSquare.rotation.z = 0.14;
  jacketGroup.add(pocketSquare);

  const fountainPenCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.034, 8),
    brassMat
  );
  fountainPenCap.position.set(-0.088, 0.388, pocketZ + 0.003);
  jacketGroup.add(fountainPenCap);

  // Hip Flap Pockets & Horn Buttons
  for (const side of [-1, 1]) {
    const hx = side * 0.145;
    const hy = 0.08;
    const hz = getTorsoFrontZ(hx, hy, 0.029);
    const hipFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.082, 0.028, 0.008),
      jacketMat
    );
    hipFlap.position.set(hx, hy, hz);
    hipFlap.rotation.y = side * 0.58;
    jacketGroup.add(hipFlap);
  }

  for (let jb = 0; jb < 2; jb++) {
    const by = 0.09 + jb * 0.065;
    const bx = 0.032;
    const hornBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.005, 12),
      shoeMat
    );
    hornBtn.rotation.x = Math.PI / 2;
    hornBtn.position.set(bx, by, getTorsoFrontZ(bx, by, 0.029));
    jacketGroup.add(hornBtn);
  }

  // Archetype-Specific Garment Details (Surface-Projected onto Jacket/Waistcoat)
  if (config.archetype === 'DR_PAWN') {
    const bx = -0.092;
    const by = 0.26;
    const bz = getTorsoFrontZ(bx, by, 0.032);
    const badgeCard = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.058, 0.004),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    badgeCard.position.set(bx, by, bz);
    badgeCard.rotation.y = -0.26;
    badgeCard.rotation.z = -0.05;
    const badgeHeader = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.014, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x2563eb })
    );
    badgeHeader.position.y = 0.02;
    badgeCard.add(badgeHeader);
    jacketGroup.add(badgeCard);
  } else if (config.archetype === 'PROF_ROOK') {
    const chainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.008, 0.16, getTorsoFrontZ(0.008, 0.16, 0.017)),
      new THREE.Vector3(0.065, 0.11, getTorsoFrontZ(0.065, 0.11, 0.031)),
      new THREE.Vector3(0.12, 0.14, getTorsoFrontZ(0.12, 0.14, 0.031)),
    ]);
    const watchChain = new THREE.Mesh(
      new THREE.TubeGeometry(chainCurve, 16, 0.004, 8, false),
      brassMat
    );
    jacketGroup.add(watchChain);
  } else if (config.archetype === 'CHAIR_QUEEN') {
    const pearlRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.078, 0.0075, 10, 24, Math.PI * 1.1),
      pearlButtonMat
    );
    pearlRing.rotation.set(Math.PI * 0.58, 0, -Math.PI * 0.05);
    pearlRing.position.set(0, 0.515, 0.012);
    jacketGroup.add(pearlRing);
  } else if (config.archetype === 'BARISTA') {
    // Sculpted Canvas Espresso Barista Apron curved cleanly outside the jacket front
    const apronGeo = buildSolidOpenGarmentGeometry(
      -0.08,
      0.42,
      14,
      20,
      0.03,
      0.036,
      () => Math.PI * 0.66
    );
    // Rotate apron 180 deg around Y so it covers the front (+Z) instead of the back (-Z)
    apronGeo.rotateY(Math.PI);
    const apronMesh = new THREE.Mesh(
      apronGeo,
      new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.85 })
    );
    jacketGroup.add(apronMesh);
  } else if (config.archetype === 'CLEANER_CLERK') {
    // Yellow Tailor's Measuring Tape draped cleanly along Mr. Henderson's chest contour
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const tx = side * 0.068;
      const tapePts: THREE.Vector3[] = [];
      for (let ty = 0.16; ty <= 0.5; ty += 0.04) {
        tapePts.push(new THREE.Vector3(tx, ty, getTorsoFrontZ(tx, ty, 0.032)));
      }
      const tapeCurve = new THREE.CatmullRomCurve3(tapePts);
      const tapeRibbon = new THREE.Mesh(
        new THREE.TubeGeometry(tapeCurve, 12, 0.006, 6, false),
        tapeMat
      );
      jacketGroup.add(tapeRibbon);
    }
  } else if (config.archetype === 'UNDERGRAD') {
    const packMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.16), packMat);
    backpack.position.set(0, 0.28, -0.22);
    backpack.castShadow = true;
    const packPocket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.05), packMat);
    packPocket.position.set(0, -0.06, -0.09);
    backpack.add(packPocket);
    jacketGroup.add(backpack);
  }

  const jacketMesh = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.002, 0.002), jacketMat);
  jacketMesh.add(jacketGroup);
  torsoGroup.add(jacketMesh);

  // Backup Sculpted Crew-Neck Sweatshirt (shown when dress shirt is dropped off at Perseus Dry Cleaners)
  const sweaterMesh = new THREE.Mesh(createSweatshirtGeometry(), sweaterMat);
  sweaterMesh.position.set(0, 0.02, 0);
  sweaterMesh.castShadow = true;
  const sweaterCrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.042, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 })
  );
  sweaterCrest.position.set(0, 0.37, getTorsoFrontZ(0, 0.37, 0.022));
  sweaterMesh.add(sweaterCrest);
  sweaterMesh.visible = false;
  torsoGroup.add(sweaterMesh);

  // --------------------------------------------------------------------------
  // 4. SCULPTED HUMAN HEAD, EXPRESSIVE EYES, FACIAL HAIR & WIRE-RIM SPECTACLES
  // --------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.59, 0);
  torsoGroup.add(headGroup);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.066, 0.115, 20),
    skinMat
  );
  neckMesh.position.set(0, 0.025, 0);
  headGroup.add(neckMesh);

  const cranium = new THREE.Mesh(createSculptedHumanHeadGeometry(), skinMat);
  cranium.position.set(0, 0.155, 0);
  cranium.castShadow = true;
  cranium.receiveShadow = true;
  headGroup.add(cranium);

  // Sculpted Ears with Outer Helix Rim
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 12), skinMat);
    ear.scale.set(0.42, 1.1, 0.68);
    ear.position.set(side * 0.126, 0.146, -0.006);
    ear.rotation.y = -side * 0.18;
    headGroup.add(ear);
  }

  // Sculpted Anatomical Nose
  const nose = new THREE.Mesh(createSculptedNoseGeometry(), skinMat);
  nose.position.set(0, 0.148, 0.132);
  headGroup.add(nose);

  // Sculpted Natural Human Lips
  const mouthLine = new THREE.Mesh(
    createSculptedMouthGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xb0725e, roughness: 0.62 })
  );
  mouthLine.position.set(0, 0.092, 0.128);
  headGroup.add(mouthLine);

  // Expressive Multi-Part Eyes recessed naturally into orbital sockets
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xe2dfd7, roughness: 0.42 });
  const irisMat = new THREE.MeshStandardMaterial({
    color: config.eyeColor ?? 0x2563eb,
    roughness: 0.35,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: config.hairColor,
    roughness: 0.86,
    metalness: 0.04,
    bumpMap: tweedTex,
    bumpScale: 0.008,
  });

  const buildEye = (side: number) => {
    const eyeRoot = new THREE.Group();
    eyeRoot.position.set(side * 0.043, 0.165, 0.12);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 14, 12), scleraMat);
    sclera.scale.set(1.08, 0.85, 0.62);
    eyeRoot.add(sclera);

    const pupilGroup = new THREE.Group();
    pupilGroup.position.set(0, 0, 0.011);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0088, 16), irisMat);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0044, 12), pupilMat);
    pupil.position.z = 0.0008;
    const specHighlight = new THREE.Mesh(
      new THREE.CircleGeometry(0.0016, 8),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.2 })
    );
    specHighlight.position.set(0.0025, 0.0025, 0.0014);
    pupilGroup.add(iris, pupil, specHighlight);
    eyeRoot.add(pupilGroup);

    const upperLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0188, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.44),
      skinMat
    );
    upperLid.scale.set(1.1, 0.88, 0.68);
    upperLid.rotation.x = -0.24;
    const lowerLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0184, 14, 8, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32),
      skinMat
    );
    lowerLid.scale.set(1.08, 0.85, 0.65);
    lowerLid.rotation.x = 0.12;
    eyeRoot.add(upperLid, lowerLid);

    headGroup.add(eyeRoot);
    return pupilGroup;
  };

  const leftPupilGroup = buildEye(-1);
  const rightPupilGroup = buildEye(1);

  const eyebrowLeft = new THREE.Mesh(createSculptedEyebrowGeometry(false), hairMat);
  eyebrowLeft.position.set(-0.043, 0.193, 0.128);
  const eyebrowRight = new THREE.Mesh(createSculptedEyebrowGeometry(true), hairMat);
  eyebrowRight.position.set(0.043, 0.193, 0.128);
  headGroup.add(eyebrowLeft, eyebrowRight);

  // Smooth C1-Continuous Coiffure (Zero face-slicing triangles!)
  const hairSculpt = new THREE.Mesh(
    createSculptedAcademicHairGeometry(config.archetype),
    hairMat
  );
  hairSculpt.position.set(0, 0.155, 0);
  hairSculpt.castShadow = true;
  headGroup.add(hairSculpt);

  // Archetype Facial Hair & Hair Accessories
  if (config.archetype === 'PROF_BISHOP') {
    const mustache = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.044, 6, 10), hairMat);
    mustache.rotation.z = Math.PI / 2;
    mustache.position.set(0, 0.106, 0.132);
    const goatee = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.044, 10), hairMat);
    goatee.rotation.x = Math.PI;
    goatee.position.set(0, 0.05, 0.128);
    headGroup.add(mustache, goatee);
  } else if (config.archetype === 'PROF_ROOK') {
    const walrusL = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.034, 6, 10), hairMat);
    walrusL.position.set(-0.019, 0.103, 0.132);
    walrusL.rotation.z = 1.25;
    const walrusR = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.034, 6, 10), hairMat);
    walrusR.position.set(0.019, 0.103, 0.132);
    walrusR.rotation.z = -1.25;
    headGroup.add(walrusL, walrusR);
  } else if (config.archetype === 'CHAIR_QUEEN') {
    const chignonBun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 14), hairMat);
    chignonBun.position.set(0, 0.21, -0.136);
    const goldComb = new THREE.Mesh(
      new THREE.TorusGeometry(0.042, 0.0045, 8, 16, Math.PI),
      brassMat
    );
    goldComb.position.set(0, 0.248, -0.108);
    goldComb.rotation.x = -0.45;
    headGroup.add(chignonBun, goldComb);
  }

  // Refined Vintage Browline / Tortoiseshell & Fine Bronze Academic Spectacles
  if (config.hasGlasses !== false) {
    const tortoiseFrameMat = new THREE.MeshStandardMaterial({
      color: 0x291811,
      roughness: 0.35,
      metalness: 0.15,
    });
    const fineWireMat = new THREE.MeshStandardMaterial({
      color: 0x926129,
      roughness: 0.32,
      metalness: 0.78,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.14,
      roughness: 0.15,
      metalness: 0.05,
    });
    for (const side of [-1, 1]) {
      const wireRim = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.002, 10, 24), fineWireMat);
      wireRim.scale.set(1.12, 0.92, 1);
      wireRim.position.set(side * 0.043, 0.164, 0.136);
      const browBar = new THREE.Mesh(
        new THREE.TorusGeometry(0.027, 0.0038, 8, 16, Math.PI * 0.88),
        tortoiseFrameMat
      );
      browBar.scale.set(1.14, 0.92, 1);
      browBar.rotation.z = Math.PI * 0.06;
      browBar.position.set(side * 0.043, 0.165, 0.137);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), lensMat);
      lens.scale.set(1.12, 0.92, 1);
      lens.position.set(side * 0.043, 0.164, 0.1365);

      const templeArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.003, 0.004, 0.13),
        tortoiseFrameMat
      );
      templeArm.position.set(side * 0.075, 0.168, 0.072);
      headGroup.add(wireRim, browBar, lens, templeArm);
    }
    const bridge = new THREE.Mesh(
      new THREE.TorusGeometry(0.013, 0.0022, 8, 12, Math.PI),
      fineWireMat
    );
    bridge.position.set(0, 0.168, 0.138);
    headGroup.add(bridge);
  }

  // --------------------------------------------------------------------------
  // 5. SEAMLESS BALL-JOINTED 2-SEGMENT ARMS, WRISTS & COHESIVE HANDS
  // --------------------------------------------------------------------------
  const buildArticulatedArm = (isRight: boolean) => {
    const side = isRight ? 1 : -1;
    const shoulderPivot = new THREE.Group();
    // Nested smoothly into the jacket's upper deltoid shoulder seam (rx = 0.228 at y = 0.455)
    shoulderPivot.position.set(side * 0.212, 0.455, 0);

    // Sculpted Upper Sleeve (with integrated ball-joint top dome so shoulder rotation is 100% seamless)
    const upperSleeve = new THREE.Mesh(
      createTailoredSleeveGeometry(0.06, 0.052, 0.235),
      jacketMat
    );
    upperSleeve.castShadow = true;
    shoulderPivot.add(upperSleeve);

    // Articulated Elbow Pivot
    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.232, 0);
    shoulderPivot.add(elbowPivot);

    // Stitched Cognac Suede Elbow Patch conformed to back/outer elbow
    const elbowPatch = new THREE.Mesh(createSculptedElbowPatchGeometry(), patchMat);
    elbowPatch.position.set(side * 0.012, 0.0, -0.053);
    elbowPatch.rotation.y = side * 0.22;
    elbowPivot.add(elbowPatch);

    // Sculpted Forearm Sleeve (with integrated ball-joint top dome so elbow flexion never opens a gap!)
    const forearmSleeve = new THREE.Mesh(
      createTailoredSleeveGeometry(0.052, 0.044, 0.215),
      jacketMat
    );
    forearmSleeve.castShadow = true;
    elbowPivot.add(forearmSleeve);

    // 3 Brass Surgeon's Cuff Buttons along outer wrist
    for (let cb = 0; cb < 3; cb++) {
      const cuffBtn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0045, 0.0045, 0.0035, 8),
        brassMat
      );
      cuffBtn.rotation.z = Math.PI / 2;
      cuffBtn.position.set(side * 0.045, -0.155 - cb * 0.016, -0.008);
      elbowPivot.add(cuffBtn);
    }

    // Crisp Ecru Shirt Cuff & Subtle Brass Cufflink
    const shirtCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.041, 0.03, 20),
      shirtMat
    );
    shirtCuff.position.set(0, -0.218, 0);
    elbowPivot.add(shirtCuff);

    const cufflink = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), brassMat);
    cufflink.position.set(side * 0.041, -0.222, 0);
    elbowPivot.add(cufflink);

    // Continuous Anatomical Wrist Cylinder connecting Shirt Cuff to Hand Palm (Zero floating hands!)
    const wristCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.031, 0.028, 0.038, 16),
      skinMat
    );
    wristCylinder.position.set(0, -0.236, 0);
    elbowPivot.add(wristCylinder);

    // Cohesive Sculpted Hand (Metacarpal Palm + Neat Parallel Curled Fingers + Thumb)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.252, 0);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 14), skinMat);
    palm.scale.set(0.68, 1.15, 0.92);
    palm.position.set(0, -0.014, 0.003);
    handGroup.add(palm);

    // 4 Parallel Sculpted Fingers with natural inward curl (Zero splayed claw angles!)
    const fingerZOffsets = [0.012, 0.004, -0.004, -0.011];
    const fingerLengths = [0.024, 0.027, 0.025, 0.02];
    for (let f = 0; f < 4; f++) {
      const fMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0046, fingerLengths[f], 5, 8),
        skinMat
      );
      fMesh.position.set(
        -side * 0.003,
        -0.036 - fingerLengths[f] * 0.25,
        fingerZOffsets[f]
      );
      fMesh.rotation.z = -side * 0.18;
      fMesh.rotation.x = 0.14;
      handGroup.add(fMesh);
    }

    // Neat Opposable Thumb
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0056, 0.02, 5, 8),
      skinMat
    );
    thumb.position.set(-side * 0.008, -0.02, 0.02);
    thumb.rotation.set(0.48, 0, -side * 0.22);
    handGroup.add(thumb);
    elbowPivot.add(handGroup);

    elbowPivot.rotation.x = -0.28;

    return { shoulderPivot, elbowPivot, handGroup };
  };

  const leftArm = buildArticulatedArm(false);
  const rightArm = buildArticulatedArm(true);
  torsoGroup.add(leftArm.shoulderPivot, rightArm.shoulderPivot);

  // Archetype Left-Hand Props positioned on the OUTER side (-X) of the left hand so they never clip into the hip!
  if (config.archetype === 'GRAD_TOBY') {
    const binderGroup = new THREE.Group();
    const folder = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.2, 0.145),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 })
    );
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.19, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.6 })
    );
    pages.position.x = -0.005;
    binderGroup.add(folder, pages);
    binderGroup.position.set(-0.026, -0.02, 0.035);
    binderGroup.rotation.z = -0.12;
    leftArm.handGroup.add(binderGroup);
  } else if (config.archetype === 'CHAIR_QUEEN') {
    const clipboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.21, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 })
    );
    clipboard.position.set(-0.026, -0.02, 0.035);
    clipboard.rotation.z = -0.12;
    leftArm.handGroup.add(clipboard);
  } else if (config.archetype === 'UNDERGRAD') {
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.007, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    phone.position.set(0, -0.028, 0.042);
    leftArm.handGroup.add(phone);
  }

  // Sculpted Paper Coffee Cup with Corrugated Kraft Sleeve, Sipping Lid & Rising Steam Wisps
  const heldCoffeeCupGroup = new THREE.Group();
  const cupPoints = [
    new THREE.Vector2(0.002, 0),
    new THREE.Vector2(0.028, 0),
    new THREE.Vector2(0.04, 0.11),
    new THREE.Vector2(0.043, 0.114),
    new THREE.Vector2(0.002, 0.114),
  ];
  const cupBody = new THREE.Mesh(
    new THREE.LatheGeometry(cupPoints, 20),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55 })
  );
  cupBody.castShadow = true;
  const cupSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.039, 0.033, 0.05, 20),
    new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.88,
      bumpMap: tweedTex,
      bumpScale: 0.01,
    })
  );
  cupSleeve.position.y = 0.055;
  const cupLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.045, 0.016, 20),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  cupLid.position.y = 0.12;
  const steamRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.016, 0.003, 6, 14, Math.PI * 1.4),
    new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.45 })
  );
  steamRing.position.set(0, 0.155, 0);
  steamRing.rotation.y = 0.6;
  heldCoffeeCupGroup.add(cupBody, cupSleeve, cupLid, steamRing);
  heldCoffeeCupGroup.position.set(0, -0.032, 0.058);
  heldCoffeeCupGroup.rotation.x = 0.25;
  heldCoffeeCupGroup.visible = false;
  rightArm.handGroup.add(heldCoffeeCupGroup);

  // --------------------------------------------------------------------------
  // 6. PLEATED TAILORED TROUSERS, BALL-JOINTED KNEES & OXFORD BROGUE SHOES
  // --------------------------------------------------------------------------
  const pelvisRadii = getTorsoEllipticalRadii(0.0, 0.004);
  const pelvisBlock = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 0.96, 0.13, 28),
    trouserMat
  );
  pelvisBlock.scale.set(pelvisRadii.rx, 1, pelvisRadii.rz);
  pelvisBlock.position.set(0, -0.025, 0);
  pelvisGroup.add(pelvisBlock);

  const buildArticulatedLeg = (isRight: boolean) => {
    const side = isRight ? 1 : -1;
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.095, -0.045, 0);

    const thighMesh = new THREE.Mesh(
      createPleatedTrouserLegGeometry(0.355),
      trouserMat
    );
    thighMesh.castShadow = true;
    hipPivot.add(thighMesh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.345, 0);
    hipPivot.add(kneePivot);

    const calfMesh = new THREE.Mesh(
      createPleatedTrouserLegGeometry(0.345),
      trouserMat
    );
    calfMesh.castShadow = true;
    kneePivot.add(calfMesh);

    // Ribbed Dress Sock at Ankle
    const dressSock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
    );
    dressSock.position.set(0, -0.345, 0);
    kneePivot.add(dressSock);

    // Sculpted Leather Oxford Brogue Shoe with Heel & Welt
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.385, 0.01);
    const shoeUpper = new THREE.Mesh(createOxfordShoeGeometry(), shoeMat);
    shoeUpper.castShadow = true;
    shoeUpper.receiveShadow = true;
    const heelBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.074, 0.024, 0.064),
      new THREE.MeshStandardMaterial({ color: 0x0f0906, roughness: 0.6 })
    );
    heelBlock.position.set(0, 0.012, -0.038);
    shoeGroup.add(shoeUpper, heelBlock);
    kneePivot.add(shoeGroup);

    return { hipPivot, kneePivot };
  };

  const leftLeg = buildArticulatedLeg(false);
  const rightLeg = buildArticulatedLeg(true);
  pelvisGroup.add(leftLeg.hipPivot, rightLeg.hipPivot);

  // --------------------------------------------------------------------------
  // 7. OVERHEAD DIEGETIC NAMEPLATE SPRITE (Compact, Depth-Tested, Hidden for Player!)
  // --------------------------------------------------------------------------
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 112;
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.SpriteMaterial({
    map: labelTex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.position.set(0, 1.72, 0);
  labelSprite.scale.set(1.12, 0.245, 1);
  if (config.archetype === 'DR_PAWN') {
    labelSprite.visible = false;
  }
  root.add(labelSprite);

  const rig: HumanAcademicRig = {
    root,
    pelvisGroup,
    torsoGroup,
    jacketMesh,
    sweaterMesh,
    shirtChestMesh,
    coffeeStainGroup,
    necktieMesh,
    headGroup,
    leftArmPivot: leftArm.shoulderPivot,
    leftElbowPivot: leftArm.elbowPivot,
    rightArmPivot: rightArm.shoulderPivot,
    rightElbowPivot: rightArm.elbowPivot,
    leftLegPivot: leftLeg.hipPivot,
    leftKneePivot: leftLeg.kneePivot,
    rightLegPivot: rightLeg.hipPivot,
    rightKneePivot: rightLeg.kneePivot,
    heldCoffeeCupGroup,
    leftPupilGroup,
    rightPupilGroup,
    eyebrowLeft,
    eyebrowRight,
    labelCanvas,
    labelTex,
    labelSprite,
    lastLabelText: '',
  };

  updateHumanCharacterLabel(rig, config.nameTag, config.roleTag, '#fbbf24');
  return rig;
}

export function updateHumanCharacterLabel(
  rig: HumanAcademicRig,
  title: string,
  subtitle: string,
  accentColor: string = '#fbbf24'
) {
  const sig = `${title}|${subtitle}|${accentColor}`;
  if (rig.lastLabelText === sig) return;
  rig.lastLabelText = sig;

  const ctx = rig.labelCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, 512, 128);

  ctx.fillStyle = 'rgba(10, 14, 23, 0.88)';
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(16, 14, 480, 96, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 56);

  ctx.fillStyle = accentColor;
  ctx.font = '20px monospace';
  ctx.fillText(subtitle, 256, 90);

  rig.labelTex.needsUpdate = true;
}

function animateHumanRigWalkAndPose(
  rig: HumanAcademicRig,
  elapsed: number,
  isWalking: boolean,
  carryingCoffee: boolean,
  phaseSeed: number = 0,
  isDistressed: boolean = false
) {
  rig.heldCoffeeCupGroup.visible = carryingCoffee;

  // Expressive Eye Gaze & Eyebrow Tilt (furrows when coffee-stained or stressed!)
  const gazeX = Math.sin(elapsed * 0.9 + phaseSeed * 1.7) * 0.003;
  const gazeY = Math.cos(elapsed * 0.7 + phaseSeed) * 0.0015;
  rig.leftPupilGroup.position.set(gazeX, gazeY, 0.012);
  rig.rightPupilGroup.position.set(gazeX, gazeY, 0.012);
  rig.eyebrowLeft.rotation.z = isDistressed ? 0.22 : -0.06 + Math.sin(elapsed * 1.5 + phaseSeed) * 0.03;
  rig.eyebrowRight.rotation.z = isDistressed ? -0.22 : 0.06 - Math.sin(elapsed * 1.5 + phaseSeed) * 0.03;

  if (isWalking) {
    const stride = elapsed * 9.2 + phaseSeed;
    const leftSwing = Math.sin(stride);
    const rightSwing = -Math.sin(stride);

    rig.leftLegPivot.rotation.x = leftSwing * 0.54;
    rig.rightLegPivot.rotation.x = rightSwing * 0.54;

    // Natural articulated knee flexion on backward recovery swing!
    rig.leftKneePivot.rotation.x = Math.max(0, -leftSwing) * 0.62;
    rig.rightKneePivot.rotation.x = Math.max(0, -rightSwing) * 0.62;

    rig.pelvisGroup.position.y = 0.78 + Math.abs(Math.cos(stride)) * 0.036;
    rig.torsoGroup.rotation.y = Math.sin(stride) * 0.08;
    rig.torsoGroup.rotation.z = Math.cos(stride) * 0.025;
    rig.headGroup.rotation.y = -Math.sin(stride) * 0.05;

    rig.leftArmPivot.rotation.x = -leftSwing * 0.42;
    rig.leftElbowPivot.rotation.x = -0.35 - Math.max(0, -leftSwing) * 0.35;

    if (carryingCoffee) {
      // Steady forearm stabilizer pose while carrying hot filter coffee
      rig.rightArmPivot.rotation.set(-0.42, -0.12, -0.06);
      rig.rightElbowPivot.rotation.set(-1.05 + Math.sin(stride * 2) * 0.04, 0, 0);
    } else {
      rig.rightArmPivot.rotation.set(leftSwing * 0.42, 0, 0);
      rig.rightElbowPivot.rotation.set(-0.35 - Math.max(0, leftSwing) * 0.35, 0, 0);
    }
  } else {
    const breath = Math.sin(elapsed * 2.2 + phaseSeed);
    rig.leftLegPivot.rotation.x = 0;
    rig.rightLegPivot.rotation.x = 0;
    rig.leftKneePivot.rotation.x = 0.04;
    rig.rightKneePivot.rotation.x = 0.04;
    rig.pelvisGroup.position.y = 0.78 + breath * 0.007;
    rig.torsoGroup.rotation.y = Math.sin(elapsed * 0.8 + phaseSeed) * 0.04;
    rig.torsoGroup.rotation.z = 0;
    rig.headGroup.rotation.y = Math.sin(elapsed * 0.65 + phaseSeed * 1.3) * 0.09;
    rig.headGroup.rotation.x = Math.cos(elapsed * 0.9 + phaseSeed) * 0.03;

    rig.leftArmPivot.rotation.x = -0.06 + breath * 0.03;
    rig.leftElbowPivot.rotation.x = -0.32 + breath * 0.04;

    if (carryingCoffee) {
      rig.rightArmPivot.rotation.set(-0.38, -0.1, -0.06);
      rig.rightElbowPivot.rotation.set(-1.02 + breath * 0.03, 0, 0);
    } else {
      rig.rightArmPivot.rotation.set(-0.08 - breath * 0.03, 0, 0);
      rig.rightElbowPivot.rotation.set(-0.32 + Math.cos(elapsed * 1.8 + phaseSeed) * 0.05, 0, 0);
    }
  }
}

// ============================================================================
// 4. BESPOKE ARCHITECTURAL & FURNITURE PROP BUILDERS FOR THE 5 CAMPUS ROOMS
// ============================================================================

function createAcademicChairGroup(woodMat: THREE.Material, cushionColor: number): THREE.Group {
  const g = new THREE.Group();
  const cushionMat = new THREE.MeshStandardMaterial({
    color: cushionColor,
    roughness: 0.75,
    bumpMap: getSharedSuedeGrainTexture(),
    bumpScale: 0.008,
  });

  // Seat Cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.5), cushionMat);
  seat.position.y = 0.46;
  seat.castShadow = true;
  g.add(seat);

  // Curved Upholstered Backrest & Wood Frame
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.06), cushionMat);
  backrest.position.set(0, 0.74, -0.22);
  backrest.rotation.x = -0.08;
  backrest.castShadow = true;
  g.add(backrest);

  // 4 Tapered Turned Wooden Legs
  for (const lx of [-0.21, 0.21]) {
    for (const lz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.016, 0.45, 10),
        woodMat
      );
      leg.position.set(lx, 0.225, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  return g;
}

function createBookshelfUnitGroup(woodMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // Tall Oak Casework
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.1, 0.42), woodMat);
  frame.position.y = 1.55;
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  // Crown Molding at Top
  const crown = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.12, 0.48), woodMat);
  crown.position.y = 3.12;
  g.add(crown);

  // 5 Shelves Packed with Leather-Bound Mathematical Volumes & Springer Yellow Monographs
  const bookPalette = [
    0x7f1d1d, 0x1e3a8a, 0x14532d, 0x78350f, 0xd97706, 0x312e81, 0x4c1d95, 0x0f766e,
  ];
  const bookMats = bookPalette.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 })
  );

  for (let shelf = 0; shelf < 5; shelf++) {
    const sy = 0.42 + shelf * 0.54;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.04, 0.44), woodMat);
    plank.position.set(0, sy, 0.02);
    g.add(plank);

    let bx = -1.12;
    let bIdx = shelf * 7;
    while (bx < 1.05) {
      const bw = 0.055 + ((bIdx * 17) % 5) * 0.016;
      const bh = 0.34 + ((bIdx * 13) % 4) * 0.035;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.28),
        bookMats[bIdx % bookMats.length]
      );
      book.position.set(bx + bw * 0.5, sy + 0.02 + bh * 0.5, 0.08);
      if (bIdx % 11 === 0) {
        book.rotation.z = -0.14;
        book.position.x += 0.02;
      }
      g.add(book);
      bx += bw + 0.008;
      bIdx++;
    }
  }
  return g;
}

export function createUniversityOfficeRig(): UniversityOfficeRig {
  const rootGroup = new THREE.Group();
  rootGroup.position.set(0, 0, 0);
  rootGroup.visible = false;

  const shatterableGroups: {
    group: THREE.Object3D;
    basePos: THREE.Vector3;
    driftDir: THREE.Vector3;
  }[] = [];
  const registerShatterable = (obj: THREE.Object3D) => {
    shatterableGroups.push({
      group: obj,
      basePos: obj.position.clone(),
      driftDir: new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        1.2 + Math.random() * 2.8,
        (Math.random() - 0.5) * 3.5
      ),
    });
  };

  const tweedTex = getSharedHerringboneTweedTexture();
  const parquetTex = getSharedParquetFloorTexture();
  const persianRugTex = getSharedPersianRugTexture();
  const checkerTileTex = getSharedCheckerTileTexture();

  // ============================================================================
  // 1. CONTINUOUS WALKABLE CAMPUS FLOORPLAN (5 CONNECTED SPACES)
  // ============================================================================
  const floorMat = new THREE.MeshStandardMaterial({
    map: parquetTex,
    roughness: 0.62,
    metalness: 0.08,
  });
  const walkableFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 22), floorMat);
  walkableFloorMesh.rotation.x = -Math.PI / 2;
  walkableFloorMesh.position.set(0.5, 0, 1.2);
  walkableFloorMesh.receiveShadow = true;
  rootGroup.add(walkableFloorMesh);

  // Room 4B Woven Persian Study Rug (with subtle 4D Tesseract medallion!)
  const officeRug = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.024, 5.6),
    new THREE.MeshStandardMaterial({
      map: persianRugTex,
      bumpMap: tweedTex,
      bumpScale: 0.012,
      roughness: 0.88,
    })
  );
  officeRug.position.set(-10.0, 0.012, -4.1);
  officeRug.receiveShadow = true;
  rootGroup.add(officeRug);

  // Faculty Corridor Carpet Runner with Gold Trim Borders
  const corridorRunner = new THREE.Mesh(
    new THREE.BoxGeometry(31.5, 0.02, 3.8),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      bumpMap: tweedTex,
      bumpScale: 0.01,
      roughness: 0.82,
    })
  );
  corridorRunner.position.set(0.5, 0.01, 1.4);
  corridorRunner.receiveShadow = true;
  rootGroup.add(corridorRunner);

  // Seminar Room 204 Royal Blue Carpet
  const seminarCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 0.022, 6.2),
    new THREE.MeshStandardMaterial({
      color: 0x172554,
      bumpMap: tweedTex,
      bumpScale: 0.012,
      roughness: 0.86,
    })
  );
  seminarCarpet.position.set(0.0, 0.011, -4.1);
  seminarCarpet.receiveShadow = true;
  rootGroup.add(seminarCarpet);

  // Cafeteria & Dry Cleaners Terrazzo Checkerboard Tile Zones
  const cafeteriaTile = new THREE.Mesh(
    new THREE.BoxGeometry(10.2, 0.022, 6.2),
    new THREE.MeshStandardMaterial({
      map: checkerTileTex,
      roughness: 0.38,
      metalness: 0.1,
    })
  );
  cafeteriaTile.position.set(11.0, 0.011, -4.1);
  cafeteriaTile.receiveShadow = true;
  rootGroup.add(cafeteriaTile);

  const cleanerTile = new THREE.Mesh(
    new THREE.BoxGeometry(10.2, 0.022, 6.0),
    new THREE.MeshStandardMaterial({
      map: checkerTileTex,
      roughness: 0.35,
      metalness: 0.12,
    })
  );
  cleanerTile.position.set(11.0, 0.011, 7.0);
  cleanerTile.receiveShadow = true;
  rootGroup.add(cleanerTile);

  // Partition Walls with Open Doorways + Baseboard & Wainscot Trim
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1e242d,
    roughness: 0.84,
    metalness: 0.05,
  });
  const wainscotMat = new THREE.MeshStandardMaterial({
    color: 0x2d1d14,
    roughness: 0.58,
    metalness: 0.08,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.24,
    metalness: 0.85,
  });

  const addWallSegment = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(x, y, z);

    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    upperWall.castShadow = true;
    upperWall.receiveShadow = true;
    wallGroup.add(upperWall);

    // Lower Oak Wainscot Chair Rail & Baseboard Molding
    const wainscotH = Math.min(1.15, h * 0.32);
    const wainscot = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.03, wainscotH, d + 0.04),
      wainscotMat
    );
    wainscot.position.y = -h * 0.5 + wainscotH * 0.5;
    wallGroup.add(wainscot);

    // Top Crown Molding Strip
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.04, 0.1, d + 0.05),
      wainscotMat
    );
    crown.position.y = h * 0.5 - 0.05;
    wallGroup.add(crown);

    rootGroup.add(wallGroup);
    registerShatterable(wallGroup);
    return wallGroup;
  };

  // North Perimeter Wall (behind Office 4B, Seminar Room 204, and Cafeteria)
  addWallSegment(33.0, 4.8, 0.25, 1.0, 2.4, -7.4);
  // West Wall of Room 4B
  addWallSegment(0.25, 4.8, 12.0, -14.8, 2.4, -1.4);
  // Divider between Room 4B and Seminar Room 204 (at x = -5.0)
  addWallSegment(0.25, 4.8, 6.4, -5.0, 2.4, -4.2);
  // Divider between Seminar Room 204 and Cafeteria (at x = +5.2)
  addWallSegment(0.25, 4.8, 6.4, 5.2, 2.4, -4.2);
  // East Wall of Cafeteria & Dry Cleaner
  addWallSegment(0.25, 4.8, 18.0, 16.4, 2.4, 1.5);

  // Corridor Partition Wall (z = -0.8) with 3 wide open doorways into Office 4B (x=-10), Seminar 204 (x=0), and Cafeteria (x=+11)
  addWallSegment(3.2, 3.2, 0.22, -13.1, 1.6, -0.8);
  addWallSegment(4.6, 3.2, 0.22, -5.0, 1.6, -0.8);
  addWallSegment(4.6, 3.2, 0.22, 5.2, 1.6, -0.8);
  addWallSegment(2.4, 3.2, 0.22, 15.1, 1.6, -0.8);

  // South Wall & West Wall of Perseus Dry Cleaners
  addWallSegment(11.4, 4.2, 0.25, 10.8, 2.1, 10.2);
  addWallSegment(0.25, 4.2, 6.2, 5.2, 2.1, 7.1);

  // Faculty Corridor Noticeboard on South Wall of Seminar Partition (x = -1.6, z = -0.66)
  const corridorBoardGroup = new THREE.Group();
  corridorBoardGroup.position.set(-4.8, 2.1, -0.66);
  const corkFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.35, 0.06), wainscotMat);
  const corkSurface = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 1.18, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0x92400e,
      bumpMap: getSharedSuedeGrainTexture(),
      bumpScale: 0.015,
      roughness: 0.9,
    })
  );
  corridorBoardGroup.add(corkFrame, corkSurface);
  const flyerColors = [0xfef08a, 0xfecdd3, 0xbfdbfe, 0xd9f99d, 0xf8fafc, 0xfde68a];
  for (let f = 0; f < 6; f++) {
    const flyer = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.42, 0.015),
      new THREE.MeshStandardMaterial({ color: flyerColors[f], roughness: 0.7 })
    );
    flyer.position.set(-0.85 + (f % 3) * 0.82, f < 3 ? 0.24 : -0.26, 0.04);
    flyer.rotation.z = ((f * 13) % 7 - 3) * 0.04;
    corridorBoardGroup.add(flyer);
  }
  rootGroup.add(corridorBoardGroup);
  registerShatterable(corridorBoardGroup);

  // ============================================================================
  // 2. SPACE 1 — ROOM 4B: DR. PAWN'S MODEST UNIVERSITY OFFICE (x = -10, z = -4.2)
  // ============================================================================
  const officeGroup = new THREE.Group();
  officeGroup.position.set(-10.0, 0, -4.2);
  rootGroup.add(officeGroup);
  registerShatterable(officeGroup);

  // Mullioned Rainy Night Window on North Wall of Room 4B + Cast-Iron Steam Radiator underneath
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.85, 0.18), wainscotMat);
  windowFrame.position.set(0, 2.5, -3.05);
  officeGroup.add(windowFrame);

  // Window Mullion Crossbars
  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.22), wainscotMat);
  mullionV.position.set(0, 2.5, -3.02);
  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.22), wainscotMat);
  mullionH.position.set(0, 2.65, -3.02);
  officeGroup.add(mullionV, mullionH);

  const nightPane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.55, 2.55),
    new THREE.MeshBasicMaterial({ color: 0x060d1a })
  );
  nightPane.position.set(0, 2.5, -2.95);
  officeGroup.add(nightPane);

  const windowDropletsMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.55, 2.55),
    new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.24,
      roughness: 0.12,
      clearcoat: 1.0,
    })
  );
  windowDropletsMesh.position.set(0, 2.5, -2.92);
  officeGroup.add(windowDropletsMesh);

  // Cast-Iron Ribbed Steam Radiator beneath the Window
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.68,
    roughness: 0.42,
  });
  for (let r = 0; r < 11; r++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.24), radiatorMat);
    fin.position.set(-0.9 + r * 0.18, 0.42, -2.85);
    officeGroup.add(fin);
  }

  // Floor-to-Ceiling Wooden Bookshelf Unit on North-West Corner of Room 4B
  const bookshelf = createBookshelfUnitGroup(wainscotMat);
  bookshelf.position.set(-3.1, 0, -2.85);
  officeGroup.add(bookshelf);

  // Green Slate Chalkboard with Wooden Chalk Tray, Eraser & Colored Chalk Sticks on West Wall
  const chalkboardCanvas = document.createElement('canvas');
  chalkboardCanvas.width = 1024;
  chalkboardCanvas.height = 512;
  const chalkboardTex = new THREE.CanvasTexture(chalkboardCanvas);
  chalkboardTex.colorSpace = THREE.SRGBColorSpace;
  const chalkboardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.28, 4.58),
    wainscotMat
  );
  chalkboardFrame.position.set(-4.66, 2.35, 0.0);
  const chalkboardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.1),
    new THREE.MeshStandardMaterial({ map: chalkboardTex, roughness: 0.78 })
  );
  chalkboardMesh.rotation.y = Math.PI / 2;
  chalkboardMesh.position.set(-4.59, 2.35, 0.0);
  chalkboardMesh.userData = {
    uniInteract: 'OPEN_CHALKBOARD',
    interactX: -12.8,
    interactZ: -4.2,
    interactLabel: 'Work at Chalkboard (Lemma 3.2 Proof)',
  };
  const chalkTray = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 4.58), wainscotMat);
  chalkTray.position.set(-4.54, 1.24, 0.0);
  officeGroup.add(chalkboardFrame, chalkboardMesh, chalkTray);

  // Executive Carved Oak Professor's Desk, Brass Drawer Pulls & Swivel Chair
  const deskWoodMat = new THREE.MeshStandardMaterial({
    color: 0x3b2316,
    roughness: 0.48,
    metalness: 0.08,
  });
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.11, 1.32), deskWoodMat);
  deskTop.position.set(-0.4, 0.78, -0.5);
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  deskTop.userData = {
    uniInteract: 'OPEN_PINE_MAIL',
    interactX: -10.2,
    interactZ: -3.6,
    interactLabel: 'Use Pine Mail & Ledger Terminal',
  };
  // Green Leather Desk Blotter Inlay
  const deskBlotter = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.015, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.65 })
  );
  deskBlotter.position.set(-0.55, 0.84, -0.45);
  const deskPedL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.76, 1.22), deskWoodMat);
  deskPedL.position.set(-1.28, 0.38, -0.5);
  deskPedL.castShadow = true;
  const deskPedR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.76, 1.22), deskWoodMat);
  deskPedR.position.set(0.48, 0.38, -0.5);
  deskPedR.castShadow = true;
  const modestyPanel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.08), deskWoodMat);
  modestyPanel.position.set(-0.4, 0.42, -0.98);
  officeGroup.add(deskTop, deskBlotter, deskPedL, deskPedR, modestyPanel);

  // Brass Drawer Handles on Desk Pedestals
  for (const px of [-1.28, 0.48]) {
    for (let dy = 0.2; dy <= 0.62; dy += 0.21) {
      const pull = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.03), brassMat);
      pull.position.set(px, dy, 0.12);
      officeGroup.add(pull);
    }
  }

  // Tufted Leather Professor's Desk Chair & Guest Chair for Toby
  const profChair = createAcademicChairGroup(deskWoodMat, 0x451a03);
  profChair.position.set(-0.55, 0, 0.35);
  profChair.rotation.y = Math.PI;
  const guestChair = createAcademicChairGroup(deskWoodMat, 0x1e3a8a);
  guestChair.position.set(-1.85, 0, -1.25);
  guestChair.rotation.y = 0.65;
  officeGroup.add(profChair, guestChair);

  // Sculpted Brass & Emerald Glass Banker's Lamp on Desk
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.045, 18),
    brassMat
  );
  lampBase.position.set(-1.22, 0.855, -0.75);
  const lampStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.32, 12),
    brassMat
  );
  lampStem.position.set(-1.22, 1.02, -0.75);
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.2, 0.16, 18, 1, false, 0, Math.PI),
    new THREE.MeshPhysicalMaterial({
      color: 0x059669,
      emissive: 0x10b981,
      emissiveIntensity: 0.9,
      roughness: 0.18,
      clearcoat: 1.0,
    })
  );
  lampShade.rotation.z = Math.PI / 2;
  lampShade.position.set(-1.22, 1.18, -0.75);
  officeGroup.add(lampBase, lampStem, lampShade);

  // Vintage Beige CRT Pine Mail Terminal + Mechanical Keyboard on Desk
  const crtScreenCanvas = document.createElement('canvas');
  crtScreenCanvas.width = 512;
  crtScreenCanvas.height = 384;
  const crtScreenTex = new THREE.CanvasTexture(crtScreenCanvas);
  crtScreenTex.colorSpace = THREE.SRGBColorSpace;
  const beigePlasticMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.62 });
  const crtSwivelBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.05, 18),
    beigePlasticMat
  );
  crtSwivelBase.position.set(0.25, 0.86, -0.68);
  const crtBezel = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.26), beigePlasticMat);
  crtBezel.position.set(0.25, 1.09, -0.6);
  crtBezel.castShadow = true;
  crtBezel.userData = {
    uniInteract: 'OPEN_PINE_MAIL',
    interactX: -9.8,
    interactZ: -3.6,
    interactLabel: 'Check Pine Mail & Ledger Terminal',
  };
  const crtRearTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 0.26, 12),
    beigePlasticMat
  );
  crtRearTube.rotation.x = Math.PI / 2;
  crtRearTube.position.set(0.25, 1.09, -0.82);
  const crtFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.33),
    new THREE.MeshBasicMaterial({ map: crtScreenTex })
  );
  crtFace.position.set(0.25, 1.09, -0.466);
  crtFace.userData = crtBezel.userData;
  const mechKeyboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.032, 0.18),
    beigePlasticMat
  );
  mechKeyboard.position.set(0.25, 0.85, -0.25);
  mechKeyboard.rotation.x = 0.08;
  officeGroup.add(crtSwivelBase, crtBezel, crtRearTube, crtFace, mechKeyboard);

  // The Broken 1987 Bunn-O-Matic Commercial Pour-Over Coffee Brewer (with Glass Carafe!)
  const coffeeMachineGroup = new THREE.Group();
  coffeeMachineGroup.position.set(3.6, 0, -2.2);
  coffeeMachineGroup.userData = {
    uniInteract: 'KICK_COFFEE_MACHINE',
    interactX: -6.8,
    interactZ: -5.8,
    interactLabel: 'Try 1987 Coffee Machine',
  };
  const standMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.78), deskWoodMat);
  standMesh.position.y = 0.425;
  standMesh.castShadow = true;
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0x52525b,
    roughness: 0.32,
    metalness: 0.82,
  });
  const bunnTower = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.56, 0.26), stainlessMat);
  bunnTower.position.set(0, 1.13, -0.1);
  const bunnOverhang = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.46), stainlessMat);
  bunnOverhang.position.set(0, 1.35, 0.02);
  const filterFunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.07, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 })
  );
  filterFunnel.position.set(0, 1.24, 0.14);
  // Glass Coffee Carafe with 1987 Petrified Coffee Sludge at Bottom
  const carafeGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.42,
      roughness: 0.1,
      clearcoat: 1.0,
    })
  );
  carafeGlass.scale.set(1, 0.88, 1);
  carafeGlass.position.set(0, 0.98, 0.14);
  const sludgeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.08, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: 0x291306, roughness: 0.9 })
  );
  sludgeMesh.position.set(0, 0.92, 0.14);
  const coffeeLedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const coffeeLed = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), coffeeLedMat);
  coffeeLed.position.set(0.12, 1.35, 0.26);
  coffeeMachineGroup.add(
    standMesh,
    bunnTower,
    bunnOverhang,
    filterFunnel,
    carafeGlass,
    sludgeMesh,
    coffeeLed
  );
  officeGroup.add(coffeeMachineGroup);

  // Chiral Quantum Lab Rack (Tektronix Dual-Trace Oscilloscope with Live Lissajous Screen + Cryo Dewar)
  const labEquipmentGroup = new THREE.Group();
  labEquipmentGroup.position.set(3.4, 0, 0.6);
  const labBench = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.82, 0.92),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.3 })
  );
  labBench.position.y = 0.41;
  labBench.castShadow = true;

  const scopeUnit = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.4, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.52, roughness: 0.38 })
  );
  scopeUnit.position.set(-0.26, 1.02, 0);
  scopeUnit.castShadow = true;

  const oscilloscopeScreenCanvas = document.createElement('canvas');
  oscilloscopeScreenCanvas.width = 256;
  oscilloscopeScreenCanvas.height = 192;
  const oscilloscopeScreenTex = new THREE.CanvasTexture(oscilloscopeScreenCanvas);
  const scopeScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.22),
    new THREE.MeshBasicMaterial({ map: oscilloscopeScreenTex })
  );
  scopeScreen.position.set(-0.36, 1.04, 0.265);
  // Rotary Knobs on Oscilloscope Front Panel
  for (let ky = 0; ky < 3; ky++) {
    for (let kx = 0; kx < 2; kx++) {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.02, 0.025, 12),
        brassMat
      );
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-0.11 + kx * 0.06, 0.92 + ky * 0.09, 0.265);
      labEquipmentGroup.add(knob);
    }
  }

  // Sculpted Cryogenic Liquid-Helium Dewar Vessel with Brass Pressure Manifold
  const dewarPoints = [
    new THREE.Vector2(0.005, 0),
    new THREE.Vector2(0.24, 0),
    new THREE.Vector2(0.24, 0.62),
    new THREE.Vector2(0.11, 0.74),
    new THREE.Vector2(0.11, 0.88),
    new THREE.Vector2(0.15, 0.91),
    new THREE.Vector2(0.005, 0.91),
  ];
  const cryoDewar = new THREE.Mesh(
    new THREE.LatheGeometry(dewarPoints, 24),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.82, roughness: 0.22 })
  );
  cryoDewar.position.set(0.34, 0.82, 0);
  cryoDewar.castShadow = true;
  const gaugeDial = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16), brassMat);
  gaugeDial.rotation.x = Math.PI / 2;
  gaugeDial.position.set(0.34, 1.82, 0.06);
  labEquipmentGroup.add(labBench, scopeUnit, scopeScreen, cryoDewar, gaugeDial);
  officeGroup.add(labEquipmentGroup);

  // ============================================================================
  // 3. SPACE 3 — SEMINAR ROOM 204 (x = 0.0, z = -4.2)
  // ============================================================================
  const seminarGroup = new THREE.Group();
  seminarGroup.position.set(0.0, 0, -4.2);
  rootGroup.add(seminarGroup);
  registerShatterable(seminarGroup);

  const seminarBoardCanvas = document.createElement('canvas');
  seminarBoardCanvas.width = 1024;
  seminarBoardCanvas.height = 512;
  const seminarBoardTex = new THREE.CanvasTexture(seminarBoardCanvas);
  seminarBoardTex.colorSpace = THREE.SRGBColorSpace;
  const seminarFrame = new THREE.Mesh(new THREE.BoxGeometry(5.38, 2.36, 0.1), wainscotMat);
  seminarFrame.position.set(0, 2.4, -3.08);
  const seminarBoardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 2.2),
    new THREE.MeshStandardMaterial({ map: seminarBoardTex, roughness: 0.38 })
  );
  seminarBoardMesh.position.set(0, 2.4, -3.02);
  seminarBoardMesh.userData = {
    uniInteract: 'SEMINAR_REVIEW',
    interactX: 0.0,
    interactZ: -3.6,
    interactLabel: 'Seminar Room 204 Review',
  };
  seminarGroup.add(seminarFrame, seminarBoardMesh);

  // Boat-Shaped Executive Conference Table + 6 Upholstered Seminar Chairs + Overhead Projector
  const confTable = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.65), deskWoodMat);
  confTable.position.set(0, 0.76, 0.2);
  confTable.castShadow = true;
  confTable.receiveShadow = true;
  confTable.userData = seminarBoardMesh.userData;
  const confBase1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.38, 0.74, 16),
    deskWoodMat
  );
  confBase1.position.set(-1.35, 0.37, 0.2);
  const confBase2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.38, 0.74, 16),
    deskWoodMat
  );
  confBase2.position.set(1.35, 0.37, 0.2);
  seminarGroup.add(confTable, confBase1, confBase2);

  // 6 Upholstered Conference Chairs around the table
  for (const cx of [-1.45, 0, 1.45]) {
    const chairNorth = createAcademicChairGroup(deskWoodMat, 0x1e3a8a);
    chairNorth.position.set(cx, 0, -0.82);
    const chairSouth = createAcademicChairGroup(deskWoodMat, 0x1e3a8a);
    chairSouth.position.set(cx, 0, 1.22);
    chairSouth.rotation.y = Math.PI;
    seminarGroup.add(chairNorth, chairSouth);
  }

  // Vintage Overhead Transparency Projector on Conference Table
  const projBase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), stainlessMat);
  projBase.position.set(-0.6, 0.89, 0.15);
  const projGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.02, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
  );
  projGlass.position.set(-0.6, 0.97, 0.15);
  const projArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8), stainlessMat);
  projArm.position.set(-0.6, 1.18, -0.02);
  const projHead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.18), brassMat);
  projHead.position.set(-0.6, 1.38, 0.06);
  projHead.rotation.x = -0.25;
  seminarGroup.add(projBase, projGlass, projArm, projHead);

  // ============================================================================
  // 4. SPACE 4 — THE UNIVERSITY CAFETERIA ("THE LAGRANGE POINT CAFÉ", x = +11.0, z = -4.2)
  // ============================================================================
  const cafeteriaGroup = new THREE.Group();
  cafeteriaGroup.position.set(11.0, 0, -4.2);
  rootGroup.add(cafeteriaGroup);
  registerShatterable(cafeteriaGroup);

  const cafeteriaBoardCanvas = document.createElement('canvas');
  cafeteriaBoardCanvas.width = 1024;
  cafeteriaBoardCanvas.height = 512;
  const cafeteriaBoardTex = new THREE.CanvasTexture(cafeteriaBoardCanvas);
  cafeteriaBoardTex.colorSpace = THREE.SRGBColorSpace;
  const cafeteriaBoardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 2.1),
    new THREE.MeshStandardMaterial({ map: cafeteriaBoardTex, roughness: 0.42 })
  );
  cafeteriaBoardMesh.position.set(0.5, 2.5, -3.02);
  cafeteriaBoardMesh.userData = {
    uniInteract: 'CAFETERIA_QUEUE',
    interactX: 11.0,
    interactZ: -3.2,
    interactLabel: 'Join/Leave Coffee Queue ($4.50)',
  };
  cafeteriaGroup.add(cafeteriaBoardMesh);

  // Espresso & Cashier Service Counter with Marble Top & Glass Pastry Case
  const counterMesh = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 1.05, 1.12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.25 })
  );
  counterMesh.position.set(0.8, 0.525, -1.6);
  counterMesh.castShadow = true;
  counterMesh.userData = cafeteriaBoardMesh.userData;
  const counterMarbleTop = new THREE.Mesh(
    new THREE.BoxGeometry(5.65, 0.08, 1.24),
    new THREE.MeshPhysicalMaterial({ color: 0xf1f5f9, roughness: 0.18, clearcoat: 0.85 })
  );
  counterMarbleTop.position.set(0.8, 1.08, -1.6);
  counterMarbleTop.userData = cafeteriaBoardMesh.userData;
  cafeteriaGroup.add(counterMesh, counterMarbleTop);

  // Glass Pastry Display Case with Croissants & Bagels
  const pastryCase = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.52, 0.72),
    new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      clearcoat: 1.0,
    })
  );
  pastryCase.position.set(-0.6, 1.38, -1.55);
  cafeteriaGroup.add(pastryCase);
  for (let p = 0; p < 4; p++) {
    const croissant = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.032, 8, 14, Math.PI * 1.3),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 })
    );
    croissant.rotation.x = Math.PI / 2;
    croissant.position.set(-1.1 + p * 0.34, 1.16, -1.55);
    cafeteriaGroup.add(croissant);
  }

  // Italian Dual-Group Brass & Chrome Commercial Espresso Machine + Stacked Cups
  const espressoMachineGroup = new THREE.Group();
  espressoMachineGroup.position.set(2.1, 1.12, -1.6);
  const espBody = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.56, 0.58), brassMat);
  espBody.position.y = 0.28;
  espBody.castShadow = true;
  const espHood = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.1, 0.62), stainlessMat);
  espHood.position.y = 0.58;
  for (const gx of [-0.22, 0.22]) {
    const groupHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.06, 0.12, 14),
      stainlessMat
    );
    groupHead.position.set(gx, 0.34, 0.32);
    const portafilterHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
    );
    portafilterHandle.rotation.x = Math.PI / 2;
    portafilterHandle.position.set(gx, 0.31, 0.46);
    espressoMachineGroup.add(groupHead, portafilterHandle);
  }
  espressoMachineGroup.add(espBody, espHood);
  cafeteriaGroup.add(espressoMachineGroup);

  // Brass Queue Stanchions with Draped Burgundy Velvet Ropes (`TubeGeometry` Catenary Curves!)
  const velvetRopeMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.78,
    bumpMap: tweedTex,
    bumpScale: 0.01,
  });
  for (let i = 0; i < 4; i++) {
    const postX = -2.2 + i * 1.35;
    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 16), brassMat);
    baseDisc.position.set(postX, 0.025, 0.35);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.94, 14), brassMat);
    post.position.set(postX, 0.48, 0.35);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), brassMat);
    finial.position.set(postX, 0.97, 0.35);
    cafeteriaGroup.add(baseDisc, post, finial);

    if (i < 3) {
      const ropeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(postX, 0.84, 0.35),
        new THREE.Vector3(postX + 0.675, 0.56, 0.35),
        new THREE.Vector3(postX + 1.35, 0.84, 0.35),
      ]);
      const ropeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(ropeCurve, 18, 0.024, 10, false),
        velvetRopeMat
      );
      cafeteriaGroup.add(ropeMesh);
    }
  }

  // Round Café Bistro Table near Prof. Rook
  const bistroTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 0.06, 24),
    counterMarbleTop.material
  );
  bistroTop.position.set(3.2, 0.76, 1.1);
  bistroTop.castShadow = true;
  const bistroPed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.28, 0.74, 16), stainlessMat);
  bistroPed.position.set(3.2, 0.37, 1.1);
  cafeteriaGroup.add(bistroTop, bistroPed);

  // ============================================================================
  // 5. SPACE 5 — PERSEUS DRY CLEANERS & HABERDASHERY (x = +11.0, z = +7.0)
  // ============================================================================
  const cleanerGroup = new THREE.Group();
  cleanerGroup.position.set(11.0, 0, 7.0);
  rootGroup.add(cleanerGroup);
  registerShatterable(cleanerGroup);

  const cleanerBoardCanvas = document.createElement('canvas');
  cleanerBoardCanvas.width = 1024;
  cleanerBoardCanvas.height = 512;
  const cleanerBoardTex = new THREE.CanvasTexture(cleanerBoardCanvas);
  cleanerBoardTex.colorSpace = THREE.SRGBColorSpace;
  const cleanerBoardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 2.2),
    new THREE.MeshStandardMaterial({ map: cleanerBoardTex, roughness: 0.4 })
  );
  cleanerBoardMesh.position.set(0, 2.45, 3.0);
  cleanerBoardMesh.rotation.y = Math.PI;
  cleanerBoardMesh.userData = {
    uniInteract: 'CLEANER_COUNTER',
    interactX: 11.0,
    interactZ: 7.2,
    interactLabel: 'Perseus Dry Cleaners Counter',
  };
  cleanerGroup.add(cleanerBoardMesh);

  // Dry Cleaners Service Counter + Vintage Brass Cash Register & Call Bell
  const cleanerCounter = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 1.02, 1.04),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.52 })
  );
  cleanerCounter.position.set(0, 0.51, 1.2);
  cleanerCounter.castShadow = true;
  cleanerCounter.userData = cleanerBoardMesh.userData;
  const cleanerTop = new THREE.Mesh(new THREE.BoxGeometry(4.95, 0.08, 1.14), deskWoodMat);
  cleanerTop.position.set(0, 1.04, 1.2);
  cleanerTop.userData = cleanerBoardMesh.userData;
  const cashRegister = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.38), brassMat);
  cashRegister.position.set(1.1, 1.25, 1.2);
  cashRegister.userData = cleanerBoardMesh.userData;
  const serviceBell = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    brassMat
  );
  serviceBell.position.set(-0.35, 1.08, 0.85);
  cleanerGroup.add(cleanerCounter, cleanerTop, cashRegister, serviceBell);

  // Haberdashery Tailor's Display Mannequin Modeling the $68 Brand-New Crisp Oxford Shirt!
  const mannequinGroup = new THREE.Group();
  mannequinGroup.position.set(3.2, 0, 0.8);
  mannequinGroup.userData = {
    uniInteract: 'BUY_HABERDASHERY_SHIRT',
    interactX: 13.5,
    interactZ: 7.4,
    interactLabel: 'Buy New Oxford Shirt ($68.00)',
  };
  const manBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.06, 16), brassMat);
  manBase.position.y = 0.03;
  const manPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 12), brassMat);
  manPole.position.y = 0.5;
  const manShirt = new THREE.Mesh(
    createTailoredShirtTorsoGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.65 })
  );
  manShirt.position.y = 0.88;
  manShirt.castShadow = true;
  const manTie = new THREE.Mesh(
    createSilkNecktieGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
  );
  manTie.position.set(0, 1.21, 0.145);
  mannequinGroup.add(manBase, manPole, manShirt, manTie);
  cleanerGroup.add(mannequinGroup);

  // Hanging Pressed Shirts Conveyor Rack inside Perseus Cleaners (Sculpted Shirts on Wire Hangers!)
  const cleanerHangingShirtGroup = new THREE.Group();
  cleanerHangingShirtGroup.position.set(-2.6, 1.25, 1.5);
  const rackLoop = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.03, 10, 32),
    stainlessMat
  );
  rackLoop.rotation.x = Math.PI / 2;
  rackLoop.scale.set(1.2, 0.45, 1);
  rackLoop.position.y = 0.72;
  cleanerHangingShirtGroup.add(rackLoop);

  const hangerShirtGeo = createTailoredShirtTorsoGeometry();
  for (let i = 0; i < 4; i++) {
    const itemGroup = new THREE.Group();
    itemGroup.position.set(-0.95 + i * 0.62, 0, 0);

    // Wire Hanger Hook
    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.006, 6, 12, Math.PI * 1.3),
      stainlessMat
    );
    hook.position.y = 0.66;
    const pressedShirt = new THREE.Mesh(
      hangerShirtGeo,
      new THREE.MeshStandardMaterial({
        color: i === 0 ? 0xffffff : i === 1 ? 0xe0f2fe : 0xfef3c7,
        roughness: 0.45,
      })
    );
    pressedShirt.scale.set(0.95, 0.95, 0.55);
    pressedShirt.castShadow = true;

    // Translucent Dry-Cleaner Poly Garment Bag Shroud
    const polyBag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.62, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.22,
        roughness: 0.15,
        depthWrite: false,
      })
    );
    polyBag.scale.set(1.0, 1.0, 0.48);
    polyBag.position.y = 0.28;
    itemGroup.add(hook, pressedShirt, polyBag);
    cleanerHangingShirtGroup.add(itemGroup);
  }
  cleanerGroup.add(cleanerHangingShirtGroup);

  // Metal Security Shutter (Lowers when Perseus Cleaners is CLOSED before 08:30 or after 17:30!)
  const cleanerClosedShutter = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 3.6, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.72,
      roughness: 0.38,
      bumpMap: tweedTex,
      bumpScale: 0.02,
    })
  );
  cleanerClosedShutter.position.set(0, 1.8, -3.1);
  cleanerClosedShutter.visible = false;
  cleanerGroup.add(cleanerClosedShutter);

  // ============================================================================
  // 6. RAIN PARTICLES OUTSIDE ROOM 4B & COFFEE SPLASH PARTICLES IN CAFETERIA
  // ============================================================================
  const rainCount = 320;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainVelocities = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3 + 0] = -10.0 + (Math.random() - 0.5) * 4.5;
    rainPositions[i * 3 + 1] = 1.2 + Math.random() * 4.2;
    rainPositions[i * 3 + 2] = -7.25 - Math.random() * 0.8;
    rainVelocities[i] = 5.5 + Math.random() * 3.5;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainPoints = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.06, transparent: true, opacity: 0.65 })
  );
  rootGroup.add(rainPoints);

  // Coffee Splash Droplets (triggered on collision with the distracted student!)
  const splashCount = 48;
  const splashPositions = new Float32Array(splashCount * 3);
  const coffeeSplashVelocities = new Float32Array(splashCount * 3);
  const splashGeo = new THREE.BufferGeometry();
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
  const coffeeSplashPoints = new THREE.Points(
    splashGeo,
    new THREE.PointsMaterial({ color: 0x78350f, size: 0.09, transparent: true, opacity: 0.95 })
  );
  coffeeSplashPoints.visible = false;
  rootGroup.add(coffeeSplashPoints);

  // ============================================================================
  // 7. SCULPTED HUMAN ACADEMIC CHARACTERS (DR. PAWN, TOBY, BISHOP, QUEEN, ROOK, STAFF)
  // ============================================================================
  const drPawnRig = createHumanAcademicCharacter({
    archetype: 'DR_PAWN',
    nameTag: 'Dr. Pawn',
    roleTag: 'Untenured Researcher · Room 4B',
    jacketColor: 0x5c4033, // Warm Oxford brown herringbone tweed
    trouserColor: 0x334155,
    tieColor: 0x991b1b,
    hairColor: 0x27272a,
    elbowPatchColor: 0x9a3412, // Stitched Cognac suede elbow patches
    eyeColor: 0x2563eb,
    hasGlasses: true,
  });
  drPawnRig.root.position.set(-10.0, 0, -2.5);
  rootGroup.add(drPawnRig.root);

  const tobyRig = createHumanAcademicCharacter({
    archetype: 'GRAD_TOBY',
    nameTag: 'Toby (Grad Student)',
    roleTag: '7th-Year PhD Candidate · Lemma 3.2',
    jacketColor: 0x3f6212, // Olive corduroy jacket
    trouserColor: 0x1e293b,
    tieColor: 0xd97706,
    hairColor: 0x78350f,
    elbowPatchColor: 0x713f12,
    eyeColor: 0x15803d,
    hasGlasses: true,
  });
  tobyRig.root.userData = {
    uniInteract: 'TALK_TOBY',
    interactLabel: 'Speak with Grad Student Toby',
  };
  rootGroup.add(tobyRig.root);

  const bishopRig = createHumanAcademicCharacter({
    archetype: 'PROF_BISHOP',
    nameTag: 'Prof. Bishop',
    roleTag: 'Director, Chiral Quantum Lab',
    jacketColor: 0x3b0764, // Deep plum velvet blazer
    trouserColor: 0x18181b,
    tieColor: 0x9333ea,
    hairColor: 0x9ca3af,
    elbowPatchColor: 0x1f2937,
    eyeColor: 0x7e22ce,
    hasGlasses: true,
  });
  bishopRig.root.userData = {
    uniInteract: 'TALK_BISHOP',
    interactLabel: 'Speak with Prof. Bishop',
  };
  rootGroup.add(bishopRig.root);

  const queenRig = createHumanAcademicCharacter({
    archetype: 'CHAIR_QUEEN',
    nameTag: 'Dr. Queen',
    roleTag: 'Department Chairwoman',
    jacketColor: 0x1e293b, // Charcoal tailored suit
    trouserColor: 0x0f172a,
    tieColor: 0xbe123c,
    hairColor: 0x1c1917,
    elbowPatchColor: 0x475569,
    eyeColor: 0xb45309,
    hasGlasses: true,
  });
  queenRig.root.userData = {
    uniInteract: 'TALK_QUEEN',
    interactLabel: 'Speak with Chairwoman Dr. Queen',
  };
  rootGroup.add(queenRig.root);

  const rookRig = createHumanAcademicCharacter({
    archetype: 'PROF_ROOK',
    nameTag: 'Prof. Rook (Tenured)',
    roleTag: 'h-index: 64 · Reviewer #2',
    jacketColor: 0x451a03, // Oxblood Harris tweed with gold watch chain
    trouserColor: 0x27272a,
    tieColor: 0xb45309,
    hairColor: 0xd1d5db,
    elbowPatchColor: 0x7f1d1d,
    eyeColor: 0x475569,
    hasGlasses: true,
  });
  rookRig.root.userData = {
    uniInteract: 'TALK_ROOK',
    interactLabel: 'Confront Tenured Prof. Rook',
  };
  rootGroup.add(rookRig.root);

  const cashierRig = createHumanAcademicCharacter({
    archetype: 'BARISTA',
    nameTag: 'Cafeteria Barista',
    roleTag: 'Lagrange Point Café ($4.50)',
    jacketColor: 0x065f46,
    trouserColor: 0x1f2937,
    tieColor: 0xf59e0b,
    hairColor: 0x451a03,
    hasGlasses: false,
  });
  cashierRig.root.position.set(11.6, 0, -6.4);
  cashierRig.root.userData = {
    uniInteract: 'CAFETERIA_QUEUE',
    interactX: 11.0,
    interactZ: -3.2,
    interactLabel: 'Join/Leave Coffee Queue ($4.50)',
  };
  rootGroup.add(cashierRig.root);

  const cleanerClerkRig = createHumanAcademicCharacter({
    archetype: 'CLEANER_CLERK',
    nameTag: 'Mr. Henderson',
    roleTag: 'Perseus Dry Cleaners (08:30–17:30)',
    jacketColor: 0x0f766e,
    trouserColor: 0x1e293b,
    tieColor: 0x38bdf8,
    hairColor: 0x6b7280,
    hasGlasses: true,
  });
  cleanerClerkRig.root.position.set(11.0, 0, 9.0);
  cleanerClerkRig.root.rotation.y = Math.PI;
  cleanerClerkRig.root.userData = {
    uniInteract: 'CLEANER_COUNTER',
    interactX: 11.0,
    interactZ: 7.2,
    interactLabel: 'Speak with Mr. Henderson (Dry Cleaners)',
  };
  rootGroup.add(cleanerClerkRig.root);

  const distractedStudentRig = createHumanAcademicCharacter({
    archetype: 'UNDERGRAD',
    nameTag: 'Distracted Undergrad',
    roleTag: 'Late for MATH 101 Midterm!',
    jacketColor: 0x1d4ed8,
    trouserColor: 0x334155,
    tieColor: 0xfbbf24,
    hairColor: 0x92400e,
    hasGlasses: false,
  });
  distractedStudentRig.root.position.set(8.2, 0, -2.0);
  rootGroup.add(distractedStudentRig.root);

  const queueNpcRigs: HumanAcademicRig[] = [0, 1, 2].map((idx) => {
    const qRig = createHumanAcademicCharacter({
      archetype: 'PATRON',
      nameTag: `Queued Patron #${idx + 1}`,
      roleTag: 'Waiting for Espresso...',
      jacketColor: [0x374151, 0x3f3f46, 0x475569][idx],
      trouserColor: 0x1e293b,
      tieColor: 0x64748b,
      hairColor: 0x27272a,
      hasGlasses: idx % 2 === 0,
    });
    rootGroup.add(qRig.root);
    return qRig;
  });

  // ============================================================================
  // 8. ARCHITECTURAL LIGHTING ACROSS ALL 5 UNIVERSITY ROOMS
  // ============================================================================
  const deskLampLight = new THREE.PointLight(0xfde68a, 3.8, 12);
  deskLampLight.position.set(-10.8, 2.3, -4.6);
  rootGroup.add(deskLampLight);

  const windowMoonLight = new THREE.SpotLight(0x60a5fa, 3.4, 16, Math.PI / 3, 0.5);
  windowMoonLight.position.set(-10.0, 4.5, -7.2);
  rootGroup.add(windowMoonLight);

  const fluorescentLight = new THREE.PointLight(0xe2e8f0, 3.5, 18);
  fluorescentLight.position.set(-5.0, 4.2, 0.5);
  rootGroup.add(fluorescentLight);

  const seminarLight = new THREE.PointLight(0xfef3c7, 3.6, 15);
  seminarLight.position.set(0.0, 4.0, -4.0);
  rootGroup.add(seminarLight);

  const cafeteriaLight = new THREE.PointLight(0xfde68a, 3.9, 16);
  cafeteriaLight.position.set(11.0, 4.0, -4.0);
  rootGroup.add(cafeteriaLight);

  const cleanerLight = new THREE.PointLight(0x67e8f9, 3.6, 15);
  cleanerLight.position.set(11.0, 3.8, 7.0);
  rootGroup.add(cleanerLight);

  return {
    rootGroup,
    walkableFloorMesh,
    rainPoints,
    rainVelocities,
    windowDropletsMesh,
    chalkboardCanvas,
    chalkboardTex,
    crtScreenCanvas,
    crtScreenTex,
    seminarBoardCanvas,
    seminarBoardTex,
    cafeteriaBoardCanvas,
    cafeteriaBoardTex,
    cleanerBoardCanvas,
    cleanerBoardTex,
    coffeeMachineGroup,
    coffeeLedMat,
    labEquipmentGroup,
    oscilloscopeScreenCanvas,
    oscilloscopeScreenTex,
    cleanerClosedShutter,
    cleanerHangingShirtGroup,
    deskLampLight,
    windowMoonLight,
    fluorescentLight,
    cafeteriaLight,
    seminarLight,
    cleanerLight,
    drPawnRig,
    tobyRig,
    bishopRig,
    queenRig,
    rookRig,
    cashierRig,
    cleanerClerkRig,
    distractedStudentRig,
    queueNpcRigs,
    coffeeSplashPoints,
    coffeeSplashVelocities,
    coffeeSplashTimerSec: 0,
    shatterableGroups,
    lastChalkSignature: '',
    lastCafeteriaSignature: '',
    lastCleanerSignature: '',
    lastSeminarSignature: '',
  };
}

export function triggerCoffeeSpill3DSplash(
  rig: UniversityOfficeRig,
  worldX: number,
  worldZ: number
) {
  rig.coffeeSplashTimerSec = 1.6;
  rig.coffeeSplashPoints.visible = true;
  const posAttr = rig.coffeeSplashPoints.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setXYZ(
      i,
      worldX + (Math.random() - 0.5) * 0.25,
      1.15 + (Math.random() - 0.5) * 0.15,
      worldZ + (Math.random() - 0.5) * 0.25
    );
    rig.coffeeSplashVelocities[i * 3 + 0] = (Math.random() - 0.5) * 2.8;
    rig.coffeeSplashVelocities[i * 3 + 1] = 1.2 + Math.random() * 2.4;
    rig.coffeeSplashVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.8;
  }
  posAttr.needsUpdate = true;
}

export function updateUniversityOfficeScene(
  rig: UniversityOfficeRig,
  elapsed: number,
  rawDelta: number,
  state: {
    year: number;
    semesterLabel: string;
    dayIndex: number;
    dayName: string;
    timeOfDayMinutes: number;
    timeFormatted: string;
    playerWorldX: number;
    playerWorldZ: number;
    playerYaw: number;
    playerIsMoving: boolean;
    shirtState: AcademicShirtState;
    carryingHotCoffee: boolean;
    cafeteriaQueuePosition: number | null;
    cafeteriaServiceProgress: number;
    activeDryCleaningTicket: DryCleaningTicket | null;
    lemmaIntegrity: number;
    boundaryGaugeVerified: boolean;
    jacobianSignFlipped: boolean;
    chiralLabDataAttached: boolean;
    journalRejections: number;
    hIndex: number;
    personalBalance: number;
    departmentalBalance: number;
    equipmentSold: boolean;
    publishedAccepted: boolean;
    realityShatterProgressSec: number;
  }
) {
  const isShattering = state.realityShatterProgressSec > 0;

  // 1. REALITY SHATTER SEQUENCE (When the Acceptance Letter fractures the University back into the 4D Chessboard!)
  if (isShattering) {
    const s = state.realityShatterProgressSec;
    const liftFactor = Math.max(0, s - 1.5);
    for (const item of rig.shatterableGroups) {
      item.group.position.set(
        item.basePos.x + item.driftDir.x * liftFactor * 0.45,
        item.basePos.y + item.driftDir.y * liftFactor * 0.55,
        item.basePos.z + item.driftDir.z * liftFactor * 0.45
      );
      item.group.rotation.z = liftFactor * 0.08 * Math.sin(item.basePos.x);
    }
  } else {
    for (const item of rig.shatterableGroups) {
      item.group.position.copy(item.basePos);
      item.group.rotation.z = 0;
    }
  }

  // 2. Rain outside Room 4B (Freezes in mid-air when Reality Shatter begins!)
  if (!isShattering) {
    const posAttr = rig.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      let y = posAttr.getY(i) - rig.rainVelocities[i] * rawDelta;
      if (y < 1.1) {
        y = 5.1;
      }
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  }

  // 2b. Animate Tektronix Oscilloscope Chiral Lissajous Wave in Room 4B
  if (!state.equipmentSold) {
    const octx = rig.oscilloscopeScreenCanvas.getContext('2d');
    if (octx) {
      octx.fillStyle = '#031c12';
      octx.fillRect(0, 0, 256, 192);
      octx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
      octx.lineWidth = 1;
      for (let gx = 32; gx < 256; gx += 32) {
        octx.beginPath();
        octx.moveTo(gx, 0);
        octx.lineTo(gx, 192);
        octx.stroke();
      }
      for (let gy = 32; gy < 192; gy += 32) {
        octx.beginPath();
        octx.moveTo(0, gy);
        octx.lineTo(256, gy);
        octx.stroke();
      }
      octx.strokeStyle = '#34d399';
      octx.lineWidth = 2.4;
      octx.beginPath();
      for (let t = 0; t <= 90; t++) {
        const a = (t / 90) * Math.PI * 2;
        const px = 128 + Math.sin(a * 3 + elapsed * 2.8) * 86;
        const py = 96 + Math.sin(a * 2 + elapsed * 1.4) * 64;
        if (t === 0) octx.moveTo(px, py);
        else octx.lineTo(px, py);
      }
      octx.stroke();
      rig.oscilloscopeScreenTex.needsUpdate = true;
    }
  }

  // 3. Coffee Spill Particle Burst Physics
  if (rig.coffeeSplashTimerSec > 0) {
    rig.coffeeSplashTimerSec = Math.max(0, rig.coffeeSplashTimerSec - rawDelta);
    const posAttr = rig.coffeeSplashPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = rig.coffeeSplashVelocities[i * 3 + 0];
      let vy = rig.coffeeSplashVelocities[i * 3 + 1];
      const vz = rig.coffeeSplashVelocities[i * 3 + 2];
      const nx = posAttr.getX(i) + vx * rawDelta;
      const ny = Math.max(0.05, posAttr.getY(i) + vy * rawDelta);
      const nz = posAttr.getZ(i) + vz * rawDelta;
      vy -= 9.8 * rawDelta;
      rig.coffeeSplashVelocities[i * 3 + 1] = vy;
      posAttr.setXYZ(i, nx, ny, nz);
    }
    posAttr.needsUpdate = true;
    if (rig.coffeeSplashTimerSec <= 0) {
      rig.coffeeSplashPoints.visible = false;
    }
  }

  // 4. Update Dr. Pawn's Human Academic Rig (Position, Garment State, Coffee Stain, Walk Stride)
  rig.drPawnRig.root.position.set(state.playerWorldX, 0, state.playerWorldZ);
  rig.drPawnRig.root.rotation.y = state.playerYaw;
  rig.drPawnRig.coffeeStainGroup.visible = state.shirtState === 'COFFEE_STAINED';
  rig.drPawnRig.jacketMesh.visible = state.shirtState !== 'AT_CLEANERS_WEARING_SWEATER';
  rig.drPawnRig.shirtChestMesh.visible = state.shirtState !== 'AT_CLEANERS_WEARING_SWEATER';
  rig.drPawnRig.necktieMesh.visible = state.shirtState !== 'AT_CLEANERS_WEARING_SWEATER';
  rig.drPawnRig.sweaterMesh.visible = state.shirtState === 'AT_CLEANERS_WEARING_SWEATER';
  rig.drPawnRig.labelSprite.visible = false; // Never show a giant self-label above Dr. Pawn!

  animateHumanRigWalkAndPose(
    rig.drPawnRig,
    elapsed,
    state.playerIsMoving,
    state.carryingHotCoffee,
    0,
    state.shirtState === 'COFFEE_STAINED'
  );

  // Helper to show NPC nameplate only when Dr. Pawn is nearby (prevents distant room labels floating through walls!)
  const updateNpcLabelVisibility = (npcRig: HumanAcademicRig, maxDist: number = 7.5) => {
    const dx = npcRig.root.position.x - state.playerWorldX;
    const dz = npcRig.root.position.z - state.playerWorldZ;
    npcRig.labelSprite.visible = !isShattering && Math.hypot(dx, dz) <= maxDist;
  };

  // 5. Update Dynamic NPC Positions & Schedules Across the 5 Rooms
  const mins = state.timeOfDayMinutes;
  // Grad Student Toby: In Office 4B (08:00–12:30), Seminar Room 204 (12:30–15:30), Office 4B (15:30+)
  if (mins >= 750 && mins < 930) {
    rig.tobyRig.root.position.set(-2.6, 0, -4.6);
    rig.tobyRig.root.rotation.y = 0.4;
    updateHumanCharacterLabel(
      rig.tobyRig,
      'Toby · Grad Student',
      'Click to discuss Lemma 3.2',
      '#38bdf8'
    );
  } else {
    rig.tobyRig.root.position.set(-12.6, 0, -3.6);
    rig.tobyRig.root.rotation.y = Math.PI * 0.4;
    updateHumanCharacterLabel(
      rig.tobyRig,
      'Toby · Grad Student',
      state.lemmaIntegrity >= 100 ? 'Lemma 3.2 Verified!' : 'Click to discuss Jacobian Sign',
      '#38bdf8'
    );
  }
  updateNpcLabelVisibility(rig.tobyRig, 7.2);
  animateHumanRigWalkAndPose(rig.tobyRig, elapsed, false, false, 1.3);

  // Prof. Bishop: In Seminar Room 204 during 13:30–16:00 (for the 14:30 Appointment!), otherwise in Corridor/Cafeteria
  if (mins >= 810 && mins <= 960) {
    rig.bishopRig.root.position.set(1.6, 0, -5.2);
    rig.bishopRig.root.rotation.y = -0.25;
    updateHumanCharacterLabel(
      rig.bishopRig,
      'Prof. Bishop',
      mins >= 870 && mins <= 915
        ? '⏰ Click for 14:30 Lab Review'
        : 'Click to discuss Lab Review',
      '#c084fc'
    );
  } else {
    rig.bishopRig.root.position.set(3.8, 0, 1.6);
    rig.bishopRig.root.rotation.y = Math.PI;
    updateHumanCharacterLabel(
      rig.bishopRig,
      'Prof. Bishop',
      'Chiral Lab Director (Appt 14:30)',
      '#c084fc'
    );
  }
  updateNpcLabelVisibility(rig.bishopRig, 7.5);
  animateHumanRigWalkAndPose(rig.bishopRig, elapsed, false, false, 2.7);

  // Department Chairwoman Dr. Queen: In Seminar Room 204 during 14:00–15:45, otherwise in Faculty Corridor
  if (mins >= 840 && mins <= 945) {
    rig.queenRig.root.position.set(-1.5, 0, -5.2);
    rig.queenRig.root.rotation.y = 0.2;
    updateHumanCharacterLabel(
      rig.queenRig,
      'Chairwoman Dr. Queen',
      'Evaluating Dress Code & Grant',
      '#f43f5e'
    );
  } else {
    rig.queenRig.root.position.set(-3.5, 0, 1.8);
    rig.queenRig.root.rotation.y = Math.PI;
    updateHumanCharacterLabel(
      rig.queenRig,
      'Chairwoman Dr. Queen',
      'Dept. Chair · Click to Speak',
      '#f43f5e'
    );
  }
  updateNpcLabelVisibility(rig.queenRig, 7.5);
  animateHumanRigWalkAndPose(rig.queenRig, elapsed, false, false, 3.9);

  // Tenured Prof. Rook (Reviewer #2): Lounging near the Cafeteria with espresso
  rig.rookRig.root.position.set(14.2, 0, -2.5);
  rig.rookRig.root.rotation.y = -Math.PI * 0.35;
  updateNpcLabelVisibility(rig.rookRig, 7.2);
  animateHumanRigWalkAndPose(rig.rookRig, elapsed, false, true, 4.8);

  // Cafeteria Barista & Dry Cleaner Clerk subtle idle animation & proximity labels
  updateNpcLabelVisibility(rig.cashierRig, 7.0);
  updateNpcLabelVisibility(rig.cleanerClerkRig, 7.0);
  updateNpcLabelVisibility(rig.distractedStudentRig, 5.5);
  animateHumanRigWalkAndPose(rig.cashierRig, elapsed, false, false, 6.1);
  animateHumanRigWalkAndPose(rig.cleanerClerkRig, elapsed, false, false, 7.2);

  // Cafeteria Queue NPCs: Show the patrons ahead of Dr. Pawn in the physical queue
  const queueCountAhead =
    state.cafeteriaQueuePosition !== null ? state.cafeteriaQueuePosition : 3;
  for (let i = 0; i < rig.queueNpcRigs.length; i++) {
    const qNpc = rig.queueNpcRigs[i];
    if (i < queueCountAhead) {
      qNpc.root.visible = true;
      qNpc.root.position.set(11.4 - i * 1.25, 0, -4.3);
      qNpc.root.rotation.y = Math.PI;
      animateHumanRigWalkAndPose(qNpc, elapsed, false, false, i * 1.7);
    } else {
      qNpc.root.visible = false;
    }
  }

  // Distracted Undergraduate Student: Paces near the Cafeteria doorway (`x: 8.5 .. 10.5, z: -2.0`)
  const studentPace = Math.sin(elapsed * 2.1) * 0.9;
  rig.distractedStudentRig.root.position.set(9.2 + studentPace, 0, -1.5);
  rig.distractedStudentRig.root.rotation.y =
    Math.cos(elapsed * 2.1) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  animateHumanRigWalkAndPose(rig.distractedStudentRig, elapsed, true, false, 5.5);

  // Perseus Dry Cleaners Opening Hours (`08:30` = 510m to `17:30` = 1050m)
  const cleanerIsOpen = mins >= 510 && mins <= 1050;
  rig.cleanerClosedShutter.visible = !cleanerIsOpen;
  rig.cleanerClerkRig.root.visible = cleanerIsOpen;

  // Gently rotate the dry-cleaning conveyor rack when open
  if (cleanerIsOpen && !isShattering) {
    rig.cleanerHangingShirtGroup.position.x = -2.6 + Math.sin(elapsed * 0.8) * 0.12;
  }

  // Hide Lab Equipment if liquidated for Perseus Arm fee
  rig.labEquipmentGroup.visible = !state.equipmentSold;

  // 6. Update Room 4B Chalkboard & CRT Monitor
  const chalkSig = `${state.dayName}_${state.lemmaIntegrity}_${state.boundaryGaugeVerified}_${state.jacobianSignFlipped}_${state.chiralLabDataAttached}_${state.journalRejections}_${state.publishedAccepted}`;
  if (chalkSig !== rig.lastChalkSignature) {
    rig.lastChalkSignature = chalkSig;
    const ctx = rig.chalkboardCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#123123';
      ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, 996, 484);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 26px Georgia, serif';
      ctx.fillText('ROOM 4B CHALKBOARD — CENTRAL LEMMA 3.2 WORKBENCH', 36, 54);

      ctx.fillStyle = '#fde68a';
      ctx.font = 'italic 22px Georgia, serif';
      ctx.fillText('Manuscript: "On the Nonexistence of Monarchs in Retrocausal Systems"', 36, 96);

      ctx.font = '21px monospace';
      ctx.fillStyle = state.boundaryGaugeVerified ? '#6ee7b7' : '#fca5a5';
      ctx.fillText(
        state.boundaryGaugeVerified
          ? '✓ [1] Boundary Gauge: ψ(t₀−1) = −γ₅ψ(t₀) (Chiral Anti-Periodic — Surface Term Vanishes)'
          : '✗ [1] Boundary Gauge: UNVERIFIED (Surface commutator [∂_t, H] diverges at ∂M)',
        36,
        160
      );

      ctx.fillStyle = state.jacobianSignFlipped ? '#6ee7b7' : '#fca5a5';
      ctx.fillText(
        state.jacobianSignFlipped
          ? '✓ [2] Retrocausal Jacobian: det[∂_t, −κ; +κ, ∂_w] = λ² + κ² > 0 (Bounded)'
          : '✗ [2] Retrocausal Jacobian: Toby found −κ sign error in off-diagonal adjoint!',
        36,
        215
      );

      ctx.fillStyle = state.chiralLabDataAttached ? '#6ee7b7' : '#fcd34d';
      ctx.fillText(
        state.chiralLabDataAttached
          ? '✓ [3] Experimental Run: Chiral Interferometer Data Attached (4.8σ Convergence)'
          : '○ [3] Experimental Run: Requires Prof. Bishop’s Chiral Lab Access (14:30 Appt)',
        36,
        270
      );

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(
        `PROOF INTEGRITY: ${state.lemmaIntegrity}%   |   JTC REJECTIONS: ${state.journalRejections}/3`,
        36,
        345
      );

      if (state.publishedAccepted) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 28px Georgia, serif';
        ctx.fillText(
          '★ FORMALLY ACCEPTED: GALACTIC ADVANCES IN THEORETICAL EVERYTHING ★',
          36,
          425
        );
      }
      rig.chalkboardTex.needsUpdate = true;
    }

    const crt = rig.crtScreenCanvas.getContext('2d');
    if (crt) {
      crt.fillStyle = '#051811';
      crt.fillRect(0, 0, 512, 384);
      crt.fillStyle = '#34d399';
      crt.font = 'bold 18px monospace';
      crt.fillText('UGA PINE MAIL & LEDGER TERMINAL', 20, 38);
      crt.fillStyle = '#a7f3d0';
      crt.font = '15px monospace';
      crt.fillText(`> Personal Checking: $${state.personalBalance.toFixed(2)}`, 20, 88);
      crt.fillText(`> Dept. Grant Acct:  $${state.departmentalBalance.toFixed(2)}`, 20, 122);
      crt.fillText(`> Lemma 3.2 Proof:   ${state.lemmaIntegrity}%`, 20, 156);
      crt.fillText(`> Shirt Condition:   ${state.shirtState}`, 20, 190);
      rig.crtScreenTex.needsUpdate = true;
    }
  }

  // 7. Update Cafeteria Queue Board
  const cafSig = `${state.cafeteriaQueuePosition}_${Math.floor(state.cafeteriaServiceProgress / 10)}_${state.carryingHotCoffee}_${state.shirtState}`;
  if (cafSig !== rig.lastCafeteriaSignature) {
    rig.lastCafeteriaSignature = cafSig;
    const ctx = rig.cafeteriaBoardCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 5;
      ctx.strokeRect(16, 16, 992, 480);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillText('THE LAGRANGE POINT CAFETERIA — ESPRESSO & FILTER COFFEE', 40, 68);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '24px monospace';
      ctx.fillText('• Hot Filter Coffee (12oz Paper Cup) ................. $4.50', 40, 135);
      ctx.fillText('• Finite Cashier Service Rate: ~1 Customer / 4 Sim Minutes', 40, 185);

      if (state.cafeteriaQueuePosition !== null) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(
          state.cafeteriaQueuePosition === 0
            ? `★ YOU ARE AT THE REGISTER! Serving: ${Math.round(state.cafeteriaServiceProgress)}%`
            : `⏳ IN QUEUE: ${state.cafeteriaQueuePosition} Patron(s) Ahead of You (${Math.round(state.cafeteriaServiceProgress)}% served)`,
          40,
          280
        );
      } else {
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(
          state.carryingHotCoffee
            ? '✓ COFFEE PURCHASED ($4.50) — Careful walking out past rushing students!'
            : '→ Walk to the Queue Stanchions or Click "Join Coffee Queue ($4.50)"',
          40,
          280
        );
      }
      rig.cafeteriaBoardTex.needsUpdate = true;
    }
  }

  // 8. Update Perseus Dry Cleaners Board
  const ticket = state.activeDryCleaningTicket;
  const cleanSig = `${cleanerIsOpen}_${state.shirtState}_${ticket?.ticketNumber}_${ticket?.readyMinutes}_${Math.floor(mins / 5)}`;
  if (cleanSig !== rig.lastCleanerSignature) {
    rig.lastCleanerSignature = cleanSig;
    const ctx = rig.cleanerBoardCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#082f49';
      ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      ctx.strokeRect(16, 16, 992, 480);

      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillText(
        `PERSEUS DRY CLEANERS & HABERDASHERY — ${cleanerIsOpen ? 'OPEN (08:30–17:30)' : 'CLOSED'}`,
        40,
        68
      );

      ctx.fillStyle = '#f8fafc';
      ctx.font = '23px monospace';
      ctx.fillText('1. Standard Next-Day Press (Ready Tomorrow 09:00) .......... $14.00', 40, 140);
      ctx.fillText('2. 1-Hour Express Coffee-Stain Removal (Takes 75m) ......... $28.50', 40, 190);
      ctx.fillText('3. Campus Haberdashery: Brand-New Oxford Dress Shirt ....... $68.00', 40, 240);

      if (ticket && !ticket.collected) {
        const readyH = Math.floor(ticket.readyMinutes / 60)
          .toString()
          .padStart(2, '0');
        const readyM = (ticket.readyMinutes % 60).toString().padStart(2, '0');
        const isReadyNow =
          state.dayIndex > ticket.readyDayIndex ||
          (state.dayIndex === ticket.readyDayIndex && mins >= ticket.readyMinutes);
        ctx.fillStyle = isReadyNow ? '#4ade80' : '#fde047';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(
          isReadyNow
            ? `★ TICKET #${ticket.ticketNumber}: SHIRT IS CLEAN & READY FOR PICKUP!`
            : `⏳ TICKET #${ticket.ticketNumber}: IN CLEANING MACHINE (Ready Day ${ticket.readyDayIndex + 1} at ${readyH}:${readyM})`,
          40,
          345
        );
      } else {
        ctx.fillStyle = state.shirtState === 'COFFEE_STAINED' ? '#fda4af' : '#94a3b8';
        ctx.font = 'bold 25px monospace';
        ctx.fillText(
          state.shirtState === 'COFFEE_STAINED'
            ? '⚠️ COFFEE-STAINED SHIRT DETECTED — Bring to Counter Before 14:30 Appt!'
            : 'All garments clean. Have a productive day at Peano Hall!',
          40,
          345
        );
      }
      rig.cleanerBoardTex.needsUpdate = true;
    }
  }

  // 9. Update Seminar Room 204 Schedule Board
  const semSig = `${state.dayName}_${Math.floor(mins / 15)}_${state.shirtState}`;
  if (semSig !== rig.lastSeminarSignature) {
    rig.lastSeminarSignature = semSig;
    const ctx = rig.seminarBoardCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#172554';
      ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, 992, 480);

      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 32px Georgia, serif';
      ctx.fillText(`SEMINAR ROOM 204 — ${state.dayName.toUpperCase()} SCHEDULE`, 40, 68);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '24px monospace';
      ctx.fillText('• 10:00 – 10:45  Grad Student Toby Consultation (in Room 4B)', 40, 145);
      ctx.fillText('• 14:30 – 15:15  MANDATORY: Prof. Bishop & Chairwoman Queen Review', 40, 200);
      ctx.fillText('                 (Chiral Quantum Lab Access & Grant Budget Audit)', 40, 238);
      ctx.fillStyle = state.shirtState === 'COFFEE_STAINED' ? '#fca5a5' : '#86efac';
      ctx.fillText(
        state.shirtState === 'COFFEE_STAINED'
          ? '⚠️ WARNING: Attending 14:30 Review in a coffee-stained shirt will offend Bishop!'
          : '✓ Dress Code Status: Acceptable for Departmental Review',
        40,
        320
      );
      rig.seminarBoardTex.needsUpdate = true;
    }
  }
}
