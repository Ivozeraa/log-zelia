import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { Navigate } from "react-router-dom";
import { Loading } from "../components/Loading";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [session, setSession] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (!session?.user) return;

      setLoadingUser(true);

      const { data, error } = await supabase
        .from("usuarios")
        .select("role_id")
        .eq("id", session.user.id)
        .single();

      if (!error) {
        setUserData(data);
      }

      setLoadingUser(false);
    };

    loadUser();
  }, [session]);

  if (session === undefined || loadingUser) return <Loading />;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length === 0) {
    return children;
  }

  const hasPermission = allowedRoles.includes(userData?.role_id);

  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  return children;
}