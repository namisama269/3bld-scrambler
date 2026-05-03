import {
    useBldHelperConfig,
    SCHEMES,
    ORD_UDE,
    orderToLetters,
    lettersToOrder,
} from '../../state/BldHelperConfigContext.jsx';

export default function GeneralSettingsCard() {
    const { config, updateField } = useBldHelperConfig();

    const schemeStr = config.scheme === 'speffz'
        ? SCHEMES.speffz
        : config.scheme === 'chichu'
            ? SCHEMES.chichu
            : (config.customScheme || SCHEMES.speffz);

    const orderDisplay = config.order === 'ordude'
        ? orderToLetters(ORD_UDE, schemeStr)
        : (config.customOrder
            ? orderToLetters(lettersToOrder(config.customOrder, schemeStr) || ORD_UDE, schemeStr)
            : '');

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">General Settings</span>
            </div>
            <div className="card-body">
                <div className="row">
                    <label className="row-label" htmlFor="ceparity">Parity</label>
                    <select
                        id="ceparity"
                        className="select"
                        value={config.ceparity}
                        onChange={(e) => updateField('ceparity')(Number(e.target.value))}
                    >
                        <option value={1}>Even</option>
                        <option value={2}>Odd</option>
                        <option value={3}>Any</option>
                    </select>
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="ceori">Scramble orientation</label>
                    <select
                        id="ceori"
                        className="select"
                        value={config.ceori ? 1 : 0}
                        onChange={(e) => updateField('ceori')(Number(e.target.value) === 1)}
                    >
                        <option value={0}>Fixed</option>
                        <option value={1}>Random</option>
                    </select>
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="scheme">Letter scheme</label>
                    <select
                        id="scheme"
                        className="select"
                        value={config.scheme}
                        onChange={(e) => updateField('scheme')(e.target.value)}
                    >
                        <option value="speffz">Speffz</option>
                        <option value="chichu">ChiChu</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="custom-scheme">Custom scheme</label>
                    <input
                        id="custom-scheme"
                        className="input input-mono"
                        type="text"
                        value={config.scheme === 'custom' ? config.customScheme : schemeStr}
                        onChange={(e) => updateField('customScheme')(e.target.value)}
                        disabled={config.scheme !== 'custom'}
                        readOnly={config.scheme !== 'custom'}
                        placeholder="48 chars: 8 corners (3 each) + 12 edges (2 each), space-separated"
                    />
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="order">Cycle break order</label>
                    <select
                        id="order"
                        className="select"
                        value={config.order}
                        onChange={(e) => updateField('order')(e.target.value)}
                    >
                        <option value="ordude">U &gt; D &gt; E</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                <div className="row">
                    <label className="row-label" htmlFor="custom-order">Custom order</label>
                    <input
                        id="custom-order"
                        className="input input-mono"
                        type="text"
                        value={config.order === 'custom' ? config.customOrder : orderDisplay}
                        onChange={(e) => updateField('customOrder')(e.target.value)}
                        disabled={config.order !== 'custom'}
                        readOnly={config.order !== 'custom'}
                        placeholder="20 scheme letters, e.g. CDABVUXW BCDAVUXWJLRT"
                    />
                </div>

                <details className="disclosure">
                    <summary>Custom scheme & encoding order guide</summary>
                    <div className="disclosure-body" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <p style={{ margin: 0 }}>
                            A letter scheme is a 48-character string that maps letters to cube
                            stickers for BLD memorization.
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                            <li><strong>1–24:</strong> 8 corners × 3 orientations</li>
                            <li><strong>25–48:</strong> 12 edges × 2 orientations</li>
                        </ul>
                        <p style={{ margin: 0 }}>
                            <strong>Corner order:</strong> UFR UFL UBL UBR DFR DFL DBL DBR<br />
                            <strong>Edge order:</strong> UR UF UL UB DR DF DL DB FR FL BL BR
                        </p>
                        <p style={{ margin: 0 }}>
                            Default <code>OrdUDE</code> = <code>CDABVUXW BCDAVUXWJLRT</code>
                            (U&gt;D&gt;E layer order in Speffz).
                        </p>
                    </div>
                </details>
            </div>
        </div>
    );
}
