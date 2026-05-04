// End-to-end Floating-isolation contract test.
//
// Side under test = Floating, other side = Solved. The floating cycle lives
// on a non-main buffer F, so getTargets(cycles, mainBuffer, side) returns:
//     [F, ...N targets, rotateForOrientation(F, ori, side)]   (length N + 2)
//
// Per-run assertions:
//   - getTargets length === N + 2
//   - getMisoriented length === 0  (with main-buffer exception at max N)
//
// Multi-buffer scenarios additionally aggregate the chosen buffer per
// scramble and report distribution.

import { loadGen } from './loadGen.js';
import { Tracer } from './loadDlin.js';
import { getTargets, getMisoriented } from './dlinHelpers.js';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    F2E_FIRST_PIECES,
    getTargetsExcludingBuffer,
    getEdgeParityTargets,
    getFlipTargets,
    getFlipParityTargets,
    getUDStickerTargets,
    CORNER_WEIGHTS,
    EDGE_WEIGHTS,
} from '../src/constants.js';

const K_SINGLE = 50;
const K_MULTI = 400;
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
        floatingTargetCount: 4,
        floatingBuffers: [],
        floatingDistribution: 'equal',
        floatingCornerTargetCount: 4,
        floatingCornerBuffers: [],
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
        const items = value.map((v) => padInner + fmt(v, indent + 1));
        return `[\n${items.join(',\n')}\n${pad}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        const items = keys.map((k) => `${padInner}${JSON.stringify(k)}: ${fmt(value[k], indent + 1)}`);
        return `{\n${items.join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(value);
}

function traceScramble(scramble, cornerOrder, edgeOrder) {
    const tracer = new Tracer({ corner: cornerOrder, edge: edgeOrder }, 'both');
    tracer.scrambleFromString(scramble);
    tracer.traceCube();
    return tracer.tracing;
}

// expectedN: target count requested (engine may clamp; if clampedTo provided,
// use that as the expected). isMaxForF: whether N equals cyclePool size for F.
function checkContract({ side, mainBuffer, expectedN, tracing, isMaxForF }) {
    const failures = [];
    const cycles = tracing[side];
    const targets = getTargets(cycles, mainBuffer, side);
    const miso = getMisoriented(cycles).filter(
        (m) => !(isMaxForF && m.piece === mainBuffer),
    );
    const expectedLen = expectedN + 2;
    if (targets.length !== expectedLen) {
        failures.push(
            `getTargets length ${targets.length}, expected ${expectedLen} ` +
            `(N=${expectedN}, got: ${JSON.stringify(targets)})`,
        );
    }
    if (miso.length !== 0) {
        failures.push(`getMisoriented length ${miso.length}, expected 0 (got: ${JSON.stringify(miso)})`);
    }
    return failures;
}

// Find which floating buffer the cycle landed on. Returns null if nothing
// matched (a contract failure in itself).
function detectFloatingBuffer(cycles, candidates) {
    for (const c of cycles) {
        if (c.type === 'cycle' && candidates.includes(c.buffer)) return c.buffer;
    }
    return null;
}

function runScenario({ label, side, mainBuffer, expectedN, configMutator, isMaxForF, gen, cornerOrder, edgeOrder, K = K_SINGLE, maxFailureSamples = 3 }) {
    let pass = 0;
    let fail = 0;
    const samples = [];
    for (let i = 0; i < K; i++) {
        const config = baseConfig();
        configMutator(config);
        const scramble = gen({ config });
        const tracing = traceScramble(scramble, cornerOrder, edgeOrder);
        const failures = checkContract({ side, mainBuffer, expectedN, tracing, isMaxForF });
        if (failures.length === 0) pass += 1;
        else {
            fail += 1;
            if (samples.length < maxFailureSamples) samples.push({ scramble, tracing, failures });
        }
    }
    const status = fail === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${label}  ${pass}/${K}`);
    for (const s of samples) {
        console.log(`  scramble: ${s.scramble}`);
        for (const f of s.failures) console.log(`    - ${f}`);
        console.log(`    tracing: ${fmt(s.tracing).replace(/\n/g, '\n    ')}`);
    }
    return { pass, fail };
}

function runDistribution({ label, side, mainBuffer, candidates, configMutator, gen, cornerOrder, edgeOrder, K = K_MULTI }) {
    const counts = Object.fromEntries(candidates.map((p) => [p, 0]));
    let contractPass = 0;
    let contractFail = 0;
    const samples = [];
    for (let i = 0; i < K; i++) {
        const config = baseConfig();
        configMutator(config);
        const scramble = gen({ config });
        const tracing = traceScramble(scramble, cornerOrder, edgeOrder);
        const buffer = detectFloatingBuffer(tracing[side], candidates);
        if (buffer) counts[buffer] += 1;
        // For multi-buffer, target count = BT default = cyclePool.length - cyclePool.length%2.
        // We don't pin its exact value here — just check that some cycle
        // exists on a candidate and no misoriented entries appear.
        const cycles = tracing[side];
        const cycleEntry = cycles.find((c) => c.type === 'cycle' && candidates.includes(c.buffer));
        const failures = [];
        if (!cycleEntry) failures.push(`no cycle on any candidate buffer`);
        const miso = getMisoriented(cycles);
        // Multi-buffer N is always even (BT default), so no max-N twist exception needed.
        if (miso.length !== 0) failures.push(`getMisoriented length ${miso.length}, expected 0 (got: ${JSON.stringify(miso)})`);
        if (failures.length === 0) contractPass += 1;
        else {
            contractFail += 1;
            if (samples.length < 3) samples.push({ scramble, tracing, failures });
        }
    }
    const status = contractFail === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${label}  ${contractPass}/${K}`);
    const summary = candidates
        .map((p) => `${p}: ${counts[p]}/${K} (${((counts[p] / K) * 100).toFixed(1)}%)`)
        .join(', ');
    console.log(`        distribution: ${summary}`);
    for (const s of samples) {
        console.log(`  scramble: ${s.scramble}`);
        for (const f of s.failures) console.log(`    - ${f}`);
        console.log(`    tracing: ${fmt(s.tracing).replace(/\n/g, '\n    ')}`);
    }
    return { pass: contractPass, fail: contractFail, counts };
}

