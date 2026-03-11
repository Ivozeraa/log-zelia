import './index.css'
import App from './App.jsx'
import { AuthProvider } from "./contexts/AuthContext.jsx"

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)