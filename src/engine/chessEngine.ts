import { ARCHETYPES } from '../data/archetypes';
import {
  BoardCoord,
  ChessPiece,
  Faction,
  MoveOption,
  PieceType,
  UnseenThreatVector,
} from '../types/game';

export function createInitialBoard(): ChessPiece[] {
  const pieces: ChessPiece[] = [];
  const backRank: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  // Black pieces (Obsidian Dominion) at rows 0 and 1
  for (let col = 0; col < 8; col++) {
    const type = backRank[col];
    const spec = ARCHETYPES[type];
    pieces.push({
      id: `b_${type}_${col}`,
      type,
      faction: 'b',
      row: 0,
      col,
      z: 0,
      w: 0,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      meter: 25,
      kills: 0,
      hasMoved: false,
      history: [{ row: 0, col, z: 0, w: 0, turn: 1 }],
    });

    const pawnSpec = ARCHETYPES.p;
    pieces.push({
      id: `b_p_${col}`,
      type: 'p',
      faction: 'b',
      row: 1,
      col,
      z: 0,
      w: 0,
      hp: pawnSpec.maxHp,
      maxHp: pawnSpec.maxHp,
      meter: 30,
      kills: 0,
      hasMoved: false,
      history: [{ row: 1, col, z: 0, w: 0, turn: 1 }],
    });
  }

  // White pieces (Solaris Order) at rows 6 and 7
  for (let col = 0; col < 8; col++) {
    const pawnSpec = ARCHETYPES.p;
    pieces.push({
      id: `w_p_${col}`,
      type: 'p',
      faction: 'w',
      row: 6,
      col,
      z: 0,
      w: 0,
      hp: pawnSpec.maxHp,
      maxHp: pawnSpec.maxHp,
      meter: 30,
      kills: 0,
      hasMoved: false,
      history: [{ row: 6, col, z: 0, w: 0, turn: 1 }],
    });

    const type = backRank[col];
    const spec = ARCHETYPES[type];
    pieces.push({
      id: `w_${type}_${col}`,
      type,
      faction: 'w',
      row: 7,
      col,
      z: 0,
      w: 0,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      meter: 25,
      kills: 0,
      hasMoved: false,
      history: [{ row: 7, col, z: 0, w: 0, turn: 1 }],
    });
  }

  // Establish initial Royal Quantum Bell-State Entanglement (|Φ⁺⟩) between Queen & King of each order
  const wQ = pieces.find((p) => p.id === 'w_q_3');
  const wK = pieces.find((p) => p.id === 'w_k_4');
  if (wQ && wK) {
    wQ.entangledWithId = wK.id;
    wK.entangledWithId = wQ.id;
  }
  const bQ = pieces.find((p) => p.id === 'b_q_3');
  const bK = pieces.find((p) => p.id === 'b_k_4');
  if (bQ && bK) {
    bQ.entangledWithId = bK.id;
    bK.entangledWithId = bQ.id;
  }

  return pieces;
}

export function getPieceAt(
  pieces: ChessPiece[],
  row: number,
  col: number,
  z: number = 0,
  w: number = 0
): ChessPiece | undefined {
  return pieces.find((p) => p.row === row && p.col === col && p.z === z && p.w === w);
}

// Find any piece at (row, col) across ANY (z, w) slice, prioritizing the active slice
export function getPieceAtProjected(
  pieces: ChessPiece[],
  row: number,
  col: number,
  activeZ: number,
  activeW: number
): ChessPiece | undefined {
  const exact = getPieceAt(pieces, row, col, activeZ, activeW);
  if (exact) return exact;
  return pieces.find((p) => p.row === row && p.col === col);
}

export function isInsideBoard(row: number, col: number, z: number = 0, w: number = 0): boolean {
  return (
    row >= 0 &&
    row < 8 &&
    col >= 0 &&
    col < 8 &&
    z >= 0 &&
    z <= 1 &&
    w >= -1 &&
    w <= 1
  );
}

export function formatWName(w: number): string {
  if (w < 0) return 'Kata (-W)';
  if (w > 0) return 'Ana (+W)';
  return 'Prime (W=0)';
}

export function formatZName(z: number): string {
  return z === 0 ? 'Ground (Z=0)' : 'Astral (Z=1)';
}

/**
 * Generates both standard 3D slice moves AND true 4D Hypercube + Temporal Intercept moves!
 * targetSliceW / targetSliceZ lets the player project moves into a chosen 4D slice,
 * or attack pieces hidden in adjacent 4D slices!
 */
