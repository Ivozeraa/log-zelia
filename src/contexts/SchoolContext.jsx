import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import { SchoolContext } from "./SchoolContextImpl";
import { useAuth } from "../hooks/useAuth";
import { canSelectSchool, resolveSchoolId } from "../utils/schoolScope";

const SELECTED_SCHOOL_STORAGE_KEY = "logview:selected-school-id";

export function SchoolProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [school, setSchool] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isGlobalAdmin = Number(user?.role_id) === 1 && !user?.escola_id;
  const isSchoolBound = Boolean(user?.escola_id);
  const canSwitchSchool = canSelectSchool(isGlobalAdmin);

  const loadSchools = useCallback(async () => {
    if (!isGlobalAdmin) {
      setSchools([]);
      return [];
    }

    const { data, error: schoolsError } = await supabase
      .from("escolas")
      .select("id, nome, cidade, created_at")
      .order("nome", { ascending: true });

    if (schoolsError) {
      throw schoolsError;
    }

    const nextSchools = data ?? [];
    setSchools(nextSchools);
    return nextSchools;
  }, [isGlobalAdmin]);

  const loadSchool = useCallback(async () => {
    if (authLoading) return;

    setLoading(true);
    setError(null);

    try {
      if (isGlobalAdmin) {
        const availableSchools = await loadSchools();
        const storedId = window.localStorage.getItem(SELECTED_SCHOOL_STORAGE_KEY);
        const storedExists = availableSchools.some((item) => String(item.id) === String(storedId));
        const nextId = storedExists ? storedId : availableSchools[0]?.id ?? null;

        setSelectedSchoolId(nextId ? String(nextId) : null);

        if (!nextId) {
          setSchool(null);
          return;
        }

        const selected = availableSchools.find((item) => String(item.id) === String(nextId)) ?? null;
        setSchool(selected);
        return;
      }

      if (!user?.escola_id) {
        setSchool(null);
        setSelectedSchoolId(null);
        setSchools([]);
        return;
      }

      const { data, error: schoolError } = await supabase
        .from("escolas")
        .select("id, nome, cidade, created_at")
        .eq("id", user.escola_id)
        .maybeSingle();

      if (schoolError) throw schoolError;

      setSchool(data ?? null);
      setSelectedSchoolId(data?.id ? String(data.id) : null);
      setSchools(data ? [data] : []);
    } catch (loadError) {
      console.error("Erro carregando escolas:", loadError);
      setSchool(null);
      setSchools([]);
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isGlobalAdmin, loadSchools, user?.escola_id]);

  useEffect(() => {
    void loadSchool();
  }, [loadSchool]);

  const switchSchool = useCallback(async (requestedSchoolId) => {
    if (!canSwitchSchool) return false;

    const target = schools.find((item) => String(item.id) === String(requestedSchoolId));
    if (!target) return false;

    setSelectedSchoolId(String(target.id));
    setSchool(target);
    window.localStorage.setItem(SELECTED_SCHOOL_STORAGE_KEY, String(target.id));
    return true;
  }, [canSwitchSchool, schools]);

  const refreshSchool = useCallback(async () => {
    await loadSchool();
  }, [loadSchool]);

  const schoolId = resolveSchoolId({
    selectedSchoolId,
    schoolId: school?.id ?? user?.escola_id ?? null,
    isGlobalAdmin,
  });

  const scope = useMemo(() => ({
    schoolId,
    isGlobalAdmin,
    isSchoolBound,
    canSwitchSchool,
    requireSchoolId() {
      if (!schoolId && !isGlobalAdmin) {
        throw new Error("A conta não possui uma escola vinculada.");
      }
      return schoolId;
    },
    resolveSchoolId(requestedSchoolId = null) {
      return resolveSchoolId({
        selectedSchoolId: requestedSchoolId,
        schoolId,
        isGlobalAdmin,
      });
    },
  }), [canSwitchSchool, isGlobalAdmin, isSchoolBound, schoolId]);

  return (
    <SchoolContext.Provider
      value={{
        school,
        schools,
        selectedSchoolId,
        schoolId: scope.schoolId,
        isGlobalAdmin: scope.isGlobalAdmin,
        isSchoolBound: scope.isSchoolBound,
        canSwitchSchool: scope.canSwitchSchool,
        requireSchoolId: scope.requireSchoolId,
        resolveSchoolId: scope.resolveSchoolId,
        switchSchool,
        loading: authLoading || loading,
        error,
        refreshSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}
