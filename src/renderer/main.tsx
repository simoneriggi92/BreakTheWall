import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './clarity.css';
import './disassembly.css';
import './exploration.css';

createRoot(document.getElementById('root')!).render(<App/>);