function main() {
    const { generateScramble } = loadGen();
    const cornerOrder = [...DEFAULT_CORNER_BUFFER_ORDER];
    const edgeOrder = [...DEFAULT_EDGE_BUFFER_ORDER];

    let totalPass = 0;
    let totalFail = 0;

    console.log('--- A. Single-buffer Floating: corners ---');
    const cornerSweeps = [
        { F: 'UFL', maxN: 6 },
        { F: 'UBL', maxN: 4 },
        { F: 'DFL', maxN: 2 },
    ];
    for (const { F, maxN } of cornerSweeps) {
        for (let N = 1; N <= maxN; N++) {
            const r = runScenario({
                label: `corners F=${F} N=${N}`,
                side: 'corner',
                mainBuffer: CORNER_BUFFER,
                expectedN: N,
                isMaxForF: N === maxN,
                configMutator: (c) => {
                    c.cornerScrambleType = 'Floating';
                    c.edgeScrambleType = 'Solved';
                    c.floatingCornerBuffers = [F];
                    c.floatingCornerTargetCount = N;
                    c.floatingCornerDistribution = 'equal';
                },
                gen: generateScramble,
                cornerOrder,
                edgeOrder,
            });
            totalPass += r.pass;
            totalFail += r.fail;
        }
    }

    console.log('\n--- A. Single-buffer Floating: edges ---');
    const edgeSweeps = [
        { F: 'UR', maxN: 10 },
        { F: 'FL', maxN: 6 },
        { F: 'DL', maxN: 2 },
    ];
    for (const { F, maxN } of edgeSweeps) {
        for (let N = 1; N <= maxN; N++) {
            const r = runScenario({
                label: `edges   F=${F} N=${N}`,
                side: 'edge',
                mainBuffer: EDGE_BUFFER,
                expectedN: N,
                isMaxForF: N === maxN,
                configMutator: (c) => {
                    c.edgeScrambleType = 'Floating';
                    c.cornerScrambleType = 'Solved';
                    c.floatingBuffers = [F];
                    c.floatingTargetCount = N;
                    c.floatingDistribution = 'equal';
                },
                gen: generateScramble,
                cornerOrder,
                edgeOrder,
            });
            totalPass += r.pass;
            totalFail += r.fail;
        }
    }

    console.log('\n--- B. Multi-buffer Floating: equal distribution ---');
    const equalScenarios = [
        { side: 'corner', mainBuffer: CORNER_BUFFER, candidates: ['UFL', 'UBR'], type: 'cornerScrambleType', listKey: 'floatingCornerBuffers', distKey: 'floatingCornerDistribution' },
        { side: 'edge',   mainBuffer: EDGE_BUFFER,   candidates: ['UR', 'UB'],   type: 'edgeScrambleType',   listKey: 'floatingBuffers',       distKey: 'floatingDistribution' },
    ];
    for (const s of equalScenarios) {
        const r = runDistribution({
            label: `${s.side}s ${s.candidates.join('+')} equal`,
            side: s.side,
            mainBuffer: s.mainBuffer,
            candidates: s.candidates,
            configMutator: (c) => {
                c[s.type] = 'Floating';
                if (s.side === 'corner') c.edgeScrambleType = 'Solved';
                else c.cornerScrambleType = 'Solved';
                c[s.listKey] = s.candidates;
                c[s.distKey] = 'equal';
            },
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log('\n--- C. Multi-buffer Floating: weighted distribution ---');
    const weightedScenarios = [
        {
            side: 'corner', mainBuffer: CORNER_BUFFER, candidates: ['UFL', 'UBR'],
            type: 'cornerScrambleType', listKey: 'floatingCornerBuffers', distKey: 'floatingCornerDistribution',
            weightsByPos: CORNER_WEIGHTS, order: cornerOrder,
        },
        {
            side: 'edge', mainBuffer: EDGE_BUFFER, candidates: ['UR', 'UB'],
            type: 'edgeScrambleType', listKey: 'floatingBuffers', distKey: 'floatingDistribution',
            weightsByPos: EDGE_WEIGHTS, order: edgeOrder,
        },
    ];
    for (const s of weightedScenarios) {
        const expectedWeights = s.candidates.map((p) => s.weightsByPos[s.order.indexOf(p)] ?? 0);
        const totalW = expectedWeights.reduce((a, b) => a + b, 0);
        const expectedPct = expectedWeights.map((w) => ((w / totalW) * 100).toFixed(1));
        const r = runDistribution({
            label: `${s.side}s ${s.candidates.join('+')} weighted (expect ${s.candidates.map((p, i) => `${p}:${expectedPct[i]}%`).join(', ')})`,
            side: s.side,
            mainBuffer: s.mainBuffer,
            candidates: s.candidates,
            configMutator: (c) => {
                c[s.type] = 'Floating';
                if (s.side === 'corner') c.edgeScrambleType = 'Solved';
                else c.cornerScrambleType = 'Solved';
                c[s.listKey] = s.candidates;
                c[s.distKey] = 'weighted';
            },
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log(`\n=== TOTAL ${totalPass} pass, ${totalFail} fail ===`);
    if (totalFail > 0) process.exitCode = 1;
}

main();
