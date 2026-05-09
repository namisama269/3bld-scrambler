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
        cornerRandomParity: c.cornerRandomParity || 'any',
        edgeRandomParity: c.edgeRandomParity || 'any',
        cornerTargetCount: c.cornerTargetCount ?? 8,
        parityTargets: c.parityTargets || [],
        cornerTwistCount: c.cornerTwistCount ?? 2,
        cornerTwistExtraCount: c.cornerTwistExtraCount ?? 0,
        cornerTwistDirection: c.cornerTwistDirection || 'mixed',
        cornerTwistTargets: c.cornerTwistTargets || [],
        twoSwapMode: c.twoSwapMode || 'unoriented',
        t2cFirstPieces: c.t2cFirstPieces || [],
        t2cOnlyLaterBuffers: !!c.t2cOnlyLaterBuffers,
        t2cExtraCount: c.t2cExtraCount ?? 6,
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
        floatingAddFlip: !!c.floatingAddFlip,
        floatingCornerTargetCount: c.floatingCornerTargetCount ?? 4,
        floatingCornerBuffers: c.floatingCornerBuffers || [],
        floatingCornerDistribution: c.floatingCornerDistribution || 'equal',
        floatingCornerAddTwist: !!c.floatingCornerAddTwist,
        cornerBufferOrder: c.cornerBufferOrder || ['UFR', 'UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBR', 'DBL'],
        edgeBufferOrder: c.edgeBufferOrder || ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
    };
}

