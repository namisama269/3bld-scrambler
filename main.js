Cube.initSolver();
const cube = new Cube();
const canvas = document.getElementById('cubeCanvas');
const ctx = canvas.getContext('2d');

// const cornerLabels = ["Solved", "Comms", "Parity", "UFR 2T", "Floating 2T", "UFR 3T", "LTCT", "T2C", "Floating 2C"];
// const edgeLabels = ["Solved", "Comms", "UF 2F", "Floating 2F", "LTEF", "F2E", "Floating 2E"];

let vc = new VisualCube(1200, 1200, 360, -0.523598, -0.209439, 0, 3, 0.08);
// vc.drawInside = true;

const holdingOrientation = document.getElementById('holdingOrientation');

let debugString = "";

// Check if the parity edge (UF or UR, whichever is not the buffer) is solved
// Solved means: top sticker is U, and side sticker is F or R
// Cube string format: 54 chars - U(0-8), R(9-17), F(18-26), D(27-35), L(36-44), B(45-53)
// UF edge: position 7 (U face) and position 19 (F face)
// UR edge: position 5 (U face) and position 10 (R face)
function isParityEdgeSolved(cubeStr, edgeBuffer) {
    if (edgeBuffer === "UF") {
        // Buffer is UF, so parity edge is UR - check positions 5 and 10
        const top = cubeStr[5];
        const side = cubeStr[10];
        return top === 'U' && (side === 'F' || side === 'R');
    } else {
        // Buffer is UR (or other), so parity edge is UF - check positions 7 and 19
        const top = cubeStr[7];
        const side = cubeStr[19];
        return top === 'U' && (side === 'F' || side === 'R');
    }
}

function getOrientationMoves() {
    return ORIENTATION_MOVES[holdingOrientation.value] || '';
}

document.addEventListener("DOMContentLoaded", function() {
    // Populate orientation dropdown
    Object.entries(ORIENTATION_OPTIONS).forEach(([key, label]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label;
        holdingOrientation.appendChild(opt);
    });

    // Restore saved value, migrating legacy raw-moves strings to the matching key
    const savedValue = localStorage.getItem('holdingOrientation');
    if (savedValue !== null && ORIENTATION_OPTIONS[savedValue]) {
        holdingOrientation.value = savedValue;
    } else if (savedValue !== null) {
        const trimmed = savedValue.trim();
        const match = Object.entries(ORIENTATION_MOVES).find(([, moves]) => moves === trimmed);
        const key = match ? match[0] : 'wg';
        holdingOrientation.value = key;
        localStorage.setItem('holdingOrientation', key);
    } else {
        holdingOrientation.value = 'wg';
    }

    holdingOrientation.addEventListener('change', function() {
        localStorage.setItem('holdingOrientation', holdingOrientation.value);
    });

    cube.move(getOrientationMoves());
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
});

function handleCheckboxToggle() {
    const useRestrictedMemo = isRestrictedMemoChecked();
    // console.log('Restricted Memo Toggled:', useRestrictedMemo);
    if (useRestrictedMemo) {
        restrictedMemoStickerIndices.forEach((index) => { 
        vc.cubeString = setCharAt(vc.cubeString, index, 'r');
        });
        // vc.cubeString = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";
    } else {
        vc.cubeString = cube.asString();
    }
    // console.log(vc.cubeString);
    vc.drawCube(ctx);
}


