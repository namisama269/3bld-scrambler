// Port of test/UFULswaptest.py — compare UF/UR vs UF/UL weak-swap edge tracings
// across a corpus of scrambles.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import { Tracer, BUFFERS } from './loadDlin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function traceEdgesWithSwap(scramble, swapPair) {
    let edgeBuffers;
    if (swapPair[0] === 'UF' && swapPair[1] === 'UR') {
        edgeBuffers = ['UF', 'UR', 'UL', 'UB', 'FR', 'FL', 'DR', 'DL', 'BR', 'DF', 'DB', 'BL'];
    } else if (swapPair[0] === 'UF' && swapPair[1] === 'UL') {
        edgeBuffers = ['UF', 'UL', 'UR', 'UB', 'FR', 'FL', 'DR', 'DL', 'BR', 'DF', 'DB', 'BL'];
    } else {
        throw new Error(`Unknown swap pair: ${JSON.stringify(swapPair)}`);
    }

    const tracer = new Tracer(BUFFERS, 'edges');
    tracer.manualSwap(swapPair[0], swapPair[1]);
    tracer.scrambleFromString(scramble);
    tracer.tracing = { edge: [], corner: [], scramble };
    tracer.rotateIntoOrientation();
    tracer.traceAll('edge', edgeBuffers);
    return tracer.tracing;
}

export function traceBothSwaps(scramble) {
    return {
        scramble,
        UR_swap: traceEdgesWithSwap(scramble, ['UF', 'UR']),
        UL_swap: traceEdgesWithSwap(scramble, ['UF', 'UL']),
    };
}

export function calculateStats(tracing) {
    let algs = 0;
    let targets = 0;
    let twoFlips = 0;

    let misorientedCount = 0;
    for (const cycle of tracing.edge) {
        if (cycle.type === 'misoriented' && cycle.orientation === 1 && cycle.parity === 0) {
            misorientedCount += 1;
        }
    }
    twoFlips = Math.floor(misorientedCount / 2);
    if (misorientedCount % 2 === 1) algs += 1;

    let ufCycle = null;
    const otherCycles = [];
    for (const cycle of tracing.edge) {
        if (cycle.buffer === 'UF' && cycle.type === 'cycle') {
            ufCycle = cycle;
        } else if (cycle.type === 'cycle') {
            otherCycles.push(cycle);
        }
    }

    if (ufCycle) targets += ufCycle.targets.length;
    for (const cycle of otherCycles) targets += 2 + cycle.targets.length;

    algs += Math.floor(targets / 2);
    algs += twoFlips;

    return { algs, targets, '2flips': twoFlips };
}

function printRawTracing(tracing, label) {
    console.log(`\n  ${label}:`);
    tracing.edge.forEach((cycle, i) => {
        console.log(
            `    Cycle ${i + 1}: buffer=${cycle.buffer}, type=${cycle.type}, ` +
                `targets=${JSON.stringify(cycle.targets)}, ori=${cycle.orientation}, parity=${cycle.parity}`
        );
    });
    const stats = calculateStats(tracing);
    console.log(`    Stats: algs=${stats.algs}, targets=${stats.targets}, 2flips=${stats['2flips']}`);
}

function processFile(filepath) {
    const scrambles = readFileSync(filepath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    if (scrambles.length === 0) {
        console.log('No scrambles found in file.');
        return;
    }

    let urAlgs = 0;
    let urTargets = 0;
    let urTwoFlips = 0;
    let ulAlgs = 0;
    let ulTargets = 0;
    let ulTwoFlips = 0;

    for (let i = 0; i < scrambles.length; i++) {
        const result = traceBothSwaps(scrambles[i]);
        const urStats = calculateStats(result.UR_swap);
        const ulStats = calculateStats(result.UL_swap);

        urAlgs += urStats.algs;
        urTargets += urStats.targets;
        urTwoFlips += urStats['2flips'];
        ulAlgs += ulStats.algs;
        ulTargets += ulStats.targets;
        ulTwoFlips += ulStats['2flips'];

        if ((i + 1) % 100 === 0) {
            console.log(`Processed ${i + 1}/${scrambles.length} scrambles...`);
        }
    }

    const n = scrambles.length;
    console.log(`\n=== Results for ${n} scrambles ===\n`);

    console.log('UF/UR swap:');
    console.log(`  Total:   algs=${urAlgs}, targets=${urTargets}, 2flips=${urTwoFlips}`);
    console.log(
        `  Average: algs=${(urAlgs / n).toFixed(2)}, targets=${(urTargets / n).toFixed(2)}, ` +
            `2flips=${(urTwoFlips / n).toFixed(2)}`
    );

    console.log('\nUF/UL swap:');
    console.log(`  Total:   algs=${ulAlgs}, targets=${ulTargets}, 2flips=${ulTwoFlips}`);
    console.log(
        `  Average: algs=${(ulAlgs / n).toFixed(2)}, targets=${(ulTargets / n).toFixed(2)}, ` +
            `2flips=${(ulTwoFlips / n).toFixed(2)}`
    );
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const filepath = args[0];
        if (!existsSync(filepath)) {
            console.log(`Error: File not found: ${filepath}`);
            process.exit(1);
        }
        processFile(filepath);
        return;
    }

    console.log("Enter scramble (or 'q' to quit):");
    console.log('Usage: node UFULswaptest.js <scrambles.txt>');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = () =>
        new Promise((resolve) => {
            rl.question('> ', (line) => resolve(line));
        });

    while (true) {
        const line = await ask();
        if (line == null) break;
        const scramble = line.trim();
        if (!scramble || scramble.toLowerCase() === 'q') break;

        const result = traceBothSwaps(scramble);
        printRawTracing(result.UR_swap, 'UF/UR swap');
        printRawTracing(result.UL_swap, 'UF/UL swap');
        console.log();
    }

    rl.close();
    console.log('Done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