// 462-parity correction: when the corner side AND the edge side BOTH end up
// with a dangling odd-parity target (Targets odd, Floating odd N, Twist with
// odd extras, Flips with odd extras — anything but 2-Swap), this 3-alg
// sequence handles both danglers at once at the START of the scramble. Net
// effect on the cube: pure UFR↔cornerTarget swap on corners + UF/UR↔edgeTarget
// swap on edges, no other movement.
//
// Doing the parity work UP FRONT means subsequent CO twists / EO flips and
// any Jb-style operations don't get a stray UFR↔UBR swap landing on top of
// them later — which is what currently relocates a UBR-piece twist to UFR
// when edge-side parity fires after the twist branch.
//
// The 3 steps:
//   1. getEdgeParityAlg(edgeBuffer, edgeTarget)
//      → swaps edgeBuffer↔edgeTarget on edges, UFR↔UBR on corners
//   2. Jb perm (= PARITY_UF_UR_UFR_X['UBR'])
//      → swaps UFR↔UBR on corners (cancels step 1's corner part), UF↔UR on edges
//   3. PARITY_UF_UR_UFR_X[cornerTarget]
//      → swaps UFR↔cornerTarget on corners, UF↔UR on edges (cancels step 2's edge UF/UR)
//
// Named 462 for the number of (corner, edge) target combinations this set
// distinguishes across the available stickers.
function handle462Parity(cornerTarget, edgeTarget, edgeBuffer) {
    cube.move(getEdgeParityAlg(edgeBuffer, edgeTarget));
    cube.move(Jb_PERM);
    cube.move(PARITY_UF_UR_UFR_X[cornerTarget]);
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
    // Standardized parity-alg prefix: every entry is a Jb-style swap of one
    // edge pair + one corner pair. Encoded as `(UF-XY UFR-XYZ)` where the
    // first half names the edge swap and the second names the corner swap.
    const _algPrefix = (() => {
        const map = new Map();
        if (typeof PARITY_UF_UR_UFR_X !== 'undefined') {
            for (const [target, alg] of Object.entries(PARITY_UF_UR_UFR_X)) {
                if (alg) map.set(alg.trim(), `(UF-UR UFR-${target})`);
            }
        }
        if (typeof PARITY_UF_X_UFR_UBR !== 'undefined') {
            for (const [target, alg] of Object.entries(PARITY_UF_X_UFR_UBR)) {
                if (alg) map.set(alg.trim(), `(UF-${target} UFR-UBR)`);
            }
        }
        if (typeof PARITY_UR_X_UFR_UBR !== 'undefined') {
            for (const [target, alg] of Object.entries(PARITY_UR_X_UFR_UBR)) {
                if (alg) map.set(alg.trim(), `(UR-${target} UFR-UBR)`);
            }
        }
        return map;
    })();
    const origMove = cube.move.bind(cube);
    cube.move = function (alg) {
        const trimmed = (alg || '').trim();
        if (trimmed) {
            const prefix = _algPrefix.get(trimmed) || '';
            // Capture _ctxLabel as a fallback annotation for non-parity algs
            // (CO twists, EO flips, random-state solve-inverses, …) so every
            // entry in the applied-algs footer says what it is.
            appliedAlgs.push({ alg: trimmed, prefix, label: _ctxLabel || '' });
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

    // === 462-parity pre-handling ==================================
    // When corner AND edge sides both produce a dangling odd-parity
    // Jb-style swap (and neither is 2-Swap), we run:
    //   Stage A: corner CO twists (if cornerScrambleType=Twist).
    //   Stage B: edge EO flips (if edgeScrambleType=Flips).
    //   Stage C: handle462Parity(X_c, X_e, edgeBuffer).
    // Then the per-side branches do the EVEN remainder. This way the
    // edge parity alg's UFR↔UBR swap doesn't relocate a CO twist later.
    //
    // Tier-1 coverage: corner ∈ {Twist+odd extras, Targets odd→Parity,
    // raw Parity}, edge ∈ {Targets odd→Parity, raw Parity}.
    // 462 only applies when the dangling parity target is on the main
    // buffer (UFR for corners, UF/UR for edges). Modes whose odd parity
    // comes from a different structure are intentionally NOT routed here:
    //   - Floating: parity lives in a non-main-buffer cycle.
    //   - Random:   handled by the U-fix mechanism (see Random branches).
    const cornerOddParityTier1 = (
        cornerScrambleType === 'Parity' ||
        (cornerScrambleType === 'Twist' && (cfg.cornerTwistExtraCount % 2 === 1))
    );
    const edgeOddParityTier1 = (
        edgeScrambleType === 'Parity' ||
        (edgeScrambleType === 'Flips' && (cfg.flipExtraCount % 2 === 1))
    );
    let pre462Active = false;
    let pre462TwistCODone = false;
    let pre462TwistContext = null;
    let pre462FlipsEODone = false;
    let pre462FlipsContext = null;
    // Floating tracks whether each side's J-perm chain ended up with odd
    // length. Each Jb in the chain leaks one stray UF/UR (corner side) or
    // UFR/UBR (edge side) swap; an odd-length chain means one is left over.
    // When BOTH sides leak, the two leftover swaps together form a Jb perm,
    // which we cancel with one more Jb at the end.
    let cornerFloatingOddParity = false;
    let edgeFloatingOddParity = false;

    if (cornerOddParityTier1 && edgeOddParityTier1) {
        pre462Active = true;
        let pre462X_c = null;
        let pre462X_e = null;

        // Stage A: corner CO twists (Twist branch's CO part only).
        if (cornerScrambleType === 'Twist') {
            const N = Math.max(1, Math.min(7, cfg.cornerTwistCount ?? 2));
            const direction = cfg.cornerTwistDirection || 'mixed';
            const twistTargetSet = new Set(cfg.cornerTwistTargets);
            const eligibleCornerPieces = twistTargetSet.size > 0
                ? cornerPieces.filter((i) => twistTargetSet.has(CORNERS[i][0]))
                : cornerPieces;
            const shuffledCornerPieces = shuffleArray([...eligibleCornerPieces]);
            const twistedPieces = shuffledCornerPieces.slice(0, N);

            const oris = new Array(N);
            if (N === 1 || direction === 'same') {
                const fixedOri = Math.floor(Math.random() * 2) + 1;
                for (let i = 0; i < N; i++) oris[i] = fixedOri;
            } else {
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

            twistTargets.forEach((twist, i) => {
                const piece = CORNERS.find((p) => p.includes(twist));
                const udTarget = piece[0];
                const baseLabel = "Corner CO twist " + (i + 1) + "/" + N + " (target=" + twist + ")";
                _ctxLabel = baseLabel + " step 1/2";
                cube.move(PARITY_UF_UR_UFR_X[udTarget]);
                _ctxLabel = baseLabel + " step 2/2";
                cube.move(PARITY_UF_UR_UFR_X[twist]);
            });
            _ctxLabel = '';

            const dirLabel = N === 1 ? 'random' : direction;
            log("Custom " + N + "-twist (direction=" + dirLabel + "): " + twistTargets.join(" "));
            addDebugLine("Custom " + N + "-twist (direction=" + dirLabel + "): " + twistTargets.join(" "));

            cornerPieces = cornerPieces.filter((idx) => !twistedPieces.includes(idx));
            pre462TwistCODone = true;
            pre462TwistContext = { twistedPieces, twistTargets, N, dirLabel };
        }

        // Stage B: edge EO flips (Flips branch's EO part only). Pre-pick
        // chosen + apply EO algs here so they're not disturbed by 462's
        // swaps. The dangling odd-extras parity sticker becomes X_e.
        if (edgeScrambleType === 'Flips') {
            const flipExtraCount = cfg.flipExtraCount;
            const parityEdgeIdxLocal = edgeBufferIndex === 0 ? 2 : 0;
            const flipCountByModeLocal = Math.max(1, Math.min(11, cfg.flipCustomCount));

            const flipCandidates = edgePieces.filter((i) => i !== parityEdgeIdxLocal);
            const selectedFlipStickers = new Set(cfg.flipTargets);
            const eligibleFlipPieces = (selectedFlipStickers.size === 0)
                ? flipCandidates
                : flipCandidates.filter((i) => selectedFlipStickers.has(EDGES[i][0]));
            const selectedParityStickers = [...(cfg.flipParityTargets || [])];
            const eligibleParityStickers = (selectedParityStickers.length === 0)
                ? edgePieces.flatMap((i) => EDGES[i])
                : selectedParityStickers;

            const validCombos = [];
            const flipPieceCombos = (function () {
                const k = flipCountByModeLocal;
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
                const afterFlipPool = edgePieces.filter((i) => !fp.includes(i));
                for (const stk of eligibleParityStickers) {
                    const stkPieceIdx = EDGES.findIndex((p) => p.includes(stk));
                    if (stkPieceIdx < 0) continue;
                    if (fp.includes(stkPieceIdx)) continue;
                    const afterParityPool = afterFlipPool.filter((i) => i !== stkPieceIdx);
                    const remainingNeeded = flipExtraCount - 1;
                    const n = afterFlipPool.length;
                    if (flipExtraCount === n + 1) {
                        if (afterParityPool.length >= n - 1) {
                            validCombos.push({ flipPieces: fp, parityPieceIdx: stkPieceIdx, paritySticker: stk });
                        }
                    } else if (afterParityPool.length >= remainingNeeded) {
                        validCombos.push({ flipPieces: fp, parityPieceIdx: stkPieceIdx, paritySticker: stk });
                    }
                }
            }
            if (validCombos.length === 0) {
                throw new Error("462: no valid Flips combination available — adjust flip / parity targets or counts");
            }
            const chosen = validCombos[Math.floor(Math.random() * validCombos.length)];

            // 462 makes the existing double-Parity correction unnecessary,
            // so we always apply flips against the primary edgeBuffer here.
            const flipBufferLocal = edgeBuffer;
            const flipPieceSet = new Set(chosen.flipPieces);
            const flipStickers = chosen.flipPieces.map((idx) => EDGES[idx][0]);
            edgePieces = edgePieces.filter((x) => !flipPieceSet.has(x));
            for (const sticker of flipStickers) {
                const piece = EDGES.find((p) => p.includes(sticker));
                const baseLabel = "Edge EO flip (sticker=" + sticker + ", buffer=" + flipBufferLocal + ")";
                _ctxLabel = baseLabel + " step 1/2";
                cube.move(getEdgeParityAlg(flipBufferLocal, piece[0]));
                _ctxLabel = baseLabel + " step 2/2";
                cube.move(getEdgeParityAlg(flipBufferLocal, piece[1]));
            }
            _ctxLabel = '';
            log(flipCountByModeLocal + "-flip (462 pre): " + flipStickers.join(" "));
            addDebugLine(flipCountByModeLocal + "-flip (462 pre): " + flipStickers.join(" "));

            pre462FlipsEODone = true;
            pre462FlipsContext = { chosen, flipBuffer: flipBufferLocal, flipCountByMode: flipCountByModeLocal };
        }

        // --- Pick parity targets, mutate state to even remainder ---
        if (cornerScrambleType === 'Parity') {
            // Replicate corner Parity branch's target selection.
            const selectedParityTargets = [...(cfg.parityTargets || [])];
            if (selectedParityTargets.length === 0) {
                const i = Math.floor(Math.random() * cornerPieces.length);
                const piece = CORNERS[cornerPieces[i]];
                pre462X_c = piece[Math.floor(Math.random() * piece.length)];
            } else {
                pre462X_c = selectedParityTargets[Math.floor(Math.random() * selectedParityTargets.length)];
            }
            const targetPieceIndex = CORNERS.findIndex((piece) => piece.includes(pre462X_c));
            if (targetPieceIndex !== -1) {
                cornerPieces = cornerPieces.filter((idx) => idx !== targetPieceIndex);
            }
            const piecesToLeaveCount = 7 - cfg.parityCount;
            if (piecesToLeaveCount > 0) {
                const shuffledRemaining = shuffleArray([...cornerPieces]);
                const piecesToLeave = shuffledRemaining.slice(0, piecesToLeaveCount);
                cornerPieces = cornerPieces.filter((i) => !piecesToLeave.includes(i));
                log("Parity (462 pre): Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map((i) => CORNERS[i][0]).join(", "));
                addDebugLine("Parity (462 pre): Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map((i) => CORNERS[i][0]).join(", "));
            }
            // Suppress the Parity branch — leave cornerPieces for the comms loop.
            cornerScrambleType = '__462_handled__';
        } else if (cornerScrambleType === 'Twist') {
            // Pick X_c from cfg.parityTargets if any are eligible (their piece
            // is still in cornerPieces — i.e. non-buffer, non-twisted). Falls
            // back to a random non-twisted corner sticker if the user's
            // selection has no eligible pieces.
            if (cornerPieces.length === 0) {
                throw new Error('462: no remaining corner piece for parity target');
            }
            const eligible = (cfg.parityTargets || []).filter((t) => {
                const idx = CORNERS.findIndex((p) => p.includes(t));
                return idx >= 0 && cornerPieces.includes(idx);
            });
            if (eligible.length > 0) {
                pre462X_c = eligible[Math.floor(Math.random() * eligible.length)];
            } else {
                const i = Math.floor(Math.random() * cornerPieces.length);
                const piece = CORNERS[cornerPieces[i]];
                pre462X_c = piece[Math.floor(Math.random() * piece.length)];
            }
            const pieceIdx = CORNERS.findIndex((p) => p.includes(pre462X_c));
            cornerPieces = cornerPieces.filter((idx) => idx !== pieceIdx);
            cfg.cornerTwistExtraCount = (cfg.cornerTwistExtraCount ?? 0) - 1;
        }

        if (edgeScrambleType === 'Parity') {
            // Replicate edge Parity branch's target selection.
            const bufferPieceIndex = EDGES.findIndex((piece) => piece.includes(edgeBuffer));
            const selectedEdgeParityTargets = (cfg.edgeParityTargets || []).filter((v) => {
                const stickerPieceIndex = EDGES.findIndex((piece) => piece.includes(v));
                return stickerPieceIndex !== bufferPieceIndex;
            });
            if (selectedEdgeParityTargets.length === 0) {
                const i = Math.floor(Math.random() * edgePieces.length);
                const piece = EDGES[edgePieces[i]];
                pre462X_e = piece[Math.floor(Math.random() * piece.length)];
            } else {
                pre462X_e = selectedEdgeParityTargets[Math.floor(Math.random() * selectedEdgeParityTargets.length)];
            }
            const targetPieceIndex = EDGES.findIndex((piece) => piece.includes(pre462X_e));
            if (targetPieceIndex !== -1) {
                edgePieces = edgePieces.filter((idx) => idx !== targetPieceIndex);
            }
            const piecesToLeaveCount = 11 - cfg.edgeParityCount;
            if (piecesToLeaveCount > 0) {
                const shuffledRemaining = shuffleArray([...edgePieces]);
                const piecesToLeave = shuffledRemaining.slice(0, piecesToLeaveCount);
                edgePieces = edgePieces.filter((i) => !piecesToLeave.includes(i));
                log("Edge Parity (462 pre): Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map((i) => EDGES[i][0]).join(", "));
                addDebugLine("Edge Parity (462 pre): Leaving " + piecesToLeaveCount + " pieces aside: " + piecesToLeave.map((i) => EDGES[i][0]).join(", "));
            }
            edgeScrambleType = '__462_handled__';
            doubleParityEdgeTarget = pre462X_e;
        } else if (edgeScrambleType === 'Flips' && pre462FlipsEODone) {
            // X_e = the parity sticker that the Flips branch would have used
            // for its odd-extras parity Jb. The parity-piece is removed from
            // edgePieces so the leftover extras pool is even.
            pre462X_e = pre462FlipsContext.chosen.paritySticker;
            const stkPieceIdx = pre462FlipsContext.chosen.parityPieceIdx;
            edgePieces = edgePieces.filter((idx) => idx !== stkPieceIdx);
            cfg.flipExtraCount = (cfg.flipExtraCount ?? 0) - 1;
            doubleParityEdgeTarget = pre462X_e;
        }

        // Stage C: apply the combined 462 correction.
        log("462-parity correction: cornerTarget=" + pre462X_c + ", edgeTarget=" + pre462X_e);
        addDebugLine("462-parity correction: cornerTarget=" + pre462X_c + ", edgeTarget=" + pre462X_e);
        _ctxLabel = "462-parity correction (corner=" + pre462X_c + ", edge=" + pre462X_e + ")";
        handle462Parity(pre462X_c, pre462X_e, edgeBuffer);
        _ctxLabel = '';
    }
    // === end 462-parity pre-handling ==============================

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
        let cyclePool = laterPieceNames
            .map(name => CORNERS.findIndex(c => c[0] === name))
            .filter(idx => idx >= 0 && cornerPieces.includes(idx));

        // "Add twisted corner" toggle (single-buffer only): peel one piece
        // off the cycle pool and twist it in place. To keep ΣCO ≡ 0 mod 3
        // (so UFR doesn't end up auto-balanced into a stray twist), we
        // also twist the floating buffer F with the OPPOSITE orientation:
        // k_P + k_F ≡ 0 (mod 3) → k_F = 3 − k_P. Result: P and F each
        // misoriented; main buffer UFR stays clean.
        if (candidates.length === 1 && cfg.floatingCornerAddTwist && cyclePool.length >= 2) {
            const twistPieceIdx = cyclePool[Math.floor(Math.random() * cyclePool.length)];
            const k_P = Math.floor(Math.random() * 2) + 1; // 1 = CW, 2 = CCW
            const k_F = 3 - k_P;

            const twistTargetP = CORNERS[twistPieceIdx][k_P];
            const udTargetP = CORNERS[twistPieceIdx][0];
            const labelP = "Corner Floating add-twist (target=" + twistTargetP + ")";
            _ctxLabel = labelP + " step 1/2";
            cube.move(PARITY_UF_UR_UFR_X[udTargetP]);
            _ctxLabel = labelP + " step 2/2";
            cube.move(PARITY_UF_UR_UFR_X[twistTargetP]);
            _ctxLabel = '';

            // Companion twist on floating buffer F with opposite orientation.
            const fPieceIdx = CORNERS.findIndex((c) => c[0] === floatingBuffer);
            if (fPieceIdx >= 0) {
                const twistTargetF = CORNERS[fPieceIdx][k_F];
                const udTargetF = CORNERS[fPieceIdx][0];
                const labelF = "Corner Floating add-twist companion F (target=" + twistTargetF + ")";
                _ctxLabel = labelF + " step 1/2";
                cube.move(PARITY_UF_UR_UFR_X[udTargetF]);
                _ctxLabel = labelF + " step 2/2";
                cube.move(PARITY_UF_UR_UFR_X[twistTargetF]);
                _ctxLabel = '';
            }

            cyclePool = cyclePool.filter((idx) => idx !== twistPieceIdx);
            log("Corner Floating add-twist: " + twistTargetP + " + " + floatingBuffer);
            addDebugLine("Corner Floating add-twist: " + twistTargetP + " + " + floatingBuffer);
        }

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

        cornerFloatingOddParity = seq.length % 2 === 1;

        seq.forEach((target, i) => {
            _ctxLabel = "Corner Floating " + (i + 1) + "/" + seq.length + " (target=" + target + ")";
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        });
        _ctxLabel = '';

        cornerPieces = [];
    }
    else if (cornerScrambleType == "Twist") {
        // The 462 pre-stage may have already handled CO twists (and reduced
        // extraCount by 1 to peel off the dangling odd-parity J-perm). When
        // pre462TwistCODone is set, just take the recorded N for the extras
        // logic below and skip re-applying the twists.
        const N = Math.max(1, Math.min(7, cfg.cornerTwistCount ?? 2));
        const extraCount = Math.max(0, Math.min(7 - N, cfg.cornerTwistExtraCount ?? 0));
        const direction = cfg.cornerTwistDirection || 'mixed';

        if (!pre462TwistCODone) {
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

            // Each CO twist is two Jb-style parity algs composed. Split them into
            // separate cube.move calls so each shows up individually in the
            // debug list with its own (UF-UR UFR-X) prefix.
            twistTargets.forEach((twist, i) => {
                const piece = CORNERS.find((p) => p.includes(twist));
                const udTarget = piece[0];
                const baseLabel = "Corner CO twist " + (i + 1) + "/" + N + " (target=" + twist + ")";
                _ctxLabel = baseLabel + " step 1/2";
                cube.move(PARITY_UF_UR_UFR_X[udTarget]);
                _ctxLabel = baseLabel + " step 2/2";
                cube.move(PARITY_UF_UR_UFR_X[twist]);
            });
            _ctxLabel = '';

            const dirLabel = N === 1 ? 'random' : direction;
            log("Custom " + N + "-twist (direction=" + dirLabel + "): " + twistTargets.join(" "));
            addDebugLine("Custom " + N + "-twist (direction=" + dirLabel + "): " + twistTargets.join(" "));
        }

        // Extras: cycle / leftover-target on the remaining (7 − N) non-buffer
        // pool. When the count is odd, the chain has one "dangling parity"
        // target — pick that one from the user's cfg.parityTargets selection
        // (filtered to pieces still in the eligible pool). The remaining
        // count-1 (now even) targets come from the random extras generator.
        if (extraCount > 0) {
            let parityTarget = null;
            let workCornerPieces = cornerPieces;
            let workCount = extraCount;
            if (extraCount % 2 === 1) {
                const eligible = (cfg.parityTargets || []).filter((t) => {
                    const idx = CORNERS.findIndex((p) => p.includes(t));
                    return idx >= 0 && cornerPieces.includes(idx);
                });
                if (eligible.length > 0) {
                    parityTarget = eligible[Math.floor(Math.random() * eligible.length)];
                    const ptIdx = CORNERS.findIndex((p) => p.includes(parityTarget));
                    workCornerPieces = cornerPieces.filter((idx) => idx !== ptIdx);
                    workCount = extraCount - 1;
                }
            }

            const extras = generateTwistExtras(workCornerPieces, workCount);
            const allTargets = parityTarget
                ? [parityTarget, ...extras.prefixTargets, ...extras.cycleTargets]
                : [...extras.prefixTargets, ...extras.cycleTargets];

            if (parityTarget) {
                _ctxLabel = "Twist parity target (target=" + parityTarget + ")";
                cube.move(generateParityAlg("UF", "UR", "UFR", parityTarget));
                _ctxLabel = '';
            }
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
    else if (cornerScrambleType == "2-Swap") {
        // Buffer order for "Only select later buffers" option
        // T2C buffer order follows the user's drag-and-drop corner order,
        // minus the active buffer at index 0. Used for the "Only later
        // buffers" second-piece constraint — keeps the engine in sync with
        // whatever pool the React side displays.
        const T2C_BUFFER_ORDER = (cfg.cornerBufferOrder || []).slice(1);

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

        // Generate 2-Swap result (isOriented = true means thirdTarget = firstTarget).
        // extraCount: 0/2/4 = simple single-cycle extras; 6 = legacy split.
        const result = generate2C(firstPieceIndex, availableSecondPieceIndices, isOriented, cfg.t2cExtraCount);
        const modeName = isOriented ? "2-Swap (Oriented)" : "2-Swap (Unoriented)";
        log(modeName + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        log(modeName + ": cycleTargets=" + result.cycleTargets.join(" "));
        log(modeName + ": remainingTargets=" + result.remainingTargets.join(" "));
        addDebugLine(modeName + ": firstTarget=" + result.firstTarget + " secondTarget=" + result.secondTarget + " thirdTarget=" + result.thirdTarget);
        addDebugLine(modeName + ": cycleTargets=" + result.cycleTargets.join(" "));
        addDebugLine(modeName + ": remainingTargets=" + result.remainingTargets.join(" "));

        // Apply cube state: parity alg with UF UR UFR for each target in
        // order (third → second → first → cycle → remaining). Labels mirror
        // the edge 2-Swap branch for consistency.
        _ctxLabel = "2-Swap setup: third (target=" + result.thirdTarget + ")";
        cube.move(generateParityAlg("UF", "UR", "UFR", result.thirdTarget));
        _ctxLabel = "2-Swap setup: second (target=" + result.secondTarget + ")";
        cube.move(generateParityAlg("UF", "UR", "UFR", result.secondTarget));
        _ctxLabel = "2-Swap setup: first (target=" + result.firstTarget + ")";
        cube.move(generateParityAlg("UF", "UR", "UFR", result.firstTarget));
        const t2cTotalCycle = result.cycleTargets.length;
        result.cycleTargets.forEach((target, i) => {
            _ctxLabel = "2-Swap extra " + (i + 1) + "/" + t2cTotalCycle + " (target=" + target + ")";
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        });
        const t2cTotalRemaining = (result.remainingTargets || []).length;
        result.remainingTargets.forEach((target, i) => {
            _ctxLabel = "2-Swap remaining " + (i + 1) + "/" + t2cTotalRemaining + " (target=" + target + ")";
            cube.move(generateParityAlg("UF", "UR", "UFR", target));
        });
        _ctxLabel = '';

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

        // Parity fix: a U quarter-turn flips both corner and edge parity by 1
        // simultaneously (preserves solvability). If the user pinned a parity
        // and the generated state's corner parity doesn't match, prepend a U.
        if (cfg.cornerRandomParity === 'even' || cfg.cornerRandomParity === 'odd') {
            const want = cfg.cornerRandomParity === 'odd' ? 1 : 0;
            const have = Cube.fromString(cube.asString()).cornerParity();
            if (have !== want) {
                _ctxLabel = "Random corner parity fix (want=" + cfg.cornerRandomParity + ")";
                cube.move("U");
                _ctxLabel = '';
            }
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
        const flipCountByMode = pre462FlipsEODone
            ? pre462FlipsContext.flipCountByMode
            : Math.max(1, Math.min(11, cfg.flipCustomCount));
        const oddExtras = flipExtraCount % 2 === 1;

        let chosen;
        let flipBuffer;
        if (pre462FlipsEODone) {
            // Pre-stage already enumerated combos, picked, and applied EO.
            // Resume from extras with the persisted context.
            chosen = pre462FlipsContext.chosen;
            flipBuffer = pre462FlipsContext.flipBuffer;
        } else {
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
                const afterFlipPool = edgePieces.filter(i => !fp.includes(i));
                if (oddExtras) {
                    for (const stk of eligibleParityStickers) {
                        const stkPieceIdx = EDGES.findIndex(p => p.includes(stk));
                        if (stkPieceIdx < 0) continue;
                        if (fp.includes(stkPieceIdx)) continue;
                        const afterParityPool = afterFlipPool.filter(i => i !== stkPieceIdx);
                        const remainingNeeded = flipExtraCount - 1;
                        const n = afterFlipPool.length;
                        if (flipExtraCount === n + 1) {
                            if (afterParityPool.length >= n - 1) {
                                validCombos.push({ flipPieces: fp, parityPieceIdx: stkPieceIdx, paritySticker: stk });
                            }
                        } else if (afterParityPool.length >= remainingNeeded) {
                            validCombos.push({ flipPieces: fp, parityPieceIdx: stkPieceIdx, paritySticker: stk });
                        }
                    }
                } else {
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

            chosen = validCombos[Math.floor(Math.random() * validCombos.length)];

            // Apply flip alg(s). Use otherEdgeBuffer when corner=Parity AND oddExtras (correction will fire).
            flipBuffer = (cornerScrambleType === "Parity" && oddExtras)
                ? ((edgeBuffer === "UF") ? "UR" : "UF")
                : edgeBuffer;

            const flipPiecesChosen = chosen.flipPieces;
            const flipStickers = flipPiecesChosen.map(idx => EDGES[idx][0]);
            const flipPieceSet = new Set(flipPiecesChosen);
            edgePieces = edgePieces.filter(x => !flipPieceSet.has(x));
            // Each EO flip is two parity algs (one per sticker of the edge).
            // Split them into separate cube.move calls so each shows up
            // individually in the debug list with its own parity prefix.
            for (const sticker of flipStickers) {
                const piece = EDGES.find((p) => p.includes(sticker));
                const baseLabel = "Edge EO flip (sticker=" + sticker + ", buffer=" + flipBuffer + ")";
                _ctxLabel = baseLabel + " step 1/2";
                cube.move(getEdgeParityAlg(flipBuffer, piece[0]));
                _ctxLabel = baseLabel + " step 2/2";
                cube.move(getEdgeParityAlg(flipBuffer, piece[1]));
            }
            _ctxLabel = '';
            const flipLogLabel = flipCountByMode + "-flip";
            log(flipLogLabel + ": " + flipStickers.join(" ") + " (flipBuffer=" + flipBuffer + ")");
            addDebugLine(flipLogLabel + ": " + flipStickers.join(" ") + " (flipBuffer=" + flipBuffer + ")");
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
        let cyclePool = laterPieceNames
            .map(name => EDGES.findIndex(e => e[0] === name))
            .filter(idx => idx >= 0 && edgePieces.includes(idx));

        // "Add flipped edge" toggle (single-buffer only): peel one piece off
        // the cycle pool and flip it in place via two getEdgeParityAlg calls
        // on its two stickers (EO defect, no perm change). Flipping just one
        // piece breaks the cube's EO invariant (sum of flipped edges must
        // be even), so we ALSO flip the floating buffer F — total flipped
        // = 2 (P + F), which keeps the cube solvable. We deliberately use
        // the floating buffer here, NOT the main edge buffer (UF/UR), so
        // the parity edge stays clean.
        if (candidates.length === 1 && cfg.floatingAddFlip && cyclePool.length >= 2) {
            const flipPieceIdx = cyclePool[Math.floor(Math.random() * cyclePool.length)];
            const piece = EDGES[flipPieceIdx];
            const flipBaseLabel = "Edge Floating add-flip (sticker=" + piece[0] + ")";
            _ctxLabel = flipBaseLabel + " step 1/2";
            cube.move(getEdgeParityAlg(edgeBuffer, piece[0]));
            _ctxLabel = flipBaseLabel + " step 2/2";
            cube.move(getEdgeParityAlg(edgeBuffer, piece[1]));
            _ctxLabel = '';

            // Companion flip on the floating buffer F to keep EO even.
            const fPieceIdx = EDGES.findIndex((e) => e[0] === floatingBuffer);
            if (fPieceIdx >= 0) {
                const fPiece = EDGES[fPieceIdx];
                const fLabel = "Edge Floating add-flip companion F (sticker=" + fPiece[0] + ")";
                _ctxLabel = fLabel + " step 1/2";
                cube.move(getEdgeParityAlg(edgeBuffer, fPiece[0]));
                _ctxLabel = fLabel + " step 2/2";
                cube.move(getEdgeParityAlg(edgeBuffer, fPiece[1]));
                _ctxLabel = '';
            }

            cyclePool = cyclePool.filter((idx) => idx !== flipPieceIdx);
            log("Edge Floating add-flip: " + piece[0] + " + " + floatingBuffer);
            addDebugLine("Edge Floating add-flip: " + piece[0] + " + " + floatingBuffer);
        }

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

        edgeFloatingOddParity = seq.length % 2 === 1;

        seq.forEach((target, i) => {
            _ctxLabel = "Edge Floating " + (i + 1) + "/" + seq.length + " (target=" + target + ")";
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
        _ctxLabel = "2-Swap setup: third (target=" + result.thirdTarget + ")";
        cube.move(getEdgeParityAlg(edgeBuffer, result.thirdTarget));
        _ctxLabel = "2-Swap setup: second (target=" + result.secondTarget + ")";
        cube.move(getEdgeParityAlg(edgeBuffer, result.secondTarget));
        _ctxLabel = "2-Swap setup: first (target=" + result.firstTarget + ")";
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

        // Parity fix: corner/edge parities are now equal (the UF/UR swap
        // above ensured solvability). If the user pinned a parity and the
        // current value doesn't match, a U flips both back into the wanted
        // configuration without breaking solvability.
        if (cfg.edgeRandomParity === 'even' || cfg.edgeRandomParity === 'odd') {
            const want = cfg.edgeRandomParity === 'odd' ? 1 : 0;
            const have = Cube.fromString(cube.asString()).edgeParity();
            if (have !== want) {
                _ctxLabel = "Random edge parity fix (want=" + cfg.edgeRandomParity + ")";
                cube.move("U");
                _ctxLabel = '';
            }
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

    // Floating odd-edge parity correction: an odd-length edge Floating chain
    // leaks a stray UFR↔UBR swap onto corners (because each Jb in the chain
    // also touches UFR↔UBR, and odd-many of them don't cancel). The user's
    // preferred convention: that leftover should land on the edge buffer pair
    // (UF↔UR), not on corners. Append a Jb here — its UFR↔UBR cancels the
    // chain's stray, and its UF↔UR becomes the new visible leftover on edges.
    //
    // This same Jb also doubles as the both-Floating-odd correction: when the
    // corner Floating chain is also odd, it leaked a UF↔UR swap onto edges,
    // which the appended Jb's UF↔UR cancels — both sides come out clean.
    if (edgeFloatingOddParity) {
        _ctxLabel = "Floating odd-edge parity correction";
        cube.move(Jb_PERM);
        _ctxLabel = '';
        log("Floating odd-edge parity correction: applied Jb perm");
        addDebugLine("Floating odd-edge parity correction: applied Jb perm");
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
            // Show both the parity-alg prefix (if any) and the contextual
            // label set by the engine, so split sub-algs still tell you which
            // higher-level operation they belong to.
            let head = '';
            if (entry.prefix && entry.label) head = entry.prefix + ' [' + entry.label + '] ';
            else if (entry.prefix) head = entry.prefix + ' ';
            else if (entry.label) head = entry.label + ': ';
            addDebugLine("  " + (i + 1) + ". " + head + entry.alg);
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
