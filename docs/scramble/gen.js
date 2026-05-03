const CORNERS = [
    ["UFR", "RUF", "FUR"],
    ["UFL", "FUL", "LUF"],
    ["UBR", "BUR", "RUB"],
    ["UBL", "LUB", "BUL"],
    ["DFR", "FDR", "RDF"],
    ["DFL", "LDF", "FDL"],
    ["DBR", "RDB", "BDR"],
    ["DBL", "BDL", "LDB"],
]

const EDGES = [
    ["UF", "FU"],
    ["UB", "BU"],
    ["UR", "RU"],
    ["UL", "LU"],
    ["FR", "RF"],
    ["FL", "LF"],
    ["DF", "FD"],
    ["DB", "BD"],
    ["DR", "RD"],
    ["DL", "LD"],
    ["BR", "RB"],
    ["BL", "LB"],
]

const ORIENTATION_OPTIONS = {
    "wg": "White (top) - Green (front)",
    "wr": "White (top) - Red (front)",
    "wb": "White (top) - Blue (front)",
    "wo": "White (top) - Orange (front)",
    "yg": "Yellow (top) - Green (front)",
    "yr": "Yellow (top) - Red (front)",
    "yb": "Yellow (top) - Blue (front)",
    "yo": "Yellow (top) - Orange (front)",
    "ob": "Orange (top) - Blue (front)",
    "ow": "Orange (top) - White (front)",
    "oy": "Orange (top) - Yellow (front)",
    "og": "Orange (top) - Green (front)",
    "rb": "Red (top) - Blue (front)",
    "rw": "Red (top) - White (front)",
    "ry": "Red (top) - Yellow (front)",
    "rg": "Red (top) - Green (front)",
    "go": "Green (top) - Orange (front)",
    "gy": "Green (top) - Yellow (front)",
    "gw": "Green (top) - White (front)",
    "gr": "Green (top) - Red (front)",
    "bo": "Blue (top) - Orange (front)",
    "by": "Blue (top) - Yellow (front)",
    "bw": "Blue (top) - White (front)",
    "br": "Blue (top) - Red (front)"
};

const ORIENTATION_MOVES = {
    "wg": "",
    "wr": "y",
    "wb": "y2",
    "wo": "y'",
    "yg": "z2",
    "yr": "x2 y",
    "yb": "x2",
    "yo": "x2 y'",
    "ob": "z y2",
    "ow": "z y",
    "oy": "z y'",
    "og": "z",
    "rb": "z' y2",
    "rw": "z' y'",
    "ry": "z' y",
    "rg": "z'",
    "go": "x y'",
    "gy": "x",
    "gw": "x y2",
    "gr": "x y",
    "bo": "x' y'",
    "by": "x' y2",
    "bw": "x'",
    "br": "x' y"
};

// Cube string format: 54 chars - U(0-8), R(9-17), F(18-26), D(27-35), L(36-44), B(45-53)
const SOLVED_CUBE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

// Corner facelet indices in cube string (8 corners, 3 stickers each)
// Order: URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB
const CORNER_FACELET_INDICES = [
    [8, 9, 20],    // URF: U9, R1, F3
    [6, 18, 38],   // UFL: U7, F1, L3
    [0, 36, 47],   // ULB: U1, L1, B3
    [2, 45, 11],   // UBR: U3, B1, R3
    [29, 26, 15],  // DFR: D3, F9, R7
    [27, 44, 24],  // DLF: D1, L9, F7
    [33, 53, 42],  // DBL: D7, B9, L7
    [35, 17, 51]   // DRB: D9, R9, B7
];

// Edge facelet indices in cube string (12 edges, 2 stickers each)
// Order: UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR
const EDGE_FACELET_INDICES = [
    [5, 10],   // UR: U6, R2
    [7, 19],   // UF: U8, F2
    [3, 37],   // UL: U4, L2
    [1, 46],   // UB: U2, B2
    [32, 16],  // DR: D6, R8
    [28, 25],  // DF: D2, F8
    [30, 43],  // DL: D4, L8
    [34, 52],  // DB: D8, B8
    [23, 12],  // FR: F6, R4
    [21, 41],  // FL: F4, L6
    [50, 39],  // BL: B6, L4
    [48, 14]   // BR: B4, R6
];

