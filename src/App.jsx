import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./Layout";
import { Home } from "./pages/Home";
import { Occurrences } from "./pages/Occurrences";
import { Management } from "./pages/Management";
import { Settings } from "./pages/Settings";
import { EditProfile } from "./components/user/EditProfile";
import ProtectedRoute from "./routers/ProtectedRoute";
import { Login } from "./pages/Login";
import { Loading } from "./components/ui/Loading";
import { ToastProvider } from "./components/ui/ToastProvide";

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
            <Route index element={<Home />} />
            <Route path="advertencias" element={<Occurrences />} />
            <Route
              path="gestao"
              element={
                <ProtectedRoute allowedRoles={[1, 2, 3]}>
                  <Management />
                </ProtectedRoute>
              }
            />
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
