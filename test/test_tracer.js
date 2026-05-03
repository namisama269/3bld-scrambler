// Port of test/test_tracer.py — weak-swap edge trace using the UR buffer.

import readline from 'node:readline';
import { Tracer, BUFFERS } from './loadDlin.js';

export const TARGET_TO_LETTER = {
    UB: 'A', DL: 'B', DB: 'C', DF: 'D',
    UL: 'E', LB: 'F', LF: 'G', LD: 'H',
    FU: 'I', FL: 'J', FR: 'K', FD: 'L',
    RB: 'M', RF: 'N', UF: 'O', RD: 'P',
    BL: 'R', BR: 'S', BD: 'T', DR: 'W',
    BU: 'Y', LU: 'Z',
};

export function targetsToLetters(targets) {
    const letters = targets.map((t) => TARGET_TO_LETTER[t] ?? '?');
    const groups = [];
    for (let i = 0; i < letters.length; i += 4) {
        groups.push(letters.slice(i, i + 4).join(''));
    }
    return groups.join(' ');
}

function swapLetters(target) {
    return target[1] + target[0];
}

export function weakswapEdgesUR(scramble) {
    const edgeBuffers = ['UR', 'UF', 'UL', 'UB', 'FR', 'FL', 'DR', 'DL', 'BR', 'DF', 'DB', 'BL'];

    // Tracing 1: normal (no swap)
    const tracerNormal = new Tracer(BUFFERS, 'edges');
    tracerNormal.scrambleFromString(scramble);
    tracerNormal.tracing = { edge: [], corner: [], scramble };
    tracerNormal.rotateIntoOrientation();
    tracerNormal.traceAll('edge', edgeBuffers);

    // Tracing 2: with UF/UR manually swapped on the solved cube before scrambling
    const edgeBuffersSwapped = ['UF', 'UR', 'UL', 'UB', 'FR', 'FL', 'DR', 'DL', 'BR', 'DF', 'DB', 'BL'];
    const tracerSwapped = new Tracer(BUFFERS, 'edges');
    tracerSwapped.scrambleFromString(scramble);
    tracerSwapped.manualSwap('UF', 'UR');
    tracerSwapped.tracing = { edge: [], corner: [], scramble };
    tracerSwapped.rotateIntoOrientation();
    tracerSwapped.traceAll('edge', edgeBuffersSwapped);

    const cycleByBuffer = (tracing, buffer) =>
        tracing.edge.find((c) => c.buffer === buffer) ?? null;

    const containsTarget = (cycle, list) => {
        if (!cycle) return false;
        return cycle.targets.some((t) => list.includes(t));
    };

    const urCycleNormal = cycleByBuffer(tracerNormal.tracing, 'UR');
    const ufCycleSwapped = cycleByBuffer(tracerSwapped.tracing, 'UF');

    let chosenTracing;
    let usedSwap;
    if (containsTarget(urCycleNormal, ['UF', 'FU'])) {
        chosenTracing = tracerNormal.tracing;
        usedSwap = false;
    } else if (containsTarget(ufCycleSwapped, ['UR', 'RU'])) {
        chosenTracing = tracerSwapped.tracing;
        usedSwap = true;
    } else {
        chosenTracing = tracerNormal.tracing;
        usedSwap = false;
    }

    const flips = [];
    for (const cycle of chosenTracing.edge) {
        if (cycle.orientation === 1 && cycle.parity === 0 && cycle.targets.length === 0) {
            flips.push(cycle.buffer);
        }
    }

    const targets = [];
    const firstBuffer = usedSwap ? 'UF' : 'UR';
    const firstCycle = cycleByBuffer(chosenTracing, firstBuffer);
    if (firstCycle && firstCycle.targets.length > 0) {
        targets.push(...firstCycle.targets);
    }

    // Build remaining cycles, then sort by length descending.
    const remaining = [];
    for (const cycle of chosenTracing.edge) {
        if (cycle.buffer === firstBuffer) continue;
        if (cycle.type === 'misoriented') continue;
        if (cycle.targets.length === 0) continue;

        const cycleTargets = [cycle.buffer, ...cycle.targets];
        if (cycle.orientation === 0) {
            cycleTargets.push(cycle.buffer);
        } else {
            cycleTargets.push(swapLetters(cycle.buffer));
        }
        remaining.push({ cycleTargets, raw: cycle });
    }
    remaining.sort((a, b) => b.cycleTargets.length - a.cycleTargets.length);

    for (const r of remaining) {
        targets.push(...r.cycleTargets);
    }

    if (targets.length % 2 === 1) {
        targets.push('UF');
    }

    let outTargets = targets;
    let outFlips = flips;
    if (usedSwap) {
        const swapUrUf = (t) => {
            if (t === 'UR') return 'UF';
            if (t === 'RU') return 'FU';
            return t;
        };
        outTargets = targets.map(swapUrUf);
        outFlips = flips.map(swapUrUf);
    }

    return {
        targets: outTargets,
        flips: outFlips,
        used_swap: usedSwap,
        raw_normal: tracerNormal.tracing,
        raw_swapped: tracerSwapped.tracing,
        remaining_cycles_sorted: remaining.map((r) => r.raw),
    };
}

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const scram = await new Promise((resolve) => rl.question('Enter scramble: ', resolve));
    rl.close();

    console.log('\n=== Weakswap Edges UR Output ===');
    const result = weakswapEdgesUR(scram);

    console.log(`\nUsed swap: ${result.used_swap}`);
    console.log(`Targets: ${targetsToLetters(result.targets)}`);
    console.log(`Flips: ${result.flips.join(' ')}`);

    console.log('\nRaw normal tracing:');
    console.log(JSON.stringify(result.raw_normal));
    console.log('\nRaw swapped tracing:');
    console.log(JSON.stringify(result.raw_swapped));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
