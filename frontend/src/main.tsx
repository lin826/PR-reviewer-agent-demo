import { createRoot } from 'react-dom/client';
import App from './App';

console.log('SWE Quality Frontend initializing...');

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('App container not found');
}
