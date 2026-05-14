import { useCallback, useEffect, useRef, useState } from 'react';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    DEFAULT_STICKER_COLORS,
    ORIENTATION_OPTIONS,
    faceAtPositionFor,
    orientationLabel,
} from '../constants.js';

// Display order for the color picker row. URFBLD = the canonical face ordering
// used in the cube facelet string (see public/scramble/main.js cubeString).
const STICKER_FACE_ORDER = ['U', 'R', 'F', 'B', 'L', 'D'];

// Flip to true to surface the color-scheme editor (per-face picker + Random +
// Reset) in the Settings card. Hidden by default — all the underlying state,
// engine plumbing (setVisualCubeStickerColors), orientation-aware label
// mapping (faceAtPositionFor), random-palette generator, and CSS remain in
// place so the feature can be reused in other projects or re-enabled here
// without rewiring anything. Just toggle this flag.
const SHOW_COLOR_SCHEME_EDITOR = false;

// HSL → 6-digit hex. Implementation of the standard HSL→RGB conversion using
// the simplified k(n) = (n + h/30) mod 12 formulation.
function hslToHex(h, s, l) {
    const sN = s / 100;
    const lN = l / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = sN * Math.min(lN, 1 - lN);
    const channel = (n) => {
        const x = lN - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
        return Math.round(255 * x).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
}

// Random palette of 6 visually-distinct colors with cube-like lightness
// variety. Hues are 6 values spaced 60° apart with a random rotation (every
// hue reachable per face; pairs always ≥60° apart). Lightness/saturation are
// stratified across SIX profiles — one near-white, one bright-light, and
// four medium — to mirror the standard cube's white + yellow + 4-colored
// distribution. Without this stratification every palette ends up feeling
// like "six medium-tone colors", which is hard for cubers used to seeing one
// light face anchor the orientation.
const PALETTE_PROFILES = [
    { sMin: 5,  sMax: 30,  lMin: 85, lMax: 95 }, // near-white (low-saturation tint)
    { sMin: 75, sMax: 100, lMin: 70, lMax: 85 }, // bright-light (yellow-ish anchor)
    { sMin: 65, sMax: 95,  lMin: 48, lMax: 62 },
    { sMin: 65, sMax: 95,  lMin: 45, lMax: 60 },
    { sMin: 65, sMax: 95,  lMin: 40, lMax: 55 },
    { sMin: 65, sMax: 95,  lMin: 35, lMax: 50 },
];

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function randomDistinctColors() {
    const offset = Math.random() * 360;
    const hues = shuffleInPlace([0, 60, 120, 180, 240, 300].map((h) => (h + offset) % 360));
    const profiles = shuffleInPlace([...PALETTE_PROFILES]);
    return hues.map((h, i) => {
        const p = profiles[i];
        const s = p.sMin + Math.random() * (p.sMax - p.sMin);
        const l = p.lMin + Math.random() * (p.lMax - p.lMin);
        return hslToHex(h, s, l);
    });
}

function reconcileOrder(saved, defaults) {
    if (!Array.isArray(saved)) return [...defaults];
    const valid = saved.filter((p) => defaults.includes(p));
    defaults.forEach((p) => { if (!valid.includes(p)) valid.push(p); });
    return valid;
}

// UF and UR are special — they're the only supported edge buffers (active +
// parity). Force them into positions 0 and 1, preserving their relative
// order if they were already both in the first two slots.
function enforceEdgeBufferConstraint(order) {
    const ufIdx = order.indexOf('UF');
    const urIdx = order.indexOf('UR');
    if (ufIdx < 2 && urIdx < 2 && ufIdx >= 0 && urIdx >= 0) return order;
    const rest = order.filter((p) => p !== 'UF' && p !== 'UR');
    const front = ufIdx <= urIdx ? ['UF', 'UR'] : ['UR', 'UF'];
    return [...front, ...rest];
}

// UFR is the only supported active corner buffer — lock it at position 0.
function enforceCornerBufferConstraint(order) {
    if (order[0] === 'UFR') return order;
    const rest = order.filter((p) => p !== 'UFR');
    return ['UFR', ...rest];
}

function BufferOrderList({ value, onChange, validate, highlightPieces }) {
    const [dragSrc, setDragSrc] = useState(null);
    const [dropHint, setDropHint] = useState({ piece: null, after: false });
    const rowRef = useRef(null);
    const dragState = useRef(null); // mutable drag session state

    const reorder = (src, target, dropAfter) => {
        if (!src || src === target) return;
        const next = value.filter((p) => p !== src);
        let idx = next.indexOf(target);
        if (idx < 0) return;
        if (dropAfter) idx += 1;
        next.splice(idx, 0, src);
        if (validate && !validate(next)) return;
        onChange(next);
    };

    // Find which chip the pointer is over and whether it's on the left or right half.
    const hitTest = useCallback((clientX, clientY) => {
        if (!rowRef.current) return null;
        const chips = rowRef.current.querySelectorAll('[role="listitem"]');
        for (const chip of chips) {
            const r = chip.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
                const piece = chip.dataset.piece;
                const after = clientX - r.left > r.width / 2;
                return { piece, after };
            }
        }
        return null;
    }, []);

    const onPointerDown = useCallback((e, piece) => {
        // Only primary button (mouse) or touch
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        // Capture on the row so pointermove/pointerup fire there during the drag.
        if (rowRef.current) rowRef.current.setPointerCapture(e.pointerId);
        dragState.current = {
            piece,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            active: false, // becomes true after threshold
        };
    }, []);

    const DRAG_THRESHOLD = 5; // px before drag activates

    const onPointerMove = useCallback((e) => {
        const ds = dragState.current;
        if (!ds) return;
        if (e.pointerId !== ds.pointerId) return;

        if (!ds.active) {
            const dx = e.clientX - ds.startX;
            const dy = e.clientY - ds.startY;
            if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
            ds.active = true;
            setDragSrc(ds.piece);
        }

        const hit = hitTest(e.clientX, e.clientY);
        if (hit && hit.piece !== ds.piece) {
            setDropHint(hit);
        } else {
            setDropHint({ piece: null, after: false });
        }
    }, [hitTest]);

    const onPointerUp = useCallback((e) => {
        const ds = dragState.current;
        if (!ds) return;
        if (e.pointerId !== ds.pointerId) return;
        dragState.current = null;

        if (ds.active) {
            const hit = hitTest(e.clientX, e.clientY);
            if (hit && hit.piece !== ds.piece) {
                reorder(ds.piece, hit.piece, hit.after);
            }
        }
        setDragSrc(null);
        setDropHint({ piece: null, after: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hitTest, value, validate, onChange]);

    // Attach move/up listeners on the row so they work even when pointer leaves the source chip.
    useEffect(() => {
        const row = rowRef.current;
        if (!row) return;
        // Use native listeners for pointer events on the container
        const move = (e) => onPointerMove(e);
        const up = (e) => onPointerUp(e);
        row.addEventListener('pointermove', move);
        row.addEventListener('pointerup', up);
        row.addEventListener('pointercancel', up);
        return () => {
            row.removeEventListener('pointermove', move);
            row.removeEventListener('pointerup', up);
            row.removeEventListener('pointercancel', up);
        };
    }, [onPointerMove, onPointerUp]);

    return (
        <div className="chip-row" role="list" ref={rowRef} style={{ touchAction: 'none' }}>
            {value.map((piece) => {
                const isActive = highlightPieces ? highlightPieces.includes(piece) : false;
                const isDragging = dragSrc === piece;
                const showHintBefore = dropHint.piece === piece && !dropHint.after;
                const showHintAfter = dropHint.piece === piece && dropHint.after;
                const cls = [
                    'chip',
                    isActive && 'active',
                    isDragging && 'dragging',
                    showHintBefore && 'drop-before',
                    showHintAfter && 'drop-after',
                ].filter(Boolean).join(' ');

                return (
                    <span
                        key={piece}
                        role="listitem"
                        data-piece={piece}
                        className={cls}
                        onPointerDown={(e) => onPointerDown(e, piece)}
                    >
                        {piece}
                    </span>
                );
            })}
        </div>
    );
}

// BLD-orientation icon variant. Both '3x3' and '1x1' are pre-generated under
// public/orientations/<variant>/ — flip this single line to switch.
const ORIENTATION_ICON_VARIANT = '3x3';
// const ORIENTATION_ICON_VARIANT = '1x1';

export default function BufferOrderCard({ activeTab, setActiveTab }) {
    const { config, updateField } = useScrambleConfig();
    const safeCornerOrder = enforceCornerBufferConstraint(
        reconcileOrder(config.cornerBufferOrder, DEFAULT_CORNER_BUFFER_ORDER),
    );
    const safeEdgeOrder = reconcileOrder(config.edgeBufferOrder, DEFAULT_EDGE_BUFFER_ORDER);
    const [collapsed, setCollapsed] = useLocalStorage('settingsCollapsed', false);

    return (
        <div className="card">
            <button
                type="button"
                className="card-header card-header-toggle"
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
            >
                <span className="card-title">Settings</span>
                <svg
                    className={`card-toggle-caret ${collapsed ? 'collapsed' : ''}`}
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                >
                    <path d="M2 5 L8 12 L14 5 Z" fill="currentColor" />
                </svg>
            </button>
            {!collapsed && <div className="card-body">
                {setActiveTab && (
                    <div className="row">
                        <label className="row-label" htmlFor="app-mode">Generate using</label>
                        <select
                            id="app-mode"
                            className="select"
                            value={activeTab}
                            onChange={(e) => setActiveTab(e.target.value)}
                        >
                            <option value="scrambler">Scrambler</option>
                            <option value="bldHelper">BLD Helper</option>
                        </select>
                    </div>
                )}
                <div className="row-stack-2col">
                    <div className="row-label">Corner buffer order</div>
                    <BufferOrderList
                        value={safeCornerOrder}
                        onChange={updateField('cornerBufferOrder')}
                        validate={(order) => order[0] === 'UFR'}
                        highlightPieces={['UFR']}
                    />
                </div>
                <div className="row-stack-2col">
                    <div className="row-label">Edge buffer order</div>
                    <BufferOrderList
                        value={safeEdgeOrder}
                        onChange={updateField('edgeBufferOrder')}
                        highlightPieces={['UF', 'UR']}
                    />
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="bld-orientation">BLD orientation</label>
                    <div className="orientation-control">
                        <img
                            className="orientation-icon"
                            src={`./orientations/${ORIENTATION_ICON_VARIANT}/${config.holdingOrientation}.svg`}
                            alt=""
                            aria-hidden="true"
                            title={orientationLabel(config.holdingOrientation)}
                        />
                        <select
                            id="bld-orientation"
                            className="select"
                            value={config.holdingOrientation}
                            onChange={(e) => updateField('holdingOrientation')(e.target.value)}
                        >
                            {Object.keys(ORIENTATION_OPTIONS).map((key) => (
                                <option key={key} value={key}>{orientationLabel(key)}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="target-order">Target order</label>
                    <select
                        id="target-order"
                        className="select"
                        value={config.targetOrder || 'piece'}
                        onChange={(e) => updateField('targetOrder')(e.target.value)}
                    >
                        <option value="piece">By piece</option>
                        <option value="face">By face (ULFRBD, Speffz ordering)</option>
                    </select>
                </div>
                <div className="row">
                    <span className="row-label">Show cube</span>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={config.showCube !== false}
                            onChange={(e) => updateField('showCube')(e.target.checked)}
                        />
                        <span className="toggle-switch"></span>
                    </label>
                </div>
                {SHOW_COLOR_SCHEME_EDITOR && <div className="row-stack-2col">
                    <div className="row-label">Color scheme</div>
                    <div className="color-scheme-row">
                        {(() => {
                            const perm = faceAtPositionFor(config.holdingOrientation || 'wg');
                            return STICKER_FACE_ORDER.map((position) => {
                                const originalFace = perm[position];
                                const current = (config.stickerColors && config.stickerColors[originalFace])
                                    || DEFAULT_STICKER_COLORS[originalFace];
                                return (
                                    <label key={position} className="color-swatch">
                                        <span className="color-swatch-label">{position}</span>
                                        <input
                                            type="color"
                                            value={current}
                                            onChange={(e) => updateField('stickerColors')({
                                                ...DEFAULT_STICKER_COLORS,
                                                ...config.stickerColors,
                                                [originalFace]: e.target.value,
                                            })}
                                            aria-label={`${position} face color`}
                                        />
                                    </label>
                                );
                            });
                        })()}
                        <div className="color-scheme-actions">
                            <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => {
                                    const [u, r, f, b, l, d] = randomDistinctColors();
                                    updateField('stickerColors')({ U: u, R: r, F: f, B: b, L: l, D: d });
                                }}
                                title="Randomize all 6 face colors (just-for-fun)"
                            >
                                Random
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => updateField('stickerColors')({ ...DEFAULT_STICKER_COLORS })}
                                title="Restore the built-in default colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>}
            </div>}
        </div>
    );
}
