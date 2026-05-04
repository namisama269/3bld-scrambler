export default function MultiselectCard({ title, allPieces, value, onChange }) {
    const safeValue = (value || []).filter((p) => allPieces.includes(p));
    // Pieces in `value` that aren't currently visible (e.g. the last buffer
    // when "Only later buffers" is on). We preserve their checked state across
    // every UI action so toggling visibility doesn't silently wipe selections.
    const externalValue = (value || []).filter((p) => !allPieces.includes(p));

    const commit = (newVisibleValue) => {
        onChange([...externalValue, ...newVisibleValue]);
    };

    const toggle = (piece) => {
        if (safeValue.includes(piece)) {
            commit(safeValue.filter((p) => p !== piece));
        } else {
            commit([...safeValue, piece]);
        }
    };

    const pillClass = safeValue.length === 0
        ? 'muted-pill danger muted-pill-inline'
        : safeValue.length === allPieces.length
            ? 'muted-pill muted-pill-inline'
            : 'muted-pill accent muted-pill-inline';

    return (
        <div>
            <div className="row-flex" style={{ marginBottom: 6 }}>
                <span className="row-label" style={{ marginBottom: 0 }}>{title}</span>
                <span className={pillClass}>{safeValue.length} / {allPieces.length}</span>
            </div>
            <div className="action-row" style={{ marginBottom: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => commit([...allPieces])}>Select all</button>
                <button type="button" className="btn btn-sm" onClick={() => commit([])}>Unselect all</button>
            </div>
            <div className="checks">
                {allPieces.map((p) => (
                    <label key={p} className="check check-mono">
                        <input type="checkbox" checked={safeValue.includes(p)} onChange={() => toggle(p)} />
                        <span className="check-box"></span>
                        <span>{p}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
