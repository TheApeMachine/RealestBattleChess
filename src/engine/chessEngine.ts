import { ARCHETYPES } from '../data/archetypes';
import { BoardCoord, ChessPiece, Faction, MoveOption, PieceType } from '../types/game';

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
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      meter: 20,
      kills: 0,
      hasMoved: false,
    });

    const pawnSpec = ARCHETYPES.p;
    pieces.push({
      id: `b_p_${col}`,
      type: 'p',
      faction: 'b',
      row: 1,
      col,
      hp: pawnSpec.maxHp,
      maxHp: pawnSpec.maxHp,
      meter: 25,
      kills: 0,
      hasMoved: false,
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
      hp: pawnSpec.maxHp,
      maxHp: pawnSpec.maxHp,
      meter: 25,
      kills: 0,
      hasMoved: false,
    });

    const type = backRank[col];
    const spec = ARCHETYPES[type];
    pieces.push({
      id: `w_${type}_${col}`,
      type,
      faction: 'w',
      row: 7,
      col,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      meter: 20,
      kills: 0,
      hasMoved: false,
    });
  }

  return pieces;
}

export function getPieceAt(pieces: ChessPiece[], row: number, col: number): ChessPiece | undefined {
  return pieces.find((p) => p.row === row && p.col === col);
}

export function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function getValidMovesForPiece(piece: ChessPiece, pieces: ChessPiece[]): MoveOption[] {
  const moves: MoveOption[] = [];
  const { row, col, faction, type } = piece;

  const addMoveIfValid = (r: number, c: number): boolean => {
    if (!isInsideBoard(r, c)) return false;
    const occupant = getPieceAt(pieces, r, c);
    if (!occupant) {
      moves.push({
        from: { row, col },
        to: { row: r, col: c },
        isCapture: false,
        isPromotion: type === 'p' && (r === 0 || r === 7),
      });
      return true; // Continue sliding
    } else if (occupant.faction !== faction) {
      moves.push({
        from: { row, col },
        to: { row: r, col: c },
        isCapture: true,
        targetPiece: occupant,
        isPromotion: type === 'p' && (r === 0 || r === 7),
      });
      return false; // Stop sliding
    }
    return false; // Blocked by friendly piece
  };

  if (type === 'p') {
    const dir = faction === 'w' ? -1 : 1;
    const startRow = faction === 'w' ? 6 : 1;

    // 1 step forward
    const nextRow = row + dir;
    if (isInsideBoard(nextRow, col) && !getPieceAt(pieces, nextRow, col)) {
      moves.push({
        from: { row, col },
        to: { row: nextRow, col },
        isCapture: false,
        isPromotion: nextRow === 0 || nextRow === 7,
      });

      // 2 steps forward from start
      const doubleRow = row + dir * 2;
      if (row === startRow && isInsideBoard(doubleRow, col) && !getPieceAt(pieces, doubleRow, col)) {
        moves.push({
          from: { row, col },
          to: { row: doubleRow, col },
          isCapture: false,
        });
      }
    }

    // Diagonal captures
    for (const dc of [-1, 1]) {
      const capCol = col + dc;
      if (isInsideBoard(nextRow, capCol)) {
        const target = getPieceAt(pieces, nextRow, capCol);
        if (target && target.faction !== faction) {
          moves.push({
            from: { row, col },
            to: { row: nextRow, col: capCol },
            isCapture: true,
            targetPiece: target,
            isPromotion: nextRow === 0 || nextRow === 7,
          });
        }
      }
    }
  } else if (type === 'n') {
    const jumps = [
      [-2, -1], [-2, 1],
      [-1, -2], [-1, 2],
      [1, -2], [1, 2],
      [2, -1], [2, 1],
    ];
    for (const [dr, dc] of jumps) {
      addMoveIfValid(row + dr, col + dc);
    }
  } else if (type === 'b' || type === 'r' || type === 'q') {
    const dirs: [number, number][] = [];
    if (type === 'b' || type === 'q') {
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    if (type === 'r' || type === 'q') {
      dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    }
    for (const [dr, dc] of dirs) {
      let r = row + dr;
      let c = col + dc;
      while (isInsideBoard(r, c)) {
        const cont = addMoveIfValid(r, c);
        if (!cont) break;
        r += dr;
        c += dc;
      }
    }
  } else if (type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        addMoveIfValid(row + dr, col + dc);
      }
    }
  }

  return moves;
}

export function chooseAIMove(pieces: ChessPiece[], aiFaction: Faction): { piece: ChessPiece; move: MoveOption } | null {
  const aiPieces = pieces.filter((p) => p.faction === aiFaction);
  const candidates: { piece: ChessPiece; move: MoveOption; score: number }[] = [];

  for (const piece of aiPieces) {
    const validMoves = getValidMovesForPiece(piece, pieces);
    for (const move of validMoves) {
      let score = Math.random() * 4;

      // Center control bonus
      const centerDist = Math.abs(3.5 - move.to.row) + Math.abs(3.5 - move.to.col);
      score += (7 - centerDist) * 1.2;

      // Advance bonus for pawns
      if (piece.type === 'p') {
        score += (aiFaction === 'b' ? move.to.row : 7 - move.to.row) * 1.5;
      }

      if (move.isCapture && move.targetPiece) {
        const targetSpec = ARCHETYPES[move.targetPiece.type];
        const attackerSpec = ARCHETYPES[piece.type];
        // Prioritize capturing high-value pieces or low-HP pieces
        const hpAdvantage = piece.hp / move.targetPiece.hp;
        score += targetSpec.tacticalValue * 12 * Math.min(1.6, hpAdvantage);
        // Exciting underdog attacks or boss clashes
        if (piece.type === 'p' && targetSpec.tacticalValue >= 5) {
          score += 18; // Brave pawn challenge!
        }
        if (attackerSpec.tacticalValue >= 5) {
          score += 10;
        }
      }

      candidates.push({ piece, move, score });
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
