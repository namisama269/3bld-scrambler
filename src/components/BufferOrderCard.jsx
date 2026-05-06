import { useState } from 'react';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    ORIENTATION_OPTIONS,
    orientationLabel,
} from '../constants.js';

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

    const reorder = (src, target, dropAfter) => {
        if (!src || src === target) return;
        const next = value.filter((p) => p !== src);
        let idx = next.indexOf(target);
        if (idx < 0) return;
        if (dropAfter) idx += 1;
        next.splice(idx, 0, src);
        if (validate && !validate(next)) return; // reject if constraint violated
        onChange(next);
    };

    return (
        <div className="chip-row" role="list">
            {value.map((piece, idx) => {
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
                        className={cls}
                        draggable
                        onDragStart={(e) => {
                            setDragSrc(piece);
                            e.dataTransfer.effectAllowed = 'move';
                            try { e.dataTransfer.setData('text/plain', piece); } catch (_) { /* IE */ }
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            if (!dragSrc || dragSrc === piece) return;
                            const r = e.currentTarget.getBoundingClientRect();
                            const after = e.clientX - r.left > r.width / 2;
                            setDropHint({ piece, after });
                        }}
                        onDragLeave={() => {
                            setDropHint((d) => (d.piece === piece ? { piece: null, after: false } : d));
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            const r = e.currentTarget.getBoundingClientRect();
                            const after = e.clientX - r.left > r.width / 2;
                            reorder(dragSrc, piece, after);
                            setDropHint({ piece: null, after: false });
                        }}
                        onDragEnd={() => {
                            setDragSrc(null);
                            setDropHint({ piece: null, after: false });
                        }}
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
            </div>}
        </div>
    );
}
