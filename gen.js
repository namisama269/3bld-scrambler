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
function generateLTCT2(parityPieceIndex, twistPieceIndex) {
    // Randomly select a twist target from twistPiece (orientation 1 or 2, not U/D sticker)
    const twistOri = Math.floor(Math.random() * 2) + 1;
    const twist = CORNERS[twistPieceIndex][twistOri];

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

    // Pick a random sticker from the parity piece as the first target
    const firstTargetOri = Math.floor(Math.random() * 3);
    const firstTarget = CORNERS[parityPieceIndex][firstTargetOri];

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

    return { twist, targets, remainingTargets };
}

// New: specific twist target, specific parity target, orientation 0 for cycle-break
function generateLTCT(parityTarget, twistTarget) {
    const twist = twistTarget;
    const twistPieceIndex = CORNERS.findIndex(piece => piece.includes(twistTarget));
    const parityPieceIndex = CORNERS.findIndex(piece => piece.includes(parityTarget));

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

    return { twist, targets, remainingTargets };
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

// 2E: Two targets to start, then isolated cycle with remaining pieces (edge version)
// Inputs: firstPieceIndex - the edge piece to start from
//         availableSecondPieceIndices - optional array of allowed second piece indices
//         forceIdenticalThirdTarget - if true, thirdTarget = firstTarget (Floating 2E)
//         bufferIndex - the edge buffer index to exclude (default 0 = UF)
//         parityEdgeIndex - the parity edge that must be in remainingTargets, not cycle (default 2 = UR)
function generate2E(firstPieceIndex, availableSecondPieceIndices, forceIdenticalThirdTarget = false, bufferIndex = 0, parityEdgeIndex = 2) {
    // Start with all edge pieces except the buffer
    let pieces = [];
    for (let i = 0; i < EDGES.length; i++) {
        if (i !== bufferIndex) {
            pieces.push(i);
        }
    } // 11 pieces

    // Remove firstPiece from the list
    pieces = pieces.filter(i => i !== firstPieceIndex);

    // Randomly select firstTarget from firstPiece (orientation 0 or 1)
    const firstTargetOri = Math.floor(Math.random() * 2);
    const firstTarget = EDGES[firstPieceIndex][firstTargetOri];

    // thirdTarget: same sticker (Floating 2E) or flipped sticker (F2E)
    let thirdTarget;
    if (forceIdenticalThirdTarget) {
        thirdTarget = firstTarget;
    } else {
        // For edges, there's only one other orientation (the flip)
        thirdTarget = EDGES[firstPieceIndex][1 - firstTargetOri];
    }

    // Randomly select secondPiece from available options and remove it
    const secondPieceOptions = availableSecondPieceIndices && availableSecondPieceIndices.length > 0
        ? availableSecondPieceIndices.filter(i => pieces.includes(i))
        : pieces;
    const secondPieceIndex = secondPieceOptions[Math.floor(Math.random() * secondPieceOptions.length)];
    pieces = pieces.filter(i => i !== secondPieceIndex);
    const secondTargetOri = Math.floor(Math.random() * 2);
    const secondTarget = EDGES[secondPieceIndex][secondTargetOri];

    // Remove parity edge from cycle candidates (it must go to remainingTargets)
    const parityEdgeInPieces = pieces.includes(parityEdgeIndex);
    const piecesForCycle = pieces.filter(i => i !== parityEdgeIndex);

    // Now select 8-8 pieces for the cycle from remaining pieces (excluding parity edge)
    const numCyclePieces = Math.floor(Math.random() * 1) + 8; // 8-8 for testing
    const shuffledCycleCandidates = shuffleArray(piecesForCycle);
    const cyclePieces = shuffledCycleCandidates.slice(0, Math.min(numCyclePieces, shuffledCycleCandidates.length));
    const leftoverFromCycle = shuffledCycleCandidates.slice(Math.min(numCyclePieces, shuffledCycleCandidates.length));

    // Generate isolated cycle
    const cycleFirstTargetOri = Math.floor(Math.random() * 2);
    const cycleFirstTarget = EDGES[cyclePieces[0]][cycleFirstTargetOri];
    const orientationNumber = Math.floor(Math.random() * 2);
    const cycleTargets = generateIsolatedCycle(cyclePieces, cycleFirstTarget, orientationNumber);

    // Combine leftover pieces with parity edge, then shuffle
    let leftoverPieces = [...leftoverFromCycle];
    if (parityEdgeInPieces) {
        leftoverPieces.push(parityEdgeIndex);
    }
    leftoverPieces = shuffleArray(leftoverPieces);

    // Generate random targets for leftover pieces (including parity edge)
    const remainingTargets = [];
    for (let i of leftoverPieces) {
        const ori = Math.floor(Math.random() * 2);
        remainingTargets.push(EDGES[i][ori]);
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
