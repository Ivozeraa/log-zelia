import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { SchoolContext } from "./SchoolContextImpl";
import { useAuth } from "../hooks/useAuth";

export function SchoolProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSchool = useCallback(async () => {
    if (authLoading) return;

    if (!user?.escola_id) {
      setSchool(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: schoolError } = await supabase
      .from("escolas")
      .select("id, nome, cidade, created_at")
      .eq("id", user.escola_id)
      .maybeSingle();

    if (schoolError) {
      console.error("Erro carregando escola:", schoolError);
      setSchool(null);
      setError(schoolError);
      setLoading(false);
      return;
    }

    setSchool(data ?? null);
    setLoading(false);
  }, [authLoading, user?.escola_id]);

  useEffect(() => {
    void loadSchool();
  }, [loadSchool]);

  const refreshSchool = useCallback(async () => {
    await loadSchool();
  }, [loadSchool]);

  return (
    <SchoolContext.Provider
      value={{
        school,
        schoolId: school?.id ?? user?.escola_id ?? null,
        loading: authLoading || loading,
        error,
        refreshSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}
