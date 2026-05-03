// A horizontal grid of piece checkboxes with mutual-exclusion against a sibling
// grid. Used for "Solved" + "Twisted/Flipped" rows where a piece can be in at
// most one row.
export default function PieceFixGrid({ pieces, hidePiece, value, otherValue, onChange }) {
    const toggle = (piece) => {
        if (value.includes(piece)) {
            onChange(value.filter((p) => p !== piece));
        } else {
            onChange([...value.filter((p) => p !== piece), piece]);
        }
    };

    return (
        <div className="checks">
            {pieces.map((piece) => {
                if (piece === hidePiece) return null;
                const checked = value.includes(piece);
                const disabled = !checked && otherValue.includes(piece);
                return (
                    <label key={piece} className={`check check-mono ${disabled ? 'disabled' : ''}`}>
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(piece)}
                        />
                        <span className="check-box"></span>
                        <span>{piece}</span>
                    </label>
                );
            })}
        </div>
    );
}
