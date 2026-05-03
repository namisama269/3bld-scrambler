// Pre-flight checks against the React-side scramble config. Returns a string
// describing the first failure, or null if everything looks generatable. Add
// new rules here so error messaging stays in one place.

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

    if (config.cornerScrambleType === 'Targets' && config.edgeScrambleType === 'Targets') {
        const cornerParity = (config.cornerTargetCount ?? 0) % 2;
        const edgeParity = (config.edgeTargetCount ?? 0) % 2;
        if (cornerParity !== edgeParity) {
            return `Target counts must have matching parity when both Corner and Edge are set to Targets (corner=${config.cornerTargetCount}, edge=${config.edgeTargetCount}).`;
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
        // The first-piece pool is the user's edge buffer order minus the
        // active buffer, with the last entry hidden when "Only later buffers"
        // is on. At least one piece in the *visible* pool must be selected.
        const activeBuffer = config.edgeBufferOrder[0];
        const f2eOrder = config.edgeBufferOrder.filter((p) => p !== activeBuffer);
        const visible = config.f2eOnlyLaterBuffers ? f2eOrder.slice(0, -1) : f2eOrder;
        const visibleSelected = (config.f2eFirstPieces || []).filter((p) => visible.includes(p));
        if (visibleSelected.length === 0) {
            return '2-Swap first-piece selection: at least one piece must be selected.';
        }
    }

    return null;
}
