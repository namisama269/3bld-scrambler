// Cross-side parity validation: corner and edge sides each force a parity
// (or null = free); validator must reject mismatches and accept matches /
// "free" combinations.

import { validateScrambleConfig } from '../src/state/validateScrambleConfig.js';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    F2E_FIRST_PIECES,
    getTargetsExcludingBuffer,
    getEdgeParityTargets,
    getFlipTargets,
    getFlipParityTargets,
    getUDStickerTargets,
} from '../src/constants.js';

function base() {
    return {
        cornerBufferOrder: [...DEFAULT_CORNER_BUFFER_ORDER],
        edgeBufferOrder: [...DEFAULT_EDGE_BUFFER_ORDER],
        cornerScrambleType: 'Solved',
        edgeScrambleType: 'Solved',
        cornerRandomParity: 'any',
        edgeRandomParity: 'any',
        cornerTargetCount: 8,
        parityTargets: getTargetsExcludingBuffer('UFR'),
        cornerTwistCount: 2,
        cornerTwistExtraCount: 0,
        cornerTwistDirection: 'mixed',
        cornerTwistTargets: getUDStickerTargets('UFR'),
        twoSwapMode: 'unoriented',
        t2cFirstPieces: [...DEFAULT_CORNER_BUFFER_ORDER].slice(1, -1),
        t2cOnlyLaterBuffers: false,
        edgeTargetCount: 12,
        floatingTargetCount: 4,
        floatingBuffers: [DEFAULT_EDGE_BUFFER_ORDER[1]],
        floatingDistribution: 'equal',
        floatingCornerTargetCount: 4,
        floatingCornerBuffers: [DEFAULT_CORNER_BUFFER_ORDER[1]],
        floatingCornerDistribution: 'equal',
        edgeParityTargets: getEdgeParityTargets('UF'),
        flipExtraCount: 0,
        flipCustomCount: 2,
        flipTargets: getFlipTargets('UF'),
        flipParityTargets: getFlipParityTargets('UF'),
        edgeTwoSwapMode: 'unoriented',
        f2eFirstPieces: [...F2E_FIRST_PIECES],
        f2eOnlyLaterBuffers: false,
        f2eExtraCount: 6,
    };
}

const cases = [
    // Format: [label, mutator, expectedAccept (true) or expectedRejectSubstring (string)]
    ['both Solved', (c) => {}, true],

    // Random + Random
    ['Random Any + Random Any', (c) => { c.cornerScrambleType = 'Random'; c.edgeScrambleType = 'Random'; }, true],
    ['Random Even + Random Even', (c) => { c.cornerScrambleType = 'Random'; c.cornerRandomParity = 'even'; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'even'; }, true],
    ['Random Odd + Random Odd', (c) => { c.cornerScrambleType = 'Random'; c.cornerRandomParity = 'odd'; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'odd'; }, true],
    ['Random Odd + Random Even (mismatch)', (c) => { c.cornerScrambleType = 'Random'; c.cornerRandomParity = 'odd'; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'even'; }, 'Parity mismatch'],
    ['Random Any + Random Odd (free side)', (c) => { c.cornerScrambleType = 'Random'; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'odd'; }, true],

    // Targets vs Random
    ['Targets odd + Random Even (mismatch)', (c) => { c.cornerScrambleType = 'Targets'; c.cornerTargetCount = 3; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'even'; }, 'Parity mismatch'],
    ['Targets odd + Random Odd', (c) => { c.cornerScrambleType = 'Targets'; c.cornerTargetCount = 3; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'odd'; }, true],
    ['Targets even + Random Even', (c) => { c.cornerScrambleType = 'Targets'; c.cornerTargetCount = 4; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'even'; }, true],
    ['Targets odd + Random Any (free)', (c) => { c.cornerScrambleType = 'Targets'; c.cornerTargetCount = 3; c.edgeScrambleType = 'Random'; }, true],

    // 2-Swap (forced odd)
    ['2-Swap + 2-Swap (both odd)', (c) => { c.cornerScrambleType = '2-Swap'; c.edgeScrambleType = '2-Swap'; }, true],
    ['2-Swap + Solved (engine auto-balances via 2-swap on Solved side)', (c) => { c.cornerScrambleType = '2-Swap'; }, true],
    ['2-Swap + Random Odd', (c) => { c.cornerScrambleType = '2-Swap'; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'odd'; }, true],
    ['2-Swap + Random Even (mismatch)', (c) => { c.cornerScrambleType = '2-Swap'; c.edgeScrambleType = 'Random'; c.edgeRandomParity = 'even'; }, 'Parity mismatch'],
    ['2-Swap + Targets odd', (c) => { c.cornerScrambleType = '2-Swap'; c.edgeScrambleType = 'Targets'; c.edgeTargetCount = 3; }, true],

    // Edge 2-Swap is parity-flexible (the engine absorbs either corner parity).
    ['Edge 2-Swap + Targets even corners', (c) => { c.edgeScrambleType = '2-Swap'; c.cornerScrambleType = 'Targets'; c.cornerTargetCount = 4; }, true],
    ['Edge 2-Swap + Targets odd corners', (c) => { c.edgeScrambleType = '2-Swap'; c.cornerScrambleType = 'Targets'; c.cornerTargetCount = 3; }, true],
    ['Edge 2-Swap + Solved corners', (c) => { c.edgeScrambleType = '2-Swap'; }, true],

    // Floating + Solved: Solved is parity-flexible, so both even and odd N accept.
    ['Floating-edge N=3 + Solved corners', (c) => { c.edgeScrambleType = 'Floating'; c.floatingTargetCount = 3; c.floatingBuffers = [DEFAULT_EDGE_BUFFER_ORDER[1]]; }, true],
    ['Floating-edge N=4 + Solved corners', (c) => { c.edgeScrambleType = 'Floating'; c.floatingTargetCount = 4; c.floatingBuffers = [DEFAULT_EDGE_BUFFER_ORDER[1]]; }, true],

    // Twist with extras (parity = extraCount % 2)
    ['Twist extras=2 + Targets even', (c) => { c.cornerScrambleType = 'Twist'; c.cornerTwistExtraCount = 2; c.edgeScrambleType = 'Targets'; c.edgeTargetCount = 4; }, true],
    ['Twist extras=3 + Targets even (mismatch)', (c) => { c.cornerScrambleType = 'Twist'; c.cornerTwistCount = 1; c.cornerTwistExtraCount = 3; c.edgeScrambleType = 'Targets'; c.edgeTargetCount = 4; }, 'Parity mismatch'],
];

let pass = 0, fail = 0;
const failures = [];
for (const [label, mut, expected] of cases) {
    const cfg = base();
    mut(cfg);
    const result = validateScrambleConfig(cfg);
    const accepted = result === null;
    let ok;
    if (expected === true) ok = accepted;
    else ok = !accepted && result.includes(expected);

    if (ok) pass += 1;
    else {
        fail += 1;
        failures.push({ label, expected, result });
    }
}

console.log(`Validator parity tests: ${pass} pass, ${fail} fail (of ${cases.length})`);
for (const f of failures) {
    console.log(`  FAIL: ${f.label}`);
    console.log(`    expected: ${f.expected === true ? 'accept' : `reject containing "${f.expected}"`}`);
    console.log(`    got:      ${f.result === null ? 'accepted' : `rejected: ${f.result}`}`);
}
if (fail > 0) process.exitCode = 1;
