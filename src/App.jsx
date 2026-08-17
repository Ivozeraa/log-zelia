import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import ProtectedRoute from "./routers/ProtectedRoute";
import { Login } from "./pages/Login";
import { ToastProvider } from "./components/ui/ToastProvide";
import { LegalAndFeedback } from "./components/ui/LegalAndFeedback";
import { AnnouncementPopup } from "./components/ui/AnnouncementPopup";

const Landing = lazy(() => import("./pages/Landing").then((module) => ({ default: module.Landing })));
const StudentOccurrenceLookup = lazy(() => import("./pages/StudentOccurrenceLookup").then((module) => ({ default: module.StudentOccurrenceLookup })));
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const Occurrences = lazy(() => import("./pages/Occurrences").then((module) => ({ default: module.Occurrences })));
const Management = lazy(() => import("./pages/Management").then((module) => ({ default: module.Management })));
const StudentManagement = lazy(() => import("./pages/StudentManagement").then((module) => ({ default: module.StudentManagement })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const EditProfile = lazy(() => import("./components/user/EditProfile").then((module) => ({ default: module.EditProfile })));
const Suporte = lazy(() => import("./pages/Suport").then((module) => ({ default: module.Suporte })));
const Horarios = lazy(() => import("./pages/Horarios").then((module) => ({ default: module.Horarios })));
const AdminFeedbacks = lazy(() => import("./pages/AdminFeedbacks").then((module) => ({ default: module.AdminFeedbacks })));
const AdminAvisos = lazy(() => import("./pages/AdminAvisos").then((module) => ({ default: module.AdminAvisos })));

function PublicPageFallback() {
  return <div className="min-h-screen bg-white dark:bg-slate-950"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><div className="h-10 w-36 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80" /><div className="mt-16 h-12 w-full max-w-xl animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" /></div></div>;
}

function ProtectedAppRoutes() {
  return <ProtectedRoute><Layout /></ProtectedRoute>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Suspense fallback={<PublicPageFallback />}><Landing /></Suspense>} />
        <Route path="/consultar-ocorrencias" element={<Suspense fallback={<PublicPageFallback />}><StudentOccurrenceLookup /></Suspense>} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<ProtectedAppRoutes />}>
          <Route index element={<Home />} />
          <Route path="advertencias" element={<Occurrences />} />
          <Route path="gestao" element={<ProtectedRoute allowedRoles={[1, 2, 3]}><Management /></ProtectedRoute>} />
          <Route path="gestao/alunos" element={<ProtectedRoute allowedRoles={[1, 2, 3]}><StudentManagement /></ProtectedRoute>} />
          <Route path="feedbacks" element={<ProtectedRoute allowedRoles={[1]}><AdminFeedbacks /></ProtectedRoute>} />
          <Route path="avisos" element={<ProtectedRoute allowedRoles={[1]}><AdminAvisos /></ProtectedRoute>} />
          <Route path="configuracoes" element={<Settings />} />
          <Route path="horarios" element={<Horarios />} />
          <Route path="editar-perfil" element={<EditProfile />} />
          <Route path="suporte" element={<Suporte />} />
          <Route path="*" element={<h1 className="mt-20 text-center text-2xl">404 - Página Não Encontrada</h1>} />
        </Route>
        <Route path="/advertencias" element={<Navigate to="/app/advertencias" replace />} />
        <Route path="/gestao" element={<Navigate to="/app/gestao" replace />} />
        <Route path="/gestao/alunos" element={<Navigate to="/app/gestao/alunos" replace />} />
        <Route path="/configuracoes" element={<Navigate to="/app/configuracoes" replace />} />
        <Route path="/horarios" element={<Navigate to="/app/horarios" replace />} />
        <Route path="/editar-perfil" element={<Navigate to="/app/editar-perfil" replace />} />
        <Route path="/suporte" element={<Navigate to="/app/suporte" replace />} />
        <Route path="/feedback" element={<Navigate to="/app/feedbacks" replace />} />
        <Route path="/avisos" element={<Navigate to="/app/avisos" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <LegalAndFeedback />
      <AnnouncementPopup />
      <ToastProvider />
    </Router>
  );
}

export default App;