// Flat arrays for easy iteration
const ALL_CORNER_INDICES = CORNER_FACELET_INDICES.flat();
const ALL_EDGE_INDICES = EDGE_FACELET_INDICES.flat();

function getPiece(target) {
    if (target.length == 3) {
        for (let i = 0; i < CORNERS.length; ++i) {
            if (CORNERS[i].includes(target)) {
                return CORNERS[i];
            }
        }
    }
    else {
        for (let i = 0; i < EDGES.length; ++i) {
            if (EDGES[i].includes(target)) {
                return EDGES[i];
            }
        }
    }

    return [];
}

// For each piece index in `indices`, pick a random orientation and emit the
// corresponding sticker name. Used to convert a list of leftover/unused
// pieces into a sequence of targets for the engine's J-perm loop.
function randomTargetsForPieces(indices, isCorner) {
    const PIECES = isCorner ? CORNERS : EDGES;
    const numOrientations = isCorner ? 3 : 2;
    const targets = [];
    for (const i of indices) {
        const ori = Math.floor(Math.random() * numOrientations);
        targets.push(PIECES[i][ori]);
    }
    return targets;
}

function generateCycleBase(pieces, firstTarget, orientationNumber, appendCycleBreak) {
    const isCorner = firstTarget.length == 3;
    const PIECES = isCorner ? CORNERS : EDGES;
    const numOrientations = isCorner ? 3 : 2;

    // Find the piece containing firstTarget and remove it from pieces
    const firstTargetPiece = getPiece(firstTarget);
    const firstTargetPieceIndex = PIECES.indexOf(firstTargetPiece);
    pieces = pieces.filter(i => i !== firstTargetPieceIndex);

    // Shuffle remaining pieces
    pieces = shuffleArray(pieces);

    // Start targets with firstTarget
    let targets = [firstTarget];

    // Calculate the forced orientation index
    const firstTargetOriIndex = firstTargetPiece.indexOf(firstTarget);
    const forcedOriIndex = (firstTargetOriIndex + orientationNumber) % numOrientations;

    if (appendCycleBreak) {
        // generateIsolatedCycle: all remaining pieces get random orientations
        for (let i = 0; i < pieces.length; i++) {
            let ori = Math.floor(Math.random() * numOrientations);
            targets.push(PIECES[pieces[i]][ori]);
        }
        // Append cycle-break: twisted sticker of firstTarget's piece
        targets.push(firstTargetPiece[forcedOriIndex]);
    } else {
        // generateMainCycle: all but last get random, last is forced
        for (let i = 0; i < pieces.length - 1; i++) {
            let ori = Math.floor(Math.random() * numOrientations);
            targets.push(PIECES[pieces[i]][ori]);
        }
        // Force last piece to calculated orientation
        if (pieces.length > 0) {
            targets.push(PIECES[pieces[pieces.length - 1]][forcedOriIndex]);
        }
    }

    return targets;
}

function generateIsolatedCycle(pieces, firstTarget, orientationNumber) {
    return generateCycleBase(pieces, firstTarget, orientationNumber, true);
}

function generateMainCycle(pieces, firstTarget, orientationNumber) {
    return generateCycleBase(pieces, firstTarget, orientationNumber, false);
}

