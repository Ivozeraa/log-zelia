import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import ProtectedRoute from "./routers/ProtectedRoute";
import { Login } from "./pages/Login";
import { ToastProvider } from "./components/ui/ToastProvide";

const Landing = lazy(() => import("./pages/Landing").then((module) => ({ default: module.Landing })));
const StudentOccurrenceLookup = lazy(() => import("./pages/StudentOccurrenceLookup").then((module) => ({ default: module.StudentOccurrenceLookup })));
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const Occurrences = lazy(() => import("./pages/Occurrences").then((module) => ({ default: module.Occurrences })));
const Management = lazy(() => import("./pages/Management").then((module) => ({ default: module.Management })));
const StudentManagement = lazy(() => import("./pages/StudentManagement").then((module) => ({ default: module.StudentManagement })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const EditProfile = lazy(() => import("./components/user/EditProfile").then((module) => ({ default: module.EditProfile })));
const Suporte = lazy(() => import("./pages/Suport").then((module) => ({ default: module.Suporte })));
const Feedback = lazy(() => import("./pages/Feedback").then((module) => ({ default: module.Feedback })));
const Horarios = lazy(() => import("./pages/Horarios").then((module) => ({ default: module.Horarios })));

function PageFallback() { return <div className="min-h-[40vh] animate-pulse rounded-2xl bg-slate-100/60 dark:bg-slate-900/40" aria-hidden="true" />; }
function ProtectedAppRoutes() { return <ProtectedRoute><Layout /></ProtectedRoute>; }

function App() {
  return <>
    <Router>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/consultar-ocorrencias" element={<StudentOccurrenceLookup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<ProtectedAppRoutes />}>
            <Route index element={<Home />} /><Route path="advertencias" element={<Occurrences />} />
            <Route path="gestao" element={<ProtectedRoute allowedRoles={[1,2,3]}><Management /></ProtectedRoute>} />
            <Route path="gestao/alunos" element={<ProtectedRoute allowedRoles={[1,2,3]}><StudentManagement /></ProtectedRoute>} />
            <Route path="configuracoes" element={<Settings />} /><Route path="horarios" element={<Horarios />} /><Route path="editar-perfil" element={<EditProfile />} /><Route path="suporte" element={<Suporte />} /><Route path="feedback" element={<Feedback />} />
            <Route path="*" element={<h1 className="mt-20 text-center text-2xl">404 - Página Não Encontrada</h1>} />
          </Route>
          <Route path="/advertencias" element={<Navigate to="/app/advertencias" replace />} /><Route path="/gestao" element={<Navigate to="/app/gestao" replace />} /><Route path="/gestao/alunos" element={<Navigate to="/app/gestao/alunos" replace />} /><Route path="/configuracoes" element={<Navigate to="/app/configuracoes" replace />} /><Route path="/horarios" element={<Navigate to="/app/horarios" replace />} /><Route path="/editar-perfil" element={<Navigate to="/app/editar-perfil" replace />} /><Route path="/suporte" element={<Navigate to="/app/suporte" replace />} /><Route path="/feedback" element={<Navigate to="/app/feedback" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
    <ToastProvider />
  </>;
}
export default App;
