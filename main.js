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
// Cube string format: 54 chars - U(0-8), R(9-17), F(18-26), D(27-35), L(36-44), B(45-53)
// UF edge: position 7 (U face) and position 19 (F face)
// UR edge: position 5 (U face) and position 10 (R face)
function isParityEdgeSolved(cubeStr, edgeBuffer) {
    if (edgeBuffer === "UF") {
        // Buffer is UF, so parity edge is UR - check positions 5 and 10
        return cubeStr[5] === 'U' && cubeStr[10] === 'R';
    } else {
        // Buffer is UR (or other), so parity edge is UF - check positions 7 and 19
        return cubeStr[7] === 'U' && cubeStr[19] === 'F';
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const savedValue = localStorage.getItem('holdingOrientation');
    if (savedValue !== null) {
        holdingOrientation.value = savedValue;
    }
    holdingOrientation.addEventListener('input', function() {
        localStorage.setItem('holdingOrientation', holdingOrientation.value);
    });

    cube.move(holdingOrientation.value);
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
        // Randomly select 2-7 pieces for the cycle
        const numCyclePieces = Math.floor(Math.random() * 6) + 2;

        // Shuffle and split into cycle pieces and remaining pieces
        const shuffledPieces = shuffleArray([...cornerPieces]);
        const cyclePieces = shuffledPieces.slice(0, numCyclePieces);
        const leftoverPieces = shuffledPieces.slice(numCyclePieces);

        // Generate isolated cycle with random first target and orientation
        const cycleFirstTargetOri = Math.floor(Math.random() * 3);
        const cycleFirstTarget = CORNERS[cyclePieces[0]][cycleFirstTargetOri];
        const orientationNumber = Math.floor(Math.random() * 3);
        const cycleTargets = generateIsolatedCycle(cyclePieces, cycleFirstTarget, orientationNumber);

        // Generate random targets for remaining pieces
        const remainingTargets = [];
        for (let i of leftoverPieces) {
            const ori = Math.floor(Math.random() * 3);
            remainingTargets.push(CORNERS[i][ori]);
        }

        log("Comms: cycleTargets=" + cycleTargets.join(" "));
        log("Comms: remainingTargets=" + remainingTargets.join(" "));
        addDebugLine("Comms: cycleTargets=" + cycleTargets.join(" "));
        addDebugLine("Comms: remainingTargets=" + remainingTargets.join(" "));

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

        cube.move(generateParityAlg("UF", "UR", cornerBuffer, parityTarget));
        log("Corner parity: " + parityTarget);
        addDebugLine("Corner parity: " + parityTarget);
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
    else if (cornerScrambleType == "2-twist") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let ori = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let twist = CORNERS[shuffledCornerPieces[0]][ori];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0]);

        cube.move(invertMoves(generateCOAlg([twist])));
        log("2-twist: " + twist);
        addDebugLine("2-twist: " + twist);
    }
    else if (cornerScrambleType == "Floating 2T") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let ori1 = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let ori2 = 3 - ori1; // other direction
        let twist1 = CORNERS[shuffledCornerPieces[0]][ori1];
        let twist2 = CORNERS[shuffledCornerPieces[1]][ori2];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

        cube.move(invertMoves(generateCOAlg([twist1])));
        cube.move(invertMoves(generateCOAlg([twist2])));
        log("Floating 2-twist: " + twist1 + " " + twist2);
        addDebugLine("Floating 2-twist: " + twist1 + " " + twist2);
    }
    else if (cornerScrambleType == "3-twist") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let ori = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let twist1 = CORNERS[shuffledCornerPieces[0]][ori];
        let twist2 = CORNERS[shuffledCornerPieces[1]][ori];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

        cube.move(invertMoves(generateCOAlg([twist1])));
        cube.move(invertMoves(generateCOAlg([twist2])));
        log("3-twist: " + twist1 + " " + twist2);
        addDebugLine("3-twist: " + twist1 + " " + twist2);
    }
    else if (cornerScrambleType == "LTCT") {
        // Check LTCT mode: pieces or stickers
        const ltctMode = document.querySelector('input[name="ltctMode"]:checked').value;

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
            const result = generateLTCT(parity, twist);
            log("LTCT: twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" "));
            addDebugLine("LTCT: twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" "));

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
            const result = generateLTCT2(selectedCombo.parityPieceIndex, selectedCombo.twistPieceIndex);
            log("LTCT: twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" "));
            addDebugLine("LTCT: twist=" + result.twist + " cycle=" + result.targets.join(" ") + " remaining=" + result.remainingTargets.join(" "));

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
    else if (cornerScrambleType == "T2C") {
        // Buffer order for "Only select later buffers" option
        const T2C_BUFFER_ORDER = ["UFL", "UBR", "UBL", "DFR", "DFL", "DBL", "DBR"];

        // Get selected T2C first piece targets
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

        // Generate T2C result with optional restricted second piece selection
        const result = generate2C(firstPieceIndex, availableSecondPieceIndices, false);
        log("T2C: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log("T2C: cycleTargets=" + result.cycleTargets.join(" "));
        log("T2C: remainingTargets=" + result.remainingTargets.join(" "));
        addDebugLine("T2C: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine("T2C: cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine("T2C: remainingTargets=" + result.remainingTargets.join(" "));

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
    else if (cornerScrambleType == "Floating 2C") {
        // Buffer order for "Only select later buffers" option (same as T2C)
        const T2C_BUFFER_ORDER = ["UFL", "UBR", "UBL", "DFR", "DFL", "DBL", "DBR"];

        // Get selected T2C first piece targets (reuse T2C settings)
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

        // Generate Floating 2C result (thirdTarget = firstTarget)
        const result = generate2C(firstPieceIndex, availableSecondPieceIndices, true);
        log("Floating 2C: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log("Floating 2C: cycleTargets=" + result.cycleTargets.join(" "));
        log("Floating 2C: remainingTargets=" + result.remainingTargets.join(" "));
        addDebugLine("Floating 2C: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine("Floating 2C: cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine("Floating 2C: remainingTargets=" + result.remainingTargets.join(" "));

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
    else if (edgeScrambleType == "UF 2F") {
        let flipI = Math.floor(Math.random() * edgePieces.length);
        let flipPiece = EDGES[edgePieces[flipI]];
        let flip = flipPiece[0];
        edgePieces.splice(flipI, 1);

        cube.move(generateEOAlg([flip], edgeBuffer));
        log("2-flip: " + flip);
        addDebugLine("2-flip: " + flip);
    }
    else if (edgeScrambleType == "Floating 2F") {
        let shuffledEdgePieces = shuffleArray(edgePieces);
        let piece1 = EDGES[shuffledEdgePieces[0]];
        let piece2 = EDGES[shuffledEdgePieces[1]];
        let flip1 = piece1[0];
        let flip2 = piece2[0];
        edgePieces = edgePieces.filter(x => x != shuffledEdgePieces[0] && x != shuffledEdgePieces[1]);

        cube.move(generateEOAlg([flip1], edgeBuffer));
        cube.move(generateEOAlg([flip2], edgeBuffer));
        log("Floating 2-flip: " + flip1 + " " + flip2);
        addDebugLine("Floating 2-flip: " + flip1 + " " + flip2);
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
    else if (edgeScrambleType == "F2E") {
        // Buffer order for "Only select later buffers" option
        const F2E_BUFFER_ORDER = ["UB", "UL", "FR", "FL", "DF", "DR", "DL", "DB", "BR", "BL"];

        // Determine parity edge index (UF=0 or UR=2, whichever is not the buffer)
        const parityEdgeIndex = edgeBufferIndex === 0 ? 2 : 0; // If buffer is UF(0), parity is UR(2); else parity is UF(0)

        // Get selected F2E first piece targets
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

        // Generate F2E result (thirdTarget = flipped sticker)
        const result = generate2E(firstPieceIndex, availableSecondPieceIndices, false, edgeBufferIndex, parityEdgeIndex);
        log("F2E: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log("F2E: cycleTargets=" + result.cycleTargets.join(" "));
        log("F2E: remainingTargets=" + result.remainingTargets.join(" "));
        addDebugLine("F2E: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine("F2E: cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine("F2E: remainingTargets=" + result.remainingTargets.join(" "));

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

        // Check if parity edge is solved
        const cubeState = cube.asString();
        const parityEdgeSolved = isParityEdgeSolved(cubeState, edgeBuffer);
        log("F2E: parityEdgeSolved=" + parityEdgeSolved);
        addDebugLine("F2E: parityEdgeSolved=" + parityEdgeSolved);

        // If parity edge is solved, apply UF_UR_FLIP to unsolve it
        if (parityEdgeSolved) {
            cube.move(UF_UR_FLIP);
            log("F2E: Applied UF_UR_FLIP");
            addDebugLine("F2E: Applied UF_UR_FLIP");
        }

        // Clear edgePieces since we've handled all edges
        edgePieces = [];
    }
    else if (edgeScrambleType == "Floating 2E") {
        // Buffer order for "Only select later buffers" option (same as F2E)
        const F2E_BUFFER_ORDER = ["UB", "UL", "FR", "FL", "DF", "DR", "DL", "DB", "BR", "BL"];

        // Determine parity edge index (UF=0 or UR=2, whichever is not the buffer)
        const parityEdgeIndex = edgeBufferIndex === 0 ? 2 : 0;

        // Get selected F2E first piece targets (reuse F2E settings)
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

        // Generate Floating 2E result (thirdTarget = firstTarget)
        const result = generate2E(firstPieceIndex, availableSecondPieceIndices, true, edgeBufferIndex, parityEdgeIndex);
        log("Floating 2E: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log("Floating 2E: cycleTargets=" + result.cycleTargets.join(" "));
        log("Floating 2E: remainingTargets=" + result.remainingTargets.join(" "));
        addDebugLine("Floating 2E: firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine("Floating 2E: cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine("Floating 2E: remainingTargets=" + result.remainingTargets.join(" "));

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

        // Check if parity edge is solved
        const cubeState = cube.asString();
        const parityEdgeSolved = isParityEdgeSolved(cubeState, edgeBuffer);
        log("Floating 2E: parityEdgeSolved=" + parityEdgeSolved);
        addDebugLine("Floating 2E: parityEdgeSolved=" + parityEdgeSolved);

        // If parity edge is solved, apply UF_UR_FLIP to unsolve it
        if (parityEdgeSolved) {
            cube.move(UF_UR_FLIP);
            log("Floating 2E: Applied UF_UR_FLIP");
            addDebugLine("Floating 2E: Applied UF_UR_FLIP");
        }

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

    // get the scramble and do in correct orientation
    let scramble = invertMoves(cube.solve());
    cube.identity();
    cube.move(holdingOrientation.value);
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

    const scrambles = [];
    for (let i = 0; i < numScrambles; ++i) {
        scrambles.push(generateScramble({ silent: true }));
        if ((i + 1) % 100 === 0) {
            console.log(`Generated ${i + 1}/${numScrambles} scrambles...`);
        }
    }

    const allScrambles = scrambles.join("\n");
    console.log(allScrambles);
}

function debug() {
    const debugText = document.getElementById('debugText');
    debugText.textContent = debugString;
    debugText.classList.remove('hidden');
    console.log("Debug on")
}