// LTCT 2: piece-based selection (U/D stickers), random twist orientation from piece,
// cycle starts with parity piece and ends back at same sticker (isolated cycle)
// twist piece is completely excluded from the cycle
function generateLTCT2(parityPieceIndex, twistPieceIndex, count = 7) {
    // Randomly select a twist target from twistPiece (orientation 1 or 2, not U/D sticker)
    const twistOri = Math.floor(Math.random() * 2) + 1;
    const twist = CORNERS[twistPieceIndex][twistOri];

    // Pick a random sticker from the parity piece as the first target
    const firstTargetOri = Math.floor(Math.random() * 3);
    const firstTarget = CORNERS[parityPieceIndex][firstTargetOri];

    if (count < 7) {
        return buildOpenChainLTCT(parityPieceIndex, twistPieceIndex, firstTarget, twist, count);
    }

    // Get remaining 6 pieces (exclude UFR index 0 and twistPiece)
    let remainingPieces = [];
    for (let i = 0; i < CORNERS.length; i++) {
        if (i !== 0 && i !== twistPieceIndex) {
            remainingPieces.push(i);
        }
    }

    // Select random number of extra pieces (1-5)
    const numExtraPieces = Math.floor(Math.random() * 5) + 1;

    // Shuffle and take numExtraPieces (excluding parityPiece for now)
    let otherPieces = remainingPieces.filter(i => i !== parityPieceIndex);
    otherPieces = shuffleArray(otherPieces);
    const selectedOtherPieces = otherPieces.slice(0, numExtraPieces);

    // Create subset with parityPiece + selected other pieces (for the cycle)
    const subsetPieces = [parityPieceIndex, ...selectedOtherPieces];

    // Random orientation for cycle-break (0, 1, or 2)
    const orientationNumber = Math.floor(Math.random() * 3);

    // Generate isolated cycle starting with parity piece sticker
    const targets = generateIsolatedCycle(subsetPieces, firstTarget, orientationNumber);

    // Get remaining pieces (exclude UFR, twistPiece, and pieces used in cycle)
    const usedPieceIndices = new Set([0, twistPieceIndex, ...subsetPieces]);
    let finalRemainingPieces = [];
    for (let i = 0; i < CORNERS.length; i++) {
        if (!usedPieceIndices.has(i)) {
            finalRemainingPieces.push(i);
        }
    }
    // Generate random targets for remaining pieces
    const remainingTargets = [];
    for (let i of finalRemainingPieces) {
        const ori = Math.floor(Math.random() * 3);
        remainingTargets.push(CORNERS[i][ori]);
    }

    return { twist, targets, remainingTargets, leftoverPieces: [] };
}

// New: specific twist target, specific parity target, orientation 0 for cycle-break
function generateLTCT(parityTarget, twistTarget, count = 7) {
    const twist = twistTarget;
    const twistPieceIndex = CORNERS.findIndex(piece => piece.includes(twistTarget));
    const parityPieceIndex = CORNERS.findIndex(piece => piece.includes(parityTarget));

    if (count < 7) {
        return buildOpenChainLTCT(parityPieceIndex, twistPieceIndex, parityTarget, twist, count);
    }

    // Get remaining 6 pieces (exclude UFR index 0 and twistPiece)
    let remainingPieces = [];
    for (let i = 0; i < CORNERS.length; i++) {
        if (i !== 0 && i !== twistPieceIndex) {
            remainingPieces.push(i);
        }
    }

    // Select random number of extra pieces (1-5)
    const numExtraPieces = Math.floor(Math.random() * 5) + 1;

    // Shuffle and take numExtraPieces (excluding parityPiece for now)
    let otherPieces = remainingPieces.filter(i => i !== parityPieceIndex);
    otherPieces = shuffleArray(otherPieces);
    const selectedOtherPieces = otherPieces.slice(0, numExtraPieces);

    // Create subset with parityPiece + selected other pieces
    const subsetPieces = [parityPieceIndex, ...selectedOtherPieces];

    // Use the specific parity target as firstTarget
    const firstTarget = parityTarget;

    // Orientation 0 for cycle-break (ends at same sticker orientation as started)
    const orientationNumber = 0;

    // Generate isolated cycle
    const targets = generateIsolatedCycle(subsetPieces, firstTarget, orientationNumber);

    // Get remaining pieces (exclude UFR, twistPiece, and pieces used in cycle)
    const usedPieceIndices = new Set([0, twistPieceIndex, ...subsetPieces]);
    let finalRemainingPieces = [];
    for (let i = 0; i < CORNERS.length; i++) {
        if (!usedPieceIndices.has(i)) {
            finalRemainingPieces.push(i);
        }
    }
    // Generate random targets for remaining pieces
    const remainingTargets = [];
    for (let i of finalRemainingPieces) {
        const ori = Math.floor(Math.random() * 3);
        remainingTargets.push(CORNERS[i][ori]);
    }

    return { twist, targets, remainingTargets, leftoverPieces: [] };
}

