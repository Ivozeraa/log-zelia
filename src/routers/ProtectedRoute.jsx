import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) return <div role="status" aria-label="Verificando acesso" className="min-h-screen bg-neutral-100 dark:bg-gray-950" />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role_id)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
