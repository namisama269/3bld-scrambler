// 462-parity correction test. The bug was: corner Twist (with a BUR-style
// twist target, i.e. on the UBR piece) + edge Parity (or any odd-edge-parity
// path) → the edge parity alg's UFR↔UBR swap relocates the UBR twist to UFR
// in the final cube state.
//
// Fix: when both sides produce odd parity, run handle462Parity at the start
// (after CO twists / EO flips). The 3-alg sequence handles both danglers
// up-front and the per-side branches do only the even remainder.
//
// What this test checks:
//   1. Misoriented entries on the intended twist pieces (NOT on UFR).
//   2. No misoriented entry on UFR (the buffer stays solved on CO).
//   3. Misoriented count == intended twist count (filtering UFR).

import { loadGen } from './loadGen.js';
import { Tracer } from './loadDlin.js';
import { getMisoriented } from './dlinHelpers.js';
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

const K = 100;
const CORNER_BUFFER = 'UFR';
const EDGE_BUFFER = 'UF';

function baseConfig() {
    return {
        cornerBufferOrder: [...DEFAULT_CORNER_BUFFER_ORDER],
        edgeBufferOrder: [...DEFAULT_EDGE_BUFFER_ORDER],
        cornerBuffer: CORNER_BUFFER,
        edgeBuffer: EDGE_BUFFER,
        holdingOrientation: 'wg',
        cornerScrambleType: 'Solved',
        edgeScrambleType: 'Solved',
        cornerRandomParity: 'any',
        edgeRandomParity: 'any',
        cornerTargetCount: 8,
        parityTargets: getTargetsExcludingBuffer(CORNER_BUFFER),
        cornerTwistCount: 2,
        cornerTwistExtraCount: 0,
        cornerTwistDirection: 'mixed',
        cornerTwistTargets: getUDStickerTargets(CORNER_BUFFER),
        twoSwapMode: 'unoriented',
        t2cFirstPieces: [...DEFAULT_CORNER_BUFFER_ORDER].slice(1, -1),
        t2cOnlyLaterBuffers: false,
        edgeTargetCount: 12,
        floatingTargetCount: 4, floatingBuffers: [],
        floatingDistribution: 'equal',
        floatingCornerTargetCount: 4, floatingCornerBuffers: [],
        floatingCornerDistribution: 'equal',
        edgeParityTargets: getEdgeParityTargets(EDGE_BUFFER),
        flipExtraCount: 0,
        flipCustomCount: 2,
        flipTargets: getFlipTargets(EDGE_BUFFER),
        flipParityTargets: getFlipParityTargets(EDGE_BUFFER),
        edgeTwoSwapMode: 'unoriented',
        f2eFirstPieces: [...F2E_FIRST_PIECES],
        f2eOnlyLaterBuffers: false,
        f2eExtraCount: 6,
    };
}

