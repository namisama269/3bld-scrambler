// Helpers for transforming a dlin tracer output into the execution-order
// target list a solver would memorize, plus the misoriented-piece list.
//
// Orientation conventions (verified against public/scramble/dlin.js — see
// cornerCycleOri / findTwists / edgeCycleOri):
//
//   Edges (orientation ∈ {0, 1}):
//     0 → piece, 1 → swap the two letters (e.g. "UB" → "BU").
//
//   Corners (orientation ∈ {-1, 0, +1}):
//     0 → piece.
//     For "special corners" (the tetrahedron UFR, UBL, DBR, DFL):
//       +1 → left-rotate 1   (e.g. UFR → FRU)
//       -1 → left-rotate 2   (e.g. UFR → RUF)
//     For non-special corners (UFL, UBR, DFR, DBL):
//       +1 → left-rotate 2   (e.g. DFR → RDF)
//       -1 → left-rotate 1   (e.g. DFR → FRD)
//
//   dlin's ±1 sign does NOT correspond uniformly to physical CW/CCW because
//   the special-corner sign flip exists. Callers whose tables are organized
//   "clockwise = +1" will line up with dlin for non-special corners and be
//   inverted for special ones — convert when consuming this output.

import { BUFFERS } from './loadDlin.js';

const SPECIAL_CORNER_KEYS = new Set(
    ['UFR', 'UBL', 'DBR', 'DFL'].map((p) => p.split('').sort().join('')),
);

export function isSpecialCorner(piece) {
    return SPECIAL_CORNER_KEYS.has(piece.split('').sort().join(''));
}

function leftRotate(s, k) {
    const n = s.length;
    const m = ((k % n) + n) % n;
    return s.slice(m) + s.slice(0, m);
}

export function rotateForOrientation(piece, ori, pieceType) {
    if (ori === 0) return piece;
    if (pieceType === 'edge') {
        if (ori !== 1) throw new Error(`Unexpected edge orientation: ${ori}`);
        return piece[1] + piece[0];
    }
    if (pieceType === 'corner') {
        const special = isSpecialCorner(piece);
        let k;
        if (ori === 1) k = special ? 1 : 2;
        else if (ori === -1) k = special ? 2 : 1;
        else throw new Error(`Unexpected corner orientation: ${ori}`);
        return leftRotate(piece, k);
    }
    throw new Error(`Unknown pieceType: ${pieceType}`);
}

// Build the execution-order target list from a side of a dlin trace.
//
//   1. Append the main-buffer cycle's targets (no buffer prefix, no closing).
//   2. Sort the remaining cycle entries by:
//        - total cycle length (targets.length + 2) descending
//        - then buffer position in BUFFERS[pieceType] ascending
//   3. For each remaining cycle, append:
//        cycle.buffer, ...cycle.targets, rotateForOrientation(buffer, ori, pieceType)
//
// The output may be odd-length — that's the parity indicator and is left
// as-is rather than padded.
export function getTargets(cycles, mainBuffer, pieceType) {
    const result = [];

    const main = cycles.find((c) => c.type === 'cycle' && c.buffer === mainBuffer);
    if (main) result.push(...main.targets);

    const order = BUFFERS[pieceType] || [];
    const remaining = cycles
        .filter((c) => c.type === 'cycle' && c.buffer !== mainBuffer && c.targets.length > 0)
        .map((c) => ({ cycle: c, length: c.targets.length + 2 }))
        .sort((a, b) => {
            if (b.length !== a.length) return b.length - a.length;
            return order.indexOf(a.cycle.buffer) - order.indexOf(b.cycle.buffer);
        });

    for (const { cycle } of remaining) {
        result.push(cycle.buffer);
        result.push(...cycle.targets);
        result.push(rotateForOrientation(cycle.buffer, cycle.orientation, pieceType));
    }

    return result;
}

// Misoriented-in-place pieces (twisted corners or flipped edges). Returns the
// raw dlin orientation value alongside the location so callers can apply
// their own chirality convention if needed.
export function getMisoriented(cycles) {
    return cycles
        .filter((c) => c.type === 'misoriented')
        .map((c) => ({ piece: c.buffer, orientation: c.orientation }));
}
