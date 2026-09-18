import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";

export default function FeatureRoute({ feature, children }) {
  const { hasFeature, loading } = useSchoolFeatures();

  if (loading) return null;
  if (!hasFeature(feature)) return <Navigate to="/app" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
