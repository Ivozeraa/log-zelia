import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

import Layout from "./Layout";

import { Home } from "./pages/Home";
import { Occurrences } from "./pages/Occurrences";
import { Management } from "./pages/Management";
import { Settings } from "./pages/Settings";
import { EditProfile } from "./pages/EditProfile";
import ProtectedRoute from "./routers/ProtectedRoute";
import { Login } from "./pages/Login";
import { Loading } from "./components/Loading";
import { ToastProvider } from "./components/ToastProvide"

function App() {
  const { loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <>
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
          <Route path="editar-perfil" element={<EditProfile />} />
        </Route>
      </Routes>
    </Router>

    <ToastProvider />
    </>
  );
}

export default App;