import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { SchoolContext } from "./SchoolContextImpl";
import { useAuth } from "../hooks/useAuth";

export function SchoolProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isGlobalAdmin = Number(user?.role_id) === 1 && !user?.escola_id;
  const isSchoolBound = Boolean(user?.escola_id);

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

  const scope = useMemo(() => ({
    schoolId: school?.id ?? user?.escola_id ?? null,
    isGlobalAdmin,
    isSchoolBound,
    canSwitchSchool: isGlobalAdmin,
    requireSchoolId() {
      const currentSchoolId = school?.id ?? user?.escola_id ?? null;
      if (!currentSchoolId && !isGlobalAdmin) {
        throw new Error("A conta não possui uma escola vinculada.");
      }
      return currentSchoolId;
    },
    resolveSchoolId(requestedSchoolId = null) {
      const currentSchoolId = school?.id ?? user?.escola_id ?? null;
      if (isGlobalAdmin) return requestedSchoolId || null;
      return currentSchoolId;
    },
  }), [isGlobalAdmin, isSchoolBound, school?.id, user?.escola_id]);

  return (
    <SchoolContext.Provider
      value={{
        school,
        schoolId: scope.schoolId,
        isGlobalAdmin: scope.isGlobalAdmin,
        isSchoolBound: scope.isSchoolBound,
        canSwitchSchool: scope.canSwitchSchool,
        requireSchoolId: scope.requireSchoolId,
        resolveSchoolId: scope.resolveSchoolId,
        loading: authLoading || loading,
        error,
        refreshSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}
