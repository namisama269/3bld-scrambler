import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
// To revert to the previous Linear-inspired tokens, swap the import above
// for './styles.legacy.css' (palette + fonts both fall back).

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
);
