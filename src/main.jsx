import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/base.css'
import './styles/sections.css'

// StrictMode is intentionally off: the site's simulation scripts must run exactly once.
createRoot(document.getElementById('root')).render(<App />)