export function getValidMovesForPiece(
  piece: ChessPiece,
  pieces: ChessPiece[],
  targetSliceZ: number = piece.z,
  targetSliceW: number = piece.w
): MoveOption[] {
  const moves: MoveOption[] = [];
  const { row, col, z, w, faction, type } = piece;

  const addMoveIfValid = (
    r: number,
    c: number,
    tz: number,
    tw: number,
    customLabel?: string
  ): boolean => {
    if (!isInsideBoard(r, c, tz, tw)) return false;
    const isCrossSlice = tz !== z || tw !== w;
    const occupant = getPieceAt(pieces, r, c, tz, tw);

    if (!occupant) {
      moves.push({
        from: { row, col, z, w },
        to: { row: r, col: c, z: tz, w: tw },
        isCapture: false,
        isPromotion: type === 'p' && (r === 0 || r === 7),
        dimensionType: isCrossSlice ? '4D_HYPER_SHIFT' : '3D_SLICE',
        dimensionLabel:
          customLabel ||
          (isCrossSlice
            ? `4D Phase Shift → ${formatWName(tw)} · ${formatZName(tz)}`
            : undefined),
      });
      return true;
    } else if (occupant.faction !== faction) {
      moves.push({
        from: { row, col, z, w },
        to: { row: r, col: c, z: tz, w: tw },
        isCapture: true,
        targetPiece: occupant,
        isPromotion: type === 'p' && (r === 0 || r === 7),
        dimensionType: isCrossSlice ? '4D_CROSS_SLICE_STRIKE' : '3D_SLICE',
        dimensionLabel:
          customLabel ||
          (isCrossSlice
            ? `4D Cross-Dimensional Ambush (${formatWName(w)} → ${formatWName(tw)})`
            : undefined),
      });
      return false;
    }
    return false;
  };

  // 1. Standard moves within the piece's own (z, w) slice OR projected into (targetSliceZ, targetSliceW)
  const sliceDelta = Math.abs(targetSliceZ - z) + Math.abs(targetSliceW - w);

  if (type === 'p') {
    const dir = faction === 'w' ? -1 : 1;
    const startRow = faction === 'w' ? 6 : 1;
    const nextRow = row + dir;

    // Standard 1-step forward (in own slice or 1 step into W/Z)
    if (sliceDelta <= 1) {
      if (isInsideBoard(nextRow, col, targetSliceZ, targetSliceW) && !getPieceAt(pieces, nextRow, col, targetSliceZ, targetSliceW)) {
        addMoveIfValid(
          nextRow,
          col,
          targetSliceZ,
          targetSliceW,
          sliceDelta > 0 ? `4D Vanguard Step (${formatWName(targetSliceW)})` : undefined
        );

        const doubleRow = row + dir * 2;
        if (
          sliceDelta === 0 &&
          row === startRow &&
          isInsideBoard(doubleRow, col, z, w) &&
          !getPieceAt(pieces, doubleRow, col, z, w)
        ) {
          addMoveIfValid(doubleRow, col, z, w);
        }
      }
    }

    // Diagonal captures (across X/Y and also across W/Z adjacent slices!)
    for (const tw of [w - 1, w, w + 1]) {
      for (const tz of [z - 1, z, z + 1]) {
        if (!isInsideBoard(nextRow, col, tz, tw)) continue;
        if (Math.abs(tw - w) + Math.abs(tz - z) > 1) continue;
        for (const dc of [-1, 1]) {
          const capCol = col + dc;
          if (isInsideBoard(nextRow, capCol, tz, tw)) {
            const target = getPieceAt(pieces, nextRow, capCol, tz, tw);
            if (target && target.faction !== faction) {
              addMoveIfValid(
                nextRow,
                capCol,
                tz,
                tw,
                tw !== w || tz !== z
                  ? `4D Diagonal Hyper-Capture (${formatWName(tw)})`
                  : undefined
              );
            }
          }
        }
      }
    }
  } else if (type === 'n') {
    // 2D L-jumps in current or adjacent W/Z slice
    const jumps = [
      [-2, -1], [-2, 1],
      [-1, -2], [-1, 2],
      [1, -2], [1, 2],
      [2, -1], [2, 1],
    ];
    for (const [dr, dc] of jumps) {
      addMoveIfValid(row + dr, col + dc, targetSliceZ, targetSliceW);
      // Also check captures in any adjacent W/Z slice!
      for (const tw of [-1, 0, 1]) {
        for (const tz of [0, 1]) {
          if (tw === targetSliceW && tz === targetSliceZ) continue;
          if (Math.abs(tw - w) + Math.abs(tz - z) <= 1) {
            const occ = getPieceAt(pieces, row + dr, col + dc, tz, tw);
            if (occ && occ.faction !== faction) {
              addMoveIfValid(
                row + dr,
                col + dc,
                tz,
                tw,
                `4D L-Jump across (${dr},${dc},ΔW=${tw - w})`
              );
            }
          }
        }
      }
    }
    // Pure 4D L-jump: 2 steps in X or Y, 1 step in W or Z!
    if (targetSliceW !== w || targetSliceZ !== z) {
      for (const [dr, dc] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
        addMoveIfValid(
          row + dr,
          col + dc,
          targetSliceZ,
          targetSliceW,
          `4D Hyper-Knight Jump (2 Space + 1 ${formatWName(targetSliceW)})`
        );
      }
    }
  } else if (type === 'b' || type === 'r' || type === 'q') {
    const dirs: [number, number][] = [];
    if (type === 'b' || type === 'q') {
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    if (type === 'r' || type === 'q') {
      dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    }

    // Standard rays in (targetSliceZ, targetSliceW)
    for (const [dr, dc] of dirs) {
      let r = row + dr;
      let c = col + dc;
      while (isInsideBoard(r, c, targetSliceZ, targetSliceW)) {
        const cont = addMoveIfValid(
          r,
          c,
          targetSliceZ,
          targetSliceW,
          targetSliceW !== w || targetSliceZ !== z
            ? `4D Multidimensional Ray → ${formatWName(targetSliceW)}`
            : undefined
        );
        if (!cont) break;
        r += dr;
        c += dc;
      }
    }

    // Pure 4th-Dimensional Orthogonal Shift for Rook & Queen (same X, Y, different W or Z!)
    if ((type === 'r' || type === 'q') && (targetSliceW !== w || targetSliceZ !== z)) {
      addMoveIfValid(
        row,
        col,
        targetSliceZ,
        targetSliceW,
        `Pure 4D Orthogonal Teleport (${formatWName(w)} → ${formatWName(targetSliceW)})`
      );
    }

    // Cross-Slice 4D Ray Captures: Can this Bishop/Rook/Queen strike an enemy piece sitting in ANOTHER (z, w) slice?
    for (const enemy of pieces) {
      if (enemy.faction === faction) continue;
      if (enemy.w === targetSliceW && enemy.z === targetSliceZ) continue;
      const dr = enemy.row - row;
      const dc = enemy.col - col;
      const dw = enemy.w - w;
      const dz = enemy.z - z;
      const stepDist = Math.max(Math.abs(dr), Math.abs(dc));

      if (type === 'r' && (dr === 0 || dc === 0) && stepDist <= 6 && Math.abs(dw) + Math.abs(dz) === 1) {
        addMoveIfValid(
          enemy.row,
          enemy.col,
          enemy.z,
          enemy.w,
          `4D Rook Orthogonal Strike into ${formatWName(enemy.w)}`
        );
      } else if (type === 'b' && Math.abs(dr) === Math.abs(dc) && stepDist > 0 && Math.abs(dw) + Math.abs(dz) === 1) {
        addMoveIfValid(
          enemy.row,
          enemy.col,
          enemy.z,
          enemy.w,
          `4D Bishop Diagonal Strike into ${formatWName(enemy.w)}`
        );
      } else if (
        type === 'q' &&
        (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) &&
        Math.abs(dw) + Math.abs(dz) === 1
      ) {
        addMoveIfValid(
          enemy.row,
          enemy.col,
          enemy.z,
          enemy.w,
          `4D Queen Hyper-Strike into ${formatWName(enemy.w)}`
        );
      }
    }
  } else if (type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0 && targetSliceZ === z && targetSliceW === w) continue;
        addMoveIfValid(row + dr, col + dc, targetSliceZ, targetSliceW);
      }
    }
  }

  // 2. TEMPORAL CAUSALITY INTERCEPT: Check if any enemy piece's PAST coordinate (from 1-2 turns ago) can be intercepted!
  for (const enemy of pieces) {
    if (enemy.faction === faction || enemy.history.length < 2) continue;
    // Look at the enemy's previous spacetime waypoint (1 turn ago)
    const pastWaypoint = enemy.history[enemy.history.length - 2];
    if (pastWaypoint.row === enemy.row && pastWaypoint.col === enemy.col) continue;

    // If our piece is adjacent to that past coordinate, we can launch a Temporal Intercept Duel!
    const distToPast = Math.hypot(pastWaypoint.row - row, pastWaypoint.col - col);
    if (distToPast <= 1.5 && !getPieceAt(pieces, pastWaypoint.row, pastWaypoint.col, z, w)) {
      moves.push({
        from: { row, col, z, w },
        to: { row: pastWaypoint.row, col: pastWaypoint.col, z: pastWaypoint.z, w: pastWaypoint.w },
        isCapture: true,
        targetPiece: enemy,
        dimensionType: 'TEMPORAL_INTERCEPT',
        dimensionLabel: `Chrono-Intercept: Strike ${ARCHETYPES[enemy.type].chessName}'s Past Echo at ${formatSquareName(pastWaypoint)}!`,
      });
    }
  }

  return moves;
}

