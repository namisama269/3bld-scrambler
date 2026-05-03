// Standardized in-app alert. Used for scramble output, validation errors,
// debug dumps, etc. The visual style is the same scramble-pill chrome with
// a severity-driven border + label color.

const SEVERITY_CLASS = {
    error: 'scramble-pill error',
    info: 'scramble-pill',
    success: 'scramble-pill success',
    debug: 'scramble-pill',
};

const SEVERITY_LABEL = {
    error: 'Error',
    info: 'Info',
    success: 'Scramble',
    debug: 'Debug',
};

export default function Alert({ severity = 'info', label, children }) {
    const cls = SEVERITY_CLASS[severity] || 'scramble-pill';
    const lbl = label !== undefined ? label : SEVERITY_LABEL[severity];
    return (
        <div className={cls}>
            {lbl ? <span className="label">{lbl}</span> : null}
            {children}
        </div>
    );
}
