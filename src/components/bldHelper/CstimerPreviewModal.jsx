import {
    useBldHelperConfig,
    CORNER_NAMES,
    EDGE_NAMES,
    SCHEMES,
    PARITY_LABELS,
    fixToString,
} from '../../state/BldHelperConfigContext.jsx';

const STATUS_SHORT = { 1: 'ok', 2: 'flip', 3: 'ok/flip', 4: 'move', 5: 'ok/move', 6: 'not ok', 7: 'any' };

function bufferLetter(scheme, pieceIdx, isEdge) {
    const parts = scheme.split(/\s+/);
    const part = isEdge ? parts[8 + pieceIdx] : parts[pieceIdx];
    return part ? part.charAt(0) : '?';
}

export default function CstimerPreviewModal({ open, onClose, lastResult }) {
    const { config } = useBldHelperConfig();
    if (!open) return null;

    const scheme = config.scheme === 'speffz' ? SCHEMES.speffz
        : config.scheme === 'chichu' ? SCHEMES.chichu
        : (config.customScheme || SCHEMES.speffz);
    const schemeLabel = config.scheme === 'speffz' ? 'Speffz'
        : config.scheme === 'chichu' ? 'ChiChu' : 'Custom';
    const orderLabel = config.order === 'ordude' ? 'U>D>E' : 'Custom';
    const cLetter = bufferLetter(scheme, config.cbuffPiece, false);
    const eLetter = bufferLetter(scheme, config.ebuffPiece, true);

    const probsLine = lastResult ? (() => {
        const p = lastResult.prob;
        const probStr = p < 1e-3 ? p.toExponential(3) : `${(Math.round(p * 1000000) / 10000)}%`;
        const caseStr = lastResult.caseNum > 1e8 ? lastResult.caseNum.toExponential(3) : lastResult.caseNum;
        return `${probStr} (cases: ${caseStr})`;
    })() : '—';
    const codeLine = lastResult
        ? (lastResult.code.match(/Corners:.*\nEdges:.*/)?.[0] || lastResult.code)
        : '—';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="card-title">csTimer BLD Helper</span>
                    <span className="flex-1" />
                    <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                    </button>
                </div>
                <div className="modal-body">
                    <table className="cst-table">
                        <tbody>
                            <tr>
                                <th>Coder</th>
                                <td colSpan={2}>{schemeLabel} · {orderLabel}</td>
                            </tr>
                            <tr>
                                <td colSpan={3} style={{ whiteSpace: 'pre-wrap' }}>{codeLine}</td>
                            </tr>
                            <tr>
                                <th colSpan={3}>Scrambler</th>
                            </tr>
                            <tr>
                                <td>{PARITY_LABELS[config.ceparity]}</td>
                                <td>Corner</td>
                                <td>Edge</td>
                            </tr>
                            <tr>
                                <td>buffer</td>
                                <td>{CORNER_NAMES[config.cbuffPiece]} [{cLetter}] · {STATUS_SHORT[config.cbuffStatus]}</td>
                                <td>{EDGE_NAMES[config.ebuffPiece]} [{eLetter}] · {STATUS_SHORT[config.ebuffStatus]}</td>
                            </tr>
                            <tr>
                                <td>fixed</td>
                                <td>{fixToString(config.cornerSolved, config.cornerTwisted) || '—'}</td>
                                <td>{fixToString(config.edgeSolved, config.edgeFlipped) || '—'}</td>
                            </tr>
                            <tr>
                                <td>flip</td>
                                <td>{config.cnerrLRMin}-{config.cnerrLRMax}</td>
                                <td>{config.enerrLRMin}-{config.enerrLRMax}</td>
                            </tr>
                            <tr>
                                <td>ex-cyc</td>
                                <td>{config.cscycLRMin}-{config.cscycLRMax}</td>
                                <td>{config.escycLRMin}-{config.escycLRMax}</td>
                            </tr>
                            <tr>
                                <td>#codes</td>
                                <td>{config.cncodeLRMin}-{config.cncodeLRMax}</td>
                                <td>{config.encodeLRMin}-{config.encodeLRMax}</td>
                            </tr>
                            <tr>
                                <td>probs</td>
                                <td colSpan={2}>{probsLine}</td>
                            </tr>
                            <tr>
                                <td>ori</td>
                                <td colSpan={2}>{config.ceori ? 'random' : 'fixed'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
