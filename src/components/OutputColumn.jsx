import { useEffect, useRef, useState } from 'react';
import { useScrambleConfig, toEngineConfig } from '../state/ScrambleConfigContext.jsx';
import { useScrambleOutput } from '../state/ScrambleOutputContext.jsx';
import { validateScrambleConfig } from '../state/validateScrambleConfig.js';
import Alert from './Alert.jsx';

// Pretty-print like JSON.stringify(value, null, 2), but inline arrays whose
// elements are all primitives so target lists like ["RD","BR",...] stay on
// one line while arrays of objects keep their per-element breaks.
function formatTracingJson(value, indent = 0) {
    const pad = '  '.repeat(indent);
    const padInner = '  '.repeat(indent + 1);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const allPrimitive = value.every((v) => v === null || typeof v !== 'object');
        if (allPrimitive) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
        const items = value.map((v) => padInner + formatTracingJson(v, indent + 1));
        return `[\n${items.join(',\n')}\n${pad}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        const items = keys.map((k) => `${padInner}${JSON.stringify(k)}: ${formatTracingJson(value[k], indent + 1)}`);
        return `{\n${items.join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(value);
}

export default function OutputColumn({ activeTab }) {
    const canvasRef = useRef(null);
    const cancelBulkRef = useRef(false);
    const { config, updateField } = useScrambleConfig();
    const out = useScrambleOutput();
    const [bulkProgress, setBulkProgress] = useState(null);

    // Bind the scramble engine to the currently mounted canvas. React StrictMode
    // remounts components in dev — re-init each mount so vc/ctx stay pointed at
    // the visible canvas.
    useEffect(() => {
        if (typeof window.initScrambler !== 'function') {
            out.setError('Scramble engine not loaded');
            return;
        }
        if (!canvasRef.current) return;
        try {
            window.initScrambler(canvasRef.current, { holdingOrientation: config.holdingOrientation });
        } catch (e) {
            out.setError(e.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (typeof window.setHoldingOrientation === 'function') {
            window.setHoldingOrientation(config.holdingOrientation);
        }
    }, [config.holdingOrientation]);

    // Push the user's custom face-color scheme into the canvas renderer
    // whenever it changes. The engine's stickerColors map is mutable and the
    // setter repaints, so this also covers the initial mount once init runs.
    useEffect(() => {
        if (typeof window.setVisualCubeStickerColors === 'function') {
            window.setVisualCubeStickerColors(config.stickerColors);
        }
    }, [config.stickerColors]);

    const onGenerate = () => {
        out.clear();
        const validationError = validateScrambleConfig(config);
        if (validationError) { out.setError(validationError); return; }
        try {
            const engineCfg = toEngineConfig(config);
            const result = window.generateMultipleScrambles({
                config: engineCfg,
                numScrambles: 1,
            });
            // Single mode renders the cube as a side effect of the engine call.
            out.setScrambleText(result.scrambles[0]);
        } catch (e) {
            out.setError(e.message);
        }
    };

    const onBulk = async () => {
        out.clear();
        const validationError = validateScrambleConfig(config);
        if (validationError) { out.setError(validationError); return; }

        const engineCfg = toEngineConfig(config);
        const count = Math.max(1, Math.min(9999, config.numScrambles || 1));
        cancelBulkRef.current = false;
        setBulkProgress({ done: 0, total: count });
        out.setScrambleList([]);

        // Time-budgeted chunking: run scrambles for ~30ms, then yield to the
        // event loop so React can repaint the progress bar and the user can
        // still scroll/interact. Total wall-clock time is essentially the
        // same as a synchronous loop minus a few setTimeout(0) overheads.
        const BUDGET_MS = 30;
        const acc = [];
        let lastYield = performance.now();

        for (let i = 0; i < count; i++) {
            if (cancelBulkRef.current) break;
            try {
                acc.push(window.generateScramble({ config: engineCfg, silent: true }));
            } catch (e) {
                acc.push(`Error: ${e.message}`);
            }
            if (performance.now() - lastYield > BUDGET_MS || i === count - 1) {
                setBulkProgress({ done: i + 1, total: count });
                out.setScrambleList([...acc]);
                await new Promise((resolve) => setTimeout(resolve, 0));
                lastYield = performance.now();
            }
        }

        setBulkProgress(null);
    };

    const onDebug = () => {
        const engineDebug = typeof window.getScrambleDebug === 'function'
            ? (window.getScrambleDebug() || '')
            : '';
        // Append dlin tracing below the engine debug if a scramble exists
        // and the tracer is available.
        const scramble = (out.scrambleText || '').trim();
        let dlinSection = '';
        if (scramble && typeof window.Tracer === 'function' && window.BUFFERS) {
            try {
                const buffers = {
                    corner: config.cornerBufferOrder,
                    edge: config.edgeBufferOrder,
                };
                const tracer = new window.Tracer(buffers, 'both');
                tracer.scrambleFromString(scramble);
                tracer.traceCube();
                dlinSection = '\n\nDLin tracing:\n' + formatTracingJson(tracer.tracing);
            } catch (e) {
                dlinSection = '\n\nDLin tracing error: ' + e.message;
            }
        }
        out.setDebugText(engineDebug + dlinSection);
    };

    // Spacebar shortcut on the Scrambler tab only.
    useEffect(() => {
        const onKey = (e) => {
            if (e.code !== 'Space') return;
            if (activeTab !== 'scrambler') return;
            const tag = (document.activeElement?.tagName || '').toUpperCase();
            const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable;
            if (editable) return;
            e.preventDefault();
            onGenerate();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, activeTab]);

    return (
        <div className="col-stack">
            {activeTab === 'scrambler' && (
                <div className="action-row">
                    <button type="button" className="btn btn-primary" onClick={onGenerate}>
                        Generate scramble
                    </button>
                    <div className="bulk-group">
                        <button type="button" className="btn bulk-btn" onClick={onBulk}>Generate bulk:</button>
                        <input
                            className="input input-num bulk-count"
                            type="number"
                            min="1"
                            max="9999"
                            aria-label="Bulk count"
                            title="Bulk count"
                            value={config.numScrambles}
                            onChange={(e) =>
                                updateField('numScrambles')(
                                    Math.max(1, Math.min(9999, parseInt(e.target.value) || 1))
                                )
                            }
                        />
                    </div>
                    <span className="action-spacer" />
                    <button type="button" className="btn" onClick={onDebug}>Debug</button>
                </div>
            )}

            {out.error ? <Alert severity="error">{out.error}</Alert> : null}

            {bulkProgress ? (
                <div className="card" style={{ padding: 12 }}>
                    <div className="row-flex" style={{ marginBottom: 8 }}>
                        <span className="card-title">Generating bulk</span>
                        <span className="muted-pill muted-pill-inline">
                            {bulkProgress.done} / {bulkProgress.total}
                        </span>
                        <span className="flex-1" />
                        <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => { cancelBulkRef.current = true; }}
                        >
                            Cancel
                        </button>
                    </div>
                    <div className="progress">
                        <div
                            className="progress-fill"
                            style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                        />
                    </div>
                </div>
            ) : null}

            {out.scrambleText ? (
                <Alert severity="success" label={null}>{out.scrambleText}</Alert>
            ) : null}

            {out.scrambleList ? (
                <div className="scramble-list">
                    {out.scrambleList.map((s, i) => (
                        <div key={i} className="scramble-list-row">
                            <span className="num">{i + 1}.</span>
                            <span>{s}</span>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className={`canvas-wrap ${out.scrambleList || config.showCube === false ? 'hidden' : ''}`}>
                <canvas
                    ref={canvasRef}
                    width="1200"
                    height="1200"
                />
            </div>

            {out.debugText ? <Alert severity="debug">{out.debugText}</Alert> : null}
        </div>
    );
}