/**
 * Computes all squares on the currently viewed 3D slice (activeZ, activeW)
 * that are threatened from UNSEEN 4th-dimensional directions (pieces with w != activeW or z != activeZ)!
 */
export function computeUnseen4DThreats(
  pieces: ChessPiece[],
  activeZ: number,
  activeW: number,
  friendlyFaction: Faction
): UnseenThreatVector[] {
  const threats: UnseenThreatVector[] = [];

  for (const enemy of pieces) {
    if (enemy.faction === friendlyFaction) continue;
    // Only consider pieces lurking outside the currently viewed 3D slice!
    if (enemy.z === activeZ && enemy.w === activeW) continue;

    const dw = Math.abs(enemy.w - activeW);
    const dz = Math.abs(enemy.z - activeZ);
    if (dw + dz > 1) continue; // Adjacent 4D fold threats

    const axisDesc = `From ${formatWName(enemy.w)} · ${formatZName(enemy.z)}`;

    // Project their 4D attack rays onto the current (activeZ, activeW) board!
    if (enemy.type === 'r' || enemy.type === 'q') {
      // Pure 4D orthogonal threat on the exact same (row, col)!
      threats.push({
        attacker: enemy,
        targetRow: enemy.row,
        targetCol: enemy.col,
        targetZ: activeZ,
        targetW: activeW,
        axisDescription: `${ARCHETYPES[enemy.type].chessName} projects straight through ${axisDesc}`,
      });
    }

    if (enemy.type === 'b' || enemy.type === 'q') {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const r = enemy.row + dr;
        const c = enemy.col + dc;
        if (isInsideBoard(r, c, activeZ, activeW)) {
          threats.push({
            attacker: enemy,
            targetRow: r,
            targetCol: c,
            targetZ: activeZ,
            targetW: activeW,
            axisDescription: `${ARCHETYPES[enemy.type].chessName} projects 4D Diagonal ${axisDesc}`,
          });
        }
      }
    }

    if (enemy.type === 'n') {
      for (const [dr, dc] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
        const r = enemy.row + dr;
        const c = enemy.col + dc;
        if (isInsideBoard(r, c, activeZ, activeW)) {
          threats.push({
            attacker: enemy,
            targetRow: r,
            targetCol: c,
            targetZ: activeZ,
            targetW: activeW,
            axisDescription: `Knight 4D L-Leap Threat ${axisDesc}`,
          });
        }
      }
    }
  }

  return threats;
}

