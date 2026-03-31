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
<<<<<<< HEAD
          <Route index element={<Home username={"Usuário"} />} />
=======

          <Route index element={<Home />} />
>>>>>>> 165dea22fa7088c69c5df1924f7a3bc82c2d6280
          <Route path="advertencias" element={<Occurrences />} />
          <Route path="gestao" element={<Management />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;