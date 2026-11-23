import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LocalPage } from './LocalPage';
import './styles.css';
import './clarity.css';
import './disassembly.css';
import './exploration.css';
import './round.css';

// `vite build --mode page` builds the local page opened from Claude Code; every other build is Electron's renderer.
createRoot(document.getElementById('root')!).render(import.meta.env.MODE === 'page' ? <LocalPage/> : <App/>);
