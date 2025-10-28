import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')!;
if (!rootElement.classList.contains('bg-gray-900')) {
  rootElement.classList.add('bg-gray-900');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