// Open-chain LTCT for counts 1/3/5: parity target + (count-1) random stickers on
// distinct other pieces. Leftover pieces are untouched (no cycle-break, no remaining cycle).
function buildOpenChainLTCT(parityPieceIndex, twistPieceIndex, firstTarget, twist, count) {
    const numExtras = count - 1;

    // Pool of pieces eligible to be "extras" (exclude buffer, twist piece, parity piece)
    let pool = [];
    for (let i = 0; i < CORNERS.length; i++) {
        if (i !== 0 && i !== twistPieceIndex && i !== parityPieceIndex) {
            pool.push(i);
        }
    }

    pool = shuffleArray(pool);
    const selectedExtras = pool.slice(0, numExtras);

    const targets = [firstTarget];
    for (const pieceIdx of selectedExtras) {
        const ori = Math.floor(Math.random() * 3);
        targets.push(CORNERS[pieceIdx][ori]);
    }

    const usedPieceIndices = new Set([0, twistPieceIndex, parityPieceIndex, ...selectedExtras]);
    const leftoverPieces = [];
    for (let i = 0; i < CORNERS.length; i++) {
        if (!usedPieceIndices.has(i)) {
            leftoverPieces.push(i);
        }
    }

    return { twist, targets, remainingTargets: [], leftoverPieces };
}

// 2C: Two targets to start, then isolated cycle with remaining pieces
// Inputs: firstPieceIndex - the piece to start from
//         availableSecondPieceIndices - optional array of allowed second piece indices
//         forceIdenticalThirdTarget - if true, thirdTarget = firstTarget (Floating 2C)
function generate2C(firstPieceIndex, availableSecondPieceIndices, forceIdenticalThirdTarget = false) {
    // Start with all pieces except UFR (index 0)
    let pieces = [1, 2, 3, 4, 5, 6, 7];

    // Remove firstPiece from the list
    pieces = pieces.filter(i => i !== firstPieceIndex);

    // Randomly select firstTarget from firstPiece
    const firstTargetOri = Math.floor(Math.random() * 3);
    const firstTarget = CORNERS[firstPieceIndex][firstTargetOri];

    // thirdTarget: same sticker (Floating 2C) or different sticker (T2C)
    let thirdTarget;
    if (forceIdenticalThirdTarget) {
        thirdTarget = firstTarget;
    } else {
        const otherOrientations = [0, 1, 2].filter(o => o !== firstTargetOri);
        const thirdTargetOri = otherOrientations[Math.floor(Math.random() * 2)];
        thirdTarget = CORNERS[firstPieceIndex][thirdTargetOri];
    }

    // Randomly select secondPiece from available options and remove it
    const secondPieceOptions = availableSecondPieceIndices && availableSecondPieceIndices.length > 0
        ? availableSecondPieceIndices.filter(i => pieces.includes(i))
        : pieces;
    const secondPieceIndex = secondPieceOptions[Math.floor(Math.random() * secondPieceOptions.length)];
    pieces = pieces.filter(i => i !== secondPieceIndex);
    const secondTargetOri = Math.floor(Math.random() * 3);
    const secondTarget = CORNERS[secondPieceIndex][secondTargetOri];

    // Now pieces has 5 remaining. Select 3-5 for the cycle.
    const numCyclePieces = Math.floor(Math.random() * 3) + 3;
    pieces = shuffleArray(pieces);
    const cyclePieces = pieces.slice(0, numCyclePieces);
    const leftoverPieces = pieces.slice(numCyclePieces);

    // Generate isolated cycle
    const cycleFirstTargetOri = Math.floor(Math.random() * 3);
    const cycleFirstTarget = CORNERS[cyclePieces[0]][cycleFirstTargetOri];
    const orientationNumber = Math.floor(Math.random() * 3);
    const cycleTargets = generateIsolatedCycle(cyclePieces, cycleFirstTarget, orientationNumber);

    // Generate random targets for leftover pieces
    const remainingTargets = [];
    for (let i of leftoverPieces) {
        const ori = Math.floor(Math.random() * 3);
        remainingTargets.push(CORNERS[i][ori]);
    }

    return { firstTarget, secondTarget, thirdTarget, cycleTargets, remainingTargets };
}

