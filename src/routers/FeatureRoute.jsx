import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";

export default function FeatureRoute({ feature, children }) {
  const { hasFeature, loading } = useSchoolFeatures();

  if (loading) return <div role="status" aria-label="Verificando recursos da escola" className="min-h-[40vh] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />;
  if (!hasFeature(feature)) return <Navigate to="/app" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
