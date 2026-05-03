export default function RangeRow({ label, min, max, valueMin, valueMax, onMinChange, onMaxChange }) {
    const clamp = (v) => Math.max(min, Math.min(max, isNaN(v) ? min : v));
    const handleMin = (v) => {
        const next = clamp(v);
        onMinChange(next);
        if (next > valueMax) onMaxChange(next);
    };
    const handleMax = (v) => {
        const next = clamp(v);
        onMaxChange(next);
        if (next < valueMin) onMinChange(next);
    };
    return (
        <div className="row">
            <span className="row-label">{label}</span>
            <div className="input-row">
                <span className="label-inline">Min</span>
                <input
                    className="input input-num"
                    type="number"
                    min={min}
                    max={max}
                    value={valueMin}
                    onChange={(e) => handleMin(parseInt(e.target.value))}
                />
                <span className="label-inline">Max</span>
                <input
                    className="input input-num"
                    type="number"
                    min={min}
                    max={max}
                    value={valueMax}
                    onChange={(e) => handleMax(parseInt(e.target.value))}
                />
            </div>
        </div>
    );
}
