import './index.css'
import App from './App.jsx'
import { AuthProvider } from "./contexts/AuthContext.jsx"
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import { applyTheme } from './theme'

applyTheme()

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <App />
    <Analytics />
    <SpeedInsights />
  </AuthProvider>
)