import { useBldHelperConfig } from '../../state/BldHelperConfigContext.jsx';

export default function GeneralSettingsCard() {
    const { config, updateField } = useBldHelperConfig();

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
            </div>
        </div>
    );
}
