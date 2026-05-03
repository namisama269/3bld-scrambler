import { useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import AppShell from './components/AppShell.jsx';
import { ScrambleConfigProvider } from './state/ScrambleConfigContext.jsx';
import { ScrambleOutputProvider } from './state/ScrambleOutputContext.jsx';
import { BldHelperConfigProvider } from './state/BldHelperConfigContext.jsx';

export default function App() {
    const [themeMode, setThemeMode] = useLocalStorage('themeMode', 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
    }, [themeMode]);

    return (
        <ScrambleConfigProvider>
            <BldHelperConfigProvider>
                <ScrambleOutputProvider>
                    <AppShell
                        themeMode={themeMode}
                        onThemeToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                    />
                </ScrambleOutputProvider>
            </BldHelperConfigProvider>
        </ScrambleConfigProvider>
    );
}