function fmt(value, indent = 0) {
    const pad = '  '.repeat(indent);
    const padInner = '  '.repeat(indent + 1);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const allPrim = value.every((v) => v === null || typeof v !== 'object');
        if (allPrim) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
        return `[\n${value.map((v) => padInner + fmt(v, indent + 1)).join(',\n')}\n${pad}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        return `{\n${keys.map((k) => `${padInner}${JSON.stringify(k)}: ${fmt(value[k], indent + 1)}`).join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(value);
}

function trace(scramble, cornerOrder, edgeOrder) {
    const tracer = new Tracer({ corner: cornerOrder, edge: edgeOrder }, 'both');
    tracer.scrambleFromString(scramble);
    tracer.traceCube();
    return tracer.tracing;
}

function runScenario({ label, K: localK, configMutator, expectedCornerMisoCount, expectedEdgeMisoCount = 0, gen, cornerOrder, edgeOrder }) {
    let pass = 0, fail = 0;
    const samples = [];
    let cornerBufferTwistedCount = 0;
    let edgeBufferFlippedCount = 0;
    for (let i = 0; i < localK; i++) {
        const config = baseConfig();
        configMutator(config);
        const scramble = gen({ config });
        const tracing = trace(scramble, cornerOrder, edgeOrder);
        const cMiso = tracing.corner.filter((c) => c.type === 'misoriented');
        const cBufMiso = cMiso.filter((m) => m.buffer === CORNER_BUFFER);
        const cNonBufMiso = cMiso.filter((m) => m.buffer !== CORNER_BUFFER);
        const eMiso = tracing.edge.filter((c) => c.type === 'misoriented');
        const eBufMiso = eMiso.filter((m) => m.buffer === EDGE_BUFFER);
        const eNonBufMiso = eMiso.filter((m) => m.buffer !== EDGE_BUFFER);
        if (cBufMiso.length > 0) cornerBufferTwistedCount += 1;
        if (eBufMiso.length > 0) edgeBufferFlippedCount += 1;
        const failures = [];
        if (cBufMiso.length !== 0) failures.push(`corner buffer ${CORNER_BUFFER} should not be misoriented`);
        if (cNonBufMiso.length !== expectedCornerMisoCount) {
            failures.push(`non-buffer corner miso ${cNonBufMiso.length}, expected ${expectedCornerMisoCount}`);
        }
        if (eBufMiso.length !== 0) failures.push(`edge buffer ${EDGE_BUFFER} should not be misoriented`);
        if (eNonBufMiso.length !== expectedEdgeMisoCount) {
            failures.push(`non-buffer edge miso ${eNonBufMiso.length}, expected ${expectedEdgeMisoCount}`);
        }
        if (failures.length === 0) pass += 1;
        else {
            fail += 1;
            if (samples.length < 3) samples.push({ scramble, tracing, failures });
        }
    }
    const status = fail === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${label}  ${pass}/${localK}  (corner-buf-twist runs: ${cornerBufferTwistedCount}, edge-buf-flip runs: ${edgeBufferFlippedCount})`);
    for (const s of samples) {
        console.log(`  scramble: ${s.scramble}`);
        for (const f of s.failures) console.log(`    - ${f}`);
        console.log(`    tracing: ${fmt(s.tracing).replace(/\n/g, '\n    ')}`);
    }
    return { pass, fail };
}

function main() {
    const { generateScramble } = loadGen();
    const cornerOrder = [...DEFAULT_CORNER_BUFFER_ORDER];
    const edgeOrder = [...DEFAULT_EDGE_BUFFER_ORDER];

    let totalPass = 0, totalFail = 0;

    console.log('--- Twist + Edge Parity (the BUR bug case) ---');
    // Twist N=3 mixed, extras=1 (odd) + edge Parity count=5 → both sides odd parity.
    {
        const r = runScenario({
            label: 'corners Twist N=3 extras=1 + edge Parity count=5',
            K,
            configMutator: (c) => {
                c.cornerScrambleType = 'Twist';
                c.cornerTwistCount = 3;
                c.cornerTwistExtraCount = 1;
                c.cornerTwistDirection = 'mixed';
                c.edgeScrambleType = 'Parity';
                c.edgeParityCount = 5;
                c.edgeParityTargets = getEdgeParityTargets(EDGE_BUFFER);
            },
            expectedCornerMisoCount: 3, // 3 twisted corners
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    // Twist N=1 + edge Parity count=3 (smaller case, still both odd via extras=1)
    {
        const r = runScenario({
            label: 'corners Twist N=1 extras=1 + edge Parity count=3',
            K,
            configMutator: (c) => {
                c.cornerScrambleType = 'Twist';
                c.cornerTwistCount = 1;
                c.cornerTwistExtraCount = 1;
                c.cornerTwistDirection = 'mixed';
                c.edgeScrambleType = 'Parity';
                c.edgeParityCount = 3;
                c.edgeParityTargets = getEdgeParityTargets(EDGE_BUFFER);
            },
            expectedCornerMisoCount: 1,
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    console.log('\n--- Twist target restricted to UBR-piece (forces the bug shape) ---');
    // Force UBR to be the twisted piece (the bug always fires before fix).
    {
        const r = runScenario({
            label: 'corners Twist N=1 targets=[UBR] extras=1 + edge Parity count=5',
            K,
            configMutator: (c) => {
                c.cornerScrambleType = 'Twist';
                c.cornerTwistCount = 1;
                c.cornerTwistExtraCount = 1;
                c.cornerTwistDirection = 'mixed';
                c.cornerTwistTargets = ['UBR'];
                c.edgeScrambleType = 'Parity';
                c.edgeParityCount = 5;
                c.edgeParityTargets = getEdgeParityTargets(EDGE_BUFFER);
            },
            expectedCornerMisoCount: 1, // UBR twisted; UFR should remain solved
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    console.log('\n--- Twist + Flips with odd extras (both sides odd via extras) ---');
    {
        const r = runScenario({
            label: 'corners Twist N=3 extras=1 + edges Flips N=3 extras=1',
            K,
            configMutator: (c) => {
                c.cornerScrambleType = 'Twist';
                c.cornerTwistCount = 3;
                c.cornerTwistExtraCount = 1;
                c.cornerTwistDirection = 'mixed';
                c.edgeScrambleType = 'Flips';
                c.flipCustomCount = 3;
                c.flipExtraCount = 1;
                c.flipTargets = getFlipTargets(EDGE_BUFFER);
                c.flipParityTargets = getFlipParityTargets(EDGE_BUFFER);
            },
            expectedCornerMisoCount: 3,
            expectedEdgeMisoCount: 3,
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    console.log('\n--- Targets odd corner + Flips odd extras ---');
    {
        const r = runScenario({
            label: 'corners Targets count=3 + edges Flips N=2 extras=1',
            K,
            configMutator: (c) => {
                c.cornerScrambleType = 'Targets';
                c.cornerTargetCount = 3;
                c.parityTargets = getTargetsExcludingBuffer(CORNER_BUFFER);
                c.edgeScrambleType = 'Flips';
                c.flipCustomCount = 2;
                c.flipExtraCount = 1;
                c.flipTargets = getFlipTargets(EDGE_BUFFER);
                c.flipParityTargets = getFlipParityTargets(EDGE_BUFFER);
            },
            expectedCornerMisoCount: 0,
            expectedEdgeMisoCount: 2,
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    console.log('\n--- Targets odd both sides (corner & edge) ---');
    // Both sides Targets-odd → both dispatch to Parity. 462 prefix should fire.
    {
        const r = runScenario({
            label: 'corners Targets count=3 + edges Targets count=5',
            K,
            configMutator: (c) => {
                c.cornerScrambleType = 'Targets';
                c.cornerTargetCount = 3;
                c.parityTargets = getTargetsExcludingBuffer(CORNER_BUFFER);
                c.edgeScrambleType = 'Targets';
                c.edgeTargetCount = 5;
                c.edgeParityTargets = getEdgeParityTargets(EDGE_BUFFER);
            },
            expectedCornerMisoCount: 0, // Targets is pure perm; no CO defects on corners
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    console.log(`\n=== TOTAL ${totalPass} pass, ${totalFail} fail ===`);
    if (totalFail > 0) process.exitCode = 1;
}

main();