// Twist extras: extra targets applied AFTER the twist alg.
// Each target is applied as a single generateParityAlg(...) call.
// Composing N such calls with N distinct pieces produces a clean (N+1)-cycle on
// corners (UFR + N pieces) plus N copies of UF↔UR edge swap (cancels if N even,
// leftover if N odd). So extras are just N distinct random pieces with a random
// sticker per piece — no isolated cycle / cycle-break / main-cycle structure needed.
//
// Inputs: remainingPieceIndices - corner pieces not used by twist (and not buffer)
//         count - desired number of extra targets, 0..n+1 where n = remainingPieceIndices.length
// Returns: { prefixTargets, cycleTargets, leftoverPieceIndices }
//   For count <= n: prefixTargets empty; cycleTargets = `count` distinct-piece targets.
//   For count = n+1: 2-cycle split — 3 prefix targets touching 2 pieces (firstPiece
//   appears twice via two different stickers), then count-3 = n-2 distinct-piece targets.
function generateTwistExtras(remainingPieceIndices, count) {
    const n = remainingPieceIndices.length;
    const result = { prefixTargets: [], cycleTargets: [], leftoverPieceIndices: [...remainingPieceIndices] };

    if (count <= 0) return result;
    if (count > n + 1) return result;

    if (count === n + 1) {
        // 2-cycle split: 3 prefix targets on 2 pieces (T2C-style),
        // then n-2 distinct-piece targets. Total = 3 + (n-2) = n+1.
        const shuffled = shuffleArray([...remainingPieceIndices]);
        const firstPieceIndex = shuffled[0];
        const secondPieceIndex = shuffled[1];
        const restPieces = shuffled.slice(2);

        const firstTargetOri = Math.floor(Math.random() * 3);
        const firstTarget = CORNERS[firstPieceIndex][firstTargetOri];
        // thirdTarget: a different sticker on firstPiece (T2C-style, unoriented)
        const otherOris = [0, 1, 2].filter(o => o !== firstTargetOri);
        const thirdTargetOri = otherOris[Math.floor(Math.random() * otherOris.length)];
        const thirdTarget = CORNERS[firstPieceIndex][thirdTargetOri];
        const secondTargetOri = Math.floor(Math.random() * 3);
        const secondTarget = CORNERS[secondPieceIndex][secondTargetOri];

        result.prefixTargets = [firstTarget, secondTarget, thirdTarget];

        for (const pieceIdx of restPieces) {
            const ori = Math.floor(Math.random() * 3);
            result.cycleTargets.push(CORNERS[pieceIdx][ori]);
        }
        result.leftoverPieceIndices = [];
        return result;
    }

    // count <= n: pick `count` distinct pieces, random sticker per piece
    const shuffled = shuffleArray([...remainingPieceIndices]);
    const chosenPieces = shuffled.slice(0, count);
    const leftover = shuffled.slice(count);

    for (const pieceIdx of chosenPieces) {
        const ori = Math.floor(Math.random() * 3);
        result.cycleTargets.push(CORNERS[pieceIdx][ori]);
    }
    result.leftoverPieceIndices = leftover;
    return result;
}

