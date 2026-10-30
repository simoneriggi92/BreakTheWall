import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './clarity.css';
import './disassembly.css';
import './guided-reading.css';

createRoot(document.getElementById('root')!).render(<App/>);
