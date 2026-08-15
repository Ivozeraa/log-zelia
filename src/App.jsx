import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./Layout";
import ProtectedRoute from "./routers/ProtectedRoute";
import { Login } from "./pages/Login";
import { Loading } from "./components/ui/Loading";
import { ToastProvider } from "./components/ui/ToastProvide";

const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const Occurrences = lazy(() => import("./pages/Occurrences").then((module) => ({ default: module.Occurrences })));
const Management = lazy(() => import("./pages/Management").then((module) => ({ default: module.Management })));
const StudentManagement = lazy(() => import("./pages/StudentManagement").then((module) => ({ default: module.StudentManagement })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const EditProfile = lazy(() => import("./components/user/EditProfile").then((module) => ({ default: module.EditProfile })));
const Suporte = lazy(() => import("./pages/Suport").then((module) => ({ default: module.Suporte })));
const Feedback = lazy(() => import("./pages/Feedback").then((module) => ({ default: module.Feedback })));
const Horarios = lazy(() => import("./pages/Horarios").then((module) => ({ default: module.Horarios })));

function PageFallback() {
  return (
    <div className="min-h-[40vh] animate-pulse rounded-2xl bg-slate-100/60 dark:bg-slate-900/40" aria-hidden="true" />
  );
}

function App() {
  const { loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <>
      <Router>
        <Suspense fallback={<PageFallback />}>
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
              <Route
                path="gestao/alunos"
                element={
                  <ProtectedRoute allowedRoles={[1, 2, 3]}>
                    <StudentManagement />
                  </ProtectedRoute>
                }
              />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="horarios" element={<Horarios />} />
              <Route path="editar-perfil" element={<EditProfile />} />
              <Route path="suporte" element={<Suporte />} />
              <Route path="feedback" element={<Feedback />} />
              <Route path="*" element={<h1 className="text-center mt-20 text-2xl">404 - Página Não Encontrada</h1>} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
      <ToastProvider />
    </>
  );
}

export default App;