// Flip extras: extra targets applied AFTER the flip alg(s) on edges.
// Each target is applied as a single getEdgeParityAlg(buffer, target) call.
// Composing N such calls with N distinct pieces produces a clean (N+1)-cycle on
// edges (buffer + N pieces) plus N copies of UFR↔UBR (cancels if N even, leftover
// if N odd — that leftover is what the double-Parity correction handles).
// So extras are just N distinct random pieces with a random sticker per piece —
// no isolated cycle / cycle-break / main-cycle structure needed.
//
// Inputs: remainingPieceIndices - edge pieces not used by flip(s) (and not buffer)
//         count - desired number of extra targets, 0..n+1 where n = remainingPieceIndices.length
// Returns: { prefixTargets, cycleTargets, leftoverPieceIndices }
//   For count <= n: prefixTargets empty; cycleTargets = `count` distinct-piece targets.
//   For count = n+1: 2-cycle split — 3 prefix targets touching 2 pieces (firstPiece
//   appears twice as both stickers), then count-3 = n-2 distinct-piece targets.
function generateFlipExtras(remainingPieceIndices, count) {
    const n = remainingPieceIndices.length;
    const result = { prefixTargets: [], cycleTargets: [], leftoverPieceIndices: [...remainingPieceIndices] };

    if (count <= 0) return result;
    if (count > n + 1) return result;

    if (count === n + 1) {
        // 2-cycle split: 3 prefix targets on 2 pieces (T2C-style for edges),
        // then n-2 distinct-piece targets on the remaining pieces. Total = 3 + (n-2) = n+1.
        const shuffled = shuffleArray([...remainingPieceIndices]);
        const firstPieceIndex = shuffled[0];
        const secondPieceIndex = shuffled[1];
        const restPieces = shuffled.slice(2);

        const firstTargetOri = Math.floor(Math.random() * 2);
        const firstTarget = EDGES[firstPieceIndex][firstTargetOri];
        // thirdTarget: the OTHER sticker on firstPiece (only 2 orientations for edges)
        const thirdTarget = EDGES[firstPieceIndex][1 - firstTargetOri];
        const secondTargetOri = Math.floor(Math.random() * 2);
        const secondTarget = EDGES[secondPieceIndex][secondTargetOri];

        result.prefixTargets = [firstTarget, secondTarget, thirdTarget];

        for (const pieceIdx of restPieces) {
            const ori = Math.floor(Math.random() * 2);
            result.cycleTargets.push(EDGES[pieceIdx][ori]);
        }
        result.leftoverPieceIndices = [];
        return result;
    }

    // count <= n: pick `count` distinct pieces, random sticker per piece
    const shuffled = shuffleArray([...remainingPieceIndices]);
    const chosenPieces = shuffled.slice(0, count);
    const leftover = shuffled.slice(count);

    for (const pieceIdx of chosenPieces) {
        const ori = Math.floor(Math.random() * 2);
        result.cycleTargets.push(EDGES[pieceIdx][ori]);
    }
    result.leftoverPieceIndices = leftover;
    return result;
}

