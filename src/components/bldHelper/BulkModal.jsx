import { useState } from 'react';

export default function BulkModal({ open, scrambles, progress, onClose }) {
    const [copyLabel, setCopyLabel] = useState('Copy all');
    const total = progress?.total ?? scrambles.length;
    const done = progress?.done ?? scrambles.length;
    const inProgress = progress && done < total;

    const onCopy = () => {
        const text = scrambles.map((s) => s.scramble).filter(Boolean).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopyLabel('Copied');
            setTimeout(() => setCopyLabel('Copy all'), 1500);
        });
    };

    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="card-title">Bulk scrambles</span>
                    <span className="muted-pill muted-pill-inline">{done} / {total}</span>
                    <span className="flex-1" />
                    <button type="button" className="btn btn-sm" onClick={onCopy}>{copyLabel}</button>
                    <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                    </button>
                </div>
                <div className="modal-body">
                    {inProgress && (
                        <div className="progress" aria-label={`${done} of ${total}`}>
                            <div className="progress-fill" style={{ width: `${(done / total) * 100}%` }} />
                        </div>
                    )}
                    <div className="scramble-list">
                        {scrambles.map((s, i) => (
                            <div key={i} className="scramble-list-row" style={s.error ? { color: 'var(--danger)' } : null}>
                                <span className="num">{i + 1}.</span>
                                <span>{s.error ? `Error: ${s.error}` : s.scramble}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
