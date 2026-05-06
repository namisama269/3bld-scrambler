// Pre-flight checks against the React-side scramble config. Returns a string
// describing the first failure, or null if everything looks generatable. Add
// new rules here so error messaging stays in one place.

// What parity (0=even, 1=odd) does this side's settings force on the cube
// permutation? `null` means "free" — the engine can absorb whatever the other
// side ends up with (e.g. Random with parity=Any, or types we don't constrain).
function getForcedParity(config, side) {
    if (side === 'corner') {
        switch (config.cornerScrambleType) {
            // Solved is parity-flexible: if the other side ends up odd, the
            // engine can absorb that with a 2-swap on this side (which is
            // visually "still solved" for memo/training purposes).
            case 'Solved': return null;
            case 'Random': {
                const p = config.cornerRandomParity || 'any';
                return p === 'even' ? 0 : p === 'odd' ? 1 : null;
            }
            case 'Targets': return (config.cornerTargetCount ?? 0) % 2;
            case 'Floating': {
                const pool = config.cornerBufferOrder.slice(1, -2);
                const sel = (config.floatingCornerBuffers || []).filter((p) => pool.includes(p));
                if (sel.length === 1) return (config.floatingCornerTargetCount ?? 0) % 2;
                return 0; // multi-buffer uses BT default = even cycle
            }
            case 'Twist': return (config.cornerTwistExtraCount ?? 0) % 2; // pure twist = 0 perm; extras add cycles
            case '2-Swap': return 1;
            default: return null; // anything else not constrained
        }
    }
    switch (config.edgeScrambleType) {
        // See corner Solved comment — same flexibility applies here.
        case 'Solved': return null;
        case 'Random': {
            const p = config.edgeRandomParity || 'any';
            return p === 'even' ? 0 : p === 'odd' ? 1 : null;
        }
        case 'Targets': return (config.edgeTargetCount ?? 0) % 2;
        case 'Floating': {
            const pool = config.edgeBufferOrder.slice(1, -2);
            const sel = (config.floatingBuffers || []).filter((p) => pool.includes(p));
            if (sel.length === 1) return (config.floatingTargetCount ?? 0) % 2;
            return 0;
        }
        case 'Flips': return (config.flipExtraCount ?? 0) % 2;
        // Edge 2-Swap (F2E) is parity-flexible — the engine's setup + extras
        // composition can absorb either even or odd from the other side.
        case '2-Swap': return null;
        default: return null;
    }
}

function parityLabel(side, config, p) {
    const t = side === 'corner' ? config.cornerScrambleType : config.edgeScrambleType;
    const parityWord = p === 0 ? 'even' : 'odd';
    return `${side === 'corner' ? 'Corner' : 'Edge'} ${t} → ${parityWord}`;
}

export function validateScrambleConfig(config) {
    if (config.edgeScrambleType === 'Flips') {
        const N = config.flipCustomCount ?? 1;
        const selected = (config.flipTargets || []).length;
        if (selected < N) {
            return `Flip targets: at least ${N} piece${N === 1 ? '' : 's'} must be selected to perform a ${N}-flip (currently ${selected}).`;
        }
    }

    if (config.cornerScrambleType === 'Floating') {
        const floatingPool = config.cornerBufferOrder.slice(1, -2);
        const valid = (config.floatingCornerBuffers || []).filter((p) => floatingPool.includes(p));
        if (valid.length === 0) {
            return 'Floating corner buffers: at least one must be selected.';
        }
    }

    if (config.cornerScrambleType === 'Twist') {
        const N = config.cornerTwistCount ?? 1;
        const selected = (config.cornerTwistTargets || []).length;
        if (selected < N) {
            return `Twist targets: at least ${N} piece${N === 1 ? '' : 's'} must be selected to perform a ${N}-twist (currently ${selected}).`;
        }
    }

    // Cross-side parity check. Whenever both sides force a specific parity
    // on the cube permutation, those parities must agree (otherwise the
    // resulting state isn't solvable). Random with parity=Any returns null
    // here and adapts to whatever the other side produces, so it skips this
    // check.
    {
        const cp = getForcedParity(config, 'corner');
        const ep = getForcedParity(config, 'edge');
        if (cp !== null && ep !== null && cp !== ep) {
            return `Parity mismatch: ${parityLabel('corner', config, cp)} vs ${parityLabel('edge', config, ep)}. Set one side to match (or pick Any on Random).`;
        }
    }

    if (config.edgeScrambleType === 'Floating') {
        // Pool is positions 1..last-2 — main buffer hidden (it's "not
        // floating") and last 2 dropped (zero weights, trivial cycles).
        const floatingPool = config.edgeBufferOrder.slice(1, -2);
        const valid = (config.floatingBuffers || []).filter((p) => floatingPool.includes(p));
        if (valid.length === 0) {
            return 'Floating buffers: at least one must be selected.';
        }
    }

    if (config.edgeScrambleType === '2-Swap') {
        // The 2-Swap engine path uses Jb-style algs (getEdgeParityAlg) that
        // are only defined for buffer = UF or UR. With any other piece at
        // position 0, no parity alg lookup succeeds and the scramble is
        // generated with empty moves.
        const activeBuffer = config.edgeBufferOrder[0];
        if (activeBuffer !== 'UF' && activeBuffer !== 'UR') {
            return `Edge 2-Swap requires UF or UR as the active edge buffer (position 0). Currently: ${activeBuffer}.`;
        }
        // The first-piece pool is the user's edge buffer order minus the
        // active buffer, with the last entry hidden when "Only later buffers"
        // is on. At least one piece in the *visible* pool must be selected.
        const f2eOrder = config.edgeBufferOrder.filter((p) => p !== activeBuffer);
        const visible = config.f2eOnlyLaterBuffers ? f2eOrder.slice(0, -1) : f2eOrder;
        const visibleSelected = (config.f2eFirstPieces || []).filter((p) => visible.includes(p));
        if (visibleSelected.length === 0) {
            return '2-Swap first-piece selection: at least one piece must be selected.';
        }
    }

    return null;
}
