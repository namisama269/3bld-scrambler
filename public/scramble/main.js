// Module-level state. Initialized lazily via window.initScrambler(canvas) so
// the React app can mount the canvas and wire callbacks before any cube ops.
let cube = null;
let vc = null;
let ctx = null;
let canvas = null;
let holdingOrientationKey = 'wg';
let debugString = '';

function ensureInit() {
    if (cube && vc && ctx) return;
    throw new Error('Scrambler not initialized — call window.initScrambler(canvas) first.');
}

window.initScrambler = function (canvasEl, opts = {}) {
    if (!canvasEl) throw new Error('initScrambler: canvas element is required');
    Cube.initSolver();
    cube = new Cube();
    canvas = canvasEl;
    ctx = canvasEl.getContext('2d');
    vc = new VisualCube(1200, 1200, 360, -0.523598, -0.209439, 0, 3, 0.08);
    if (opts.holdingOrientation) holdingOrientationKey = opts.holdingOrientation;
    cube.identity();
    cube.move(getOrientationMoves());
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
};

window.setHoldingOrientation = function (key) {
    holdingOrientationKey = key;
    if (cube && vc && ctx) {
        cube.identity();
        cube.move(getOrientationMoves());
        vc.cubeString = cube.asString();
        vc.drawCube(ctx);
    }
};

// Paint a 54-char URFDLB facelet string directly on the shared canvas.
// Used by the BLD Helper tab, which builds its own scramble via cubeutil
// and just needs to render the resulting cube state.
window.renderFaceletString = function (facelet) {
    if (!vc || !ctx) return;
    vc.cubeString = facelet;
    vc.drawCube(ctx);
};

// Cube string format: 54 chars — U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53).
// UF edge stickers: indices 7 (U face) + 19 (F face).
// UR edge stickers: indices 5 (U face) + 10 (R face).
function isParityEdgeSolved(cubeStr, edgeBuffer) {
    if (edgeBuffer === 'UF') {
        return cubeStr[5] === 'U' && (cubeStr[10] === 'F' || cubeStr[10] === 'R');
    }
    return cubeStr[7] === 'U' && (cubeStr[19] === 'F' || cubeStr[19] === 'R');
}

function getOrientationMoves() {
    return ORIENTATION_MOVES[holdingOrientationKey] || '';
}

function buildScrambleConfig(options) {
    const c = options.config || {};
    return {
        cornerBuffer: c.cornerBuffer || 'UFR',
        edgeBuffer: c.edgeBuffer || 'UF',
        cornerScrambleType: c.cornerScrambleType || 'Solved',
        edgeScrambleType: c.edgeScrambleType || 'Solved',
        cornerTargetCount: c.cornerTargetCount ?? 8,
        parityTargets: c.parityTargets || [],
        paritySpecialTargets: c.paritySpecialTargets || [],
        cornerTwistCount: c.cornerTwistCount ?? 2,
        cornerTwistExtraCount: c.cornerTwistExtraCount ?? 0,
        cornerTwistDirection: c.cornerTwistDirection || 'mixed',
        cornerTwistTargets: c.cornerTwistTargets || [],
        ltctMode: c.ltctMode || 'pieces',
        ltctCount: c.ltctCount ?? 7,
        ltctParityTargets: c.ltctParityTargets || [],
        ltctTwistTargets: c.ltctTwistTargets || [],
        ltct2ParityTargets: c.ltct2ParityTargets || [],
        ltct2TwistTargets: c.ltct2TwistTargets || [],
        twoSwapMode: c.twoSwapMode || 'unoriented',
        t2cFirstPieces: c.t2cFirstPieces || [],
        t2cOnlyLaterBuffers: !!c.t2cOnlyLaterBuffers,
        edgeParityCount: c.edgeParityCount ?? 11,
        edgeParityTargets: c.edgeParityTargets || [],
        flipExtraCount: c.flipExtraCount ?? 0,
        flipCustomCount: c.flipCustomCount ?? 2,
        flipTargets: c.flipTargets || [],
        flipParityTargets: c.flipParityTargets || [],
        edgeTwoSwapMode: c.edgeTwoSwapMode || 'unoriented',
        f2eFirstPieces: c.f2eFirstPieces || [],
        f2eOnlyLaterBuffers: !!c.f2eOnlyLaterBuffers,
        f2eExtraCount: c.f2eExtraCount ?? 6,
        edgeTargetCount: c.edgeTargetCount ?? 12,
        f2eBufferOrder: c.f2eBufferOrder || ['UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL', 'BR', 'BL'],
        floatingTargetCount: c.floatingTargetCount ?? 4,
        floatingBuffers: c.floatingBuffers || [],
        floatingDistribution: c.floatingDistribution || 'equal',
        floatingCornerTargetCount: c.floatingCornerTargetCount ?? 4,
        floatingCornerBuffers: c.floatingCornerBuffers || [],
        floatingCornerDistribution: c.floatingCornerDistribution || 'equal',
        cornerBufferOrder: c.cornerBufferOrder || ['UFR', 'UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBR', 'DBL'],
        edgeBufferOrder: c.edgeBufferOrder || ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
    };
}