export function chooseAIMove(pieces: ChessPiece[], aiFaction: Faction): { piece: ChessPiece; move: MoveOption } | null {
  const aiPieces = pieces.filter((p) => p.faction === aiFaction);
  const candidates: { piece: ChessPiece; move: MoveOption; score: number }[] = [];

  for (const piece of aiPieces) {
    // AI considers both its current slice AND occasionally shifting into Ana (+1) or Kata (-1)!
    const targetWOptions = Math.random() < 0.3 ? [piece.w, piece.w === 0 ? 1 : 0] : [piece.w];
    for (const tw of targetWOptions) {
      const validMoves = getValidMovesForPiece(piece, pieces, piece.z, tw);
      for (const move of validMoves) {
        let score = Math.random() * 4;

        const centerDist = Math.abs(3.5 - move.to.row) + Math.abs(3.5 - move.to.col);
        score += (7 - centerDist) * 1.2;

        if (piece.type === 'p') {
          score += (aiFaction === 'b' ? move.to.row : 7 - move.to.row) * 1.5;
        }

        if (move.dimensionType === '4D_HYPER_SHIFT') {
          score += 5; // AI occasionally hides a Rook/Bishop/Knight in the 4th dimension!
        }

        if (move.isCapture && move.targetPiece) {
          const targetSpec = ARCHETYPES[move.targetPiece.type];
          const attackerSpec = ARCHETYPES[piece.type];
          const hpAdvantage = piece.hp / move.targetPiece.hp;
          score += targetSpec.tacticalValue * 12 * Math.min(1.6, hpAdvantage);
          if (move.dimensionType === '4D_CROSS_SLICE_STRIKE' || move.dimensionType === 'TEMPORAL_INTERCEPT') {
            score += 16; // AI loves dramatic 4D ambushes!
          }
          if (piece.type === 'p' && targetSpec.tacticalValue >= 5) {
            score += 18;
          }
          if (attackerSpec.tacticalValue >= 5) {
            score += 10;
          }
        }

        candidates.push({ piece, move, score });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { piece: candidates[0].piece, move: candidates[0].move };
}

export function formatSquareName(coord: BoardCoord): string {
  const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  return `${files[coord.col]}${8 - coord.row}`;
}
