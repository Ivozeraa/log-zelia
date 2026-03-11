import './index.css'
import App from './App.jsx'
import { AuthProvider } from "./contexts/AuthContext.jsx"
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)