function resetCube() {
    cube.identity();
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

// generate scramble

function generateScramble(options = {}) {
    const { silent = false } = options;
    const log = silent ? () => {} : (...args) => console.log(...args);
    const addDebugLine = silent ? () => {} : (line) => {
        debugString += line + "\n";
    };

    log("Generating scramble");
    cube.identity();
    if (!silent) {
        debugString = "";
        const debugElement = document.getElementById('debugText');
        if (debugElement) {
            debugElement.classList.add('hidden');
        }
    }

    const cornerBufferSelect = document.getElementById("cornerBufferSelect");
    const cornerScrambleSelect = document.getElementById("cornerScrambleSelect");
    const edgeScrambleSelect = document.getElementById("edgeScrambleSelect");

    const cornerBuffer = cornerBufferSelect ? cornerBufferSelect.value : "UFR";

    // Validate that buffer is UFR - other buffers not fully supported yet
    if (cornerBuffer !== "UFR") {
        console.warn("Non-UFR buffers are not fully supported yet. Some scramble types may not work correctly.");
    }
    let cornerScrambleType = cornerScrambleSelect.value || "Solved";
    let edgeScrambleType = edgeScrambleSelect.value || "Solved";
    const edgeBufferSelect = document.getElementById("edgeBufferSelect");
    const edgeBuffer = edgeBufferSelect ? edgeBufferSelect.value : "UF";
    log("Corner buffer: " + cornerBuffer);
    addDebugLine("Corner buffer: " + cornerBuffer);
    log("Edge buffer: " + edgeBuffer);
    addDebugLine("Edge buffer: " + edgeBuffer);
    log("Corner scramble type: " + cornerScrambleType);
    addDebugLine("Corner scramble type: " + cornerScrambleType);
    log("Edge scramble type: " + edgeScrambleType);
    addDebugLine("Edge scramble type: " + edgeScrambleType);

    // Tracks the edge target chosen by the edge Parity branch, used to apply a
    // double-Parity correction alg at the end if both corner and edge are Parity.
    let doubleParityEdgeTarget = null;

    // Find buffer index
    const bufferIndex = CORNERS.findIndex(piece => piece.includes(cornerBuffer));

    // Create cornerPieces array excluding the buffer
    let cornerPieces = [];
    for (let i = 0; i < CORNERS.length; i++) {
        if (i !== bufferIndex) {
            cornerPieces.push(i);
        }
    }

    // Find edge buffer index and create edgePieces excluding the buffer
    const edgeBufferIndex = EDGES.findIndex(piece => piece.includes(edgeBuffer));
    let edgePieces = [];
    for (let i = 0; i < EDGES.length; i++) {
        if (i !== edgeBufferIndex) {
            edgePieces.push(i);
        }
    }

    let solveCornerIfOdd = true;
    let solveEdgeIfOdd = true;

    if (cornerScrambleType == "Solved") {
        cornerPieces = [];
    }
    else if (cornerScrambleType == "Comms") {
        // Get comms count setting (2, 4, 6, or 8)
        const commsCount = parseInt(document.querySelector('input[name="commsCount"]:checked')?.value || '8');

        let cycleTargets = [];
        let remainingTargets = [];

        // For 2, 4, 6: leave pieces aside, no cycle needed
        // For 8: use original cycle logic (no pieces left aside)
        if (commsCount <= 6) {
            // Calculate how many pieces to leave aside
            // 2 targets = 5 pieces left aside (use 2 pieces)
            // 4 targets = 3 pieces left aside (use 4 pieces)
            // 6 targets = 1 piece left aside (use 6 pieces)
            const piecesToLeaveCount = 7 - commsCount;

            // Shuffle all pieces
            const shuffledPieces = shuffleArray([...cornerPieces]);

            // Leave some pieces aside
            const piecesToLeave = shuffledPieces.slice(0, piecesToLeaveCount);
            const piecesToUse = shuffledPieces.slice(piecesToLeaveCount);

            if (piecesToLeaveCount > 0) {
                log("Comms: Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map(i => CORNERS[i][0]).join(", "));
                addDebugLine("Comms: Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map(i => CORNERS[i][0]).join(", "));
            }

            // No cycle, just generate random targets for the pieces we're using
            for (let i of piecesToUse) {
                const ori = Math.floor(Math.random() * 3);
                remainingTargets.push(CORNERS[i][ori]);
            }
        } else {
            // Full 8 targets: use original cycle logic
            // Randomly select 2-7 pieces for the cycle
            const numCyclePieces = Math.floor(Math.random() * 6) + 2;
            const shuffledPieces = shuffleArray([...cornerPieces]);
            const cyclePieces = shuffledPieces.slice(0, Math.min(numCyclePieces, shuffledPieces.length));
            const leftoverPieces = shuffledPieces.slice(Math.min(numCyclePieces, shuffledPieces.length));

            // Generate isolated cycle with random first target and orientation
            const cycleFirstTargetOri = Math.floor(Math.random() * 3);
            const cycleFirstTarget = CORNERS[cyclePieces[0]][cycleFirstTargetOri];
            const orientationNumber = Math.floor(Math.random() * 3);
            cycleTargets = generateIsolatedCycle(cyclePieces, cycleFirstTarget, orientationNumber);

            // Generate random targets for remaining pieces
            for (let i of leftoverPieces) {
                const ori = Math.floor(Math.random() * 3);
                remainingTargets.push(CORNERS[i][ori]);
            }
        }

        log("Comms (count=" + commsCount + "): cycleTargets=" + cycleTargets.join(" "));
        log("Comms (count=" + commsCount + "): remainingTargets=" + remainingTargets.join(" "));
        addDebugLine("Comms (count=" + commsCount + "): cycleTargets=" + cycleTargets.join(" "));
        addDebugLine("Comms (count=" + commsCount + "): remainingTargets=" + remainingTargets.join(" "));

        // Apply cube state: parity alg for each target
        for (let target of cycleTargets) {
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        }
        for (let target of remainingTargets) {
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        }

        // Clear cornerPieces since we've handled all corners
        cornerPieces = [];
    }
    else if (cornerScrambleType == "Parity") {
        // Get parity count setting (1, 3, 5, or 7)
        const parityCount = parseInt(document.querySelector('input[name="parityCount"]:checked')?.value || '7');

        // Get selected parity targets
        const selectedParityTargets = [];
        const parityTargetCheckboxes = document.querySelectorAll('.parity-target');
        parityTargetCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedParityTargets.push(checkbox.value);
            }
        });

        // If no targets selected, fall back to all targets
        let parityTarget;
        if (selectedParityTargets.length === 0) {
            let parityI = Math.floor(Math.random() * cornerPieces.length);
            let parityPiece = CORNERS[cornerPieces[parityI]];
            parityTarget = parityPiece[Math.floor(Math.random() * parityPiece.length)];
        } else {
            parityTarget = selectedParityTargets[Math.floor(Math.random() * selectedParityTargets.length)];
        }

        // Remove the piece from cornerPieces if it exists there
        const targetPieceIndex = CORNERS.findIndex(piece => piece.includes(parityTarget));
        if (targetPieceIndex !== -1) {
            const listIndex = cornerPieces.indexOf(targetPieceIndex);
            if (listIndex !== -1) {
                cornerPieces.splice(listIndex, 1);
            }
        }

        // Calculate how many pieces to leave aside based on parity count
        // 7 targets = 0 pieces left aside
        // 5 targets = 2 pieces left aside
        // 3 targets = 4 pieces left aside
        // 1 target = 6 pieces left aside
        const piecesToLeaveCount = 7 - parityCount;

        if (piecesToLeaveCount > 0) {
            // Randomly select pieces to leave aside (from cornerPieces)
            const shuffledRemaining = shuffleArray([...cornerPieces]);
            const piecesToLeave = shuffledRemaining.slice(0, piecesToLeaveCount);

            // Remove those pieces from cornerPieces so they won't get comms
            cornerPieces = cornerPieces.filter(i => !piecesToLeave.includes(i));

            log("Parity: Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map(i => CORNERS[i][0]).join(", "));
            addDebugLine("Parity: Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map(i => CORNERS[i][0]).join(", "));
        }

        cube.move(generateParityAlg("UF", "UR", cornerBuffer, parityTarget));
        log("Corner parity (count=" + parityCount + "): " + parityTarget);
        addDebugLine("Corner parity (count=" + parityCount + "): " + parityTarget);
    }
    else if (cornerScrambleType == "ParitySpecial") {
        // Get selected parity special targets
        const selectedParitySpecialTargets = [];
        const paritySpecialTargetCheckboxes = document.querySelectorAll('.parity-special-target');
        paritySpecialTargetCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedParitySpecialTargets.push(checkbox.value);
            }
        });

        // If no targets selected, fall back to default list
        const specialParityTargets = selectedParitySpecialTargets.length > 0
            ? selectedParitySpecialTargets
            : ["UBL", "UBR", "UFL", "LUF", "BUR"];
        const parityTarget = specialParityTargets[Math.floor(Math.random() * specialParityTargets.length)];
        const parityPieceIndex = CORNERS.findIndex(piece => piece.includes(parityTarget));
        if (parityPieceIndex !== -1) {
            const listIndex = cornerPieces.indexOf(parityPieceIndex);
            if (listIndex !== -1) {
                cornerPieces.splice(listIndex, 1);
            }
        }

        cube.move(generateParityAlg("UF", "UR", cornerBuffer, parityTarget));
        log("Corner parity: " + parityTarget);
        addDebugLine("Corner parity: " + parityTarget);
    }
    else if (cornerScrambleType == "Twist") {
        const twistMode = document.querySelector('input[name="twistMode"]:checked')?.value || '2-twist';
        const twistCount = parseInt(document.querySelector('input[name="twistCount"]:checked')?.value || '0');
        const shuffledCornerPieces = shuffleArray(cornerPieces);

        if (twistMode === "2-twist") {
            const ori = Math.floor(Math.random() * 2) + 1;
            const twist = CORNERS[shuffledCornerPieces[0]][ori];
            cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0]);

            cube.move(invertMoves(generateCOAlg([twist])));
            log("2-twist: " + twist);
            addDebugLine("2-twist: " + twist);
        } else if (twistMode === "Floating 2T") {
            const ori1 = Math.floor(Math.random() * 2) + 1;
            const ori2 = 3 - ori1;
            const twist1 = CORNERS[shuffledCornerPieces[0]][ori1];
            const twist2 = CORNERS[shuffledCornerPieces[1]][ori2];
            cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

            cube.move(invertMoves(generateCOAlg([twist1])));
            cube.move(invertMoves(generateCOAlg([twist2])));
            log("Floating 2-twist: " + twist1 + " " + twist2);
            addDebugLine("Floating 2-twist: " + twist1 + " " + twist2);
        } else if (twistMode === "3-twist") {
            const ori = Math.floor(Math.random() * 2) + 1;
            const twist1 = CORNERS[shuffledCornerPieces[0]][ori];
            const twist2 = CORNERS[shuffledCornerPieces[1]][ori];
            cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

            cube.move(invertMoves(generateCOAlg([twist1])));
            cube.move(invertMoves(generateCOAlg([twist2])));
            log("3-twist: " + twist1 + " " + twist2);
            addDebugLine("3-twist: " + twist1 + " " + twist2);
        }

        // Apply extra parity-style targets on remaining pieces.
        // Pieces left aside stay untouched (no targets emitted).
        if (twistCount > 0) {
            const extras = generateTwistExtras(cornerPieces, twistCount);
            const allTargets = [...extras.prefixTargets, ...extras.cycleTargets];
            // Apply prefix in 2C order (third, second, first) for n+1 split, then cycle targets
            if (extras.prefixTargets.length === 3) {
                cube.move(generateParityAlg("UF", "UR", "UFR", extras.prefixTargets[2]));
                cube.move(generateParityAlg("UF", "UR", "UFR", extras.prefixTargets[1]));
                cube.move(generateParityAlg("UF", "UR", "UFR", extras.prefixTargets[0]));
            }
            for (const target of extras.cycleTargets) {
                cube.move(generateParityAlg("UF", "UR", "UFR", target));
            }
            log("Twist extras (count=" + twistCount + "): " + allTargets.join(" ") +
                (extras.leftoverPieceIndices.length > 0
                    ? " | leftover=" + extras.leftoverPieceIndices.map(i => CORNERS[i][0]).join(",")
                    : ""));
            addDebugLine("Twist extras (count=" + twistCount + "): " + allTargets.join(" ") +
                (extras.leftoverPieceIndices.length > 0
                    ? " | leftover=" + extras.leftoverPieceIndices.map(i => CORNERS[i][0]).join(",")
                    : ""));
        }
        // Clear cornerPieces so the main comms loop doesn't process leftovers
        cornerPieces = [];
    }
    else if (cornerScrambleType == "LTCT") {
        // Check LTCT mode: pieces or stickers
        const ltctMode = document.querySelector('input[name="ltctMode"]:checked').value;
        const ltctCount = parseInt(document.querySelector('input[name="ltctCount"]:checked')?.value || '7');

        if (ltctMode === "stickers") {
            // Stickers mode: use generateLTCT with specific targets
            // Get selected LTCT parity targets
            const selectedLTCTParityTargets = [];
            const ltctParityTargetCheckboxes = document.querySelectorAll('.ltct-parity-target');
            ltctParityTargetCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedLTCTParityTargets.push(checkbox.value);
                }
            });

            // Get selected LTCT twist targets
            const selectedLTCTTwistTargets = [];
            const ltctTwistTargetCheckboxes = document.querySelectorAll('.ltct-twist-target');
            ltctTwistTargetCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedLTCTTwistTargets.push(checkbox.value);
                }
            });

            // Helper function to check if two targets are on the same piece
            const isSamePiece = (target1, target2) => {
                const pieceIndex1 = CORNERS.findIndex(piece => piece.includes(target1));
                const pieceIndex2 = CORNERS.findIndex(piece => piece.includes(target2));
                return pieceIndex1 === pieceIndex2;
            };

            // Get lists of possible targets
            const parityList = selectedLTCTParityTargets.length > 0 ? selectedLTCTParityTargets :
                CORNERS.slice(1).flatMap(piece => piece); // All corners except UFR
            const twistList = selectedLTCTTwistTargets.length > 0 ? selectedLTCTTwistTargets :
                CORNERS.slice(1).flatMap(piece => piece.slice(1)); // All corners except UFR, twisted orientations only

            // Pre-compute all valid combinations
            const validCombinations = [];
            for (let p of parityList) {
                for (let t of twistList) {
                    if (!isSamePiece(p, t)) {
                        validCombinations.push({ parity: p, twist: t });
                    }
                }
            }

            // Check if any valid combination exists
            if (validCombinations.length === 0) {
                alert("Error: No valid LTCT combination possible with current selections. Parity and twist targets cannot be on the same piece. Please adjust your target selections.");
                return;
            }

            // Randomly select from valid combinations
            const selectedCombo = validCombinations[Math.floor(Math.random() * validCombinations.length)];
            const parity = selectedCombo.parity;
            const twist = selectedCombo.twist;

            // Generate LTCT result
            const result = generateLTCT(parity, twist, ltctCount);
            const leftoverStr = result.leftoverPieces.length > 0
                ? " leftover=" + result.leftoverPieces.map(i => CORNERS[i][0]).join(",")
                : "";
            log("LTCT (count=" + ltctCount + "): twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" ") + leftoverStr);
            addDebugLine("LTCT (count=" + ltctCount + "): twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" ") + leftoverStr);

            // Apply cube state:
            // 1. Do twist with CO alg
            cube.move(invertMoves(generateCOAlg([result.twist])));
            // 2. Do parity for each target in the cycle
            for (let target of result.targets) {
                cube.move(generateParityAlg("UF", "UR", "UFR", target));
            }
            // 3. Do parity for each target in the remaining
            for (let target of result.remainingTargets) {
                cube.move(generateParityAlg("UF", "UR", "UFR", target));
            }
        } else {
            // Pieces mode: use generateLTCT2 with piece indices
            // Get selected LTCT parity pieces (U/D stickers)
            const selectedLTCTParityPieces = [];
            const ltctParityTargetCheckboxes = document.querySelectorAll('.ltct2-parity-target');
            ltctParityTargetCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedLTCTParityPieces.push(checkbox.value);
                }
            });

            // Get selected LTCT twist pieces (U/D stickers)
            const selectedLTCTTwistPieces = [];
            const ltctTwistTargetCheckboxes = document.querySelectorAll('.ltct2-twist-target');
            ltctTwistTargetCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedLTCTTwistPieces.push(checkbox.value);
                }
            });

            // Get lists of possible piece indices
            const parityPieceIndices = selectedLTCTParityPieces.length > 0
                ? selectedLTCTParityPieces.map(p => CORNERS.findIndex(piece => piece[0] === p))
                : CORNERS.slice(1).map((_, i) => i + 1); // All except UFR (index 0)

            const twistPieceIndices = selectedLTCTTwistPieces.length > 0
                ? selectedLTCTTwistPieces.map(p => CORNERS.findIndex(piece => piece[0] === p))
                : CORNERS.slice(1).map((_, i) => i + 1); // All except UFR (index 0)

            // Pre-compute valid combinations (parity and twist must be different pieces)
            const validCombinations = [];
            for (let p of parityPieceIndices) {
                for (let t of twistPieceIndices) {
                    if (p !== t) {
                        validCombinations.push({ parityPieceIndex: p, twistPieceIndex: t });
                    }
                }
            }

            // Check if any valid combination exists
            if (validCombinations.length === 0) {
                alert("Error: No valid LTCT combination possible with current selections. Parity and twist pieces must be different. Please adjust your selections.");
                return;
            }

            // Randomly select from valid combinations
            const selectedCombo = validCombinations[Math.floor(Math.random() * validCombinations.length)];

            // Generate LTCT result using piece-based function
            const result = generateLTCT2(selectedCombo.parityPieceIndex, selectedCombo.twistPieceIndex, ltctCount);
            const leftoverStr = result.leftoverPieces.length > 0
                ? " leftover=" + result.leftoverPieces.map(i => CORNERS[i][0]).join(",")
                : "";
            log("LTCT (count=" + ltctCount + "): twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" ") + leftoverStr);
            addDebugLine("LTCT (count=" + ltctCount + "): twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" ") + leftoverStr);

            // Apply cube state:
            // 1. Do twist with CO alg
            cube.move(invertMoves(generateCOAlg([result.twist])));
            // 2. Do parity for each target in the cycle
            for (let target of result.targets) {
                cube.move(generateParityAlg("UF", "UR", "UFR", target));
            }
            // 3. Do parity for each target in the remaining
            for (let target of result.remainingTargets) {
                cube.move(generateParityAlg("UF", "UR", "UFR", target));
            }
        }

        // Clear cornerPieces since we've handled all corners
        cornerPieces = [];
    }
    else if (cornerScrambleType == "LTCT_UBL") {
        const parity = "UBL";
        const parityPieceIndex = CORNERS.findIndex(piece => piece.includes(parity));
        if (parityPieceIndex !== -1) {
            cornerPieces = cornerPieces.filter(x => x != parityPieceIndex);
        }
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let twistOri = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let twist = CORNERS[shuffledCornerPieces[0]][twistOri];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0]);

        cube.move(invertMoves(generateCOAlg([twist])));
        cube.move(generateParityAlg("UF", "UR", "UFR", parity));
        log("LTCT: " + parity + "[" + twist + "]");
        addDebugLine("LTCT: " + parity + "[" + twist + "]");
    }
    else if (cornerScrambleType == "LTCT_special") {
        const specialParityTargets = ["UBL", "UBR", "UFL", "LUF", "BUR"];
        const parity = specialParityTargets[Math.floor(Math.random() * specialParityTargets.length)];
        const parityPieceIndex = CORNERS.findIndex(piece => piece.includes(parity));
        if (parityPieceIndex !== -1) {
            cornerPieces = cornerPieces.filter(x => x != parityPieceIndex);
        }
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let twistOri = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let twist = CORNERS[shuffledCornerPieces[0]][twistOri];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0]);

        cube.move(invertMoves(generateCOAlg([twist])));
        cube.move(generateParityAlg("UF", "UR", "UFR", parity));
        log("LTCT: " + parity + "[" + twist + "]");
        addDebugLine("LTCT: " + parity + "[" + twist + "]");
    }
    else if (cornerScrambleType == "2-Swap") {
        // Buffer order for "Only select later buffers" option
        const T2C_BUFFER_ORDER = ["UFL", "UBR", "UBL", "DFR", "DFL", "DBL", "DBR"];

        // Check 2-Swap mode: unoriented (T2C) or oriented (Floating 2C)
        const twoSwapMode = document.querySelector('input[name="twoSwapMode"]:checked')?.value || 'unoriented';
        const isOriented = twoSwapMode === 'oriented';

        // Get selected first piece targets
        const selectedT2CFirstPieces = [];
        const t2cFirstPieceCheckboxes = document.querySelectorAll('.t2c-first-piece');
        t2cFirstPieceCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedT2CFirstPieces.push(checkbox.value);
            }
        });

        // Check if "Only select later buffers" is enabled
        const onlyLaterBuffers = document.getElementById('t2cOnlyLaterBuffers')?.checked || false;

        // Get list of possible first piece indices
        const firstPieceIndices = selectedT2CFirstPieces.length > 0
            ? selectedT2CFirstPieces.map(p => CORNERS.findIndex(piece => piece[0] === p))
            : cornerPieces; // All except UFR (buffer)

        // Randomly select a first piece
        const firstPieceIndex = firstPieceIndices[Math.floor(Math.random() * firstPieceIndices.length)];
        const firstPieceName = CORNERS[firstPieceIndex][0]; // Get U/D sticker name

        // Determine available second pieces based on the toggle
        let availableSecondPieceIndices;
        if (onlyLaterBuffers) {
            // Only allow pieces that come later in the buffer order
            const firstPieceOrderPos = T2C_BUFFER_ORDER.indexOf(firstPieceName);
            const laterPieces = T2C_BUFFER_ORDER.slice(firstPieceOrderPos + 1);
            availableSecondPieceIndices = laterPieces
                .map(p => CORNERS.findIndex(piece => piece[0] === p))
                .filter(i => i !== 0 && i !== firstPieceIndex); // Exclude buffer and first piece
        } else {
            // All pieces except buffer and first piece
            availableSecondPieceIndices = cornerPieces.filter(i => i !== firstPieceIndex);
        }

        // Generate 2-Swap result (isOriented = true means thirdTarget = firstTarget)
        const result = generate2C(firstPieceIndex, availableSecondPieceIndices, isOriented);
        const modeName = isOriented ? "2-Swap (Oriented)" : "2-Swap (Unoriented)";
        log(modeName + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log(modeName + ": cycleTargets=" + result.cycleTargets.join(" "));
        log(modeName + ": remainingTargets=" + result.remainingTargets.join(" "));
        addDebugLine(modeName + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine(modeName + ": cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine(modeName + ": remainingTargets=" + result.remainingTargets.join(" "));

        // Apply cube state: parity alg with UF UR UFR for each target in order
        cube.move(generateParityAlg("UF", "UR", "UFR", result.thirdTarget));
        cube.move(generateParityAlg("UF", "UR", "UFR", result.secondTarget));
        cube.move(generateParityAlg("UF", "UR", "UFR", result.firstTarget));
        for (let target of result.cycleTargets) {
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        }
        for (let target of result.remainingTargets) {
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        }

        // Clear cornerPieces since we've handled all corners
        cornerPieces = [];
    }
    else if (cornerScrambleType == "Random") {
        // Generate random corner state
        const randomCubeStr = generateRandomState("random", "solved");
        log("Random corners state: " + randomCubeStr);
        addDebugLine("Random corners state: " + randomCubeStr);

        // Apply the random corner state to the cube
        // We need to extract just the corner moves from this random state
        const randomCube = Cube.fromString(randomCubeStr);
        const solutionMoves = randomCube.solve();
        // Apply the inverse to get from solved to the random state
        cube.move(invertMoves(solutionMoves));

        // Clear cornerPieces since we've handled all corners
        cornerPieces = [];
    }

    let cornerComms = generateCommTargets(cornerPieces, "c", false);
    log("Corner comms: " + (cornerComms.length ? cornerComms.join(" ") : "None") + " (" + cornerComms.length + ")");
    addDebugLine("Corner comms: " + (cornerComms.length ? cornerComms.join(" ") : "None") + " (" + cornerComms.length + ")");
    for (let i = cornerComms.length - 1; i > 0; i -= 2) {
        cube.move(generateParityAlg("UF", "UR", "UFR", cornerComms[i-1]));
        cube.move(generateParityAlg("UF", "UR", "UFR", cornerComms[i]));
    }

    if (edgeScrambleType == "Solved") {
        edgePieces = [];
    }
    else if (edgeScrambleType == "Parity") {
        // Mirror of corner Parity: pick one parity target, leave (11 - count) edges aside,
        // remaining edges fall through to the edge comms loop below.
        const edgeParityCount = parseInt(document.querySelector('input[name="edgeParityCount"]:checked')?.value || '11');

        const bufferPieceIndex = EDGES.findIndex(piece => piece.includes(edgeBuffer));
        const selectedEdgeParityTargets = [];
        document.querySelectorAll('.edge-parity-target').forEach(checkbox => {
            if (checkbox.checked) {
                // Defense: never allow a sticker on the buffer's piece as a parity target
                const stickerPieceIndex = EDGES.findIndex(piece => piece.includes(checkbox.value));
                if (stickerPieceIndex !== bufferPieceIndex) {
                    selectedEdgeParityTargets.push(checkbox.value);
                }
            }
        });

        let parityTarget;
        if (selectedEdgeParityTargets.length === 0) {
            const parityI = Math.floor(Math.random() * edgePieces.length);
            const parityPiece = EDGES[edgePieces[parityI]];
            parityTarget = parityPiece[Math.floor(Math.random() * parityPiece.length)];
        } else {
            parityTarget = selectedEdgeParityTargets[Math.floor(Math.random() * selectedEdgeParityTargets.length)];
        }

        // Remove the parity target's piece from edgePieces if present
        const targetPieceIndex = EDGES.findIndex(piece => piece.includes(parityTarget));
        if (targetPieceIndex !== -1) {
            const listIndex = edgePieces.indexOf(targetPieceIndex);
            if (listIndex !== -1) {
                edgePieces.splice(listIndex, 1);
            }
        }

        // Leave (11 - count) edges aside so the comms loop only handles (count - 1) of them
        const piecesToLeaveCount = 11 - edgeParityCount;
        if (piecesToLeaveCount > 0) {
            const shuffledRemaining = shuffleArray([...edgePieces]);
            const piecesToLeave = shuffledRemaining.slice(0, piecesToLeaveCount);
            edgePieces = edgePieces.filter(i => !piecesToLeave.includes(i));

            log("Edge Parity: Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map(i => EDGES[i][0]).join(", "));
            addDebugLine("Edge Parity: Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map(i => EDGES[i][0]).join(", "));
        }

        cube.move(getEdgeParityAlg(edgeBuffer, parityTarget));
        log("Edge parity (count=" + edgeParityCount + "): " + parityTarget);
        addDebugLine("Edge parity (count=" + edgeParityCount + "): " + parityTarget);
        doubleParityEdgeTarget = parityTarget;

        // Double-Parity correction: when both corner and edge are Parity, apply
        // the correction alg right after the edge parity alg, before edge comms.
        if (cornerScrambleType === "Parity") {
            const otherEdgeBuffer = (edgeBuffer === "UF") ? "UR" : "UF";
            const targetIsOnOtherBuffer = (parityTarget === otherEdgeBuffer ||
                                           parityTarget === otherEdgeBuffer.split('').reverse().join(''));
            const correctionTarget = targetIsOnOtherBuffer ? edgeBuffer : parityTarget;
            cube.move(getEdgeParityAlg(otherEdgeBuffer, correctionTarget));
            log("Double-Parity correction: " + otherEdgeBuffer + "/UFR-UBR with edge target " + correctionTarget);
            addDebugLine("Double-Parity correction: " + otherEdgeBuffer + "/UFR-UBR with edge target " + correctionTarget);
        }
    }
    else if (edgeScrambleType == "Comms") {
        // Randomly select 2-11 pieces for the cycle
        const numCyclePieces = Math.floor(Math.random() * 10) + 2;

        // Shuffle and split into cycle pieces and remaining pieces
        const shuffledPieces = shuffleArray([...edgePieces]);
        const cyclePieces = shuffledPieces.slice(0, numCyclePieces);
        const leftoverPieces = shuffledPieces.slice(numCyclePieces);

        // Generate isolated cycle with random first target and orientation
        const cycleFirstTargetOri = Math.floor(Math.random() * 2);
        const cycleFirstTarget = EDGES[cyclePieces[0]][cycleFirstTargetOri];
        const orientationNumber = Math.floor(Math.random() * 2);
        const cycleTargets = generateIsolatedCycle(cyclePieces, cycleFirstTarget, orientationNumber);

        // Generate random targets for remaining pieces
        const remainingTargets = [];
        for (let i of leftoverPieces) {
            const ori = Math.floor(Math.random() * 2);
            remainingTargets.push(EDGES[i][ori]);
        }

        log("Edge Comms: cycleTargets=" + cycleTargets.join(" "));
        log("Edge Comms: remainingTargets=" + remainingTargets.join(" "));
        addDebugLine("Edge Comms: cycleTargets=" + cycleTargets.join(" "));
        addDebugLine("Edge Comms: remainingTargets=" + remainingTargets.join(" "));

        // Apply cube state: parity alg for each target based on buffer
        for (let target of cycleTargets) {
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        }
        for (let target of remainingTargets) {
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        }

        // Clear edgePieces since we've handled all edges
        edgePieces = [];
    }
    else if (edgeScrambleType == "Flips") {
        const flipMode = document.querySelector('input[name="flipMode"]:checked')?.value || '2-flip';
        const flipExtraCount = parseInt(document.querySelector('input[name="flipExtraCount"]:checked')?.value || '0');
        const parityEdgeIndex = edgeBufferIndex === 0 ? 2 : 0;
        const flipCountByMode = (flipMode === "2-flip") ? 1 : 2;
        const oddExtras = flipExtraCount % 2 === 1;

        // Pool of eligible flip pieces (exclude buffer + parity edge).
        const flipCandidates = edgePieces.filter(i => i !== parityEdgeIndex);

        // Read user-selected flip-target stickers → set of eligible flip pieces.
        // Each flip-target sticker corresponds to one piece (the oriented sticker).
        const selectedFlipStickers = new Set();
        document.querySelectorAll('.flip-target').forEach(cb => {
            if (cb.checked) selectedFlipStickers.add(cb.value);
        });
        const eligibleFlipPieces = (selectedFlipStickers.size === 0)
            ? flipCandidates
            : flipCandidates.filter(i => selectedFlipStickers.has(EDGES[i][0]));

        // Read user-selected flip-parity-target stickers (any sticker on any non-buffer piece).
        const selectedParityStickers = [];
        document.querySelectorAll('.flip-parity-target').forEach(cb => {
            if (cb.checked) selectedParityStickers.push(cb.value);
        });
        const eligibleParityStickers = (selectedParityStickers.length === 0)
            ? edgePieces.flatMap(i => EDGES[i])
            : selectedParityStickers;

        // Brute-force enumerate valid (flipPieces, parityTargetSticker) combinations.
        // Constraints:
        //   - flipPieces: distinct pieces from eligibleFlipPieces, count = flipCountByMode
        //   - parityTargetSticker (only when oddExtras): on a piece NOT in flipPieces and not buffer
        //   - enough remaining pieces to fill the rest of the extras count
        const validCombos = [];
        const flipPieceCombos = (flipCountByMode === 1)
            ? eligibleFlipPieces.map(p => [p])
            : (() => {
                const pairs = [];
                for (let a = 0; a < eligibleFlipPieces.length; a++) {
                    for (let b = a + 1; b < eligibleFlipPieces.length; b++) {
                        pairs.push([eligibleFlipPieces[a], eligibleFlipPieces[b]]);
                    }
                }
                return pairs;
            })();

        for (const fp of flipPieceCombos) {
            // Pieces remaining for extras after flips removed
            const afterFlipPool = edgePieces.filter(i => !fp.includes(i));
            if (oddExtras) {
                // Need a parity target sticker, and (count - 1) remaining pieces after parity-piece removal
                for (const stk of eligibleParityStickers) {
                    const stkPieceIdx = EDGES.findIndex(p => p.includes(stk));
                    if (stkPieceIdx < 0) continue;
                    if (fp.includes(stkPieceIdx)) continue;
                    const afterParityPool = afterFlipPool.filter(i => i !== stkPieceIdx);
                    // Need (count - 1) extras targets on distinct pieces from afterParityPool,
                    // OR for n+1 split: count = n+1 means we use all leftover pieces with one repeat.
                    const remainingNeeded = flipExtraCount - 1;
                    const n = afterFlipPool.length; // n = pool size after flips
                    if (flipExtraCount === n + 1) {
                        // 2-cycle split: parity target = firstTarget, parity piece appears twice
                        // (other sticker as third target). After parity piece, need n-1 more pieces.
                        // afterParityPool size = n - 1 → need exactly n - 1 = remainingNeeded - 1
                        // (n-1 distinct pieces fills remainingNeeded - 1 = count - 2 of the targets;
                        // the other "double" target is the third sticker on the parity piece itself).
                        // Actually for n+1 case: prefix uses parityPiece + 1 other piece; cycle uses
                        // the rest. Total distinct pieces used = 2 + (n - 2) = n = afterFlipPool.length.
                        // Check we have at least 1 piece for "secondPiece" of prefix + (n-2) for cycle.
                        if (afterParityPool.length >= n - 1) {
                            validCombos.push({ flipPieces: fp, parityPieceIdx: stkPieceIdx, paritySticker: stk });
                        }
                    } else {
                        if (afterParityPool.length >= remainingNeeded) {
                            validCombos.push({ flipPieces: fp, parityPieceIdx: stkPieceIdx, paritySticker: stk });
                        }
                    }
                }
            } else {
                // Even count: no parity target needed. Just check we can fit `count` distinct pieces.
                const n = afterFlipPool.length;
                if (flipExtraCount === 0 || flipExtraCount <= n) {
                    validCombos.push({ flipPieces: fp, parityPieceIdx: null, paritySticker: null });
                }
            }
        }

        if (validCombos.length === 0) {
            alert("Error: No valid Flips combination possible with current selections. " +
                  "Adjust flip targets, parity targets, or counts.");
            return;
        }

        const chosen = validCombos[Math.floor(Math.random() * validCombos.length)];

        // Apply flip alg(s). Use otherEdgeBuffer when corner=Parity AND oddExtras (correction will fire).
        const flipBuffer = (cornerScrambleType === "Parity" && oddExtras)
            ? ((edgeBuffer === "UF") ? "UR" : "UF")
            : edgeBuffer;

        if (flipMode === "2-flip") {
            const fpIdx = chosen.flipPieces[0];
            const flipSticker = EDGES[fpIdx][0];
            edgePieces = edgePieces.filter(x => x !== fpIdx);
            cube.move(generateEOAlg([flipSticker], flipBuffer));
            log("2-flip: " + flipSticker + " (flipBuffer=" + flipBuffer + ")");
            addDebugLine("2-flip: " + flipSticker + " (flipBuffer=" + flipBuffer + ")");
        } else {
            const [a, b] = chosen.flipPieces;
            const fs1 = EDGES[a][0], fs2 = EDGES[b][0];
            edgePieces = edgePieces.filter(x => x !== a && x !== b);
            cube.move(generateEOAlg([fs1], flipBuffer));
            cube.move(generateEOAlg([fs2], flipBuffer));
            log("Floating 2-flip: " + fs1 + " " + fs2 + " (flipBuffer=" + flipBuffer + ")");
            addDebugLine("Floating 2-flip: " + fs1 + " " + fs2 + " (flipBuffer=" + flipBuffer + ")");
        }

        // Apply extras (count > 0).
        if (flipExtraCount > 0) {
            const orderedTargets = [];

            if (oddExtras && chosen.parityPieceIdx !== null) {
                // First target = user's chosen parity sticker.
                orderedTargets.push(chosen.paritySticker);

                const n = edgePieces.length;
                if (flipExtraCount === n + 1) {
                    // 2-cycle split: prefix = (paritySticker, secondTarget on someOtherPiece, otherSticker on parityPiece)
                    // Cycle targets = main cycle on remaining n-2 pieces.
                    const poolAfterParity = edgePieces.filter(i => i !== chosen.parityPieceIdx);
                    const shuffled = shuffleArray([...poolAfterParity]);
                    const secondPieceIdx = shuffled[0];
                    const cyclePieces = shuffled.slice(1);
                    const secondTarget = EDGES[secondPieceIdx][Math.floor(Math.random() * 2)];
                    const otherStickerOnParityPiece = EDGES[chosen.parityPieceIdx].find(s => s !== chosen.paritySticker);
                    // Order: 3rd (otherStickerOnParityPiece), 2nd (secondTarget), 1st (paritySticker), then cycle
                    // Existing convention applies prefix in [2,1,0] order. For us:
                    //   prefix = [paritySticker, secondTarget, otherStickerOnParityPiece]
                    // applied as: third, second, first → otherStickerOnParityPiece, secondTarget, paritySticker
                    orderedTargets.length = 0;
                    orderedTargets.push(otherStickerOnParityPiece);
                    orderedTargets.push(secondTarget);
                    orderedTargets.push(chosen.paritySticker);
                    for (const pi of cyclePieces) {
                        const ori = Math.floor(Math.random() * 2);
                        orderedTargets.push(EDGES[pi][ori]);
                    }
                } else {
                    // Standard odd count < n+1: 1 parity target + (count-1) distinct random pieces from leftover pool.
                    const poolAfterParity = edgePieces.filter(i => i !== chosen.parityPieceIdx);
                    const shuffled = shuffleArray([...poolAfterParity]);
                    const restPieces = shuffled.slice(0, flipExtraCount - 1);
                    for (const pi of restPieces) {
                        const ori = Math.floor(Math.random() * 2);
                        orderedTargets.push(EDGES[pi][ori]);
                    }
                }
            } else {
                // Even count, no user parity target — fall back to the existing extras generator
                // which produces `count` distinct-piece targets (or n+1 split if applicable).
                const extras = generateFlipExtras(edgePieces, flipExtraCount);
                if (extras.prefixTargets.length === 3) {
                    orderedTargets.push(extras.prefixTargets[2]);
                    orderedTargets.push(extras.prefixTargets[1]);
                    orderedTargets.push(extras.prefixTargets[0]);
                }
                for (const t of extras.cycleTargets) orderedTargets.push(t);
            }

            // Apply the FIRST target, then the double-Parity correction (if odd
            // count + corner Parity), then the rest.
            if (orderedTargets.length > 0) {
                const firstTarget = orderedTargets[0];
                cube.move(getEdgeParityAlg(edgeBuffer, firstTarget));
                doubleParityEdgeTarget = firstTarget;

                if (cornerScrambleType === "Parity" && oddExtras) {
                    const otherEdgeBuffer = (edgeBuffer === "UF") ? "UR" : "UF";
                    const targetIsOnOtherBuffer = (firstTarget === otherEdgeBuffer ||
                                                   firstTarget === otherEdgeBuffer.split('').reverse().join(''));
                    const correctionTarget = targetIsOnOtherBuffer ? edgeBuffer : firstTarget;
                    cube.move(getEdgeParityAlg(otherEdgeBuffer, correctionTarget));
                    log("Double-Parity correction (Flips): " + otherEdgeBuffer + "/UFR-UBR with edge target " + correctionTarget);
                    addDebugLine("Double-Parity correction (Flips): " + otherEdgeBuffer + "/UFR-UBR with edge target " + correctionTarget);
                }

                for (let i = 1; i < orderedTargets.length; i++) {
                    cube.move(getEdgeParityAlg(edgeBuffer, orderedTargets[i]));
                }
            }
            log("Flip extras (count=" + flipExtraCount + "): " + orderedTargets.join(" "));
            addDebugLine("Flip extras (count=" + flipExtraCount + "): " + orderedTargets.join(" "));
        }
        edgePieces = [];
    }
    else if (edgeScrambleType == "LTEF") {
        // do not include comms from UR
        edgePieces.splice(1, 1);
        let shuffledEdgePieces = shuffleArray(edgePieces);
        let piece1 = EDGES[shuffledEdgePieces[0]];
        let piece2 = EDGES[shuffledEdgePieces[1]];
        let ori = Math.floor(Math.random() * 2); // random int 0 or 1
        let lt = piece1[ori];
        let ef = piece2[0];
        let ef_ = piece2[1];
        edgePieces = edgePieces.filter(x => x != shuffledEdgePieces[0] && x != shuffledEdgePieces[1]);

        cube.move(getEdgeParityAlg(edgeBuffer, ef));
        cube.move(getEdgeParityAlg(edgeBuffer, "UR"));
        cube.move(getEdgeParityAlg(edgeBuffer, lt));
        cube.move(getEdgeParityAlg(edgeBuffer, ef_));
        log("LTEF: " + lt + "[" + ef + "]");
        addDebugLine("LTEF: " + lt + "[" + ef + "]");
    }
    else if (edgeScrambleType == "2-Swap") {
        // Buffer order for "Only select later buffers" option
        const F2E_BUFFER_ORDER = ["UB", "UL", "FR", "FL", "DF", "DR", "DL", "DB", "BR", "BL"];

        // Check edge 2-Swap mode toggle (unoriented = F2E, oriented = Floating 2E)
        const edgeTwoSwapMode = document.querySelector('input[name="edgeTwoSwapMode"]:checked')?.value || 'unoriented';
        const isOriented = edgeTwoSwapMode === 'oriented';

        // Determine parity edge index (UF=0 or UR=2, whichever is not the buffer)
        const parityEdgeIndex = edgeBufferIndex === 0 ? 2 : 0;

        // Get selected first piece targets
        const selectedF2EFirstPieces = [];
        const f2eFirstPieceCheckboxes = document.querySelectorAll('.f2e-first-piece');
        f2eFirstPieceCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedF2EFirstPieces.push(checkbox.value);
            }
        });

        // Check if "Only select later buffers" is enabled
        const onlyLaterBuffers = document.getElementById('f2eOnlyLaterBuffers')?.checked || false;

        // Get list of possible first piece indices (exclude buffer and parity edge)
        const firstPieceIndices = selectedF2EFirstPieces.length > 0
            ? selectedF2EFirstPieces.map(p => EDGES.findIndex(piece => piece[0] === p))
                .filter(i => i !== parityEdgeIndex)
            : edgePieces.filter(i => i !== parityEdgeIndex);

        // Randomly select a first piece
        const firstPieceIndex = firstPieceIndices[Math.floor(Math.random() * firstPieceIndices.length)];
        const firstPieceName = EDGES[firstPieceIndex][0]; // Get primary sticker name

        // Determine available second pieces based on the toggle (also exclude parity edge)
        let availableSecondPieceIndices;
        if (onlyLaterBuffers) {
            // Only allow pieces that come later in the buffer order
            const firstPieceOrderPos = F2E_BUFFER_ORDER.indexOf(firstPieceName);
            const laterPieces = F2E_BUFFER_ORDER.slice(firstPieceOrderPos + 1);
            availableSecondPieceIndices = laterPieces
                .map(p => EDGES.findIndex(piece => piece[0] === p))
                .filter(i => i !== edgeBufferIndex && i !== parityEdgeIndex && i !== firstPieceIndex);
        } else {
            // All pieces except buffer, parity edge, and first piece
            availableSecondPieceIndices = edgePieces.filter(i => i !== parityEdgeIndex && i !== firstPieceIndex);
        }

        // Generate 2-Swap result (isOriented: thirdTarget = firstTarget, else thirdTarget = flipped sticker)
        const result = generate2E(firstPieceIndex, availableSecondPieceIndices, isOriented, edgeBufferIndex);
        const modeLabel = isOriented ? "2-Swap (Oriented)" : "2-Swap (F2E)";
        log(modeLabel + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log(modeLabel + ": cycleTargets=" + result.cycleTargets.join(" "));
        log(modeLabel + ": remainingTargets=" + result.remainingTargets.join(" "));
        addDebugLine(modeLabel + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine(modeLabel + ": cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine(modeLabel + ": remainingTargets=" + result.remainingTargets.join(" "));

        // Apply Jb perm first (UF UR UFL UBR parity)
        cube.move(Jb_PERM);

        // Apply cube state: parity alg for each target in order (third, second, first)
        cube.move(getEdgeParityAlg(edgeBuffer, result.thirdTarget));
        cube.move(getEdgeParityAlg(edgeBuffer, result.secondTarget));
        cube.move(getEdgeParityAlg(edgeBuffer, result.firstTarget));
        for (let target of result.cycleTargets) {
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        }
        for (let target of result.remainingTargets) {
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        }

        // Clear edgePieces since we've handled all edges
        edgePieces = [];
    }
    else if (edgeScrambleType == "Random") {
        // Generate random edge state
        // We need to account for corner parity - check current cube state
        const currentCubeStr = cube.asString();
        const currentCube = Cube.fromString(currentCubeStr);
        const cornerParity = currentCube.cornerParity();

        // Generate random edges with solved corners
        const randomEdgeCubeStr = generateRandomState("solved", "random");
        log("Random edges state: " + randomEdgeCubeStr);
        addDebugLine("Random edges state: " + randomEdgeCubeStr);

        // Extract just the edge positions from the random cube and apply them
        // We do this by: getting the random edge cube, then combining with current corners
        let combinedCubeStr = currentCubeStr;

        // Copy edge facelets from random edge cube to combined cube
        for (const idx of ALL_EDGE_INDICES) {
            combinedCubeStr = setCharAt(combinedCubeStr, idx, randomEdgeCubeStr[idx]);
        }

        // Check if the combined state is solvable (parities must match)
        const combinedCube = Cube.fromString(combinedCubeStr);
        const edgeParity = combinedCube.edgeParity();

        if (cornerParity !== edgeParity) {
            // Fix parity by swapping UF and UR edges
            let temp1 = combinedCubeStr[5];
            combinedCubeStr = setCharAt(combinedCubeStr, 5, combinedCubeStr[7]);
            combinedCubeStr = setCharAt(combinedCubeStr, 7, temp1);
            let temp2 = combinedCubeStr[10];
            combinedCubeStr = setCharAt(combinedCubeStr, 10, combinedCubeStr[19]);
            combinedCubeStr = setCharAt(combinedCubeStr, 19, temp2);
            log("Random edges: Fixed parity by swapping UF/UR");
            addDebugLine("Random edges: Fixed parity by swapping UF/UR");
        }

        log("Random edges combined state: " + combinedCubeStr);
        addDebugLine("Random edges combined state: " + combinedCubeStr);

        // Reset cube and apply the combined state
        cube.identity();
        const finalCube = Cube.fromString(combinedCubeStr);
        cube.move(invertMoves(finalCube.solve()));

        // Clear edgePieces since we've handled all edges
        edgePieces = [];
    }

    let edgeComms = generateCommTargets(edgePieces, "e", solveEdgeIfOdd);
    log("Edge comms: " + (edgeComms.length ? edgeComms.join(" ") : "None") + " (" + edgeComms.length + ")");
    addDebugLine("Edge comms: " + (edgeComms.length ? edgeComms.join(" ") : "None") + " (" + edgeComms.length + ")");
    for (let i = edgeComms.length - 1; i > 0; i -= 2) {
        cube.move(getEdgeParityAlg(edgeBuffer, edgeComms[i-1]));
        cube.move(getEdgeParityAlg(edgeBuffer, edgeComms[i]));
    }

    // Double-Parity correction: when both corner and edge are Parity, the two
    // parity algs interfere (each one swaps the buffer-piece of the other layer).
    // Apply one extra alg to undo the conflict. There are two cases:
    //   - Normal: edge target is on a regular non-buffer edge → use the OTHER
    //     (unused) edge buffer's table with that target.
    //   - Special: edge target is on the other-buffer's piece itself (UF/FU when
    //     buffer=UR, or UR/RU when buffer=UF) → apply the fixed UF↔UR + UFR↔UBR
    //     swap alg (looked up via getEdgeParityAlg(otherEdgeBuffer, edgeBuffer)).
    // if (cornerScrambleType === "Parity" && doubleParityEdgeTarget) {
    //     const otherEdgeBuffer = (edgeBuffer === "UF") ? "UR" : "UF";
    //     const targetIsOnOtherBuffer = (doubleParityEdgeTarget === otherEdgeBuffer ||
    //                                    doubleParityEdgeTarget === otherEdgeBuffer.split('').reverse().join(''));
    //     const correctionTarget = targetIsOnOtherBuffer ? edgeBuffer : doubleParityEdgeTarget;
    //     cube.move(getEdgeParityAlg(otherEdgeBuffer, correctionTarget));
    //     log("Double-Parity correction: " + otherEdgeBuffer + "/UFR-UBR with edge target " + correctionTarget);
    //     addDebugLine("Double-Parity correction: " + otherEdgeBuffer + "/UFR-UBR with edge target " + correctionTarget);
    // }

    // Check if parity edge is solved (only for 2-Swap edge mode)
    if (edgeScrambleType == "2-Swap") {
        const cubeState = cube.asString();
        const parityEdgeSolved = isParityEdgeSolved(cubeState, edgeBuffer);
        log("2-Swap: cubeState=" + cubeState);
        log("2-Swap: UF check: pos7=" + cubeState[7] + " pos19=" + cubeState[19]);
        log("2-Swap: UR check: pos5=" + cubeState[5] + " pos10=" + cubeState[10]);
        log("2-Swap: parityEdgeSolved=" + parityEdgeSolved);
        addDebugLine("2-Swap: cubeState=" + cubeState);
        addDebugLine("2-Swap: UF check: pos7=" + cubeState[7] + " pos19=" + cubeState[19]);
        addDebugLine("2-Swap: UR check: pos5=" + cubeState[5] + " pos10=" + cubeState[10]);
        addDebugLine("2-Swap: parityEdgeSolved=" + parityEdgeSolved);

        // If parity edge is solved, apply UF_UR_FLIP to make it unsolved
        if (parityEdgeSolved) {
            cube.move(UF_UR_FLIP);
            log("2-Swap: Applied UF_UR_FLIP to make parity edge unsolved");
            addDebugLine("2-Swap: Applied UF_UR_FLIP to make parity edge unsolved");
        }
    }

    // get the scramble and do in correct orientation
    let scramble = invertMoves(cube.solve());
    cube.identity();
    cube.move(getOrientationMoves());
    cube.move(scramble);

    if (!silent) {
        const scrambleText = document.getElementById('scramble');
        if (scrambleText) {
            scrambleText.textContent = scramble;
            scrambleText.classList.remove('hidden');
        }
        log("Scramble: " + scramble);
        vc.cubeString = cube.asString();
        vc.drawCube(ctx);
    }

    return scramble;
}

function generateMultipleScrambles() {
    const numScramblesInput = document.getElementById('numScrambles');
    const numScrambles = parseInt(numScramblesInput.value) || 1;

    if (numScrambles === 1) {
        // Single scramble - use original display with cube visualization
        generateScramble();
        document.getElementById('scrambleList').classList.add('hidden');
    } else {
        // Multiple scrambles - generate and display as a list
        const scrambles = [];
        for (let i = 0; i < numScrambles; i++) {
            scrambles.push(generateScramble({ silent: true }));
        }

        // Hide the single scramble display and cube
        const scrambleElement = document.getElementById('scramble');
        if (scrambleElement) {
            scrambleElement.classList.add('hidden');
        }

        // Display the list of scrambles
        const scrambleList = document.getElementById('scrambleList');
        let listHTML = '<div class="alert alert-success" role="alert">';
        listHTML += '<h6 class="mb-3">Generated ' + numScrambles + ' scrambles:</h6>';
        scrambles.forEach((scramble, index) => {
            listHTML += '<div class="mb-2"><strong>' + (index + 1) + '.</strong> ' + scramble + '</div>';
        });
        listHTML += '</div>';
        scrambleList.innerHTML = listHTML;
        scrambleList.classList.remove('hidden');

        // Hide debug text
        const debugElement = document.getElementById('debugText');
        if (debugElement) {
            debugElement.classList.add('hidden');
        }
    }
}

function generateBulkScrambles() {
    console.log("Bulk scramble generation started");
    const numScramblesInput = document.getElementById('numScrambles');
    const numScrambles = parseInt(numScramblesInput.value) || 1;
    const scrambleElement = document.getElementById('scramble');

    const scrambles = [];
    for (let i = 0; i < numScrambles; ++i) {
        scrambles.push(generateScramble({ silent: true }));
        if (numScrambles > 1 && (i + 1) % 10 === 0) {
            scrambleElement.textContent = `Generating... ${i + 1}/${numScrambles}`;
            console.log(`Generated ${i + 1}/${numScrambles} scrambles...`);
        }
    }

    const allScrambles = scrambles.join("\n");
    if (numScrambles > 1) {
        scrambleElement.textContent = `Generated ${numScrambles} scrambles (see console)`;
    }
    console.log(allScrambles);
}

function debug() {
    const debugText = document.getElementById('debugText');
    debugText.textContent = debugString;
    debugText.classList.remove('hidden');
    console.log("Debug on")
}