// 2E: 2-Swap setup (firstTarget, secondTarget, thirdTarget), then an isolated
// cycle of `extraCount` pieces. extraCount must be even — odd cycle lengths
// flip parity and cancel the 2-Swap. The leftover non-cycle pieces stay
// untouched (no random remainingTargets), which is the simpler form the
// user asked for.
function generate2E(firstPieceIndex, availableSecondPieceIndices, forceIdenticalThirdTarget = false, bufferIndex = 0, extraCount = 6) {
    const parityEdgeIndex = bufferIndex === 0 ? 2 : 0;

    let pieces = [];
    for (let i = 0; i < EDGES.length; i++) {
        if (i !== bufferIndex && i !== parityEdgeIndex) {
            pieces.push(i);
        }
    } // 10 pieces

    pieces = pieces.filter(i => i !== firstPieceIndex);

    const firstTargetOri = Math.floor(Math.random() * 2);
    const firstTarget = EDGES[firstPieceIndex][firstTargetOri];

    let thirdTarget;
    if (forceIdenticalThirdTarget) {
        thirdTarget = firstTarget;
    } else {
        thirdTarget = EDGES[firstPieceIndex][1 - firstTargetOri];
    }

    let secondPieceOptions = availableSecondPieceIndices && availableSecondPieceIndices.length > 0
        ? availableSecondPieceIndices.filter(i => pieces.includes(i) && i !== parityEdgeIndex)
        : pieces.filter(i => i !== parityEdgeIndex);
    const secondPieceIndex = secondPieceOptions[Math.floor(Math.random() * secondPieceOptions.length)];
    pieces = pieces.filter(i => i !== secondPieceIndex);
    const secondTargetOri = Math.floor(Math.random() * 2);
    const secondTarget = EDGES[secondPieceIndex][secondTargetOri];

    // extraCount = number of cycle TARGETS (J-perms). Must be even — odd
    // parity cancels the 2-Swap.
    //   extras = 0: just the 2-Swap setup, no cycle, parity edge solved.
    //   extras ≤ 8: N unique pieces from a 9-piece pool (8 non-2-Swap +
    //     parity edge). One J-perm each, no cycle-break, no repeats.
    //   extras = 10: EXACT legacy F2E behavior — random isolated cycle of
    //     3-8 pieces plus remainingTargets for the leftover pieces and the
    //     parity edge, totaling 10 J-perms always.
    const fullPool = [...pieces, parityEdgeIndex]; // 9 entries
    const MAX_EXTRAS = fullPool.length + 1; // 10
    let extras = Math.max(0, extraCount | 0);
    if (extras > MAX_EXTRAS) extras = MAX_EXTRAS;
    if (extras % 2 === 1) extras -= 1;

    let cycleTargets = [];
    let remainingTargets = [];

    if (extras === 0) {
        // no cycle
    } else if (extras === MAX_EXTRAS) {
        // Legacy F2E path. If the parity edge is already used as first or
        // second piece (now allowed since first-piece can be the parity
        // edge), we skip adding it again to allLeftoverPieces.
        const numCyclePieces = Math.floor(Math.random() * 6) + 3; // 3-8
        const shuffledPieces = shuffleArray(pieces);
        const cyclePieces = shuffledPieces.slice(0, Math.min(numCyclePieces, shuffledPieces.length));
        const leftoverPieces = shuffledPieces.slice(Math.min(numCyclePieces, shuffledPieces.length));

        const cycleFirstTargetOri = Math.floor(Math.random() * 2);
        const cycleFirstTarget = EDGES[cyclePieces[0]][cycleFirstTargetOri];
        const orientationNumber = Math.floor(Math.random() * 2);
        cycleTargets = generateIsolatedCycle(cyclePieces, cycleFirstTarget, orientationNumber);

        const parityAlreadyUsed = firstPieceIndex === parityEdgeIndex || secondPieceIndex === parityEdgeIndex;
        const allLeftoverPieces = parityAlreadyUsed
            ? shuffleArray(leftoverPieces)
            : shuffleArray([parityEdgeIndex, ...leftoverPieces]);
        remainingTargets = randomTargetsForPieces(allLeftoverPieces, false);
    } else {
        // extras 2/4/6/8: N unique pieces from the 9-piece pool.
        const chosen = shuffleArray(fullPool).slice(0, extras);
        cycleTargets = randomTargetsForPieces(chosen, false);
    }

    return { firstTarget, secondTarget, thirdTarget, cycleTargets, remainingTargets };
}

function generateCommTargets(indices, type, solvePieceIfOdd) {
    let targets = [];
    let numOrientations = type == "c" ? 3 : 2;

    indices = shuffleArray(indices);
    for (let i = 0; i < indices.length; ++i) {
        let ori = Math.floor(Math.random() * numOrientations);
        if (type == "c") {
            targets.push(CORNERS[indices[i]][ori]);
        }
        else {
            targets.push(EDGES[indices[i]][ori]);
        }
    }

    if (targets.length % 2 == 1) {
        // 0% chance to fix odd number of targets by solving a piece instead of cycle breaking
        // let solvePiece = Math.floor(Math.random() * 5);
        let solvePiece = -1;

        if (solvePieceIfOdd || solvePiece == 2) {
            const removeI = Math.floor(Math.random() * targets.length);
            targets.splice(removeI, 1);
        }
        else {
            let breakI = Math.floor(Math.random() * (targets.length - 2));
            let oris = getPiece(targets[breakI]);

            let newOris = [];
            for (let i = 0; i < oris.length; ++i) {
                newOris.push(oris[i]);
                // if (oris[i] != targets[breakI]) {
                //     newOris.push(oris[i]);
                // }
            }

            let breakJ = Math.floor(Math.random() * newOris.length);
            targets.push(newOris[breakJ]);
        }
    }

    return targets;
}

