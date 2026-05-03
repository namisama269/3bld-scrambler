import { useState } from 'react';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    ORIENTATION_OPTIONS,
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

function BufferOrderList({ value, onChange, validate, secondaryIdx }) {
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
                const isActive = idx === 0 || idx === secondaryIdx;
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

export default function BufferOrderCard() {
    const { config, updateField } = useScrambleConfig();
    const safeCornerOrder = reconcileOrder(config.cornerBufferOrder, DEFAULT_CORNER_BUFFER_ORDER);
    const safeEdgeOrder = enforceEdgeBufferConstraint(
        reconcileOrder(config.edgeBufferOrder, DEFAULT_EDGE_BUFFER_ORDER),
    );

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Buffer order</span>
            </div>
            <div className="card-body">
                <div className="row-stack-2col">
                    <div className="row-label">Corners</div>
                    <BufferOrderList
                        value={safeCornerOrder}
                        onChange={updateField('cornerBufferOrder')}
                    />
                </div>
                <div className="row-stack-2col">
                    <div className="row-label">Edges</div>
                    <BufferOrderList
                        value={safeEdgeOrder}
                        onChange={updateField('edgeBufferOrder')}
                        secondaryIdx={1}
                        validate={(order) => {
                            const firstTwo = order.slice(0, 2);
                            return firstTwo.includes('UF') && firstTwo.includes('UR');
                        }}
                    />
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="bld-orientation">BLD orientation</label>
                    <select
                        id="bld-orientation"
                        className="select"
                        value={config.holdingOrientation}
                        onChange={(e) => updateField('holdingOrientation')(e.target.value)}
                    >
                        {Object.entries(ORIENTATION_OPTIONS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