// generate scramble

function generateScramble(options = {}) {
    ensureInit();
    const { silent = false } = options;
    const cfg = buildScrambleConfig(options);
    const log = silent ? () => {} : (...args) => console.log(...args);
    const addDebugLine = silent ? () => {} : (line) => {
        debugString += line + "\n";
    };

    log("Generating scramble");
    cube.identity();
    if (!silent) {
        debugString = "";
    }

    // Capture every alg fed to cube.move during scramble construction so the
    // debug log can show the full applied execution. Restore in `finally`.
    // Each push records `{alg, label}` — label resolves from a reverse-lookup
    // of named tables first, falling back to the contextual label set by the
    // surrounding code via `_ctxLabel`.
    const appliedAlgs = [];
    let _ctxLabel = '';
    const _algLookup = (() => {
        const map = new Map();
        if (typeof Jb_PERM !== 'undefined') map.set(Jb_PERM.trim(), 'Jb perm');
        if (typeof UF_UR_FLIP !== 'undefined') map.set(UF_UR_FLIP.trim(), 'UF/UR flip (parity edge fix)');
        if (typeof PARITY_UR_X_UFR_UBR !== 'undefined') {
            for (const [target, alg] of Object.entries(PARITY_UR_X_UFR_UBR)) {
                if (alg) map.set(alg.trim(), `Edge parity (UR → ${target})`);
            }
        }
        if (typeof PARITY_UF_X_UFR_UBR !== 'undefined') {
            for (const [target, alg] of Object.entries(PARITY_UF_X_UFR_UBR)) {
                if (alg) map.set(alg.trim(), `Edge parity (UF → ${target})`);
            }
        }
        if (typeof PARITY_UF_UR_UFR_X !== 'undefined') {
            for (const [target, alg] of Object.entries(PARITY_UF_UR_UFR_X)) {
                if (alg) map.set(alg.trim(), `Corner parity (UFR → ${target})`);
            }
        }
        return map;
    })();
    const origMove = cube.move.bind(cube);
    cube.move = function (alg) {
        const trimmed = (alg || '').trim();
        if (trimmed) {
            // Call-site context wins over the table lookup — same alg string can
            // serve different roles (e.g. Jb perm vs corner parity (UFR→UBR)).
            const label = _ctxLabel || _algLookup.get(trimmed) || 'Generated alg';
            appliedAlgs.push({ alg: trimmed, label });
        }
        return origMove(alg);
    };

    let scramble;
    try {

    const cornerBuffer = cfg.cornerBuffer;
    if (cornerBuffer !== "UFR") {
        console.warn("Non-UFR buffers are not fully supported yet. Some scramble types may not work correctly.");
    }
    let cornerScrambleType = cfg.cornerScrambleType;
    let edgeScrambleType = cfg.edgeScrambleType;
    const edgeBuffer = cfg.edgeBuffer;

    // Edge "Targets" is the merged Comms+Parity entry — dispatch to the
    // appropriate underlying branch based on count parity. cfg.edgeTargetCount
    // is the unified target count, mirrored into the legacy fields here.
    if (edgeScrambleType === 'Targets') {
        const targetCount = cfg.edgeTargetCount ?? 12;
        if (targetCount % 2 === 1) {
            edgeScrambleType = 'Parity';
            cfg.edgeParityCount = targetCount;
        } else {
            edgeScrambleType = 'Comms';
            cfg.edgeCommsCount = targetCount;
        }
    }

    // Corner "Targets" is the merged Comms+Parity entry — same dispatch as
    // edges, against cfg.cornerTargetCount.
    if (cornerScrambleType === 'Targets') {
        const targetCount = cfg.cornerTargetCount ?? 8;
        if (targetCount % 2 === 1) {
            cornerScrambleType = 'Parity';
            cfg.parityCount = targetCount;
        } else {
            cornerScrambleType = 'Comms';
            cfg.commsCount = targetCount;
        }
    }
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
        const commsCount = cfg.commsCount;

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
            remainingTargets = randomTargetsForPieces(piecesToUse, true);
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
            remainingTargets = randomTargetsForPieces(leftoverPieces, true);
        }

        log("Comms (count=" + commsCount + "): cycleTargets=" + cycleTargets.join(" "));
        log("Comms (count=" + commsCount + "): remainingTargets=" + remainingTargets.join(" "));
        addDebugLine("Comms (count=" + commsCount + "): cycleTargets=" + cycleTargets.join(" "));
        addDebugLine("Comms (count=" + commsCount + "): remainingTargets=" + remainingTargets.join(" "));

        // Apply cube state: parity alg for each target. Tag cycle vs
        // remaining so the Applied-algs footer keeps the structure visible.
        const cycN = cycleTargets.length;
        cycleTargets.forEach((target, i) => {
            _ctxLabel = "Corner Comms cycle " + (i + 1) + "/" + cycN + " (target=" + target + ")";
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        });
        const remN = remainingTargets.length;
        remainingTargets.forEach((target, i) => {
            _ctxLabel = "Corner Comms remaining " + (i + 1) + "/" + remN + " (target=" + target + ")";
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        });
        _ctxLabel = '';

        // Clear cornerPieces since we've handled all corners
        cornerPieces = [];
    }
    else if (cornerScrambleType == "Parity") {
        // Get parity count setting (1, 3, 5, or 7)
        const parityCount = cfg.parityCount;
        const selectedParityTargets = [...cfg.parityTargets];

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
        const paritySpecialTargetCheckboxes = (cfg.paritySpecialTargets || []).map((v) => ({ checked: true, value: v }));
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
    else if (cornerScrambleType == "Floating") {
        // Mirrors the edge Floating logic: pick a floating corner buffer F
        // (multi-select + Equal/Weighted distribution), then chain corner
        // J-perm setups so F + N targets form the cycle. Note that the
        // corner J-perm alg PARITY_UF_UR_UFR_X is a 3-cycle (UFR UBR target)
        // rather than a clean 2-cycle, so chains will involve UBR. The
        // active corner buffer (UFR) is solved at the end.
        const cornerOrder = cfg.cornerBufferOrder || [];
        // Position 0 (main corner buffer) hidden — Floating means non-main.
        const floatingPool = cornerOrder.slice(1, -2);
        const candidates = (cfg.floatingCornerBuffers || []).filter(p => floatingPool.includes(p));
        if (candidates.length === 0) {
            throw new Error("Corner Floating: at least one corner buffer must be selected");
        }

        // Keep in sync with CORNER_WEIGHTS in src/constants.js.
        const FLOATING_CORNER_WEIGHTS = [378, 270, 180, 108, 54, 18];
        const distribution = cfg.floatingCornerDistribution === 'weighted' ? 'weighted' : 'equal';
        let floatingBuffer;
        if (distribution === 'weighted') {
            const weights = candidates.map(p => FLOATING_CORNER_WEIGHTS[cornerOrder.indexOf(p)] || 0);
            const total = weights.reduce((a, b) => a + b, 0);
            if (total <= 0) {
                floatingBuffer = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                let r = Math.random() * total;
                let pickIdx = candidates.length - 1;
                for (let i = 0; i < candidates.length; i++) {
                    r -= weights[i];
                    if (r < 0) { pickIdx = i; break; }
                }
                floatingBuffer = candidates[pickIdx];
            }
        } else {
            floatingBuffer = candidates[Math.floor(Math.random() * candidates.length)];
        }

        const floatingIdx = cornerOrder.indexOf(floatingBuffer);
        const laterPieceNames = cornerOrder.slice(floatingIdx + 1);
        const cyclePool = laterPieceNames
            .map(name => CORNERS.findIndex(c => c[0] === name))
            .filter(idx => idx >= 0 && cornerPieces.includes(idx));

        let N;
        if (candidates.length > 1) {
            N = cyclePool.length - (cyclePool.length % 2); // BT default
        } else {
            const requestedN = Math.max(1, cfg.floatingCornerTargetCount ?? 4);
            N = Math.min(requestedN, cyclePool.length);
            if (N < requestedN) {
                log("Corner Floating: clamped target count from " + requestedN + " to " + N);
                addDebugLine("Corner Floating: clamped target count from " + requestedN + " to " + N);
            }
        }

        const otherPieceIndices = shuffleArray([...cyclePool]).slice(0, N);
        const otherTargets = otherPieceIndices.map(idx => CORNERS[idx][Math.floor(Math.random() * 3)]);

        const isActiveAsFloating = floatingBuffer === cornerBuffer;
        let seq;
        if (isActiveAsFloating) {
            seq = otherTargets;
        } else {
            const F_target = CORNERS[CORNERS.findIndex(c => c[0] === floatingBuffer)][Math.floor(Math.random() * 3)];
            seq = [F_target, ...otherTargets, F_target];
        }

        log("Corner Floating: floatingBuffer=" + floatingBuffer + " (distribution=" + distribution + ", from " + candidates.length + ") seq=" + seq.join(" "));
        addDebugLine("Corner Floating: floatingBuffer=" + floatingBuffer + " (distribution=" + distribution + ", from " + candidates.length + ") seq=" + seq.join(" "));

        seq.forEach((target, i) => {
            _ctxLabel = "Corner Floating " + (i + 1) + "/" + seq.length + " (target=" + target + ")";
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        });
        _ctxLabel = '';

        cornerPieces = [];
    }
    else if (cornerScrambleType == "Twist") {
        // N = number of non-buffer corners to twist. Each picked piece gets a
        // random orientation 1 or 2 (CW or CCW). The buffer's CO is auto-set
        // by the alg composition: Σ orientations ≡ 0 mod 3 across all corners.
        const N = Math.max(1, Math.min(7, cfg.cornerTwistCount ?? 2));
        const extraCount = Math.max(0, Math.min(7 - N, cfg.cornerTwistExtraCount ?? 0));
        const direction = cfg.cornerTwistDirection || 'mixed';

        // Restrict twist candidates to the user's selection (primary stickers
        // like 'UFL', 'UBR', …). Empty selection falls back to all non-buffer
        // pieces — the React-side validator already requires selected ≥ N.
        const twistTargetSet = new Set(cfg.cornerTwistTargets);
        const eligibleCornerPieces = twistTargetSet.size > 0
            ? cornerPieces.filter((i) => twistTargetSet.has(CORNERS[i][0]))
            : cornerPieces;
        const shuffledCornerPieces = shuffleArray([...eligibleCornerPieces]);
        const twistedPieces = shuffledCornerPieces.slice(0, N);

        // Decide each twisted piece's orientation (1=CW or 2=CCW) per the
        // direction setting:
        //   - N=1: random.
        //   - 'same' (N≥2): pick one direction at random; all pieces use it.
        //   - 'mixed' (N≥2): pick 2 random pieces, force one CW and one CCW;
        //     remaining pieces stay random.
        const oris = new Array(N);
        if (N === 1 || direction === 'same') {
            const fixedOri = N === 1
                ? Math.floor(Math.random() * 2) + 1
                : Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < N; i++) oris[i] = fixedOri;
            if (N >= 2 && direction !== 'same') {
                // unreachable — kept for safety
            }
        } else {
            // mixed
            const indices = shuffleArray(Array.from({ length: N }, (_, i) => i));
            const cwIdx = indices[0];
            const ccwIdx = indices[1];
            for (let i = 0; i < N; i++) {
                if (i === cwIdx) oris[i] = 1;
                else if (i === ccwIdx) oris[i] = 2;
                else oris[i] = Math.floor(Math.random() * 2) + 1;
            }
        }
        const twistTargets = twistedPieces.map((idx, i) => CORNERS[idx][oris[i]]);
        cornerPieces = cornerPieces.filter((idx) => !twistedPieces.includes(idx));

        twistTargets.forEach((twist, i) => {
            _ctxLabel = "Corner CO twist " + (i + 1) + "/" + N + " (target=" + twist + ")";
            cube.move(invertMoves(generateCOAlg([twist])));
        });
        _ctxLabel = '';

        const dirLabel = N === 1 ? 'random' : direction;
        log("Custom " + N + "-twist (direction=" + dirLabel + "): " + twistTargets.join(" "));
        addDebugLine("Custom " + N + "-twist (direction=" + dirLabel + "): " + twistTargets.join(" "));

        // Extras: cycle / leftover-target on the remaining (7 − N) non-buffer pool.
        if (extraCount > 0) {
            const extras = generateTwistExtras(cornerPieces, extraCount);
            const allTargets = [...extras.prefixTargets, ...extras.cycleTargets];
            if (extras.prefixTargets.length === 3) {
                cube.move(generateParityAlg("UF", "UR", "UFR", extras.prefixTargets[2]));
                cube.move(generateParityAlg("UF", "UR", "UFR", extras.prefixTargets[1]));
                cube.move(generateParityAlg("UF", "UR", "UFR", extras.prefixTargets[0]));
            }
            for (const target of extras.cycleTargets) {
                cube.move(generateParityAlg("UF", "UR", "UFR", target));
            }
            log("Twist extras (count=" + extraCount + "): " + allTargets.join(" ") +
                (extras.leftoverPieceIndices.length > 0
                    ? " | leftover=" + extras.leftoverPieceIndices.map((i) => CORNERS[i][0]).join(",")
                    : ""));
            addDebugLine("Twist extras (count=" + extraCount + "): " + allTargets.join(" ") +
                (extras.leftoverPieceIndices.length > 0
                    ? " | leftover=" + extras.leftoverPieceIndices.map((i) => CORNERS[i][0]).join(",")
                    : ""));
        }
        // Clear cornerPieces so the main comms loop doesn't process leftovers
        cornerPieces = [];
    }
    else if (cornerScrambleType == "LTCT") {
        // Check LTCT mode: pieces or stickers
        const ltctMode = cfg.ltctMode;
        const ltctCount = cfg.ltctCount;

        if (ltctMode === "stickers") {
            // Stickers mode: use generateLTCT with specific targets
            const selectedLTCTParityTargets = [...cfg.ltctParityTargets];
            const selectedLTCTTwistTargets = [...cfg.ltctTwistTargets];

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
            _ctxLabel = "LTCT corner CO twist (target=" + result.twist + ")";
            cube.move(invertMoves(generateCOAlg([result.twist])));
            _ctxLabel = '';
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
            const selectedLTCTParityPieces = [...cfg.ltct2ParityTargets];
            const selectedLTCTTwistPieces = [...cfg.ltct2TwistTargets];

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
            _ctxLabel = "LTCT corner CO twist (target=" + result.twist + ")";
            cube.move(invertMoves(generateCOAlg([result.twist])));
            _ctxLabel = '';
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

        _ctxLabel = "LTCT corner CO twist (target=" + twist + ")";
        cube.move(invertMoves(generateCOAlg([twist])));
        _ctxLabel = '';
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

        _ctxLabel = "LTCT corner CO twist (target=" + twist + ")";
        cube.move(invertMoves(generateCOAlg([twist])));
        _ctxLabel = '';
        cube.move(generateParityAlg("UF", "UR", "UFR", parity));
        log("LTCT: " + parity + "[" + twist + "]");
        addDebugLine("LTCT: " + parity + "[" + twist + "]");
    }
    else if (cornerScrambleType == "2-Swap") {
        // Buffer order for "Only select later buffers" option
        const T2C_BUFFER_ORDER = ["UFL", "UBR", "UBL", "DFR", "DFL", "DBL", "DBR"];

        // Check 2-Swap mode: unoriented (T2C) or oriented (Floating 2C)
        const twoSwapMode = cfg.twoSwapMode;
        const isOriented = twoSwapMode === 'oriented';

        // Get selected first piece targets
        const selectedT2CFirstPieces = [];
        const t2cFirstPieceCheckboxes = cfg.t2cFirstPieces.map((v) => ({ checked: true, value: v }));
        t2cFirstPieceCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedT2CFirstPieces.push(checkbox.value);
            }
        });

        // Check if "Only select later buffers" is enabled
        const onlyLaterBuffers = cfg.t2cOnlyLaterBuffers;

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
        const edgeParityCount = cfg.edgeParityCount;

        const bufferPieceIndex = EDGES.findIndex(piece => piece.includes(edgeBuffer));
        const selectedEdgeParityTargets = cfg.edgeParityTargets.filter(v => {
            // Defense: never allow a sticker on the buffer's piece as a parity target
            const stickerPieceIndex = EDGES.findIndex(piece => piece.includes(v));
            return stickerPieceIndex !== bufferPieceIndex;
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
        // Edge Comms count = total target J-perms.
        //   count < 12: pick `count` unique non-buffer pieces, one J-perm per
        //     piece with a random sticker. No cycle-break, no piece visited
        //     twice. Leftover pieces stay solved.
        //   count = 12: legacy behavior — random isolated cycle of 2-11
        //     pieces + remaining targets for leftover, totaling 12.
        const commsCount = cfg.edgeCommsCount;
        let cycleTargets = [];
        let remainingTargets = [];

        if (commsCount === 0) {
            // nothing
        } else if (commsCount < edgePieces.length + 1) {
            const shuffledPieces = shuffleArray([...edgePieces]);
            const piecesToUse = shuffledPieces.slice(0, commsCount);
            remainingTargets = randomTargetsForPieces(piecesToUse, false);
        } else {
            const numCyclePieces = Math.floor(Math.random() * 10) + 2; // 2-11
            const shuffledPieces = shuffleArray([...edgePieces]);
            const cyclePieces = shuffledPieces.slice(0, numCyclePieces);
            const leftoverPieces = shuffledPieces.slice(numCyclePieces);

            const cycleFirstTargetOri = Math.floor(Math.random() * 2);
            const cycleFirstTarget = EDGES[cyclePieces[0]][cycleFirstTargetOri];
            const orientationNumber = Math.floor(Math.random() * 2);
            cycleTargets = generateIsolatedCycle(cyclePieces, cycleFirstTarget, orientationNumber);

            remainingTargets = randomTargetsForPieces(leftoverPieces, false);
        }

        log("Edge Comms (count=" + commsCount + "): cycleTargets=" + cycleTargets.join(" "));
        log("Edge Comms (count=" + commsCount + "): remainingTargets=" + remainingTargets.join(" "));
        addDebugLine("Edge Comms (count=" + commsCount + "): cycleTargets=" + cycleTargets.join(" "));
        addDebugLine("Edge Comms (count=" + commsCount + "): remainingTargets=" + remainingTargets.join(" "));

        const eCycN = cycleTargets.length;
        cycleTargets.forEach((target, i) => {
            _ctxLabel = "Edge Comms cycle " + (i + 1) + "/" + eCycN + " (target=" + target + ")";
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        });
        const eRemN = remainingTargets.length;
        remainingTargets.forEach((target, i) => {
            _ctxLabel = "Edge Comms remaining " + (i + 1) + "/" + eRemN + " (target=" + target + ")";
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        });
        _ctxLabel = '';

        edgePieces = [];
    }
    else if (edgeScrambleType == "Flips") {
        const flipExtraCount = cfg.flipExtraCount;
        const parityEdgeIndex = edgeBufferIndex === 0 ? 2 : 0;
        // K = number of generateEOAlg([target], buffer) calls. Each call flips
        // one non-buffer target + toggles the buffer, so the buffer ends
        // flipped iff K is odd — even K means K non-buffer flips; odd K
        // silently adds the buffer for parity.
        const flipCountByMode = Math.max(1, Math.min(11, cfg.flipCustomCount));
        const oddExtras = flipExtraCount % 2 === 1;

        // Pool of eligible flip pieces (exclude buffer + parity edge).
        const flipCandidates = edgePieces.filter(i => i !== parityEdgeIndex);

        const selectedFlipStickers = new Set(cfg.flipTargets);
        const eligibleFlipPieces = (selectedFlipStickers.size === 0)
            ? flipCandidates
            : flipCandidates.filter(i => selectedFlipStickers.has(EDGES[i][0]));

        const selectedParityStickers = [...cfg.flipParityTargets];
        const eligibleParityStickers = (selectedParityStickers.length === 0)
            ? edgePieces.flatMap(i => EDGES[i])
            : selectedParityStickers;

        // Brute-force enumerate valid (flipPieces, parityTargetSticker) combinations.
        // Constraints:
        //   - flipPieces: distinct pieces from eligibleFlipPieces, count = flipCountByMode
        //   - parityTargetSticker (only when oddExtras): on a piece NOT in flipPieces and not buffer
        //   - enough remaining pieces to fill the rest of the extras count
        const validCombos = [];
        const flipPieceCombos = (function () {
            const k = flipCountByMode;
            if (k === 0) return [[]];
            if (k > eligibleFlipPieces.length) return [];
            const out = [];
            (function rec(start, combo) {
                if (combo.length === k) { out.push(combo.slice()); return; }
                for (let i = start; i < eligibleFlipPieces.length; i++) {
                    combo.push(eligibleFlipPieces[i]);
                    rec(i + 1, combo);
                    combo.pop();
                }
            })(0, []);
            return out;
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

        const flipPiecesChosen = chosen.flipPieces;
        const flipStickers = flipPiecesChosen.map(idx => EDGES[idx][0]);
        const flipPieceSet = new Set(flipPiecesChosen);
        edgePieces = edgePieces.filter(x => !flipPieceSet.has(x));
        for (const sticker of flipStickers) {
            _ctxLabel = "Edge EO flip (sticker=" + sticker + ", buffer=" + flipBuffer + ")";
            cube.move(generateEOAlg([sticker], flipBuffer));
        }
        _ctxLabel = '';
        const flipLogLabel = flipCountByMode + "-flip";
        log(flipLogLabel + ": " + flipStickers.join(" ") + " (flipBuffer=" + flipBuffer + ")");
        addDebugLine(flipLogLabel + ": " + flipStickers.join(" ") + " (flipBuffer=" + flipBuffer + ")");

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
    else if (edgeScrambleType == "Floating") {
        // Floating cycle: produce a closed cycle on (N+1) edge pieces that
        // does NOT pass through the active buffer. Implemented by chaining
        // J-perm setups: J(buf,X1) J(buf,X2) … J(buf,X_{N+1}) J(buf,X1) leaves
        // the active buffer solved and creates a cycle on {X1..X_{N+1}}.
        // X1 is the "floating buffer" the user picked from the buffer order.
        // Single-select Floating: user picks ONE buffer F at position ≥ 1 of
        // the buffer order. F is the pivot; the cycle pool is everything
        // strictly after F. The chain
        //   J(activeBuf, F) J(activeBuf, T_1) … J(activeBuf, T_N) J(activeBuf, F)
        // produces an (N+1)-cycle around F, with the active buffer solved.
        const edgeOrder = cfg.edgeBufferOrder || [];
        // Floating pool: positions 1..last-2. Position 0 (main buffer) is
        // hidden because Floating means "not the main buffer".
        const floatingPool = edgeOrder.slice(1, -2);
        const candidates = (cfg.floatingBuffers || []).filter(p => floatingPool.includes(p));
        if (candidates.length === 0) {
            throw new Error("Floating: at least one floating buffer must be selected");
        }
        // Distribution: 'equal' → uniform pick; 'weighted' → pick proportional
        // to the # of (1st, 2nd) sticker-pair cases at each buffer position.
        // Weights are indexed by position in edgeBufferOrder. Keep in sync
        // with EDGE_WEIGHTS in src/constants.js.
        const FLOATING_EDGE_WEIGHTS = [440, 360, 288, 224, 168, 120, 80, 48, 24, 8];
        const distribution = cfg.floatingDistribution === 'weighted' ? 'weighted' : 'equal';
        let floatingBuffer;
        if (distribution === 'weighted') {
            const weights = candidates.map(p => FLOATING_EDGE_WEIGHTS[edgeOrder.indexOf(p)] || 0);
            const total = weights.reduce((a, b) => a + b, 0);
            if (total <= 0) {
                floatingBuffer = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                let r = Math.random() * total;
                let pickIdx = candidates.length - 1;
                for (let i = 0; i < candidates.length; i++) {
                    r -= weights[i];
                    if (r < 0) { pickIdx = i; break; }
                }
                floatingBuffer = candidates[pickIdx];
            }
        } else {
            floatingBuffer = candidates[Math.floor(Math.random() * candidates.length)];
        }
        const floatingIdx = edgeOrder.indexOf(floatingBuffer);

        const laterPieceNames = edgeOrder.slice(floatingIdx + 1);
        const cyclePool = laterPieceNames
            .map(name => EDGES.findIndex(e => e[0] === name))
            .filter(idx => idx >= 0 && edgePieces.includes(idx));
        // Multi-select: target count is fixed per pick at buffer-trainer's
        // default — evenize(laterCount) — so each scramble has a sensible
        // size for whichever buffer was chosen.
        // Single-select: honor the user's chosen target count, capped to
        // what's available.
        let N;
        if (candidates.length > 1) {
            N = cyclePool.length - (cyclePool.length % 2); // evenize
        } else {
            const requestedN = Math.max(1, cfg.floatingTargetCount ?? 4);
            N = Math.min(requestedN, cyclePool.length);
            if (N < requestedN) {
                log("Edge Floating: clamped target count from " + requestedN + " to " + N + " (only " + cyclePool.length + " later buffers after " + floatingBuffer + ")");
                addDebugLine("Edge Floating: clamped target count from " + requestedN + " to " + N);
            }
        }

        const otherPieceIndices = shuffleArray([...cyclePool]).slice(0, N);
        const otherTargets = otherPieceIndices.map(idx => EDGES[idx][Math.floor(Math.random() * 2)]);

        // Two cases for the J-perm chain:
        //   (a) floating buffer == active buffer: the chain is just
        //       J(buf, T_1) … J(buf, T_N), producing a cycle through buf
        //       and N targets. (No J(buf, buf) — the alg table doesn't
        //       define one, and it isn't needed here.)
        //   (b) floating buffer != active buffer: wrap with J(buf, F) on
        //       both ends so the active buffer ends solved, and the cycle
        //       sits on F + the targets.
        const isActiveAsFloating = floatingBuffer === edgeBuffer;
        let seq;
        if (isActiveAsFloating) {
            seq = otherTargets;
        } else {
            const F_target = EDGES[EDGES.findIndex(e => e[0] === floatingBuffer)][Math.floor(Math.random() * 2)];
            seq = [F_target, ...otherTargets, F_target];
        }

        log("Edge Floating: floatingBuffer=" + floatingBuffer + " (distribution=" + distribution + ", from " + candidates.length + ") seq=" + seq.join(" "));
        addDebugLine("Edge Floating: floatingBuffer=" + floatingBuffer + " (distribution=" + distribution + ", from " + candidates.length + ") seq=" + seq.join(" "));

        seq.forEach((target, i) => {
            _ctxLabel = "Floating cycle " + (i + 1) + "/" + seq.length + " (target=" + target + ")";
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        });
        _ctxLabel = '';

        edgePieces = [];
    }
    else if (edgeScrambleType == "2-Swap") {
        // Buffer order for "Only select later buffers" — follows the user's
        // configured edge buffer order (minus UF/UR) so it stays consistent
        // with what the multiselect UI shows.
        const F2E_BUFFER_ORDER = cfg.f2eBufferOrder;

        const edgeTwoSwapMode = cfg.edgeTwoSwapMode;
        const isOriented = edgeTwoSwapMode === 'oriented';

        // Determine parity edge index (UF=0 or UR=2, whichever is not the buffer)
        const parityEdgeIndex = edgeBufferIndex === 0 ? 2 : 0;

        const selectedF2EFirstPieces = [...cfg.f2eFirstPieces];
        const onlyLaterBuffers = cfg.f2eOnlyLaterBuffers;

        // First piece candidates: exclude only the active buffer. The parity
        // edge ("second buffer") IS allowed as a first piece per the user's
        // updated UI. The legacy extras=10 path (handled in generate2E) is
        // already aware of this via its `usedPieces` check.
        const firstPieceIndices = selectedF2EFirstPieces.length > 0
            ? selectedF2EFirstPieces.map(p => EDGES.findIndex(piece => piece[0] === p))
                .filter(i => i >= 0 && i !== edgeBufferIndex)
            : edgePieces;

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

        // Generate 2-Swap result. extraCount controls cycle size — must be
        // even, else the cycle parity cancels the 2-Swap.
        const result = generate2E(firstPieceIndex, availableSecondPieceIndices, isOriented, edgeBufferIndex, cfg.f2eExtraCount);
        const modeLabel = isOriented ? "2-Swap (Oriented)" : "2-Swap (F2E)";
        log(modeLabel + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log(modeLabel + ": cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine(modeLabel + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine(modeLabel + ": cycleTargets=" + result.cycleTargets.join(" "));

        // Apply Jb perm first (UF UR UFL UBR parity), then 2-Swap setup
        // (third, second, first), then the cycle. Each step gets a labeled
        // _ctxLabel so the debug footer reads cleanly.
        _ctxLabel = "2-Swap: Jb perm";
        cube.move(Jb_PERM);
        _ctxLabel = "2-Swap setup: third target = " + result.thirdTarget;
        cube.move(getEdgeParityAlg(edgeBuffer, result.thirdTarget));
        _ctxLabel = "2-Swap setup: second target = " + result.secondTarget;
        cube.move(getEdgeParityAlg(edgeBuffer, result.secondTarget));
        _ctxLabel = "2-Swap setup: first target = " + result.firstTarget;
        cube.move(getEdgeParityAlg(edgeBuffer, result.firstTarget));
        const totalCycle = result.cycleTargets.length;
        result.cycleTargets.forEach((target, i) => {
            _ctxLabel = "2-Swap extra " + (i + 1) + "/" + totalCycle + " (target=" + target + ")";
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        });
        // Legacy 2-Swap (extras=10) also emits remainingTargets for the
        // leftover pieces + parity edge. New extras values (2/4/6/8) leave
        // remainingTargets empty.
        const totalRemaining = (result.remainingTargets || []).length;
        result.remainingTargets.forEach((target, i) => {
            _ctxLabel = "2-Swap remaining " + (i + 1) + "/" + totalRemaining + " (target=" + target + ")";
            cube.move(getEdgeParityAlg(edgeBuffer, target));
        });
        _ctxLabel = '';

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
        _ctxLabel = "Random edge state (solve-inverse)";
        cube.move(invertMoves(finalCube.solve()));
        _ctxLabel = '';

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

    // Parity-edge fix: only applies on the legacy extras=10 path. The
    // 2/4/6/8 paths don't need it (they don't touch the parity edge in a
    // way that requires this corrective flip).
    if (edgeScrambleType == "2-Swap" && cfg.f2eExtraCount === 10) {
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

        if (parityEdgeSolved) {
            _ctxLabel = "Parity edge fix (UF/UR flip)";
            cube.move(UF_UR_FLIP);
            _ctxLabel = '';
            log("2-Swap: Applied UF_UR_FLIP to make parity edge unsolved");
            addDebugLine("2-Swap: Applied UF_UR_FLIP to make parity edge unsolved");
        }
    }

    // get the scramble and do in correct orientation
    scramble = invertMoves(cube.solve());
    } finally {
        cube.move = origMove;
    }

    // Footer: list every alg applied during scramble construction so the
    // user can paste/verify the exec independently of cube.solve().
    if (appliedAlgs.length > 0) {
        addDebugLine("");
        addDebugLine("Applied algs:");
        appliedAlgs.forEach((entry, i) => {
            const labelPart = entry.label ? entry.label + ': ' : '';
            addDebugLine("  " + (i + 1) + ". " + labelPart + entry.alg);
        });
        // Concatenated single-line exec — useful for paste/diff but visually
        // noisy in the debug pill. Kept commented for future re-enabling.
        // addDebugLine("");
        // addDebugLine("Full applied exec: " + appliedAlgs.map((e) => e.alg).join(" "));
    }

    cube.identity();
    cube.move(getOrientationMoves());
    cube.move(scramble);

    if (!silent) {
        log("Scramble: " + scramble);
        vc.cubeString = cube.asString();
        vc.drawCube(ctx);
    }

    return scramble;
}

window.generateScramble = generateScramble;

window.generateMultipleScrambles = function (options = {}) {
    ensureInit();
    const config = options.config || {};
    const numScrambles = options.numScrambles ?? 1;

    if (numScrambles === 1) {
        const scramble = generateScramble({ config });
        return { mode: 'single', scrambles: [scramble] };
    }

    const scrambles = [];
    for (let i = 0; i < numScrambles; i++) {
        scrambles.push(generateScramble({ config, silent: true }));
    }
    return { mode: 'list', scrambles };
};

window.generateBulkScrambles = function (options = {}) {
    ensureInit();
    const config = options.config || {};
    const numScrambles = options.numScrambles ?? 1;
    const onProgress = options.onProgress;

    const scrambles = [];
    for (let i = 0; i < numScrambles; ++i) {
        scrambles.push(generateScramble({ config, silent: true }));
        if (numScrambles > 1 && (i + 1) % 10 === 0 && typeof onProgress === 'function') {
            onProgress(i + 1, numScrambles);
        }
    }
    if (typeof options.onComplete === 'function') options.onComplete(scrambles);
    console.log(scrambles.join('\n'));
    return scrambles;
};

window.getScrambleDebug = function () {
    return debugString;
};