// Helper to set character at index in string
function setCharAt(str, index, char) {
    return str.substring(0, index) + char + str.substring(index + 1);
}

// Generate a random cube state with options for corner/edge randomness
// cornerMode: "random" or anything else (solved)
// edgeMode: "random" or anything else (solved)
// Returns: cube string (54 chars)
function generateRandomState(cornerMode, edgeMode) {
    const isCornerRandom = cornerMode === "random";
    const isEdgeRandom = edgeMode === "random";

    // Both random - use Cube.random()
    if (isCornerRandom && isEdgeRandom) {
        return Cube.random().asString();
    }

    // Neither random - return solved
    if (!isCornerRandom && !isEdgeRandom) {
        return SOLVED_CUBE;
    }

    // Generate a random cube to start with
    const randomCube = Cube.random();
    let cubeStr = randomCube.asString();

    if (isCornerRandom && !isEdgeRandom) {
        // Random corners, solved edges
        console.log("generateRandomState: Corner random, edges solved");
        console.log("generateRandomState: Original random cube:", cubeStr);

        // Check corner parity from the original random cube first
        const cornerParity = randomCube.cornerParity();
        console.log("generateRandomState: Corner parity:", cornerParity);

        // Overwrite edges with solved
        console.log("generateRandomState: ALL_EDGE_INDICES:", ALL_EDGE_INDICES);
        console.log("generateRandomState: cubeStr length before:", cubeStr.length);
        for (const idx of ALL_EDGE_INDICES) {
            const solvedChar = SOLVED_CUBE[idx];
            if (solvedChar === undefined) {
                console.log("generateRandomState: ERROR - undefined at index", idx);
            }
            cubeStr = setCharAt(cubeStr, idx, solvedChar);
        }
        console.log("generateRandomState: cubeStr length after:", cubeStr.length);
        console.log("generateRandomState: After overwriting edges:", cubeStr);

        // If corner parity is odd, swap UF and UR edges to match
        // UF: indices 7 (U face) and 19 (F face)
        // UR: indices 5 (U face) and 10 (R face)
        if (cornerParity === 1) {
            console.log("generateRandomState: Parity is odd, swapping UF and UR edges");
            // Swap U stickers (index 5 and 7)
            let temp1 = cubeStr[5];
            cubeStr = setCharAt(cubeStr, 5, cubeStr[7]);
            cubeStr = setCharAt(cubeStr, 7, temp1);
            // Swap side stickers (index 10 and 19)
            let temp2 = cubeStr[10];
            cubeStr = setCharAt(cubeStr, 10, cubeStr[19]);
            cubeStr = setCharAt(cubeStr, 19, temp2);
            console.log("generateRandomState: After swapping edges:", cubeStr);
        }

        console.log("generateRandomState: Final cube string:", cubeStr);
        return cubeStr;
    }

    if (!isCornerRandom && isEdgeRandom) {
        // Random edges, solved corners
        // Overwrite corners with solved
        for (const idx of ALL_CORNER_INDICES) {
            cubeStr = setCharAt(cubeStr, idx, SOLVED_CUBE[idx]);
        }

        // Check if solvable using parity check
        // For a solvable cube, corner parity must equal edge parity
        const testCube = Cube.fromString(cubeStr);
        const cornerParity = testCube.cornerParity();
        const edgeParity = testCube.edgeParity();

        if (cornerParity !== edgeParity) {
            // Not solvable - fix parity by swapping two edges
            // Swap U6 (index 5) and U8 (index 7) - swaps UR and UF edge positions
            let temp1 = cubeStr[5];
            cubeStr = setCharAt(cubeStr, 5, cubeStr[7]);
            cubeStr = setCharAt(cubeStr, 7, temp1);
            // Swap R2 (index 10) and F2 (index 19) - the second facelets
            let temp2 = cubeStr[10];
            cubeStr = setCharAt(cubeStr, 10, cubeStr[19]);
            cubeStr = setCharAt(cubeStr, 19, temp2);
        }

        return cubeStr;
    }

    return SOLVED_CUBE;
}
