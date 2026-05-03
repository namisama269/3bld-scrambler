// Load the browser-side scramble engine (cube.js + alg.js + … + gen.js + main.js)
// into a Node sandbox so tests can call window.generateScramble headlessly.
//
// All scripts are concatenated and run as a single program so top-level
// const/let/class declarations in one file are visible to the next — the same
// shared lexical environment classic <script> tags get in a browser.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAMBLE_DIR = path.resolve(__dirname, '../public/scramble');

// Loaded in the same order as index.html. `dlin.js` already self-attaches to
// `window`; the others use UMD or `var`/`function` declarations that land on
// the global automatically.
const SCRIPT_ORDER = [
    'cube.js',
    'solve.js',
    'alg_jison.js',
    'alg.js',
    'bldAlgs.js',
    'helpers.js',
    'visualCube.js',
    'dlin.js',
    'gen.js',
    'main.js',
];

function buildFakeCanvas() {
    // 2d context: every method is a no-op, every property assignment is stored.
    const fakeCtx = new Proxy(
        {},
        {
            get(target, prop) {
                if (prop in target) return target[prop];
                return () => {};
            },
            set(target, prop, value) {
                target[prop] = value;
                return true;
            },
        }
    );
    return {
        width: 1200,
        height: 1200,
        getContext: () => fakeCtx,
    };
}

function buildContext() {
    const ctx = {};
    // Self-referential window so `window.X = ...` and bare `X` both resolve
    // to the same global, matching browser semantics.
    ctx.window = ctx;
    ctx.globalThis = ctx;
    ctx.self = ctx;
    ctx.console = console;
    ctx.performance = globalThis.performance;
    ctx.setTimeout = setTimeout;
    ctx.clearTimeout = clearTimeout;
    // Minimal document stub — bldAlgs.js references document.getElementById
    // inside functions we never call, but the file may be parsed as soon as
    // it loads so the symbol must at least exist.
    ctx.document = {
        getElementById: () => null,
    };
    return vm.createContext(ctx);
}

function loadAllScripts(ctx) {
    const sources = SCRIPT_ORDER.map((file) => {
        const fullPath = path.join(SCRAMBLE_DIR, file);
        return `\n//# sourceURL=${file}\n` + readFileSync(fullPath, 'utf8');
    });
    const combined = sources.join('\n');
    vm.runInContext(combined, ctx, { filename: 'scramble-bundle.js' });
}

let _cachedCtx = null;

export function loadGen() {
    if (_cachedCtx) return _cachedCtx;

    const ctx = buildContext();
    loadAllScripts(ctx);

    // initScrambler stamps cube/vc/ctx into module-scope vars in main.js.
    // Run it once with a fake canvas so generateScramble's ensureInit() is
    // satisfied; silent: true on subsequent calls keeps drawCube out of the
    // hot path.
    const fakeCanvas = buildFakeCanvas();
    ctx.window.initScrambler(fakeCanvas, { holdingOrientation: 'wg' });

    _cachedCtx = {
        window: ctx.window,
        generateScramble: (options) =>
            ctx.window.generateScramble({ silent: true, ...options }),
        generateMultipleScrambles: (options) =>
            ctx.window.generateMultipleScrambles(options),
        Tracer: ctx.window.Tracer,
        BUFFERS: ctx.window.BUFFERS,
        DlinCube: ctx.window.DlinCube,
    };
    return _cachedCtx;
}
