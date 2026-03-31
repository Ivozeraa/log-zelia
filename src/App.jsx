import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Layout from "./Layout";

import { Home } from "./pages/Home";
import { Occurrences } from "./pages/Occurrences";
import { Management } from "./pages/Management";
import { Settings } from "./pages/Settings";
import ProtectedRoute from "./routers/ProtectedRoute";
import { Login } from "./pages/Login";

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home username={"Usuário"} />} />
          <Route path="advertencias" element={<Occurrences />} />
          <Route path="gestao" element={<Management />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;