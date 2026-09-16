import './index.css'
import './darkmode.css'
import App from './App.jsx'
import { AuthProvider } from "./contexts/AuthContext.jsx"
import { SchoolProvider } from "./contexts/SchoolContext.jsx"
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { createMuiTheme } from './muiTheme'
import { applyTheme } from './theme'
import { installSuspensionReportBridge } from './utils/suspensionReportBridge'

const savedTheme = localStorage.getItem('theme') || 'light'
applyTheme(savedTheme)

installSuspensionReportBridge()

ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={createMuiTheme(savedTheme)}>
    <CssBaseline />
    <AuthProvider>
      <SchoolProvider>
        <App />
      </SchoolProvider>
      <Analytics />
      <SpeedInsights />
    </AuthProvider>
  </ThemeProvider>
)
